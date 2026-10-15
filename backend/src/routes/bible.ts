import { Router } from 'express';
import { and, asc, count, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { BOOKS, bookBySlug, findBook } from '../data/books.js';
import { db } from '../db/client.js';
import { crossReferences, sectionParallels, sections, verses } from '../db/schema.js';
import { badRequest, notFound } from '../lib/errors.js';
import { parseReferences, pickRange } from '../lib/reference.js';
import { parse, paginationSchema } from '../middleware/validate.js';
import { describePassage, loadPassages } from '../services/passages.js';

export const bibleRouter = Router();

function resolveBook(slugOrName: string) {
  const book = bookBySlug.get(slugOrName) ?? findBook(slugOrName);
  if (!book) throw notFound(`Livre inconnu : ${slugOrName}`);
  return book;
}

const bookDto = (b: (typeof BOOKS)[number]) => ({
  id: b.id,
  slug: b.slug,
  name: b.name,
  abbreviation: b.abbreviation,
  testament: b.testament,
  chapterCount: b.chapterCount,
});

/** Liste des livres, avec indicateur de disponibilité du texte importé. */
bibleRouter.get('/books', async (req, res) => {
  const { testament } = parse(z.object({ testament: z.enum(['AT', 'NT']).optional() }), req.query);
  const counts = await db.select({ bookId: verses.bookId, n: count() }).from(verses).groupBy(verses.bookId);
  const available = new Map(counts.map((c) => [c.bookId, c.n]));
  res.json({
    books: BOOKS.filter((b) => !testament || b.testament === testament).map((b) => ({
      ...bookDto(b),
      verseCount: available.get(b.id) ?? 0,
    })),
  });
});

bibleRouter.get('/books/:book', async (req, res) => {
  const book = resolveBook(req.params.book);
  const chapters = await db
    .select({ chapter: verses.chapter, verseCount: count() })
    .from(verses)
    .where(eq(verses.bookId, book.id))
    .groupBy(verses.chapter)
    .orderBy(asc(verses.chapter));
  res.json({ book: { ...bookDto(book), chapters } });
});

/** Un chapitre complet, avec les titres de sections de la Segond 1910 et leurs parallèles. */
bibleRouter.get('/books/:book/chapters/:chapter', async (req, res) => {
  const book = resolveBook(req.params.book);
  const chapter = parse(z.coerce.number().int().min(1).max(book.chapterCount), req.params.chapter);
  const [rows, sectionRows] = await Promise.all([
    db
      .select({ verse: verses.verse, text: verses.text })
      .from(verses)
      .where(and(eq(verses.bookId, book.id), eq(verses.chapter, chapter)))
      .orderBy(asc(verses.verse)),
    db
      .select()
      .from(sections)
      .where(
        and(eq(sections.bookId, book.id), sql`${sections.chapterStart} <= ${chapter} AND ${sections.chapterEnd} >= ${chapter}`),
      )
      .orderBy(asc(sections.chapterStart), asc(sections.verseStart)),
  ]);
  if (!rows.length) throw notFound('Ce chapitre n’a pas encore été importé');
  res.json({
    book: bookDto(book),
    chapter,
    previous: chapter > 1 ? { book: book.slug, chapter: chapter - 1 } : null,
    next: chapter < book.chapterCount ? { book: book.slug, chapter: chapter + 1 } : null,
    sections: sectionRows.map((s) => ({ id: s.id, title: s.title, ...describePassage(pickRange(s)), parallels: s.parallelsRaw })),
    verses: rows,
  });
});

/** Texte d'une ou plusieurs références : /passages?ref=Ge 2:18-24; Mt 19:3-9 */
bibleRouter.get('/passages', async (req, res) => {
  const { ref } = parse(z.object({ ref: z.string().trim().min(2).max(300) }), req.query);
  const { ranges, errors } = parseReferences(ref);
  if (!ranges.length) throw badRequest(errors[0] ?? 'Référence invalide', errors);
  if (ranges.length > 20) throw badRequest('Maximum 20 références par requête');
  res.json({ passages: await loadPassages(ranges), errors });
});

/** Recherche plein texte (français, insensible aux formes : « pardonner » trouve « pardonnez »). */
bibleRouter.get('/search', async (req, res) => {
  const q = parse(
    paginationSchema.extend({
      q: z.string().trim().min(2).max(200),
      testament: z.enum(['AT', 'NT']).optional(),
      book: z.string().optional(),
    }),
    req.query,
  );
  const query = sql`websearch_to_tsquery('french', ${q.q})`;
  const doc = sql`to_tsvector('french', ${verses.text})`;
  const filters = [sql`${doc} @@ ${query}`];
  if (q.book) filters.push(eq(verses.bookId, resolveBook(q.book).id));
  if (q.testament) {
    const ids = BOOKS.filter((b) => b.testament === q.testament).map((b) => b.id);
    filters.push(sql`${verses.bookId} BETWEEN ${Math.min(...ids)} AND ${Math.max(...ids)}`);
  }
  const where = and(...filters);
  const [rows, [total]] = await Promise.all([
    db
      .select({
        bookId: verses.bookId,
        chapter: verses.chapter,
        verse: verses.verse,
        text: verses.text,
        rank: sql<number>`ts_rank(${doc}, ${query})`,
      })
      .from(verses)
      .where(where)
      .orderBy(desc(sql`ts_rank(${doc}, ${query})`), asc(verses.bookId), asc(verses.chapter), asc(verses.verse))
      .limit(q.limit)
      .offset(q.offset),
    db.select({ n: count() }).from(verses).where(where),
  ]);
  res.json({
    total: total?.n ?? 0,
    limit: q.limit,
    offset: q.offset,
    results: rows.map((r) => ({
      ...describePassage({ bookId: r.bookId, chapterStart: r.chapter, verseStart: r.verse, chapterEnd: r.chapter, verseEnd: r.verse }),
      text: r.text,
    })),
  });
});

/** Renvois et parallèles liés à un verset. */
bibleRouter.get('/books/:book/chapters/:chapter/verses/:verse/references', async (req, res) => {
  const book = resolveBook(req.params.book);
  const chapter = parse(z.coerce.number().int().min(1), req.params.chapter);
  const verse = parse(z.coerce.number().int().min(1), req.params.verse);

  const [xrefs, sectionRows] = await Promise.all([
    db
      .select()
      .from(crossReferences)
      .where(
        and(eq(crossReferences.fromBookId, book.id), eq(crossReferences.fromChapter, chapter), eq(crossReferences.fromVerse, verse)),
      ),
    db
      .select()
      .from(sections)
      .where(
        and(
          eq(sections.bookId, book.id),
          sql`(${sections.chapterStart}, ${sections.verseStart}) <= (${chapter}, ${verse})`,
          sql`((${sections.verseEnd} IS NULL AND ${sections.chapterEnd} >= ${chapter}) OR (${sections.chapterEnd}, ${sections.verseEnd}) >= (${chapter}, ${verse}))`,
        ),
      )
      .orderBy(desc(sections.chapterStart), desc(sections.verseStart))
      .limit(1),
  ]);
  const section = sectionRows[0];
  const parallels = section
    ? await db
        .select()
        .from(sectionParallels)
        .where(eq(sectionParallels.sectionId, section.id))
        .orderBy(asc(sectionParallels.position))
    : [];
  res.json({
    verse: describePassage({ bookId: book.id, chapterStart: chapter, verseStart: verse, chapterEnd: chapter, verseEnd: verse }),
    crossReferences: xrefs.map((x) => describePassage(pickRange(x))),
    section: section
      ? { id: section.id, title: section.title, ...describePassage(pickRange(section)), parallels: parallels.map((p) => describePassage(pickRange(p))) }
      : null,
  });
});


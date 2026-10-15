import { and, asc, eq, or, sql, type SQL } from 'drizzle-orm';
import { bookById } from '../data/books.js';
import type { DbOrTx } from '../db/client.js';
import { db } from '../db/client.js';
import { verses } from '../db/schema.js';
import { formatReference, pickRange, type PassageRange } from '../lib/reference.js';

export interface VerseDto {
  chapter: number;
  verse: number;
  text: string;
}

export interface PassageDto {
  reference: string;
  referenceFull: string;
  book: { id: number; slug: string; name: string; abbreviation: string };
  range: PassageRange;
  verses?: VerseDto[];
}

/** Condition SQL « ce verset appartient à la plage ». */
export function rangeCondition(r: PassageRange): SQL {
  return and(
    eq(verses.bookId, r.bookId),
    sql`(${verses.chapter}, ${verses.verse}) >= (${r.chapterStart}, ${r.verseStart})`,
    r.verseEnd === null
      ? sql`${verses.chapter} <= ${r.chapterEnd}`
      : sql`(${verses.chapter}, ${verses.verse}) <= (${r.chapterEnd}, ${r.verseEnd})`,
  )!;
}

const inRange = (r: PassageRange, v: { bookId: number; chapter: number; verse: number }) =>
  v.bookId === r.bookId &&
  (v.chapter > r.chapterStart || (v.chapter === r.chapterStart && v.verse >= r.verseStart)) &&
  (r.verseEnd === null ? v.chapter <= r.chapterEnd : v.chapter < r.chapterEnd || (v.chapter === r.chapterEnd && v.verse <= r.verseEnd));

/** Décrit une plage (référence lisible + livre), sans le texte. */
export function describePassage(range: PassageRange): PassageDto {
  const r = pickRange(range);
  const b = bookById.get(r.bookId)!;
  return {
    reference: formatReference(r),
    referenceFull: formatReference(r, 'full'),
    book: { id: b.id, slug: b.slug, name: b.name, abbreviation: b.abbreviation },
    range: r,
  };
}

/** Charge le texte de plusieurs plages en une seule requête. */
export async function loadPassages(ranges: PassageRange[], conn: DbOrTx = db): Promise<PassageDto[]> {
  if (!ranges.length) return [];
  const rows = await conn
    .select({ bookId: verses.bookId, chapter: verses.chapter, verse: verses.verse, text: verses.text })
    .from(verses)
    .where(or(...ranges.map(rangeCondition)))
    .orderBy(asc(verses.bookId), asc(verses.chapter), asc(verses.verse));

  return ranges.map((r) => ({
    ...describePassage(r),
    verses: rows.filter((v) => inRange(r, v)).map(({ chapter, verse, text }) => ({ chapter, verse, text })),
  }));
}

export async function loadPassage(range: PassageRange, conn: DbOrTx = db): Promise<PassageDto> {
  return (await loadPassages([range], conn))[0]!;
}

/** Vérifie que le premier verset d'une plage existe dans le texte importé. */
export async function rangeExists(range: PassageRange, conn: DbOrTx = db): Promise<boolean> {
  const [row] = await conn
    .select({ id: verses.id })
    .from(verses)
    .where(
      and(eq(verses.bookId, range.bookId), eq(verses.chapter, range.chapterStart), eq(verses.verse, range.verseStart)),
    )
    .limit(1);
  return Boolean(row);
}

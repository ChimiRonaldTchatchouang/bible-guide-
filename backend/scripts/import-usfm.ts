/**
 * Importe la Bible Louis Segond 1910 (format USFM) dans la base.
 *
 *   npm run bible:download            # récupère le texte (domaine public) dans data/lsg1910
 *   npm run bible:import              # importe toute la Bible
 *   npm run bible:import -- --testament AT
 *   npm run bible:import -- --books GEN,EXO --dir chemin/vers/usfm
 *
 * Ré-exécutable : les livres importés sont remplacés. Les groupes déjà créés sont conservés
 * (seul leur lien vers la section d'origine est perdu si la section est recréée).
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { inArray } from 'drizzle-orm';
import { db, pool } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrate.js';
import { crossReferences, sectionParallels, sections, verses } from '../src/db/schema.js';
import { formatReference, type PassageRange } from '../src/lib/reference.js';
import { parseUsfmBook, type ParsedBook } from '../src/lib/usfm.js';

const { values: args } = parseArgs({
  options: {
    dir: { type: 'string', default: 'data/lsg1910/p.sfm' },
    testament: { type: 'string' },
    books: { type: 'string' },
    verbose: { type: 'boolean', default: false },
  },
});

async function insertChunked<T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>, size = 1000) {
  for (let i = 0; i < rows.length; i += size) await insert(rows.slice(i, i + size));
}

async function main() {
  const dir = path.resolve(args.dir!);
  if (!fs.existsSync(dir)) {
    throw new Error(`Dossier introuvable : ${dir}\nLancez d'abord « npm run bible:download » ou passez --dir.`);
  }
  const wanted = args.books ? new Set(args.books.toUpperCase().split(',').map((s) => s.trim())) : null;

  const parsed: ParsedBook[] = [];
  for (const file of fs.readdirSync(dir).filter((f) => /\.(u?sfm|usfm)$/i.test(f)).sort()) {
    const book = parseUsfmBook(fs.readFileSync(path.join(dir, file), 'utf8'));
    if (!book) continue;
    if (wanted && !wanted.has(book.book.code)) continue;
    if (args.testament && book.book.testament !== args.testament.toUpperCase()) continue;
    parsed.push(book);
  }
  if (!parsed.length) throw new Error('Aucun livre USFM trouvé avec ces critères.');

  await runMigrations();

  // Ensemble des versets connus (base + import en cours) pour filtrer les parallèles invalides.
  const known = new Set<string>();
  for (const b of parsed) for (const v of b.verses) known.add(`${b.book.id}:${v.chapter}:${v.verse}`);
  const existing = await db.select({ b: verses.bookId, c: verses.chapter, v: verses.verse }).from(verses);
  for (const v of existing) known.add(`${v.b}:${v.c}:${v.v}`);
  const valid = (r: PassageRange) =>
    known.has(`${r.bookId}:${r.chapterStart}:${r.verseStart}`) &&
    (r.verseEnd === null || known.has(`${r.bookId}:${r.chapterEnd}:${r.verseEnd}`));

  const bookIds = parsed.map((b) => b.book.id);
  let dropped = 0;

  await db.transaction(async (tx) => {
    await tx.delete(crossReferences).where(inArray(crossReferences.fromBookId, bookIds));
    await tx.delete(sections).where(inArray(sections.bookId, bookIds));
    await tx.delete(verses).where(inArray(verses.bookId, bookIds));

    for (const b of parsed) {
      await insertChunked(
        b.verses.map((v) => ({ bookId: b.book.id, ...v })),
        (chunk) => tx.insert(verses).values(chunk),
      );

      for (const u of b.units) {
        const [row] = await tx
          .insert(sections)
          .values({ ...u.range, title: u.title, headingStart: u.headingStart, parallelsRaw: u.parallelsRaw })
          .returning({ id: sections.id });
        const parallels = u.parallels.filter((p) => valid(p) || (dropped++, false));
        if (parallels.length) {
          await tx.insert(sectionParallels).values(parallels.map((p, position) => ({ sectionId: row!.id, ...p, position })));
        }
      }

      const xrefs = b.crossReferences.filter((x) => valid(x.target) || (dropped++, false));
      await insertChunked(
        xrefs.map((x) => ({ fromBookId: b.book.id, fromChapter: x.chapter, fromVerse: x.verse, ...x.target })),
        (chunk) => tx.insert(crossReferences).values(chunk),
      );

      const withParallels = b.units.filter((u) => u.parallels.length).length;
      console.log(
        `  ${b.book.name.padEnd(22)} ${String(b.verses.length).padStart(5)} versets · ${String(b.units.length).padStart(4)} unités (${withParallels} avec parallèles) · ${xrefs.length} renvois`,
      );
      if (args.verbose) for (const w of b.warnings) console.warn(`    ⚠ ${w}`);
    }
  });

  const total = parsed.reduce((s, b) => s + b.verses.length, 0);
  console.log(`\n✔ ${parsed.length} livres, ${total} versets importés.`);
  if (dropped) console.log(`  (${dropped} références parallèles ignorées car hors du texte importé — normal si un seul Testament est importé)`);
  const sample = parsed[0]!.units.find((u) => u.parallels.length);
  if (sample) console.log(`  Exemple : ${sample.title ?? ''} ${formatReference(sample.range)} ↔ ${sample.parallels.map((p) => formatReference(p)).join(', ')}`);
}

main()
  .catch((err) => {
    console.error('✖', err.cause?.message ?? err.message?.slice(0, 500) ?? err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

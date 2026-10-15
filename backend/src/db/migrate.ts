import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './client.js';
import { BOOKS } from '../data/books.js';
import { books } from './schema.js';

const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../drizzle');

/** Applique les migrations puis (ré)insère la liste canonique des 66 livres. */
export async function runMigrations() {
  await migrate(db, { migrationsFolder });
  for (const b of BOOKS) {
    await db
      .insert(books)
      .values(b)
      .onConflictDoUpdate({
        target: books.id,
        set: { code: b.code, slug: b.slug, name: b.name, abbreviation: b.abbreviation, testament: b.testament, chapterCount: b.chapterCount },
      });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runMigrations()
    .then(() => console.log('✔ Migrations appliquées, livres à jour'))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

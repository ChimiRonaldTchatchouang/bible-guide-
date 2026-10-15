/**
 * Exporte le contenu publié (thèmes + groupes avec texte et parallèles) en JSON
 * pour la version hors ligne de l'application mobile.
 *
 *   npm run export:mobile    → ../mobile/src/data/content.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { asc, eq } from 'drizzle-orm';
import { db, pool } from '../src/db/client.js';
import { passageGroups, themes } from '../src/db/schema.js';
import { getGroupDetail } from '../src/services/groups.js';

const OUT = path.resolve(import.meta.dirname, '../../mobile/src/data/content.json');

const verses = (v: { chapter: number; verse: number; text: string }[] = []) =>
  v.map(({ chapter, verse, text }) => ({ c: chapter, v: verse, t: text }));

async function main() {
  const themeRows = await db.select().from(themes).where(eq(themes.published, true)).orderBy(asc(themes.position));
  const groupRows = await db
    .select({ id: passageGroups.id })
    .from(passageGroups)
    .where(eq(passageGroups.status, 'published'))
    .orderBy(asc(passageGroups.id));

  const groups = [];
  for (const { id } of groupRows) {
    const g = (await getGroupDetail(id, { withParallelText: true }))!;
    groups.push({
      slug: g.slug,
      title: g.title,
      reference: g.passage.referenceFull,
      contextStory: g.contextStory,
      teaching: g.teaching,
      themes: g.themes.map((t) => t.slug),
      verses: verses(g.passage.verses),
      parallels: g.parallels.map((p) => ({ reference: p.referenceFull, note: p.note, verses: verses(p.verses) })),
    });
  }

  const slugById = new Map(themeRows.map((t) => [t.id, t.slug]));
  const content = {
    version: 1,
    bible: 'Louis Segond 1910',
    generatedAt: new Date().toISOString(),
    themes: themeRows.map((t) => ({
      slug: t.slug,
      name: t.name,
      description: t.description,
      icon: t.icon,
      color: t.color,
      parent: t.parentId ? (slugById.get(t.parentId) ?? null) : null,
    })),
    groups,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(content));
  const kb = Math.round(fs.statSync(OUT).size / 1024);
  console.log(`✔ ${content.themes.length} thèmes, ${groups.length} groupes → ${path.relative(process.cwd(), OUT)} (${kb} Ko)`);
}

main()
  .catch((err) => {
    console.error('✖', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

import { Router } from 'express';
import { and, asc, count, eq, exists, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { groupThemes, passageGroups, themes, type Theme } from '../db/schema.js';
import { notFound } from '../lib/errors.js';
import { optionalAuth } from '../middleware/auth.js';
import { paginationSchema, parse } from '../middleware/validate.js';
import { getGroupDetail, getGroupSummaries } from '../services/groups.js';

export const contentRouter = Router();

const isEditor = (role?: string) => role === 'editor' || role === 'admin';

interface ThemeNode {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  position: number;
  groupCount: number;
  children: ThemeNode[];
}

const themeNode = (t: Theme, groupCount: number): ThemeNode => ({
  id: t.id,
  slug: t.slug,
  name: t.name,
  description: t.description,
  icon: t.icon,
  color: t.color,
  position: t.position,
  groupCount,
  children: [],
});

async function publishedGroupCounts() {
  const rows = await db
    .select({ themeId: groupThemes.themeId, n: count() })
    .from(groupThemes)
    .innerJoin(passageGroups, eq(passageGroups.id, groupThemes.groupId))
    .where(eq(passageGroups.status, 'published'))
    .groupBy(groupThemes.themeId);
  return new Map(rows.map((r) => [r.themeId, r.n]));
}

/** Arborescence des thèmes de vie (pardon, mariage, foi…) avec le nombre de groupes publiés. */
contentRouter.get('/themes', async (_req, res) => {
  const [rows, counts] = await Promise.all([
    db.select().from(themes).where(eq(themes.published, true)).orderBy(asc(themes.position), asc(themes.name)),
    publishedGroupCounts(),
  ]);
  const nodes = new Map(rows.map((t) => [t.id, themeNode(t, counts.get(t.id) ?? 0)]));
  const roots: ThemeNode[] = [];
  for (const t of rows) {
    const node = nodes.get(t.id)!;
    const parent = t.parentId ? nodes.get(t.parentId) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  res.json({ themes: roots });
});

contentRouter.get('/themes/:slug', async (req, res) => {
  const page = parse(paginationSchema, req.query);
  const [theme] = await db
    .select()
    .from(themes)
    .where(and(eq(themes.slug, req.params.slug), eq(themes.published, true)));
  if (!theme) throw notFound('Thème introuvable');

  const where = and(eq(groupThemes.themeId, theme.id), eq(passageGroups.status, 'published'));
  const [children, counts, ids, [total]] = await Promise.all([
    db
      .select()
      .from(themes)
      .where(and(eq(themes.parentId, theme.id), eq(themes.published, true)))
      .orderBy(asc(themes.position), asc(themes.name)),
    publishedGroupCounts(),
    db
      .select({ id: passageGroups.id })
      .from(groupThemes)
      .innerJoin(passageGroups, eq(passageGroups.id, groupThemes.groupId))
      .where(where)
      .orderBy(asc(groupThemes.position), asc(passageGroups.bookId), asc(passageGroups.chapterStart), asc(passageGroups.verseStart))
      .limit(page.limit)
      .offset(page.offset),
    db
      .select({ n: count() })
      .from(groupThemes)
      .innerJoin(passageGroups, eq(passageGroups.id, groupThemes.groupId))
      .where(where),
  ]);

  res.json({
    theme: { ...themeNode(theme, counts.get(theme.id) ?? 0), children: children.map((c) => themeNode(c, counts.get(c.id) ?? 0)) },
    groups: await getGroupSummaries(ids.map((r) => r.id)),
    total: total?.n ?? 0,
    limit: page.limit,
    offset: page.offset,
  });
});

/** Liste des groupes de passages, filtrable par thème et par mot-clé. */
contentRouter.get('/groups', async (req, res) => {
  const q = parse(
    paginationSchema.extend({ theme: z.string().optional(), q: z.string().trim().min(2).max(100).optional() }),
    req.query,
  );
  const filters = [eq(passageGroups.status, 'published')];
  if (q.theme) {
    filters.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(groupThemes)
          .innerJoin(themes, eq(themes.id, groupThemes.themeId))
          .where(and(eq(groupThemes.groupId, passageGroups.id), eq(themes.slug, q.theme))),
      ),
    );
  }
  if (q.q) {
    const like = `%${q.q.replace(/[%_\\]/g, '\\$&')}%`;
    filters.push(
      or(ilike(passageGroups.title, like), ilike(passageGroups.teaching, like), ilike(passageGroups.contextStory, like))!,
    );
  }
  const where = and(...filters);
  const [ids, [total]] = await Promise.all([
    db
      .select({ id: passageGroups.id })
      .from(passageGroups)
      .where(where)
      .orderBy(asc(passageGroups.bookId), asc(passageGroups.chapterStart), asc(passageGroups.verseStart))
      .limit(q.limit)
      .offset(q.offset),
    db.select({ n: count() }).from(passageGroups).where(where),
  ]);
  res.json({ groups: await getGroupSummaries(ids.map((r) => r.id)), total: total?.n ?? 0, limit: q.limit, offset: q.offset });
});

/** Fiche complète d'un groupe : passage + histoire contextuelle + enseignement + parallèles. */
contentRouter.get('/groups/:slug', optionalAuth, async (req, res) => {
  const { withParallelText } = parse(
    z.object({ withParallelText: z.enum(['true', 'false', '1', '0']).optional() }),
    req.query,
  );
  const group = await getGroupDetail(req.params.slug as string, {
    withParallelText: withParallelText === 'true' || withParallelText === '1',
  });
  if (!group || (group.status !== 'published' && !isEditor(req.user?.role))) throw notFound('Groupe introuvable');
  res.json({ group });
});

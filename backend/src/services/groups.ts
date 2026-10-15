import { asc, count, eq, inArray } from 'drizzle-orm';
import { db, type DbOrTx } from '../db/client.js';
import { groupParallels, groupThemes, passageGroups, themes, type PassageGroup } from '../db/schema.js';
import { pickRange } from '../lib/reference.js';
import { describePassage, loadPassages, type PassageDto } from './passages.js';

export interface ThemeRef {
  id: number;
  slug: string;
  name: string;
  color: string | null;
  icon: string | null;
}

export interface GroupSummary {
  id: number;
  slug: string;
  title: string;
  status: PassageGroup['status'];
  passage: PassageDto;
  teaching: string | null;
  themes: ThemeRef[];
  parallelCount: number;
}

export interface ParallelDto extends PassageDto {
  id: number;
  note: string | null;
  position: number;
}

export interface GroupDetail extends GroupSummary {
  contextStory: string | null;
  parallels: ParallelDto[];
  sourceSectionId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

async function themesByGroup(groupIds: number[], conn: DbOrTx) {
  const map = new Map<number, ThemeRef[]>();
  if (!groupIds.length) return map;
  const rows = await conn
    .select({
      groupId: groupThemes.groupId,
      id: themes.id,
      slug: themes.slug,
      name: themes.name,
      color: themes.color,
      icon: themes.icon,
    })
    .from(groupThemes)
    .innerJoin(themes, eq(themes.id, groupThemes.themeId))
    .where(inArray(groupThemes.groupId, groupIds))
    .orderBy(asc(themes.position), asc(themes.name));
  for (const { groupId, ...t } of rows) {
    if (!map.has(groupId)) map.set(groupId, []);
    map.get(groupId)!.push(t);
  }
  return map;
}

/** Résumés (sans texte) des groupes donnés, dans l'ordre des ids fournis. */
export async function getGroupSummaries(ids: number[], conn: DbOrTx = db): Promise<GroupSummary[]> {
  if (!ids.length) return [];
  const [rows, themeMap, parallelCounts] = await Promise.all([
    conn.select().from(passageGroups).where(inArray(passageGroups.id, ids)),
    themesByGroup(ids, conn),
    conn
      .select({ groupId: groupParallels.groupId, n: count() })
      .from(groupParallels)
      .where(inArray(groupParallels.groupId, ids))
      .groupBy(groupParallels.groupId),
  ]);
  const counts = new Map(parallelCounts.map((c) => [c.groupId, c.n]));
  const byId = new Map(rows.map((g) => [g.id, g]));
  return ids
    .map((id) => byId.get(id))
    .filter((g): g is PassageGroup => Boolean(g))
    .map((g) => ({
      id: g.id,
      slug: g.slug,
      title: g.title,
      status: g.status,
      passage: describePassage(pickRange(g)),
      teaching: g.teaching,
      themes: themeMap.get(g.id) ?? [],
      parallelCount: counts.get(g.id) ?? 0,
    }));
}

/**
 * Détail complet d'un groupe : passage principal avec son texte, histoire contextuelle,
 * enseignement, thèmes et passages parallèles (texte inclus si `withParallelText`).
 */
export async function getGroupDetail(
  idOrSlug: number | string,
  opts: { withParallelText?: boolean } = {},
  conn: DbOrTx = db,
): Promise<GroupDetail | null> {
  const [g] = await conn
    .select()
    .from(passageGroups)
    .where(typeof idOrSlug === 'number' ? eq(passageGroups.id, idOrSlug) : eq(passageGroups.slug, idOrSlug))
    .limit(1);
  if (!g) return null;

  const [themeMap, parallelRows] = await Promise.all([
    themesByGroup([g.id], conn),
    conn
      .select()
      .from(groupParallels)
      .where(eq(groupParallels.groupId, g.id))
      .orderBy(asc(groupParallels.position), asc(groupParallels.id)),
  ]);

  const toLoad = [pickRange(g), ...(opts.withParallelText ? parallelRows.map((p) => pickRange(p)) : [])];
  const loaded = await loadPassages(toLoad, conn);

  return {
    id: g.id,
    slug: g.slug,
    title: g.title,
    status: g.status,
    passage: loaded[0]!,
    teaching: g.teaching,
    contextStory: g.contextStory,
    themes: themeMap.get(g.id) ?? [],
    parallelCount: parallelRows.length,
    parallels: parallelRows.map((p, i) => ({
      ...(opts.withParallelText ? loaded[i + 1]! : describePassage(pickRange(p))),
      id: p.id,
      note: p.note,
      position: p.position,
    })),
    sourceSectionId: g.sourceSectionId,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
  };
}

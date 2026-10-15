import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { passageGroups, readingPlanDays, readingPlanItems, readingPlans, themes } from '../db/schema.js';
import { getGroupDetail, type GroupDetail } from './groups.js';

/* ─────────────────────────── Calcul du jour ─────────────────────────── */

/** Date du jour (AAAA-MM-JJ) dans un fuseau horaire donné. */
export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

const toUtcMidnight = (isoDate: string) => Date.parse(`${isoDate}T00:00:00Z`);

/** Jour du plan (1..totalDays) pour quelqu'un qui a commencé à `startDate`. Boucle après la fin. */
export function planDayFromStart(startDate: string, today: string, totalDays: number): number {
  const diff = Math.floor((toUtcMidnight(today) - toUtcMidnight(startDate)) / 86_400_000);
  if (diff < 0) return 1;
  return (diff % totalDays) + 1;
}

/** Jour du plan pour un visiteur non inscrit : le jour de l'année (31 déc. d'une année bissextile ⇒ dernier jour). */
export function planDayFromCalendar(today: string, totalDays: number): number {
  const year = today.slice(0, 4);
  const dayOfYear = Math.floor((toUtcMidnight(today) - toUtcMidnight(`${year}-01-01`)) / 86_400_000) + 1;
  return Math.min(dayOfYear, totalDays);
}

/* ─────────────────────────── Lecture d'un jour ─────────────────────────── */

export interface PlanDayDto {
  dayNumber: number;
  title: string | null;
  readings: Array<{ position: number; theme: { id: number; slug: string; name: string } | null; group: GroupDetail }>;
}

export async function getPlanDay(planId: number, dayNumber: number): Promise<PlanDayDto | null> {
  const [day] = await db
    .select()
    .from(readingPlanDays)
    .where(and(eq(readingPlanDays.planId, planId), eq(readingPlanDays.dayNumber, dayNumber)))
    .limit(1);
  if (!day) return null;

  const items = await db
    .select({
      groupId: readingPlanItems.groupId,
      position: readingPlanItems.position,
      themeId: themes.id,
      themeSlug: themes.slug,
      themeName: themes.name,
    })
    .from(readingPlanItems)
    .leftJoin(themes, eq(themes.id, readingPlanItems.themeId))
    .where(eq(readingPlanItems.dayId, day.id))
    .orderBy(asc(readingPlanItems.position));

  const groups = await Promise.all(items.map((i) => getGroupDetail(i.groupId)));
  return {
    dayNumber: day.dayNumber,
    title: day.title,
    readings: items.flatMap((i, idx) => {
      const group = groups[idx];
      if (!group || group.status !== 'published') return [];
      return [
        {
          position: i.position,
          theme: i.themeId ? { id: i.themeId, slug: i.themeSlug!, name: i.themeName! } : null,
          group,
        },
      ];
    }),
  };
}

/* ─────────────────────────── Génération du plan ─────────────────────────── */

export type PlanStrategy = 'by_theme' | 'rotate' | 'canonical';

interface Candidate {
  id: number;
  weight: number;
  themeId: number | null;
  themeName: string | null;
  themePosition: number;
  inThemePosition: number;
  bookId: number;
  chapter: number;
  verse: number;
}

/**
 * Répartit les groupes publiés sur les jours du plan.
 * Un groupe n'est jamais coupé : il est lu en entier le même jour, rattaché à son thème principal.
 * La charge de lecture (nombre de versets du passage principal) est équilibrée entre les jours.
 */
export async function generatePlan(planId: number, strategy: PlanStrategy = 'by_theme') {
  const [plan] = await db.select().from(readingPlans).where(eq(readingPlans.id, planId));
  if (!plan) throw new Error('Plan introuvable');

  const result = await db.execute<{
    id: number;
    weight: string;
    theme_id: number | null;
    theme_name: string | null;
    theme_position: number | null;
    in_theme_position: number | null;
    book_id: number;
    chapter_start: number;
    verse_start: number;
  }>(sql`
    SELECT g.id, g.book_id, g.chapter_start, g.verse_start,
           (SELECT count(*) FROM verses v
             WHERE v.book_id = g.book_id
               AND (v.chapter, v.verse) >= (g.chapter_start, g.verse_start)
               AND (CASE WHEN g.verse_end IS NULL THEN v.chapter <= g.chapter_end
                         ELSE (v.chapter, v.verse) <= (g.chapter_end, g.verse_end) END)) AS weight,
           pt.theme_id, pt.theme_name, pt.theme_position, pt.in_theme_position
      FROM passage_groups g
      LEFT JOIN LATERAL (
        SELECT t.id AS theme_id, t.name AS theme_name, t.position AS theme_position, gt.position AS in_theme_position
          FROM group_themes gt JOIN themes t ON t.id = gt.theme_id
         WHERE gt.group_id = g.id
         ORDER BY t.position, t.name
         LIMIT 1
      ) pt ON true
     WHERE g.status = 'published'
  `);

  const candidates: Candidate[] = result.rows.map((r) => ({
    id: r.id,
    weight: Math.max(1, Number(r.weight)),
    themeId: r.theme_id,
    themeName: r.theme_name,
    themePosition: r.theme_position ?? Number.MAX_SAFE_INTEGER,
    inThemePosition: r.in_theme_position ?? 0,
    bookId: r.book_id,
    chapter: r.chapter_start,
    verse: r.verse_start,
  }));

  const canonical = (a: Candidate, b: Candidate) => a.bookId - b.bookId || a.chapter - b.chapter || a.verse - b.verse;
  const byTheme = (a: Candidate, b: Candidate) =>
    a.themePosition - b.themePosition ||
    (a.themeId ?? 0) - (b.themeId ?? 0) ||
    a.inThemePosition - b.inThemePosition ||
    canonical(a, b);

  let ordered: Candidate[];
  if (strategy === 'canonical') ordered = [...candidates].sort(canonical);
  else if (strategy === 'by_theme') ordered = [...candidates].sort(byTheme);
  else {
    // Rotation : un groupe de chaque thème à tour de rôle pour varier les lectures.
    const queues = new Map<number | null, Candidate[]>();
    for (const c of [...candidates].sort(byTheme)) {
      if (!queues.has(c.themeId)) queues.set(c.themeId, []);
      queues.get(c.themeId)!.push(c);
    }
    ordered = [];
    const lists = [...queues.values()];
    while (lists.some((l) => l.length)) for (const l of lists) if (l.length) ordered.push(l.shift()!);
  }

  const days = partition(ordered, plan.totalDays);

  await db.transaction(async (tx) => {
    await tx.delete(readingPlanDays).where(eq(readingPlanDays.planId, planId));
    for (let i = 0; i < days.length; i++) {
      const dayGroups = days[i]!;
      const themeNames = [...new Set(dayGroups.map((g) => g.themeName).filter(Boolean))];
      const [day] = await tx
        .insert(readingPlanDays)
        .values({ planId, dayNumber: i + 1, title: themeNames.length ? themeNames.join(' · ') : null })
        .returning({ id: readingPlanDays.id });
      if (dayGroups.length) {
        await tx.insert(readingPlanItems).values(
          dayGroups.map((g, position) => ({ dayId: day!.id, groupId: g.id, themeId: g.themeId, position })),
        );
      }
    }
  });

  const filled = days.filter((d) => d.length).length;
  return {
    planId,
    strategy,
    totalDays: plan.totalDays,
    groups: candidates.length,
    filledDays: filled,
    emptyDays: plan.totalDays - filled,
    warning:
      candidates.length < plan.totalDays
        ? `Seulement ${candidates.length} groupes publiés pour ${plan.totalDays} jours : ${plan.totalDays - filled} jours restent vides.`
        : undefined,
  };
}

/** Découpe une suite ordonnée en `n` jours non vides (si possible) à charge équilibrée. */
export function partition<T extends { weight: number }>(items: T[], n: number): T[][] {
  const days: T[][] = Array.from({ length: n }, () => []);
  if (!items.length) return days;
  if (items.length <= n) {
    items.forEach((it, i) => days[i]!.push(it));
    return days;
  }
  const total = items.reduce((s, i) => s + i.weight, 0);
  let day = 0;
  let cumulative = 0;
  items.forEach((it, idx) => {
    const remainingItems = items.length - idx;
    const remainingDays = n - day;
    // Passer au jour suivant si la cible cumulée est atteinte, ou s'il faut garder au moins un groupe par jour restant.
    if (
      days[day]!.length > 0 &&
      day < n - 1 &&
      (cumulative >= (total * (day + 1)) / n || remainingItems <= remainingDays - 1)
    ) {
      day++;
    }
    days[day]!.push(it);
    cumulative += it.weight;
  });
  return days;
}

export async function getPlanBySlug(slug: string) {
  const [plan] = await db.select().from(readingPlans).where(eq(readingPlans.slug, slug)).limit(1);
  return plan ?? null;
}

/** Ids des groupes publiés (utile pour vérifier les entrées admin). */
export async function publishedGroupIds(ids: number[]) {
  if (!ids.length) return new Set<number>();
  const rows = await db
    .select({ id: passageGroups.id })
    .from(passageGroups)
    .where(and(inArray(passageGroups.id, ids), eq(passageGroups.status, 'published')));
  return new Set(rows.map((r) => r.id));
}

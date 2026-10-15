import { Router } from 'express';
import { and, asc, count, eq, ilike, inArray, isNotNull, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db, type Tx } from '../../db/client.js';
import {
  groupParallels,
  groupThemes,
  passageGroups,
  readingPlanDays,
  readingPlanItems,
  readingPlans,
  sectionParallels,
  sections,
  themes,
  users,
  verses,
} from '../../db/schema.js';
import { bookBySlug, findBook } from '../../data/books.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { formatReference, parseReference, parseReferences, pickRange, type PassageRange } from '../../lib/reference.js';
import { slugify } from '../../lib/slug.js';
import { requireRole } from '../../middleware/auth.js';
import { idParam, paginationSchema, parse, slugSchema } from '../../middleware/validate.js';
import { getGroupDetail, getGroupSummaries } from '../../services/groups.js';
import { describePassage, rangeExists } from '../../services/passages.js';
import { generatePlan } from '../../services/plans.js';
import { publicUser } from '../auth.js';

export const adminRouter = Router();
adminRouter.use(requireRole('editor'));

/* ─────────────────────────────── Thèmes ─────────────────────────────── */

const themeBody = z.object({
  name: z.string().trim().min(1).max(120),
  slug: slugSchema.optional(),
  description: z.string().max(5000).nullish(),
  icon: z.string().max(60).nullish(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/, 'Couleur au format #RRGGBB')
    .nullish(),
  parentId: z.number().int().positive().nullish(),
  position: z.number().int().optional(),
  published: z.boolean().optional(),
});

adminRouter.get('/themes', async (_req, res) => {
  const rows = await db.select().from(themes).orderBy(asc(themes.position), asc(themes.name));
  const counts = await db.select({ themeId: groupThemes.themeId, n: count() }).from(groupThemes).groupBy(groupThemes.themeId);
  const byTheme = new Map(counts.map((c) => [c.themeId, c.n]));
  res.json({ themes: rows.map((t) => ({ ...t, groupCount: byTheme.get(t.id) ?? 0 })) });
});

adminRouter.post('/themes', async (req, res) => {
  const body = parse(themeBody, req.body);
  const [theme] = await db
    .insert(themes)
    .values({ ...body, slug: body.slug ?? slugify(body.name) })
    .returning();
  res.status(201).json({ theme });
});

adminRouter.patch('/themes/:id', async (req, res) => {
  const id = parse(idParam, req.params.id);
  const body = parse(themeBody.partial(), req.body);
  if (body.parentId === id) throw badRequest('Un thème ne peut pas être son propre parent');
  const [theme] = await db.update(themes).set(body).where(eq(themes.id, id)).returning();
  if (!theme) throw notFound('Thème introuvable');
  res.json({ theme });
});

adminRouter.delete('/themes/:id', async (req, res) => {
  const id = parse(idParam, req.params.id);
  const [deleted] = await db.delete(themes).where(eq(themes.id, id)).returning({ id: themes.id });
  if (!deleted) throw notFound('Thème introuvable');
  res.status(204).end();
});

/* ─────────────────────────── Groupes de passages ─────────────────────────── */

const themeLink = z.union([
  z.number().int().positive(),
  z.string().min(1),
  z.object({ theme: z.union([z.number().int().positive(), z.string().min(1)]), position: z.number().int().optional() }),
]);

const parallelInput = z.union([
  z.string().min(2),
  z.object({ reference: z.string().min(2), note: z.string().max(2000).nullish() }),
]);

const groupBody = z.object({
  title: z.string().trim().min(1).max(200),
  slug: slugSchema.optional(),
  reference: z.string().trim().min(2).max(60),
  contextStory: z.string().max(20_000).nullish(),
  teaching: z.string().max(20_000).nullish(),
  status: z.enum(['draft', 'published']).optional(),
  themes: z.array(themeLink).max(20).optional(),
  /** Liste de parallèles, ou chaîne « Mt 19:3-9; Ép 5:22-33 ». Remplace les parallèles existants. */
  parallels: z.union([z.array(parallelInput).max(100), z.string().max(2000)]).optional(),
  sourceSectionId: z.number().int().positive().nullish(),
});

function toRange(reference: string): PassageRange {
  try {
    return parseReference(reference);
  } catch (e) {
    throw badRequest((e as Error).message);
  }
}

async function ensureTextExists(range: PassageRange, conn: Tx) {
  if (!(await rangeExists(range, conn))) {
    throw badRequest(`Le texte de ${formatReference(range)} n’est pas dans la base (import de la Bible fait ?)`);
  }
}

function normalizeParallels(input: NonNullable<z.infer<typeof groupBody>['parallels']>) {
  if (typeof input === 'string') {
    const { ranges, errors } = parseReferences(input);
    if (errors.length) throw badRequest('Parallèles invalides', errors);
    return ranges.map((r) => ({ range: r, note: null as string | null }));
  }
  return input.map((p) => {
    const ref = typeof p === 'string' ? p : p.reference;
    return { range: toRange(ref), note: typeof p === 'string' ? null : (p.note ?? null) };
  });
}

async function resolveThemeIds(links: z.infer<typeof themeLink>[], conn: Tx) {
  const items = links.map((l, i) =>
    typeof l === 'object' ? { key: l.theme, position: l.position ?? i } : { key: l, position: i },
  );
  const ids = items.filter((i) => typeof i.key === 'number').map((i) => i.key as number);
  const slugs = items.filter((i) => typeof i.key === 'string').map((i) => i.key as string);
  const conds: SQL[] = [];
  if (ids.length) conds.push(inArray(themes.id, ids));
  if (slugs.length) conds.push(inArray(themes.slug, slugs));
  const found = conds.length ? await conn.select({ id: themes.id, slug: themes.slug }).from(themes).where(or(...conds)) : [];
  return items.map((i) => {
    const t = found.find((f) => f.id === i.key || f.slug === i.key);
    if (!t) throw badRequest(`Thème inconnu : ${i.key}`);
    return { themeId: t.id, position: i.position };
  });
}

async function writeGroupRelations(tx: Tx, groupId: number, body: Partial<z.infer<typeof groupBody>>) {
  if (body.themes) {
    const links = await resolveThemeIds(body.themes, tx);
    await tx.delete(groupThemes).where(eq(groupThemes.groupId, groupId));
    if (links.length) await tx.insert(groupThemes).values(links.map((l) => ({ groupId, ...l })));
  }
  if (body.parallels !== undefined) {
    const parallels = normalizeParallels(body.parallels);
    await tx.delete(groupParallels).where(eq(groupParallels.groupId, groupId));
    if (parallels.length) {
      await tx
        .insert(groupParallels)
        .values(parallels.map((p, position) => ({ groupId, ...p.range, note: p.note, position })));
    }
  }
}

async function uniqueGroupSlug(base: string, conn: Tx) {
  const root = slugify(base, 110) || 'groupe';
  const taken = await conn
    .select({ slug: passageGroups.slug })
    .from(passageGroups)
    .where(or(eq(passageGroups.slug, root), ilike(passageGroups.slug, `${root}-%`)));
  const set = new Set(taken.map((t) => t.slug));
  if (!set.has(root)) return root;
  let i = 2;
  while (set.has(`${root}-${i}`)) i++;
  return `${root}-${i}`;
}

adminRouter.get('/groups', async (req, res) => {
  const q = parse(
    paginationSchema.extend({
      status: z.enum(['draft', 'published']).optional(),
      theme: z.string().optional(),
      q: z.string().trim().min(2).optional(),
      unthemed: z.enum(['true', 'false']).optional(),
    }),
    req.query,
  );
  const filters: SQL[] = [];
  if (q.status) filters.push(eq(passageGroups.status, q.status));
  if (q.q) filters.push(ilike(passageGroups.title, `%${q.q}%`));
  if (q.theme) {
    filters.push(
      sql`EXISTS (SELECT 1 FROM ${groupThemes} JOIN ${themes} ON ${themes.id} = ${groupThemes.themeId}
                  WHERE ${groupThemes.groupId} = ${passageGroups.id} AND ${themes.slug} = ${q.theme})`,
    );
  }
  if (q.unthemed === 'true') {
    filters.push(sql`NOT EXISTS (SELECT 1 FROM ${groupThemes} WHERE ${groupThemes.groupId} = ${passageGroups.id})`);
  }
  const where = filters.length ? and(...filters) : undefined;
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

adminRouter.get('/groups/:id', async (req, res) => {
  const group = await getGroupDetail(parse(idParam, req.params.id), { withParallelText: true });
  if (!group) throw notFound('Groupe introuvable');
  res.json({ group });
});

adminRouter.post('/groups', async (req, res) => {
  const body = parse(groupBody, req.body);
  const range = toRange(body.reference);
  const id = await db.transaction(async (tx) => {
    await ensureTextExists(range, tx);
    const [g] = await tx
      .insert(passageGroups)
      .values({
        ...range,
        title: body.title,
        slug: body.slug ?? (await uniqueGroupSlug(body.title, tx)),
        contextStory: body.contextStory ?? null,
        teaching: body.teaching ?? null,
        status: body.status ?? 'draft',
        sourceSectionId: body.sourceSectionId ?? null,
      })
      .returning({ id: passageGroups.id });
    await writeGroupRelations(tx, g!.id, body);
    return g!.id;
  });
  res.status(201).json({ group: await getGroupDetail(id, { withParallelText: true }) });
});

adminRouter.patch('/groups/:id', async (req, res) => {
  const id = parse(idParam, req.params.id);
  const body = parse(groupBody.partial(), req.body);
  await db.transaction(async (tx) => {
    const patch: Partial<typeof passageGroups.$inferInsert> = {};
    if (body.reference) {
      const range = toRange(body.reference);
      await ensureTextExists(range, tx);
      Object.assign(patch, range);
    }
    for (const k of ['title', 'slug', 'contextStory', 'teaching', 'status', 'sourceSectionId'] as const) {
      if (body[k] !== undefined) (patch as Record<string, unknown>)[k] = body[k];
    }
    const [g] = Object.keys(patch).length
      ? await tx.update(passageGroups).set(patch).where(eq(passageGroups.id, id)).returning({ id: passageGroups.id })
      : await tx.select({ id: passageGroups.id }).from(passageGroups).where(eq(passageGroups.id, id));
    if (!g) throw notFound('Groupe introuvable');
    await writeGroupRelations(tx, id, body);
  });
  res.json({ group: await getGroupDetail(id, { withParallelText: true }) });
});

adminRouter.delete('/groups/:id', async (req, res) => {
  const id = parse(idParam, req.params.id);
  const [deleted] = await db.delete(passageGroups).where(eq(passageGroups.id, id)).returning({ id: passageGroups.id });
  if (!deleted) throw notFound('Groupe introuvable');
  res.status(204).end();
});

/* ──────────────── Sections Segond 1910 → brouillons de groupes ──────────────── */

adminRouter.get('/sections', async (req, res) => {
  const q = parse(
    paginationSchema.extend({
      book: z.string().optional(),
      chapter: z.coerce.number().int().positive().optional(),
      q: z.string().trim().min(2).optional(),
      withParallels: z.enum(['true', 'false']).optional(),
    }),
    req.query,
  );
  const filters: SQL[] = [];
  if (q.book) {
    const book = bookBySlug.get(q.book) ?? findBook(q.book);
    if (!book) throw badRequest(`Livre inconnu : ${q.book}`);
    filters.push(eq(sections.bookId, book.id));
  }
  if (q.chapter) filters.push(sql`${sections.chapterStart} <= ${q.chapter} AND ${sections.chapterEnd} >= ${q.chapter}`);
  if (q.q) filters.push(ilike(sections.title, `%${q.q}%`));
  if (q.withParallels === 'true') filters.push(isNotNull(sections.parallelsRaw));
  const where = filters.length ? and(...filters) : undefined;

  const [rows, [total]] = await Promise.all([
    db
      .select({
        section: sections,
        usedBy: sql<number[] | null>`(SELECT array_agg(g.id) FROM ${passageGroups} g WHERE g.source_section_id = ${sections.id})`,
      })
      .from(sections)
      .where(where)
      .orderBy(asc(sections.bookId), asc(sections.chapterStart), asc(sections.verseStart))
      .limit(q.limit)
      .offset(q.offset),
    db.select({ n: count() }).from(sections).where(where),
  ]);
  const ids = rows.map((r) => r.section.id);
  const parallels = ids.length
    ? await db.select().from(sectionParallels).where(inArray(sectionParallels.sectionId, ids)).orderBy(asc(sectionParallels.position))
    : [];
  res.json({
    total: total?.n ?? 0,
    limit: q.limit,
    offset: q.offset,
    sections: rows.map(({ section: s, usedBy }) => ({
      id: s.id,
      title: s.title,
      ...describePassage(pickRange(s)),
      parallelsRaw: s.parallelsRaw,
      parallels: parallels.filter((p) => p.sectionId === s.id).map((p) => describePassage(pickRange(p)).reference),
      usedByGroupIds: usedBy ?? [],
    })),
  });
});

/** Crée un brouillon de groupe à partir d'une section (titre + passage + parallèles de la Segond 1910). */
adminRouter.post('/sections/:id/group', async (req, res) => {
  const sectionId = parse(idParam, req.params.id);
  const body = parse(z.object({ themes: z.array(themeLink).optional(), title: z.string().max(200).optional() }), req.body ?? {});
  const [section] = await db.select().from(sections).where(eq(sections.id, sectionId));
  if (!section) throw notFound('Section introuvable');
  const parallels = await db
    .select()
    .from(sectionParallels)
    .where(eq(sectionParallels.sectionId, sectionId))
    .orderBy(asc(sectionParallels.position));

  const id = await db.transaction(async (tx) => {
    const title = body.title ?? section.title ?? describePassage(pickRange(section)).referenceFull;
    const [g] = await tx
      .insert(passageGroups)
      .values({ ...pickRange(section), title, slug: await uniqueGroupSlug(title, tx), status: 'draft', sourceSectionId: section.id })
      .returning({ id: passageGroups.id });
    if (parallels.length) {
      await tx
        .insert(groupParallels)
        .values(parallels.map((p, position) => ({ groupId: g!.id, ...pickRange(p), position })));
    }
    if (body.themes) await writeGroupRelations(tx, g!.id, { themes: body.themes });
    return g!.id;
  });
  res.status(201).json({ group: await getGroupDetail(id, { withParallelText: true }) });
});

/* ─────────────────────────── Plans de lecture ─────────────────────────── */

const planBody = z.object({
  name: z.string().trim().min(1).max(150),
  slug: slugSchema.optional(),
  description: z.string().max(5000).nullish(),
  totalDays: z.number().int().min(1).max(1000).optional(),
  published: z.boolean().optional(),
});

adminRouter.get('/plans', async (_req, res) => {
  const rows = await db
    .select({
      plan: readingPlans,
      filledDays: sql<number>`(SELECT count(DISTINCT d.id)::int FROM ${readingPlanDays} d JOIN ${readingPlanItems} i ON i.day_id = d.id WHERE d.plan_id = ${readingPlans.id})`,
    })
    .from(readingPlans)
    .orderBy(asc(readingPlans.id));
  res.json({ plans: rows.map((r) => ({ ...r.plan, filledDays: r.filledDays })) });
});

adminRouter.post('/plans', async (req, res) => {
  const body = parse(planBody, req.body);
  const [plan] = await db.insert(readingPlans).values({ ...body, slug: body.slug ?? slugify(body.name, 80) }).returning();
  res.status(201).json({ plan });
});

adminRouter.patch('/plans/:id', async (req, res) => {
  const id = parse(idParam, req.params.id);
  const [plan] = await db.update(readingPlans).set(parse(planBody.partial(), req.body)).where(eq(readingPlans.id, id)).returning();
  if (!plan) throw notFound('Plan introuvable');
  res.json({ plan });
});

adminRouter.delete('/plans/:id', async (req, res) => {
  const id = parse(idParam, req.params.id);
  const [deleted] = await db.delete(readingPlans).where(eq(readingPlans.id, id)).returning({ id: readingPlans.id });
  if (!deleted) throw notFound('Plan introuvable');
  res.status(204).end();
});

/** (Re)génère la répartition des groupes publiés sur les jours du plan. Écrase la répartition existante. */
adminRouter.post('/plans/:id/generate', async (req, res) => {
  const id = parse(idParam, req.params.id);
  const { strategy } = parse(z.object({ strategy: z.enum(['by_theme', 'rotate', 'canonical']).default('by_theme') }), req.body ?? {});
  const [plan] = await db.select({ id: readingPlans.id }).from(readingPlans).where(eq(readingPlans.id, id));
  if (!plan) throw notFound('Plan introuvable');
  res.json({ result: await generatePlan(id, strategy) });
});

/** Ajustement manuel d'un jour : titre et liste ordonnée de groupes (ids ou slugs). */
adminRouter.put('/plans/:id/days/:day', async (req, res) => {
  const planId = parse(idParam, req.params.id);
  const [plan] = await db.select().from(readingPlans).where(eq(readingPlans.id, planId));
  if (!plan) throw notFound('Plan introuvable');
  const dayNumber = parse(z.coerce.number().int().min(1).max(plan.totalDays), req.params.day);
  const body = parse(
    z.object({
      title: z.string().max(200).nullish(),
      groups: z.array(z.union([z.number().int().positive(), z.string().min(1)])).max(20),
    }),
    req.body,
  );
  const numeric = body.groups.filter((g): g is number => typeof g === 'number');
  const slugs = body.groups.filter((g): g is string => typeof g === 'string');
  const conds: SQL[] = [];
  if (numeric.length) conds.push(inArray(passageGroups.id, numeric));
  if (slugs.length) conds.push(inArray(passageGroups.slug, slugs));
  const found = conds.length
    ? await db.select({ id: passageGroups.id, slug: passageGroups.slug }).from(passageGroups).where(or(...conds))
    : [];
  const groupIds = body.groups.map((g) => {
    const hit = found.find((f) => f.id === g || f.slug === g);
    if (!hit) throw badRequest(`Groupe inconnu : ${g}`);
    return hit.id;
  });
  const primaryThemes = groupIds.length
    ? await db
        .select({ groupId: groupThemes.groupId, themeId: groupThemes.themeId, pos: themes.position })
        .from(groupThemes)
        .innerJoin(themes, eq(themes.id, groupThemes.themeId))
        .where(inArray(groupThemes.groupId, groupIds))
        .orderBy(asc(themes.position))
    : [];

  await db.transaction(async (tx) => {
    const [day] = await tx
      .insert(readingPlanDays)
      .values({ planId, dayNumber, title: body.title ?? null })
      .onConflictDoUpdate({
        target: [readingPlanDays.planId, readingPlanDays.dayNumber],
        set: { title: body.title ?? null },
      })
      .returning({ id: readingPlanDays.id });
    await tx.delete(readingPlanItems).where(eq(readingPlanItems.dayId, day!.id));
    if (groupIds.length) {
      await tx.insert(readingPlanItems).values(
        [...new Set(groupIds)].map((groupId, position) => ({
          dayId: day!.id,
          groupId,
          position,
          themeId: primaryThemes.find((t) => t.groupId === groupId)?.themeId ?? null,
        })),
      );
    }
  });
  res.json({ ok: true, planId, dayNumber, groupIds: [...new Set(groupIds)] });
});

/* ───────────────────────── Utilisateurs (admin) ───────────────────────── */

adminRouter.get('/users', requireRole('admin'), async (req, res) => {
  const q = parse(paginationSchema.extend({ q: z.string().trim().min(2).optional() }), req.query);
  const where = q.q ? or(ilike(users.email, `%${q.q}%`), ilike(users.displayName, `%${q.q}%`)) : undefined;
  const [rows, [total]] = await Promise.all([
    db.select().from(users).where(where).orderBy(asc(users.createdAt)).limit(q.limit).offset(q.offset),
    db.select({ n: count() }).from(users).where(where),
  ]);
  res.json({ users: rows.map(publicUser), total: total?.n ?? 0 });
});

adminRouter.patch('/users/:id', requireRole('admin'), async (req, res) => {
  const id = parse(z.uuid(), req.params.id);
  const { role } = parse(z.object({ role: z.enum(['user', 'editor', 'admin']) }), req.body);
  const [user] = await db.update(users).set({ role }).where(eq(users.id, id)).returning();
  if (!user) throw notFound('Utilisateur introuvable');
  res.json({ user: publicUser(user) });
});

/* ─────────────────────────────── Statistiques ─────────────────────────────── */

adminRouter.get('/stats', async (_req, res) => {
  const one = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;
  const [verseCount, sectionCount, themeCount, published, drafts, userCount] = await Promise.all([
    one(db.select({ n: count() }).from(verses)),
    one(db.select({ n: count() }).from(sections)),
    one(db.select({ n: count() }).from(themes)),
    one(db.select({ n: count() }).from(passageGroups).where(eq(passageGroups.status, 'published'))),
    one(db.select({ n: count() }).from(passageGroups).where(eq(passageGroups.status, 'draft'))),
    one(db.select({ n: count() }).from(users)),
  ]);
  const withoutStory = await one(
    db
      .select({ n: count() })
      .from(passageGroups)
      .where(and(eq(passageGroups.status, 'published'), sql`coalesce(${passageGroups.contextStory}, '') = ''`)),
  );
  res.json({
    verses: verseCount,
    sections: sectionCount,
    themes: themeCount,
    groups: { published, drafts, publishedWithoutContextStory: withoutStory },
    users: userCount,
  });
});

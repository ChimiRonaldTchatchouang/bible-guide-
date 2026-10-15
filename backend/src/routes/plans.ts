import { Router } from 'express';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { env } from '../config/env.js';
import { db } from '../db/client.js';
import { planEnrollments, readingPlanDays, readingPlanItems, readingPlans, passageGroups } from '../db/schema.js';
import { notFound } from '../lib/errors.js';
import { pickRange } from '../lib/reference.js';
import { optionalAuth } from '../middleware/auth.js';
import { parse } from '../middleware/validate.js';
import { describePassage } from '../services/passages.js';
import { getPlanBySlug, getPlanDay, planDayFromCalendar, planDayFromStart, todayIn } from '../services/plans.js';

export const plansRouter = Router();

async function publishedPlan(slug: string) {
  const plan = await getPlanBySlug(slug);
  if (!plan || !plan.published) throw notFound('Plan de lecture introuvable');
  return plan;
}

const planDto = (p: typeof readingPlans.$inferSelect) => ({
  id: p.id,
  slug: p.slug,
  name: p.name,
  description: p.description,
  totalDays: p.totalDays,
});

plansRouter.get('/plans', async (_req, res) => {
  const rows = await db.select().from(readingPlans).where(eq(readingPlans.published, true)).orderBy(asc(readingPlans.id));
  res.json({ plans: rows.map(planDto) });
});

/** Vue d'ensemble du plan : chaque jour avec son titre et les références à lire (sans texte). */
plansRouter.get('/plans/:slug', async (req, res) => {
  const plan = await publishedPlan(req.params.slug as string);
  const rows = await db
    .select({
      dayNumber: readingPlanDays.dayNumber,
      title: readingPlanDays.title,
      groupSlug: passageGroups.slug,
      groupTitle: passageGroups.title,
      status: passageGroups.status,
      bookId: passageGroups.bookId,
      chapterStart: passageGroups.chapterStart,
      verseStart: passageGroups.verseStart,
      chapterEnd: passageGroups.chapterEnd,
      verseEnd: passageGroups.verseEnd,
    })
    .from(readingPlanDays)
    .leftJoin(readingPlanItems, eq(readingPlanItems.dayId, readingPlanDays.id))
    .leftJoin(passageGroups, eq(passageGroups.id, readingPlanItems.groupId))
    .where(eq(readingPlanDays.planId, plan.id))
    .orderBy(asc(readingPlanDays.dayNumber), asc(readingPlanItems.position));

  const days = new Map<number, { dayNumber: number; title: string | null; readings: Array<{ slug: string; title: string; reference: string }> }>();
  for (const r of rows) {
    if (!days.has(r.dayNumber)) days.set(r.dayNumber, { dayNumber: r.dayNumber, title: r.title, readings: [] });
    if (r.groupSlug && r.status === 'published') {
      days.get(r.dayNumber)!.readings.push({
        slug: r.groupSlug,
        title: r.groupTitle!,
        reference: describePassage(pickRange(r as Parameters<typeof pickRange>[0])).reference,
      });
    }
  }
  res.json({ plan: planDto(plan), days: [...days.values()] });
});

/**
 * Lecture du jour. Connecté et inscrit au plan ⇒ jour calculé depuis sa date de début.
 * Sinon ⇒ jour de l'année (1er janvier = jour 1).
 */
plansRouter.get('/plans/:slug/today', optionalAuth, async (req, res) => {
  const plan = await publishedPlan(req.params.slug as string);
  const { date } = parse(z.object({ date: z.iso.date().optional() }), req.query);
  const today = date ?? todayIn(env.APP_TIMEZONE);

  let dayNumber = planDayFromCalendar(today, plan.totalDays);
  let source: 'calendar' | 'enrollment' = 'calendar';
  if (req.user) {
    const [enrollment] = await db
      .select()
      .from(planEnrollments)
      .where(and(eq(planEnrollments.userId, req.user.sub), eq(planEnrollments.planId, plan.id)));
    if (enrollment) {
      dayNumber = planDayFromStart(enrollment.startDate, today, plan.totalDays);
      source = 'enrollment';
    }
  }
  const day = await getPlanDay(plan.id, dayNumber);
  res.json({ plan: planDto(plan), date: today, source, day: day ?? { dayNumber, title: null, readings: [] } });
});

plansRouter.get('/plans/:slug/days/:day', async (req, res) => {
  const plan = await publishedPlan(req.params.slug as string);
  const dayNumber = parse(z.coerce.number().int().min(1).max(plan.totalDays), req.params.day);
  const day = await getPlanDay(plan.id, dayNumber);
  if (!day) throw notFound('Ce jour n’a pas encore de lecture');
  res.json({ plan: planDto(plan), day });
});

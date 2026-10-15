import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/*
 * Convention des plages de versets (passage) utilisée partout :
 *   bookId + chapterStart:verseStart → chapterEnd:verseEnd
 *   verseEnd = NULL  ⇒ jusqu'à la fin du chapitre chapterEnd (ex. « Ps 23 »).
 */
const range = () => ({
  bookId: smallint('book_id').notNull().references(() => books.id),
  chapterStart: smallint('chapter_start').notNull(),
  verseStart: smallint('verse_start').notNull().default(1),
  chapterEnd: smallint('chapter_end').notNull(),
  verseEnd: smallint('verse_end'),
});

const timestamps = () => ({
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const testamentEnum = pgEnum('testament', ['AT', 'NT']);
export const roleEnum = pgEnum('user_role', ['user', 'editor', 'admin']);
export const groupStatusEnum = pgEnum('group_status', ['draft', 'published']);

/* ───────────────────────────── Texte biblique ───────────────────────────── */

export const books = pgTable('books', {
  id: smallint('id').primaryKey(), // ordre canonique 1..66
  code: varchar('code', { length: 3 }).notNull().unique(), // code USFM : GEN, EXO…
  slug: varchar('slug', { length: 40 }).notNull().unique(),
  name: varchar('name', { length: 80 }).notNull(),
  abbreviation: varchar('abbreviation', { length: 10 }).notNull(),
  testament: testamentEnum('testament').notNull(),
  chapterCount: smallint('chapter_count').notNull(),
});

export const verses = pgTable(
  'verses',
  {
    id: serial('id').primaryKey(),
    bookId: smallint('book_id').notNull().references(() => books.id),
    chapter: smallint('chapter').notNull(),
    verse: smallint('verse').notNull(),
    text: text('text').notNull(),
  },
  (t) => [
    uniqueIndex('verses_ref_uq').on(t.bookId, t.chapter, t.verse),
    index('verses_fts_idx').using('gin', sql`to_tsvector('french', ${t.text})`),
  ],
);

/**
 * Unités de lecture (péricopes) de la Segond 1910 à parallèles.
 * Un titre de section peut couvrir plusieurs unités, chacune avec ses propres passages parallèles
 * (« V. 4-7 », « V. 8-17 »…). `headingStart` = première unité sous ce titre (pour l'affichage).
 */
export const sections = pgTable(
  'sections',
  {
    id: serial('id').primaryKey(),
    ...range(),
    title: text('title'),
    headingStart: boolean('heading_start').notNull().default(false),
    parallelsRaw: text('parallels_raw'),
  },
  (t) => [index('sections_book_idx').on(t.bookId, t.chapterStart, t.verseStart)],
);

export const sectionParallels = pgTable(
  'section_parallels',
  {
    id: serial('id').primaryKey(),
    sectionId: integer('section_id').notNull().references(() => sections.id, { onDelete: 'cascade' }),
    ...range(),
    position: smallint('position').notNull().default(0),
  },
  (t) => [index('section_parallels_section_idx').on(t.sectionId)],
);

/** Renvois verset → passage (notes \x de la Segond 1910). */
export const crossReferences = pgTable(
  'cross_references',
  {
    id: serial('id').primaryKey(),
    fromBookId: smallint('from_book_id').notNull().references(() => books.id),
    fromChapter: smallint('from_chapter').notNull(),
    fromVerse: smallint('from_verse').notNull(),
    ...range(),
  },
  (t) => [index('cross_refs_from_idx').on(t.fromBookId, t.fromChapter, t.fromVerse)],
);

/* ──────────────────────── Contenu éditorial (thèmes) ──────────────────────── */

export const themes = pgTable(
  'themes',
  {
    id: serial('id').primaryKey(),
    slug: varchar('slug', { length: 80 }).notNull().unique(),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    icon: varchar('icon', { length: 60 }),
    color: varchar('color', { length: 9 }),
    parentId: integer('parent_id').references((): any => themes.id, { onDelete: 'set null' }),
    position: integer('position').notNull().default(0),
    published: boolean('published').notNull().default(true),
    ...timestamps(),
  },
  (t) => [index('themes_parent_idx').on(t.parentId)],
);

/**
 * Groupe de passages : un passage principal affiché, son histoire contextuelle,
 * son enseignement, et les références des passages qui disent la même chose.
 */
export const passageGroups = pgTable(
  'passage_groups',
  {
    id: serial('id').primaryKey(),
    slug: varchar('slug', { length: 120 }).notNull().unique(),
    title: varchar('title', { length: 200 }).notNull(),
    ...range(),
    contextStory: text('context_story'),
    teaching: text('teaching'),
    sourceSectionId: integer('source_section_id').references(() => sections.id, { onDelete: 'set null' }),
    status: groupStatusEnum('status').notNull().default('draft'),
    ...timestamps(),
  },
  (t) => [index('groups_status_idx').on(t.status)],
);

export const groupParallels = pgTable(
  'group_parallels',
  {
    id: serial('id').primaryKey(),
    groupId: integer('group_id').notNull().references(() => passageGroups.id, { onDelete: 'cascade' }),
    ...range(),
    note: text('note'),
    position: smallint('position').notNull().default(0),
  },
  (t) => [index('group_parallels_group_idx').on(t.groupId)],
);

export const groupThemes = pgTable(
  'group_themes',
  {
    groupId: integer('group_id').notNull().references(() => passageGroups.id, { onDelete: 'cascade' }),
    themeId: integer('theme_id').notNull().references(() => themes.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.themeId] }), index('group_themes_theme_idx').on(t.themeId)],
);

/* ─────────────────────────── Plans de lecture ─────────────────────────── */

export const readingPlans = pgTable('reading_plans', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 80 }).notNull().unique(),
  name: varchar('name', { length: 150 }).notNull(),
  description: text('description'),
  totalDays: smallint('total_days').notNull().default(365),
  published: boolean('published').notNull().default(true),
  ...timestamps(),
});

export const readingPlanDays = pgTable(
  'reading_plan_days',
  {
    id: serial('id').primaryKey(),
    planId: integer('plan_id').notNull().references(() => readingPlans.id, { onDelete: 'cascade' }),
    dayNumber: smallint('day_number').notNull(),
    title: varchar('title', { length: 200 }),
  },
  (t) => [uniqueIndex('plan_day_uq').on(t.planId, t.dayNumber)],
);

export const readingPlanItems = pgTable(
  'reading_plan_items',
  {
    dayId: integer('day_id').notNull().references(() => readingPlanDays.id, { onDelete: 'cascade' }),
    groupId: integer('group_id').notNull().references(() => passageGroups.id, { onDelete: 'cascade' }),
    themeId: integer('theme_id').references(() => themes.id, { onDelete: 'set null' }),
    position: smallint('position').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.dayId, t.groupId] }), index('plan_items_group_idx').on(t.groupId)],
);

/* ───────────────────────────── Utilisateurs ───────────────────────────── */

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 254 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: varchar('display_name', { length: 100 }),
  role: roleEnum('role').notNull().default('user'),
  ...timestamps(),
});

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('refresh_tokens_user_idx').on(t.userId)],
);

export const planEnrollments = pgTable(
  'plan_enrollments',
  {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    planId: integer('plan_id').notNull().references(() => readingPlans.id, { onDelete: 'cascade' }),
    startDate: date('start_date').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.planId] })],
);

export const dayCompletions = pgTable(
  'day_completions',
  {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    planId: integer('plan_id').notNull().references(() => readingPlans.id, { onDelete: 'cascade' }),
    dayNumber: smallint('day_number').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.planId, t.dayNumber] })],
);

export const favorites = pgTable(
  'favorites',
  {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    groupId: integer('group_id').notNull().references(() => passageGroups.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.groupId] })],
);

export const notes = pgTable(
  'notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    groupId: integer('group_id').references(() => passageGroups.id, { onDelete: 'set null' }),
    reference: varchar('reference', { length: 60 }),
    content: text('content').notNull(),
    ...timestamps(),
  },
  (t) => [index('notes_user_idx').on(t.userId, t.updatedAt)],
);

export type Book = typeof books.$inferSelect;
export type Theme = typeof themes.$inferSelect;
export type PassageGroup = typeof passageGroups.$inferSelect;
export type User = typeof users.$inferSelect;

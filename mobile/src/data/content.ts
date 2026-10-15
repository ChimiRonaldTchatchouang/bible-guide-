import raw from './content.json';

export interface Verse {
  c: number;
  v: number;
  t: string;
}

export interface Theme {
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  parent: string | null;
}

export interface Parallel {
  reference: string;
  note: string | null;
  verses: Verse[];
}

export interface PassageGroup {
  slug: string;
  title: string;
  reference: string;
  contextStory: string | null;
  teaching: string | null;
  themes: string[];
  verses: Verse[];
  parallels: Parallel[];
}

const content = raw as { bible: string; themes: Theme[]; groups: PassageGroup[] };

export const BIBLE_VERSION = content.bible;
export const themes = content.themes;
export const groups = content.groups;

const themeBySlug = new Map(themes.map((t) => [t.slug, t]));
const groupBySlug = new Map(groups.map((g) => [g.slug, g]));

export const getTheme = (slug: string) => themeBySlug.get(slug);
export const getGroup = (slug: string) => groupBySlug.get(slug);

export const rootThemes = () => themes.filter((t) => !t.parent);
export const childThemes = (slug: string) => themes.filter((t) => t.parent === slug);

/** Groupes d'un thème (et de ses sous-thèmes), sans doublon. */
export function groupsForTheme(slug: string): PassageGroup[] {
  const slugs = new Set([slug, ...childThemes(slug).map((t) => t.slug)]);
  return groups.filter((g) => g.themes.some((s) => slugs.has(s)));
}

export function dayOfYear(date = new Date()): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000);
}

/** Lecture du jour : chaque jour un nouveau groupe, en boucle sur le contenu disponible. */
export function dailyGroup(date = new Date()): PassageGroup {
  return groups[(dayOfYear(date) - 1) % groups.length]!;
}

export function excerpt(group: PassageGroup, max = 140): string {
  const text = group.verses.map((v) => v.t).join(' ');
  return text.length > max ? `${text.slice(0, max).replace(/\s+\S*$/, '')}…` : text;
}

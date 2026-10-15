import { bookById, findBook, type BookData } from '../data/books.js';

/** Plage de versets. verseEnd = null ⇒ jusqu'à la fin de chapterEnd. */
export interface PassageRange {
  bookId: number;
  chapterStart: number;
  verseStart: number;
  chapterEnd: number;
  verseEnd: number | null;
}

export interface ParseResult {
  ranges: PassageRange[];
  errors: string[];
}

const IGNORED_WORDS = /^(?:cf|comp|voir|v|vv|et|etc|ss|s)\b\.?/i;
const BOOK_RE =
  /^((?:[123](?:er|re|e)?\s*)?[A-Za-zÀ-ÖØ-öø-ÿ’']+(?:\s+(?:des|de|du|selon)\s+[A-Za-zÀ-ÖØ-öø-ÿ]+)?)\.?\s*(?=\d)/;

/**
 * Analyse une ou plusieurs références bibliques en français.
 * Exemples : « Ge 2:18-24 », « Psaume 23 », « 1 Co 13:4-7; 15:1 », « Ap 22:1, 2; 2:7 », « Ge 4:17 à 5:32 ».
 * Tolérant : les morceaux non reconnus sont signalés dans `errors` sans bloquer le reste.
 */
export function parseReferences(input: string, defaultBook?: BookData): ParseResult {
  const ranges: PassageRange[] = [];
  const errors: string[] = [];
  let s = input.replace(/[()[\]]/g, ' ').replace(/ /g, ' ');
  let book: BookData | undefined = defaultBook;
  let chapter: number | null = null;
  let mode: 'chapter' | 'verse' = 'chapter';

  while (s.length) {
    // Séparateurs : « , » ⇒ suite de versets ; « ; » ou « . » ⇒ suite de chapitres.
    const sep = /^[\s,;.]+/.exec(s);
    if (sep) {
      if (/[;.]/.test(sep[0])) mode = 'chapter';
      else if (sep[0].includes(',') && chapter !== null) mode = 'verse';
      s = s.slice(sep[0].length);
      continue;
    }
    const bm = BOOK_RE.exec(s);
    const found = bm ? findBook(bm[1]!) : undefined;
    if (bm && found) {
      book = found;
      chapter = null;
      mode = 'chapter';
      s = s.slice(bm[0].length);
      continue;
    }
    const ignored = IGNORED_WORDS.exec(s);
    if (ignored) {
      s = s.slice(ignored[0].length);
      continue;
    }
    if (bm) {
      errors.push(`Livre inconnu : « ${bm[1]} »`);
      book = undefined;
      chapter = null;
      mode = 'chapter';
      s = s.slice(bm[0].length);
      continue;
    }

    if (!/^\d/.test(s)) {
      // Mot isolé non reconnu : on l'ignore.
      const word = /^\S+/.exec(s)![0];
      if (/[A-Za-zÀ-ÿ]/.test(word)) errors.push(`Élément ignoré : « ${word} »`);
      s = s.slice(word.length);
      continue;
    }

    // Lecture d'un « terme » : a[:b] [- c[:d]]
    const term = /^(\d+)(?:(?::|\.(?=\d))(\d+))?(?:\s*(?:[-–]|à)\s*(\d+)(?:(?::|\.(?=\d))(\d+))?)?/.exec(s)!;
    s = s.slice(term[0].length);
    if (!book) {
      errors.push(`Référence sans livre : « ${term[0]} »`);
      continue;
    }
    const a = Number(term[1]);
    const b = term[2] !== undefined ? Number(term[2]) : undefined;
    const c = term[3] !== undefined ? Number(term[3]) : undefined;
    const d = term[4] !== undefined ? Number(term[4]) : undefined;

    let r: PassageRange;
    if (b !== undefined) {
      // a:b …
      chapter = a;
      if (c === undefined) r = { bookId: book.id, chapterStart: a, verseStart: b, chapterEnd: a, verseEnd: b };
      else if (d === undefined) r = { bookId: book.id, chapterStart: a, verseStart: b, chapterEnd: a, verseEnd: c };
      else r = { bookId: book.id, chapterStart: a, verseStart: b, chapterEnd: c, verseEnd: d };
      mode = 'verse';
    } else if (book.chapterCount === 1) {
      // Livres d'un seul chapitre (Abdias, Jude…) : le nombre est un verset.
      chapter = 1;
      r = { bookId: book.id, chapterStart: 1, verseStart: a, chapterEnd: d !== undefined ? c! : 1, verseEnd: d ?? c ?? a };
    } else if (mode === 'verse' && chapter !== null) {
      // « 22:1, 2 » ⇒ verset 2 du chapitre courant ; « 3:16-4:2 » géré plus haut.
      if (c !== undefined && d !== undefined) {
        r = { bookId: book.id, chapterStart: chapter, verseStart: a, chapterEnd: c, verseEnd: d };
        chapter = c;
      } else {
        r = { bookId: book.id, chapterStart: chapter, verseStart: a, chapterEnd: chapter, verseEnd: c ?? a };
      }
    } else {
      // Chapitre(s) entier(s) : « Ps 23 », « Ps 1-2 », « Ge 1-2:3 »
      chapter = c ?? a;
      r = { bookId: book.id, chapterStart: a, verseStart: 1, chapterEnd: c ?? a, verseEnd: d ?? null };
    }

    const problem = validateRange(r);
    if (problem) errors.push(problem);
    else ranges.push(r);
  }

  return { ranges, errors };
}

/** Analyse une référence unique ; lève une erreur si elle est invalide. */
export function parseReference(input: string): PassageRange {
  const { ranges, errors } = parseReferences(input);
  if (ranges.length !== 1 || errors.length) {
    throw new Error(errors[0] ?? (ranges.length ? 'Une seule référence attendue' : `Référence invalide : « ${input} »`));
  }
  return ranges[0]!;
}

export function validateRange(r: PassageRange): string | null {
  const book = bookById.get(r.bookId);
  if (!book) return `Livre inconnu (id ${r.bookId})`;
  const label = formatReference(r);
  if (r.chapterStart < 1 || r.chapterEnd > book.chapterCount) return `Chapitre hors limites : ${label}`;
  if (r.chapterEnd < r.chapterStart) return `Plage inversée : ${label}`;
  if (r.verseStart < 1 || (r.verseEnd !== null && r.verseEnd < 1)) return `Verset invalide : ${label}`;
  if (r.chapterEnd === r.chapterStart && r.verseEnd !== null && r.verseEnd < r.verseStart) return `Plage inversée : ${label}`;
  return null;
}

/** « Ge 2:18-24 », « Ps 23 », « Ge 4:17-5:32 ». `full` ⇒ nom complet du livre. */
export function formatReference(r: PassageRange, style: 'abbr' | 'full' = 'abbr'): string {
  const book = bookById.get(r.bookId);
  const name = book ? (style === 'full' ? book.name : book.abbreviation) : `#${r.bookId}`;
  const single = book?.chapterCount === 1;
  const wholeChapters = r.verseStart === 1 && r.verseEnd === null;

  if (wholeChapters) {
    if (single) return name;
    return r.chapterStart === r.chapterEnd ? `${name} ${r.chapterStart}` : `${name} ${r.chapterStart}-${r.chapterEnd}`;
  }
  const start = single ? `${r.verseStart}` : `${r.chapterStart}:${r.verseStart}`;
  if (r.chapterStart === r.chapterEnd) {
    if (r.verseEnd === r.verseStart) return `${name} ${start}`;
    return `${name} ${start}-${r.verseEnd ?? 'fin'}`;
  }
  return `${name} ${start}-${r.chapterEnd}:${r.verseEnd ?? 'fin'}`;
}

/** Extrait les colonnes de plage d'un objet (ligne SQL ou corps de requête). */
export function pickRange<T extends PassageRange>(row: T): PassageRange {
  return {
    bookId: row.bookId,
    chapterStart: row.chapterStart,
    verseStart: row.verseStart,
    chapterEnd: row.chapterEnd,
    verseEnd: row.verseEnd,
  };
}

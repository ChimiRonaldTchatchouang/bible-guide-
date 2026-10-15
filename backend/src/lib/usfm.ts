import { bookByCode, type BookData } from '../data/books.js';
import { parseReferences, type PassageRange } from './reference.js';

/*
 * Analyseur USFM pour la « Bible Segond 1910 à parallèles » (BibleCorps FRA-B-LSG1910-PD-UBS).
 * Extrait : versets, titres de sections, unités de lecture avec leurs parallèles (\r) et renvois (\x).
 * Les introductions modernes (\ip, \io…) sont ignorées : seul le texte 1910 est importé.
 */

export interface ParsedVerse {
  chapter: number;
  verse: number;
  text: string;
}

export interface ParsedUnit {
  title: string | null;
  headingStart: boolean;
  range: PassageRange;
  parallelsRaw: string | null;
  parallels: PassageRange[];
}

export interface ParsedCrossRef {
  chapter: number;
  verse: number;
  target: PassageRange;
}

export interface ParsedBook {
  book: BookData;
  verses: ParsedVerse[];
  units: ParsedUnit[];
  crossReferences: ParsedCrossRef[];
  warnings: string[];
}

const SKIP_LINE =
  /^\\(?:id|ide|h|toc\d*|mt\d*|mte\d*|imt\d*|ip|ipi|io\d*|ior|is\d*|ib\d*|iq\d*|ie|ms\d*|mr|rem|periph|sd\d*|cl|cp)\b/;

type Ref = { chapter: number; verse: number };
const cmp = (a: Ref, b: Ref) => a.chapter - b.chapter || a.verse - b.verse;

/** Nettoie le texte d'un verset : notes, renvois et marqueurs de caractères retirés. */
export function cleanText(s: string): string {
  return s
    .replace(/\\x\s.*?\\x\*/g, '')
    .replace(/\\f\s.*?\\f\*/g, '')
    .replace(/\\fig\s.*?\\fig\*/g, '')
    .replace(/\\\+?[a-z]+\d*\*/g, '') // marqueurs fermants : \wj*, \it*
    .replace(/\\\+?[a-z]+\d*\s?/g, '') // marqueurs ouvrants : \wj , \tc1 , \q
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?»])/g, '$1')
    .replace(/«\s+/g, '«')
    .trim();
}

/** « V. 4-7 », « 2 v. 25 à 3 v. 6 », « 7 v. 26-8:11 » → plage dans le livre courant. */
function parseRPrefix(prefix: string, book: BookData, chapter: number): PassageRange | null {
  const normalized = prefix
    .replace(/(\d+)\s*v\.\s*(\d+)/g, '$1:$2')
    .replace(/^V\.\s*/i, '')
    .trim();
  const withChapter = /^\d+:/.test(normalized)
    ? normalized
    : normalized.replace(/^(\d+)/, `${chapter}:$1`).replace(/([,-–]\s*)(\d+)(?!:)/g, '$1$2');
  const { ranges } = parseReferences(withChapter, book);
  if (!ranges.length) return null;
  const sorted = [...ranges].sort(
    (a, b) => cmp({ chapter: a.chapterStart, verse: a.verseStart }, { chapter: b.chapterStart, verse: b.verseStart }),
  );
  const first = sorted[0]!;
  const last = sorted.reduce((m, r) =>
    cmp({ chapter: r.chapterEnd, verse: r.verseEnd ?? 999 }, { chapter: m.chapterEnd, verse: m.verseEnd ?? 999 }) > 0 ? r : m,
  );
  return {
    bookId: book.id,
    chapterStart: first.chapterStart,
    verseStart: first.verseStart,
    chapterEnd: last.chapterEnd,
    verseEnd: last.verseEnd,
  };
}

interface Heading {
  title: string;
  start: Ref | null;
}
interface RLine {
  raw: string;
  explicit: PassageRange | null;
  anchor: Ref | null;
  heading: number; // index du titre courant (-1 si aucun)
  chapter: number;
}

export function parseUsfmBook(content: string): ParsedBook | null {
  const idLine = /^\\id\s+(\w{3})/m.exec(content);
  if (!idLine) return null;
  const book = bookByCode.get(idLine[1]!.toUpperCase());
  if (!book) return null;

  const warnings: string[] = [];
  const verses: ParsedVerse[] = [];
  const rawXrefs: Array<{ at: Ref; text: string }> = [];
  const headings: Heading[] = [];
  const rLines: RLine[] = [];
  let chapter = 0;
  let current: { chapter: number; verse: number; parts: string[] } | null = null;
  // Éléments en attente du prochain verset (titre ou \r placés avant le texte).
  let pendingHeading: number | null = null;
  let pendingR: number[] = [];

  const flush = () => {
    if (!current) return;
    const raw = current.parts.join(' ');
    for (const m of raw.matchAll(/\\x\s.*?\\xt\s(.*?)\\x\*/g)) {
      rawXrefs.push({ at: { chapter: current.chapter, verse: current.verse }, text: m[1]! });
    }
    const text = cleanText(raw);
    if (text) verses.push({ chapter: current.chapter, verse: current.verse, text });
    else warnings.push(`${book.abbreviation} ${current.chapter}:${current.verse} vide`);
    current = null;
  };

  const startVerse = (n: number) => {
    flush();
    current = { chapter, verse: n, parts: [] };
    const at = { chapter, verse: n };
    if (pendingHeading !== null) headings[pendingHeading]!.start = at;
    for (const i of pendingR) rLines[i]!.anchor = at;
    pendingHeading = null;
    pendingR = [];
  };

  const appendContent = (text: string) => {
    // Un même fragment peut contenir plusieurs \v.
    const pieces = text.split(/(\\v\s+\d+(?:[-,]\d+)?\s?)/);
    for (const piece of pieces) {
      const v = /^\\v\s+(\d+)/.exec(piece);
      if (v) startVerse(Number(v[1]));
      else if (piece.trim() && current) current.parts.push(piece);
    }
  };

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || SKIP_LINE.test(line)) continue;

    const c = /^\\c\s+(\d+)/.exec(line);
    if (c) {
      flush();
      chapter = Number(c[1]);
      continue;
    }
    if (chapter === 0) continue; // introduction du livre

    const s = /^\\s\d?\s+(.*)$/.exec(line);
    if (s) {
      flush();
      headings.push({ title: cleanText(s[1]!), start: null });
      pendingHeading = headings.length - 1;
      continue;
    }

    const r = /^\\r\s+(.*)$/.exec(line);
    if (r) {
      const raw = r[1]!.trim();
      const prefix = /^((?:V\.|\d+\s*v\.)[^:]*?(?:\d+:\d+[^:]*?)?):\s*/.exec(raw);
      let explicit: PassageRange | null = null;
      let refs = raw;
      if (prefix) {
        explicit = parseRPrefix(prefix[1]!, book, chapter);
        refs = raw.slice(prefix[0].length);
        if (!explicit) warnings.push(`Préfixe \\r non compris : « ${prefix[1]} »`);
      }
      rLines.push({
        raw: refs.replace(/^cf\.\s*/i, '').trim(),
        explicit,
        anchor: null,
        heading: pendingHeading ?? headings.length - 1,
        chapter,
      });
      if (!explicit) pendingR.push(rLines.length - 1);
      continue;
    }

    // Lignes de contenu : \p, \q, \m, \b, \tr… (le marqueur de paragraphe est retiré au nettoyage)
    appendContent(line.replace(/^\\(?:p|q\d?|m|mi|pi\d?|nb|b|li\d?|tr|d|qc|qr|pc|pm\d?)\b\s?/, ''));
  }
  flush();

  // ── Corrections des coquilles de numérotation (ex. « \v 11 5Éloignez-vous » pour Ps 119:115) ──
  for (let i = 1; i < verses.length; i++) {
    const prev = verses[i - 1]!;
    const v = verses[i]!;
    if (v.chapter !== prev.chapter || v.verse > prev.verse) continue;
    const digits = /^(\d+)\s*/.exec(v.text);
    if (digits && Number(`${v.verse}${digits[1]}`) === prev.verse + 1) {
      warnings.push(`${book.abbreviation} ${v.chapter}:${v.verse} renuméroté en ${prev.verse + 1}`);
      v.verse = prev.verse + 1;
      v.text = v.text.slice(digits[0].length);
    }
  }
  const seenVerses = new Set<string>();
  const unique = verses.filter((v) => {
    const key = `${v.chapter}:${v.verse}`;
    if (seenVerses.has(key)) {
      warnings.push(`${book.abbreviation} ${key} en double, ignoré`);
      return false;
    }
    seenVerses.add(key);
    return true;
  });
  verses.splice(0, verses.length, ...unique);

  // ── Construction des unités de lecture ──
  const lastVerse = verses.at(-1);
  if (!lastVerse) return { book, verses, units: [], crossReferences: [], warnings };
  const verseIndex = new Map(verses.map((v, i) => [`${v.chapter}:${v.verse}`, i]));
  const chapterLast = new Map<number, number>();
  for (const v of verses) chapterLast.set(v.chapter, Math.max(chapterLast.get(v.chapter) ?? 0, v.verse));

  const prevVerse = (at: Ref): Ref | null => {
    const i = verseIndex.get(`${at.chapter}:${at.verse}`);
    if (i === undefined || i === 0) return null;
    const v = verses[i - 1]!;
    return { chapter: v.chapter, verse: v.verse };
  };

  const validHeadings = headings
    .map((h, idx) => ({ ...h, idx }))
    .filter((h): h is Heading & { idx: number; start: Ref } => h.start !== null);
  const headingEnd = (k: number): Ref => {
    const next = validHeadings[k + 1];
    return (next && prevVerse(next.start)) ?? { chapter: lastVerse.chapter, verse: lastVerse.verse };
  };

  const toRange = (start: Ref, end: Ref): PassageRange => ({
    bookId: book.id,
    chapterStart: start.chapter,
    verseStart: start.verse,
    chapterEnd: end.chapter,
    verseEnd: end.verse,
  });

  const parallelsOf = (raw: string) => (raw ? parseReferences(raw).ranges : []);

  const units: ParsedUnit[] = [];
  const usedR = new Set<number>();
  validHeadings.forEach((h, k) => {
    const end = headingEnd(k);
    const own = rLines
      .map((rl, i) => ({ rl, i }))
      .filter(({ rl }) => rl.heading === h.idx);
    const local: ParsedUnit[] = [];
    for (const { rl, i } of own) {
      let range: PassageRange | null = rl.explicit;
      if (!range && rl.anchor) range = toRange(rl.anchor, end);
      if (!range) continue;
      usedR.add(i);
      local.push({ title: h.title, headingStart: false, range, parallelsRaw: rl.raw || null, parallels: parallelsOf(rl.raw) });
    }
    if (!local.length) {
      local.push({ title: h.title, headingStart: true, range: toRange(h.start, end), parallelsRaw: null, parallels: [] });
    }
    local.sort((a, b) =>
      cmp({ chapter: a.range.chapterStart, verse: a.range.verseStart }, { chapter: b.range.chapterStart, verse: b.range.verseStart }),
    );
    local[0]!.headingStart = true;
    units.push(...local);
  });

  // \r hors de tout titre (ex. Psaumes) : de l'ancre jusqu'à la fin du chapitre.
  rLines.forEach((rl, i) => {
    if (usedR.has(i)) return;
    let range = rl.explicit;
    if (!range && rl.anchor) {
      range = toRange(rl.anchor, { chapter: rl.anchor.chapter, verse: chapterLast.get(rl.anchor.chapter)! });
    }
    if (!range) return;
    units.push({ title: null, headingStart: false, range, parallelsRaw: rl.raw || null, parallels: parallelsOf(rl.raw) });
  });

  units.sort((a, b) =>
    cmp({ chapter: a.range.chapterStart, verse: a.range.verseStart }, { chapter: b.range.chapterStart, verse: b.range.verseStart }),
  );

  const crossReferences: ParsedCrossRef[] = rawXrefs.flatMap((x) =>
    parseReferences(x.text, book).ranges.map((target) => ({ ...x.at, target })),
  );

  return { book, verses, units, crossReferences, warnings };
}

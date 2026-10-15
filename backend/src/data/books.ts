export interface BookData {
  id: number;
  code: string;
  slug: string;
  name: string;
  abbreviation: string;
  testament: 'AT' | 'NT';
  chapterCount: number;
  /** Autres façons d'écrire le livre, acceptées par le parseur de références. */
  aliases: string[];
}

type Row = [code: string, slug: string, name: string, abbr: string, chapters: number, aliases: string[]];

// Abréviations = celles de la Segond 1910 à parallèles ; alias = usages courants.
const AT: Row[] = [
  ['GEN', 'genese', 'Genèse', 'Ge', 50, ['Gn', 'Gen']],
  ['EXO', 'exode', 'Exode', 'Ex', 40, ['Exo']],
  ['LEV', 'levitique', 'Lévitique', 'Lé', 27, ['Lv', 'Lev']],
  ['NUM', 'nombres', 'Nombres', 'No', 36, ['Nb', 'Nomb']],
  ['DEU', 'deuteronome', 'Deutéronome', 'De', 34, ['Dt', 'Deut']],
  ['JOS', 'josue', 'Josué', 'Jos', 24, []],
  ['JDG', 'juges', 'Juges', 'Jg', 21, ['Jug']],
  ['RUT', 'ruth', 'Ruth', 'Ru', 4, ['Rt']],
  ['1SA', '1-samuel', '1 Samuel', '1 S', 31, ['1 Sa', '1 Sam']],
  ['2SA', '2-samuel', '2 Samuel', '2 S', 24, ['2 Sa', '2 Sam']],
  ['1KI', '1-rois', '1 Rois', '1 R', 22, ['1 Ro']],
  ['2KI', '2-rois', '2 Rois', '2 R', 25, ['2 Ro']],
  ['1CH', '1-chroniques', '1 Chroniques', '1 Ch', 29, ['1 Chr']],
  ['2CH', '2-chroniques', '2 Chroniques', '2 Ch', 36, ['2 Chr']],
  ['EZR', 'esdras', 'Esdras', 'Esd', 10, ['Esdr']],
  ['NEH', 'nehemie', 'Néhémie', 'Né', 13, ['Ne', 'Néh']],
  ['EST', 'esther', 'Esther', 'Est', 10, []],
  ['JOB', 'job', 'Job', 'Job', 42, ['Jb']],
  ['PSA', 'psaumes', 'Psaumes', 'Ps', 150, ['Psaume', 'Psa']],
  ['PRO', 'proverbes', 'Proverbes', 'Pr', 31, ['Prov']],
  ['ECC', 'ecclesiaste', 'Ecclésiaste', 'Ec', 12, ['Qo', 'Eccl', "L'Ecclésiaste"]],
  ['SNG', 'cantique-des-cantiques', 'Cantique des cantiques', 'Ca', 8, ['Ct', 'Cant', 'Cantique']],
  ['ISA', 'esaie', 'Ésaïe', 'És', 66, ['Es', 'Is', 'Isaïe', 'Esaïe']],
  ['JER', 'jeremie', 'Jérémie', 'Jé', 52, ['Jr', 'Je', 'Jér']],
  ['LAM', 'lamentations', 'Lamentations', 'La', 5, ['Lm', 'Lam']],
  ['EZK', 'ezechiel', 'Ézéchiel', 'Éz', 48, ['Ez', 'Ézé', 'Ezéchiel']],
  ['DAN', 'daniel', 'Daniel', 'Da', 12, ['Dn']],
  ['HOS', 'osee', 'Osée', 'Os', 14, []],
  ['JOL', 'joel', 'Joël', 'Joë', 3, ['Jl', 'Joe', 'Joel']],
  ['AMO', 'amos', 'Amos', 'Am', 9, []],
  ['OBA', 'abdias', 'Abdias', 'Ab', 1, ['Abd']],
  ['JON', 'jonas', 'Jonas', 'Jon', 4, []],
  ['MIC', 'michee', 'Michée', 'Mi', 7, ['Mic']],
  ['NAM', 'nahum', 'Nahum', 'Na', 3, []],
  ['HAB', 'habacuc', 'Habacuc', 'Ha', 3, ['Hab']],
  ['ZEP', 'sophonie', 'Sophonie', 'So', 3, ['Soph']],
  ['HAG', 'aggee', 'Aggée', 'Ag', 2, []],
  ['ZEC', 'zacharie', 'Zacharie', 'Za', 14, ['Zac', 'Zach']],
  ['MAL', 'malachie', 'Malachie', 'Mal', 4, ['Ml']],
];

const NT: Row[] = [
  ['MAT', 'matthieu', 'Matthieu', 'Mt', 28, ['Matt']],
  ['MRK', 'marc', 'Marc', 'Mc', 16, ['Mr']],
  ['LUK', 'luc', 'Luc', 'Lu', 24, ['Lc']],
  ['JHN', 'jean', 'Jean', 'Jn', 21, ['Jea']],
  ['ACT', 'actes', 'Actes', 'Ac', 28, ['Act', 'Actes des Apôtres']],
  ['ROM', 'romains', 'Romains', 'Ro', 16, ['Rm', 'Rom']],
  ['1CO', '1-corinthiens', '1 Corinthiens', '1 Co', 16, ['1 Cor']],
  ['2CO', '2-corinthiens', '2 Corinthiens', '2 Co', 13, ['2 Cor']],
  ['GAL', 'galates', 'Galates', 'Ga', 6, ['Gal']],
  ['EPH', 'ephesiens', 'Éphésiens', 'Ép', 6, ['Ep', 'Éph', 'Eph']],
  ['PHP', 'philippiens', 'Philippiens', 'Ph', 4, ['Phil']],
  ['COL', 'colossiens', 'Colossiens', 'Col', 4, []],
  ['1TH', '1-thessaloniciens', '1 Thessaloniciens', '1 Th', 5, ['1 Thes']],
  ['2TH', '2-thessaloniciens', '2 Thessaloniciens', '2 Th', 3, ['2 Thes']],
  ['1TI', '1-timothee', '1 Timothée', '1 Ti', 6, ['1 Tm', '1 Tim']],
  ['2TI', '2-timothee', '2 Timothée', '2 Ti', 4, ['2 Tm', '2 Tim']],
  ['TIT', 'tite', 'Tite', 'Tit', 3, ['Tt']],
  ['PHM', 'philemon', 'Philémon', 'Phm', 1, ['Philém']],
  ['HEB', 'hebreux', 'Hébreux', 'Hé', 13, ['He', 'Héb', 'Heb']],
  ['JAS', 'jacques', 'Jacques', 'Ja', 5, ['Jc', 'Jac']],
  ['1PE', '1-pierre', '1 Pierre', '1 Pi', 5, ['1 P']],
  ['2PE', '2-pierre', '2 Pierre', '2 Pi', 3, ['2 P']],
  ['1JN', '1-jean', '1 Jean', '1 Jn', 5, []],
  ['2JN', '2-jean', '2 Jean', '2 Jn', 1, []],
  ['3JN', '3-jean', '3 Jean', '3 Jn', 1, []],
  ['JUD', 'jude', 'Jude', 'Jud', 1, ['Jd']],
  ['REV', 'apocalypse', 'Apocalypse', 'Ap', 22, ['Apo', 'Apoc']],
];

export const BOOKS: BookData[] = [
  ...AT.map(([code, slug, name, abbreviation, chapterCount, aliases], i) => ({
    id: i + 1, code, slug, name, abbreviation, testament: 'AT' as const, chapterCount, aliases,
  })),
  ...NT.map(([code, slug, name, abbreviation, chapterCount, aliases], i) => ({
    id: AT.length + i + 1, code, slug, name, abbreviation, testament: 'NT' as const, chapterCount, aliases,
  })),
];

export const bookById = new Map(BOOKS.map((b) => [b.id, b]));
export const bookByCode = new Map(BOOKS.map((b) => [b.code, b]));
export const bookBySlug = new Map(BOOKS.map((b) => [b.slug, b]));

/** Normalise un nom de livre : minuscules, sans accents, sans points ni espaces multiples. */
export function normalizeBookKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(?:(?:premier|premiere|1er|1re)\s*|i\s+)(?=[a-z])/, '1 ')
    .replace(/^(?:(?:second|seconde|deuxieme|2nd|2e)\s*|ii\s+)(?=[a-z])/, '2 ')
    .replace(/^(?:(?:troisieme|3e)\s*|iii\s+)(?=[a-z])/, '3 ')
    .replace(/^(1|2|3)(?=[a-z])/, '$1 ');
}

const lookup = new Map<string, BookData>();
for (const b of BOOKS) {
  for (const key of [b.name, b.abbreviation, b.slug.replace(/-/g, ' '), b.code, ...b.aliases]) {
    lookup.set(normalizeBookKey(key), b);
  }
}

export function findBook(name: string): BookData | undefined {
  return lookup.get(normalizeBookKey(name));
}

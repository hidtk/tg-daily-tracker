/**
 * Small text helpers shared by the server checks and the client hints:
 * typed-answer grading with typo tolerance, word blanks for cloze questions, vocabulary use in free text.
 */
import type { VocabWord } from './vocab';

/** Crude stem: enough to match inflected forms (mitigate / mitigated / mitigating). */
export function stem(w: string): string {
  const x = w.toLowerCase().replace(/[^a-z'-]/g, '');
  return x.length >= 6 ? x.slice(0, 5) : x.length >= 4 ? x.slice(0, x.length - 1) : x;
}

/** Lowercase, straight apostrophes, no punctuation except hyphen and apostrophe, single spaces. */
export function normalizeWord(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z' -]/g, ' ')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Allowed typos: none for short words, one up to 8 letters, two for longer ones. */
export function typoTolerance(len: number): number {
  return len <= 4 ? 0 : len <= 8 ? 1 : 2;
}

/**
 * Grade a typed answer against the expected word (and optional accepted variants).
 * Case, extra spaces and a hyphen written as a space are ignored; a small typo still counts, but is reported.
 */
export function checkTyped(given: string, expected: string[]): { ok: boolean; exact: boolean } {
  const g = normalizeWord(given);
  if (!g) return { ok: false, exact: false };
  const loose = (s: string) => s.replace(/[-' ]/g, '');
  for (const e of expected.map(normalizeWord)) {
    if (g === e || loose(g) === loose(e)) return { ok: true, exact: true };
  }
  for (const e of expected.map(normalizeWord)) {
    if (levenshtein(loose(g), loose(e)) <= typoTolerance(loose(e).length)) return { ok: true, exact: false };
  }
  return { ok: false, exact: false };
}

const TOKEN = /[A-Za-z][A-Za-z'’-]*/g;

/** Is `token` a form of `head` (peak/peaked, phase/phased, mitigate/mitigating)? Deliberately simple. */
const IRREGULAR: Record<string, string[]> = {
  take: ['took', 'taken', 'taking', 'takes'],
  bring: ['brought', 'bringing', 'brings'],
  give: ['gave', 'given', 'giving', 'gives'],
  rise: ['rose', 'risen', 'rising', 'rises'],
};

export function sameWord(token: string, head: string): boolean {
  const t = token.toLowerCase().replace(/’/g, "'");
  const h = head.toLowerCase();
  if (t === h || IRREGULAR[h]?.includes(t)) return true;
  if (h.length <= 3) return false;
  const prefix = h.length <= 4 ? h : h.length <= 6 ? h.slice(0, -1) : h.slice(0, -2);
  return t.startsWith(prefix) && t.length <= h.length + 4;
}

/**
 * The example sentence with the headword blanked out, or null when the word is not found as a
 * continuous phrase (e.g. "took his age into account"). `answer` is the form used in the sentence.
 */
export function clozeFor(w: Pick<VocabWord, 'word' | 'example'>): { sentence: string; answer: string } | null {
  const head = w.word.toLowerCase().split(/\s+/).filter(Boolean);
  const toks = [...w.example.matchAll(TOKEN)].map((m) => ({ text: m[0], at: m.index ?? 0 }));
  for (let i = 0; i + head.length <= toks.length; i++) {
    const run = toks.slice(i, i + head.length);
    // Short function words must match exactly; content words may be inflected.
    const match = run.every((t, k) => sameWord(t.text, head[k]));
    if (!match) continue;
    const from = run[0].at;
    const last = run[run.length - 1];
    const to = last.at + last.text.length;
    const answer = w.example.slice(from, to);
    const blank = head.map(() => '_____').join(' ');
    return { sentence: w.example.slice(0, from) + blank + w.example.slice(to), answer };
  }
  return null;
}

/** Word count for free text: tokens that contain Latin letters. */
export function countWords(text: string): number {
  return (text.match(/[A-Za-z][A-Za-z'’-]*/g) ?? []).length;
}

/** Mostly English: enough Latin letters and very little Cyrillic. */
export function isEnglish(text: string): boolean {
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  const cyr = (text.match(/[А-Яа-яЁё]/g) ?? []).length;
  return latin >= 10 && cyr <= latin / 20;
}

const FUNCTION_WORDS = new Set(['to', 'a', 'an', 'the', 'of', 'in', 'on', 'for', 'with', 'at', 'by', 'into', 'about', 'out', 'up']);

/**
 * Which of `words` appear in `text` (inflected forms allowed). For phrases every content word must appear,
 * in order, within a few tokens of each other — "took his age into account" counts for "take into account".
 */
export function vocabUsed(text: string, words: Pick<VocabWord, 'id' | 'word'>[]): number[] {
  const toks = (text.match(TOKEN) ?? []).map((t) => t.toLowerCase().replace(/’/g, "'"));
  const used: number[] = [];
  for (const w of words) {
    const keys = w.word.toLowerCase().split(/[\s]+/).filter((k) => k && !FUNCTION_WORDS.has(k));
    if (!keys.length) continue;
    const ks = keys;
    const matches = (i: number, k: string) => sameWord(toks[i], k);
    let found = false;
    for (let i = 0; i < toks.length && !found; i++) {
      if (!matches(i, ks[0])) continue;
      let pos = i;
      let ok = true;
      for (const k of ks.slice(1)) {
        let next = -1;
        for (let j = pos + 1; j < Math.min(toks.length, pos + 5); j++) if (matches(j, k)) { next = j; break; }
        if (next < 0) { ok = false; break; }
        pos = next;
      }
      found = ok;
    }
    if (found) used.push(w.id);
  }
  return used;
}

/** Share of distinct content words two texts have in common (0..1), for spotting a resubmitted text. */
export function overlap(a: string, b: string): number {
  const set = (s: string) => new Set((s.match(TOKEN) ?? []).map(stem).filter((x) => x.length > 3));
  const A = set(a);
  const B = set(b);
  if (!A.size || !B.size) return 0;
  let common = 0;
  for (const x of A) if (B.has(x)) common++;
  return common / Math.min(A.size, B.size);
}

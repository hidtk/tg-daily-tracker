/**
 * Rubric checks for free answers (sentence, Writing, Speaking). Deterministic and shared: the server decides,
 * the app shows the same list of criteria with a plain explanation for each one that failed.
 */
import { countWords, isEnglish, stem, vocabUsed } from './text';
import type { VocabWord } from './vocab';

export type CriterionId =
  | 'length' // enough words
  | 'vocab' // recent words used
  | 'word' // the given word is used (sentence)
  | 'linking' // linking words: because, however, for example…
  | 'sentences' // several sentences, none endless
  | 'english'
  | 'variety' // not the same words over and over
  | 'gibberish' // no random letters
  | 'copy' // not a copy of an earlier answer / of the example
  | 'prompt' // not the task text copied back
  | 'time' // took long enough (Writing: timer on the server)
  | 'duration' // voice long enough
  | 'own_voice' // recorded, not forwarded
  | 'new_voice' // this voice was not counted before
  | 'topic_ai'; // on topic, as judged by the AI check (only when it is configured)

export interface Criterion {
  id: CriterionId;
  ok: boolean;
  /** what was found and what is needed, for the explanation ("87 words, need 120") */
  value?: number | string;
  need?: number | string;
}

export interface CheckResult {
  ok: boolean;
  criteria: Criterion[];
}

const result = (criteria: Criterion[]): CheckResult => ({ ok: criteria.every((c) => c.ok), criteria });

const TOKEN = /[A-Za-z][A-Za-z'’-]*/g;
const tokens = (t: string) => (t.match(TOKEN) ?? []).map((x) => x.toLowerCase().replace(/’/g, "'"));

const STOPWORDS = new Set(
  'a an the and or but so to of in on at by for with from into about as is are was were be been being it its this that these those i you he she we they my your our their his her them me us not no do does did have has had will would can could should may might must there here than then very also just more most some any all each other such only own same too'.split(' '),
);

export const LINKING_WORDS = [
  'because', 'however', 'therefore', 'although', 'though', 'while', 'whereas', 'moreover', 'furthermore', 'besides',
  'for example', 'for instance', 'such as', 'in addition', 'on the other hand', 'as a result', 'consequently',
  'firstly', 'secondly', 'finally', 'in conclusion', 'overall', 'nevertheless', 'despite', 'in contrast', 'since',
  'so that', 'which means', 'in my opinion', 'to sum up', 'instead', 'otherwise', 'unless', 'thus', 'hence',
];

/** Distinct linking words and phrases in a text. */
export function linkingUsed(text: string): string[] {
  const t = ` ${tokens(text).join(' ')} `;
  return LINKING_WORDS.filter((w) => t.includes(` ${w} `));
}

/** Sentences: split on . ! ? and line breaks, keep the ones with at least 3 words. */
export function sentencesOf(text: string): string[] {
  return text
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => countWords(s) >= 3);
}

/** Share of tokens that don't look like words: no vowels, very long, or the same letter 3+ times in a row. */
export function gibberishShare(text: string): number {
  const toks = tokens(text);
  if (!toks.length) return 1;
  const bad = toks.filter((w) => (w.length > 3 && !/[aeiouy]/.test(w)) || w.length > 20 || /(.)\1\1/.test(w) || /[bcdfghjklmnpqrstvwxz]{6,}/.test(w));
  return bad.length / toks.length;
}

/**
 * Repetition: distinct content words / all content words, and the share of the most frequent one.
 * "good good good good…" has a low ratio and a high top share.
 */
export function variety(text: string): { ratio: number; top: number; max: number } {
  const content = tokens(text).filter((w) => !STOPWORDS.has(w)).map(stem);
  if (!content.length) return { ratio: 0, top: 1, max: 0 };
  const counts = new Map<string, number>();
  for (const w of content) counts.set(w, (counts.get(w) ?? 0) + 1);
  const max = Math.max(...counts.values());
  return { ratio: counts.size / content.length, top: max / content.length, max };
}

/** Share of the text's five-word sequences that also appear in `source` — a copied passage scores high. */
export function copiedShare(text: string, source: string): number {
  const grams = (s: string) => {
    const t = tokens(s);
    const out: string[] = [];
    for (let i = 0; i + 5 <= t.length; i++) out.push(t.slice(i, i + 5).join(' '));
    return out;
  };
  const mine = grams(text);
  if (!mine.length) return 0;
  const theirs = new Set(grams(source));
  return mine.filter((g) => theirs.has(g)).length / mine.length;
}

function varietyOk(text: string, short: boolean): { ok: boolean; value: number } {
  const v = variety(text);
  // A topic word may come back a few times; the same word as a fifth of the text, or a text of repeats, is filler.
  const ok = short ? v.max <= 3 : v.ratio >= 0.35 && !(v.top > 0.2 && v.max > 5);
  return { ok, value: Math.round(v.ratio * 100) };
}

// ---------- Sentence with a word ----------

export const SENTENCE_MIN_WORDS = 7;

export function checkSentence(o: { word: string; example: string; text: string; previous?: string[] }): CheckResult {
  const words = countWords(o.text);
  const used = vocabUsed(o.text, [{ id: 1, word: o.word }]).length > 0;
  const copy = Math.max(copiedShare(o.text, o.example), ...(o.previous ?? []).map((p) => copiedShare(o.text, p)));
  const gib = gibberishShare(o.text);
  return result([
    { id: 'word', ok: used, value: o.word },
    { id: 'length', ok: words >= SENTENCE_MIN_WORDS, value: words, need: SENTENCE_MIN_WORDS },
    { id: 'english', ok: isEnglish(o.text) },
    { id: 'gibberish', ok: gib <= 0.1 },
    { id: 'variety', ok: varietyOk(o.text, true).ok },
    { id: 'copy', ok: copy < 0.5 },
  ]);
}

// ---------- Writing ----------

export type TaskSize = 'short' | 'long';

export interface WritingRules {
  minWords: number;
  /** recent vocabulary words to use (fewer if fewer are learned) */
  vocab: number;
  linking: number;
  sentences: number;
  /** from pressing Start to sending */
  minSeconds: number;
}

export const WRITING_RULES: Record<TaskSize, WritingRules> = {
  short: { minWords: 60, vocab: 2, linking: 1, sentences: 3, minSeconds: 240 },
  long: { minWords: 150, vocab: 3, linking: 3, sentences: 6, minSeconds: 600 },
};

export function checkWriting(o: {
  size: TaskSize;
  text: string;
  seconds: number;
  vocab: Pick<VocabWord, 'id' | 'word'>[];
  previous: string[];
  prompt: string;
}): CheckResult & { words: number; used: string[]; linking: string[] } {
  const r = WRITING_RULES[o.size];
  const words = countWords(o.text);
  const ids = vocabUsed(o.text, o.vocab);
  const used = o.vocab.filter((w) => ids.includes(w.id)).map((w) => w.word);
  const needVocab = Math.min(r.vocab, o.vocab.length);
  const linking = linkingUsed(o.text);
  const sents = sentencesOf(o.text);
  const longest = Math.max(0, ...sents.map(countWords));
  const gib = gibberishShare(o.text);
  const copy = Math.max(0, ...o.previous.map((p) => copiedShare(o.text, p)));
  const fromPrompt = copiedShare(o.text, o.prompt);
  const criteria: Criterion[] = [
    { id: 'length', ok: words >= r.minWords, value: words, need: r.minWords },
    { id: 'vocab', ok: used.length >= needVocab, value: used.length, need: needVocab },
    { id: 'linking', ok: linking.length >= r.linking, value: linking.length, need: r.linking },
    { id: 'sentences', ok: sents.length >= r.sentences && longest <= 60, value: sents.length, need: r.sentences },
    { id: 'english', ok: isEnglish(o.text) },
    { id: 'variety', ok: varietyOk(o.text, false).ok, value: varietyOk(o.text, false).value },
    { id: 'gibberish', ok: gib <= 0.05 },
    { id: 'copy', ok: copy < 0.4 },
    { id: 'prompt', ok: fromPrompt < 0.3 },
    { id: 'time', ok: o.seconds >= r.minSeconds, value: Math.round(o.seconds / 60), need: Math.round(r.minSeconds / 60) },
  ];
  return { ...result(criteria), words, used, linking };
}

// ---------- Speaking ----------

export interface SpeakingRules {
  minSeconds: number;
}

export const SPEAKING_RULES: Record<TaskSize, SpeakingRules> = {
  short: { minSeconds: 45 },
  long: { minSeconds: 100 },
};

export function checkVoice(o: { size: TaskSize; seconds: number; forwarded: boolean; duplicate: boolean }): CheckResult {
  const r = SPEAKING_RULES[o.size];
  return result([
    { id: 'duration', ok: o.seconds >= r.minSeconds, value: o.seconds, need: r.minSeconds },
    { id: 'own_voice', ok: !o.forwarded },
    { id: 'new_voice', ok: !o.duplicate },
  ]);
}

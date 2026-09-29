import { describe, expect, it } from 'vitest';
import { VOCAB, checkTyped, clozeFor, countWords, isEnglish, overlap, sameWord, vocabUsed } from '@tracker/shared';

describe('typed answers', () => {
  it('ignores case, spaces and apostrophe style', () => {
    expect(checkTyped('  Mitigate ', ['mitigate'])).toEqual({ ok: true, exact: true });
    expect(checkTyped('WELL BEING', ['well-being']).ok).toBe(true);
    expect(checkTyped('account  for', ['account for'])).toEqual({ ok: true, exact: true });
  });
  it('forgives a small typo in longer words, reports it', () => {
    expect(checkTyped('mitigte', ['mitigate'])).toEqual({ ok: true, exact: false });
    expect(checkTyped('exacerbte', ['exacerbate']).ok).toBe(true);
    expect(checkTyped('unprecedneted', ['unprecedented']).ok).toBe(true); // 2 edits in a 13-letter word
    expect(checkTyped('urbanization', ['urbanisation']).ok).toBe(true);
  });
  it('is strict with short words and wrong words', () => {
    expect(checkTyped('pak', ['peak']).ok).toBe(false);
    expect(checkTyped('peek', ['peak']).ok).toBe(false);
    expect(checkTyped('alleviate', ['mitigate']).ok).toBe(false);
    expect(checkTyped('', ['mitigate']).ok).toBe(false);
  });
});

describe('cloze questions', () => {
  it('blanks the word in the example and keeps the used form', () => {
    const w = VOCAB.find((x) => x.word === 'exacerbate')!;
    const c = clozeFor(w)!;
    expect(c.answer).toBe('exacerbated');
    expect(c.sentence).not.toMatch(/exacerbat/i);
    expect(c.sentence).toContain('_____');
  });
  it('handles phrases and falls back when the phrase is split', () => {
    expect(clozeFor(VOCAB.find((x) => x.word === 'account for')!)!.answer).toBe('account for');
    expect(clozeFor(VOCAB.find((x) => x.word === 'phase out')!)!.answer).toBe('phased out');
    expect(clozeFor(VOCAB.find((x) => x.word === 'take into account')!)).toBeNull();
  });
  it('never leaks the answer for any word in the bank', () => {
    let made = 0;
    for (const w of VOCAB) {
      const c = clozeFor(w);
      if (!c) continue;
      made++;
      expect(w.example).toContain(c.answer);
      expect(c.sentence.toLowerCase()).not.toContain(c.answer.toLowerCase());
    }
    expect(made).toBeGreaterThan(VOCAB.length * 0.6);
  });
});

describe('vocabulary in free text', () => {
  const words = [
    { id: 1, word: 'mitigate' },
    { id: 2, word: 'take into account' },
    { id: 3, word: 'peak' },
    { id: 4, word: 'well-being' },
  ];
  it('finds inflected words and split phrases', () => {
    expect(vocabUsed('Cities mitigated the heat and it peaked in June.', words)).toEqual([1, 3]);
    expect(vocabUsed('The court took his age into account.', words)).toEqual([2]);
    expect(vocabUsed('Parks improve our well-being.', words)).toEqual([4]);
    expect(vocabUsed('Nothing relevant here at all.', words)).toEqual([]);
  });
  it('matches forms, not lookalikes', () => {
    expect(sameWord('phased', 'phase')).toBe(true);
    expect(sameWord('mitigating', 'mitigate')).toBe(true);
    expect(sameWord('peaks', 'peak')).toBe(true);
    expect(sameWord('speaker', 'peak')).toBe(false);
  });
  it('counts words and spots Russian or a resubmitted text', () => {
    expect(countWords("It's a well-known fact, isn't it?")).toBe(6);
    expect(isEnglish('This is plainly an English sentence.')).toBe(true);
    expect(isEnglish('Это русский текст with a few words')).toBe(false);
    const a = 'Remote work saves commuting time and gives employees flexibility, but isolation can hurt teamwork.';
    expect(overlap(a, a + ' Indeed.')).toBeGreaterThan(0.9);
    expect(overlap(a, 'Tourism brings money to villages while crowds damage fragile ancient monuments.')).toBeLessThan(0.3);
  });
});

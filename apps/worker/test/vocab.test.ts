import { describe, expect, it } from 'vitest';
import { REVIEW_INTERVALS, VOCAB, quizOptions } from '@tracker/shared';

describe('vocabulary bank', () => {
  it('has unique words with all fields filled', () => {
    expect(VOCAB.length).toBeGreaterThanOrEqual(150);
    expect(new Set(VOCAB.map((w) => w.word)).size).toBe(VOCAB.length);
    for (const w of VOCAB) {
      expect(w.ipa.length).toBeGreaterThan(0);
      expect(w.meaning.length).toBeGreaterThan(5);
      expect(w.example.length).toBeGreaterThan(15);
      expect(w.ru.length).toBeGreaterThan(0);
    }
  });

  it('builds a deterministic four-option quiz containing the right answer once', () => {
    const w = VOCAB[10];
    const a = quizOptions(w, 20260910);
    const b = quizOptions(w, 20260910);
    expect(a).toEqual(b);
    expect(a.options).toHaveLength(4);
    expect(new Set(a.options).size).toBe(4);
    expect(a.options[a.answer]).toBe(w.meaning);
  });

  it('uses the 1/3/7/14/30 schedule', () => {
    expect(REVIEW_INTERVALS).toEqual([1, 3, 7, 14, 30]);
  });
});

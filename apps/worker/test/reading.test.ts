import { describe, expect, it } from 'vitest';
import { HARD_TESTS, READING_TESTS, bandForTest, findReadingPart, isCorrect, paragraphHint, rawToBand, readingParts, readingPay, type ReadingQuestion } from '@tracker/shared';

describe('reading bank', () => {
  it('every test has 13 questions with unique numbers and valid answers', () => {
    const ids = new Set<string>();
    for (const t of [...READING_TESTS, ...HARD_TESTS]) {
      expect(ids.has(t.id)).toBe(false);
      ids.add(t.id);
      expect(t.questions).toHaveLength(13);
      expect(new Set(t.questions.map((q) => q.n)).size).toBe(13);
      for (const q of t.questions) {
        if (q.type === 'tfng') expect(['TRUE', 'FALSE', 'NOT GIVEN']).toContain(q.answer);
        if (q.type === 'mcq') {
          expect(q.options).toHaveLength(4);
          expect(['A', 'B', 'C', 'D']).toContain(q.answer);
        }
        if (q.type === 'gap') expect(q.answer.split(/\s+/).length).toBeLessThanOrEqual(2);
        expect(q.explain.length).toBeGreaterThan(0);
      }
    }
    expect(READING_TESTS.length).toBe(24);
    expect(HARD_TESTS.length).toBe(5);
  });
});

describe('answers are checked by the key, fair about form', () => {
  const gap = (answer: string, accept?: string[]): ReadingQuestion => ({ n: 1, type: 'gap', prompt: '', answer, accept, explain: 'Paragraph C.' });
  it('ignores case, a leading article, spaces, hyphens and punctuation', () => {
    expect(isCorrect(gap('seabed'), ' The Sea Bed. ')).toBe(true);
    expect(isCorrect(gap('wind farm'), 'a wind-farm')).toBe(true);
    expect(isCorrect(gap('mean'), 'MEAN!')).toBe(true);
  });
  it('accepts listed synonyms, digits for number words and British or American spelling', () => {
    expect(isCorrect(gap('teeth', ['paintings']), 'paintings')).toBe(true);
    expect(isCorrect(gap('ten'), '10')).toBe(true);
    expect(isCorrect(gap('metres'), 'meters')).toBe(true);
    expect(isCorrect(gap('organisation'), 'organization')).toBe(true);
    expect(isCorrect(gap('colour'), 'color')).toBe(true);
  });
  it('is still the key: a different word or a misspelling is wrong', () => {
    expect(isCorrect(gap('mean'), 'average')).toBe(false);
    expect(isCorrect(gap('naloxone'), 'naloxon')).toBe(false);
    expect(isCorrect(gap('four'), 'for')).toBe(false);
    expect(isCorrect(gap('mean'), '')).toBe(false);
  });
  it('TRUE / FALSE / NOT GIVEN and letters', () => {
    const tf: ReadingQuestion = { n: 1, type: 'tfng', prompt: '', answer: 'NOT GIVEN', explain: '' };
    expect(isCorrect(tf, 'not given')).toBe(true);
    expect(isCorrect(tf, 'NG')).toBe(true);
    expect(isCorrect(tf, 'FALSE')).toBe(false);
    const mcq: ReadingQuestion = { n: 1, type: 'mcq', prompt: '', options: ['a', 'b', 'c', 'd'], answer: 'B', explain: '' };
    expect(isCorrect(mcq, 'b')).toBe(true);
  });
  it('a wrong answer gets a paragraph hint, not the answer', () => {
    expect(paragraphHint('Paragraph B: the proposal met scepticism.')).toBe('B');
    expect(paragraphHint('no paragraph here')).toBeNull();
  });
});

describe('Reading is split into small tasks with their own price', () => {
  const [tfng, mcq, gap, all] = readingParts(READING_TESTS[0], false);
  it('one type of questions per task, 4–5 questions each, plus the whole passage', () => {
    expect([tfng.part, mcq.part, gap.part, all.part]).toEqual(['tfng', 'mcq', 'gap', 'all']);
    for (const p of [tfng, mcq, gap]) {
      expect(p.questions.length).toBeGreaterThanOrEqual(4);
      expect(p.questions.length).toBeLessThanOrEqual(5);
      expect(p.questions.every((q) => q.type === p.part)).toBe(true);
    }
    expect(all.questions).toHaveLength(13);
  });
  it('a longer or harder task pays more; the whole passage more than its parts', () => {
    expect(all.price).toBeGreaterThan(tfng.price + mcq.price + gap.price);
    expect(all.minutes).toBeGreaterThan(tfng.minutes);
    const hard = readingParts(HARD_TESTS[0], true);
    expect(hard[0].price).toBeGreaterThan(tfng.price);
    expect(hard[0].level).toBe(3);
  });
  it('ids round-trip', () => {
    expect(findReadingPart('r:rt-01:mcq')?.questions).toHaveLength(4);
    expect(findReadingPart('r:boss-2:all')?.hard).toBe(true);
    expect(findReadingPart('r:nope:mcq')).toBeNull();
    expect(findReadingPart('rt-01')).toBeNull();
  });
  it('pays price × share right; under 50% or too fast — nothing', () => {
    expect(readingPay(tfng, 5, 5, 300)).toEqual({ pay: tfng.price, passed: true, fast: false });
    expect(readingPay(tfng, 4, 5, 300).pay).toBe(Math.round(tfng.price * 0.8));
    expect(readingPay(tfng, 2, 5, 300)).toEqual({ pay: 0, passed: false, fast: false });
    expect(readingPay(tfng, 5, 5, 30)).toEqual({ pay: 0, passed: true, fast: true });
  });
});

describe('band scale', () => {
  it('follows the official Academic Reading table', () => {
    expect(rawToBand(40)).toBe(9);
    expect(rawToBand(30)).toBe(7);
    expect(rawToBand(0)).toBe(2.5);
    expect(bandForTest(10, 13)).toBe(7);
  });
});

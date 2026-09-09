import { describe, expect, it } from 'vitest';
import { READING_TESTS, bandForTest, creditForAttempt, isCorrect, minutesForBand, rawToBand } from '@tracker/shared';

describe('reading bank', () => {
  it('every test has 13 questions with unique numbers and valid answers', () => {
    expect(READING_TESTS.length).toBeGreaterThanOrEqual(4);
    const ids = new Set<string>();
    for (const t of READING_TESTS) {
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
  });

  it('grades answers case- and punctuation-insensitively', () => {
    const q = READING_TESTS[0].questions.find((x) => x.type === 'gap')!;
    expect(isCorrect(q, q.answer.toUpperCase())).toBe(true);
    expect(isCorrect(q, ` ${q.answer}. `)).toBe(true);
    expect(isCorrect(q, '')).toBe(false);
    expect(isCorrect(q, 'definitely-not-it')).toBe(false);
  });
});

describe('band scale', () => {
  it('follows the official Academic Reading table', () => {
    expect(rawToBand(40)).toBe(9);
    expect(rawToBand(30)).toBe(7);
    expect(rawToBand(23)).toBe(6);
    expect(rawToBand(15)).toBe(5);
    expect(rawToBand(0)).toBe(2.5);
  });

  it('scales a 13-question test onto it', () => {
    expect(bandForTest(13, 13)).toBe(9);
    expect(bandForTest(10, 13)).toBe(7); // 31/40
    expect(bandForTest(8, 13)).toBe(6);  // 25/40
    expect(bandForTest(0, 13)).toBe(2.5);
  });
});

describe('minutes earned', () => {
  const base = { seconds: 60, repeat: false, earnedToday: 0, balance: 0, dailyCap: 60, bankCap: 120 };

  it('pays the agreed rate', () => {
    expect(minutesForBand(7)).toBe(30);
    expect(minutesForBand(6.5)).toBe(30);
    expect(minutesForBand(6)).toBe(15);
    expect(minutesForBand(5.5)).toBe(10);
    expect(minutesForBand(5)).toBe(10);
    expect(minutesForBand(4.5)).toBe(5);
  });

  it('halves the reward when the test ran over the limit', () => {
    const r = creditForAttempt({ ...base, band: 7, seconds: 40 * 60, limitMin: 25 });
    expect(r.halved).toBe(true);
    expect(r.earned).toBe(15);
  });

  it('pays nothing for a repeat of an already rewarded test', () => {
    const r = creditForAttempt({ ...base, band: 7, repeat: true });
    expect(r.earned).toBe(0);
    expect(r.halved).toBe(false);
  });

  it('clamps to the daily cap', () => {
    const r = creditForAttempt({ ...base, band: 7, earnedToday: 50, dailyCap: 60 });
    expect(r.earned).toBe(10);
    expect(r.capped).toBe(true);
  });

  it('clamps to the bank cap so minutes cannot be hoarded forever', () => {
    const r = creditForAttempt({ ...base, band: 7, balance: 115, bankCap: 120 });
    expect(r.earned).toBe(5);
    expect(r.capped).toBe(true);
  });

  it('never returns a negative credit', () => {
    const r = creditForAttempt({ ...base, band: 7, balance: 200, bankCap: 120 });
    expect(r.earned).toBe(0);
  });
});

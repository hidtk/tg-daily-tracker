import { describe, expect, it } from 'vitest';
import { BOSSES, BOSS_TESTS, EARN, EMPTY_DAY, READING_TESTS, XP, computeGameStreak, dayXp, isReadingCounted, levelFor, minutesForBand, nonReadingValue, questsFor, settlePlan, xpToReach } from '@tracker/shared';

describe('levels', () => {
  it('each step costs 25 XP more', () => {
    expect(xpToReach(1)).toBe(0);
    expect(xpToReach(2)).toBe(100);
    expect(xpToReach(3)).toBe(225);
    expect(xpToReach(6) - xpToReach(5)).toBe(200);
  });
  it('a boss caps the level until it is beaten', () => {
    const xp = xpToReach(7) + 10;
    expect(levelFor(xp, [])).toEqual({ level: 5, gatedBy: BOSSES[0] });
    expect(levelFor(xp, ['boss-1'])).toEqual({ level: 7, gatedBy: null });
    expect(levelFor(xpToReach(12), ['boss-1']).level).toBe(10);
    expect(levelFor(0, []).level).toBe(1);
  });
  it('every boss has a harder test in the bank', () => {
    for (const b of BOSSES) {
      const t = BOSS_TESTS.find((x) => x.id === b.id)!;
      expect(t.questions).toHaveLength(13);
      expect(t.minutes).toBeGreaterThanOrEqual(20);
      expect(t.paragraphs.join(' ').length).toBeGreaterThan(Math.max(...READING_TESTS.map((r) => r.paragraphs.join(' ').length)) * 0.9);
    }
  });
});

describe('streak', () => {
  it('counts consecutive Reading days, today unfinished does not break it', () => {
    expect(computeGameStreak(['2026-09-26', '2026-09-27', '2026-09-28'], '2026-09-29')).toEqual({ current: 3, best: 3, shields: 0, today_done: false });
    expect(computeGameStreak(['2026-09-27', '2026-09-29'], '2026-09-29').current).toBe(1);
    expect(computeGameStreak([], '2026-09-29').current).toBe(0);
  });
  it('seven days earn a shield that saves one missed day', () => {
    const week = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06', '2026-09-07'];
    const s = computeGameStreak([...week, '2026-09-09'], '2026-09-09');
    expect(s.current).toBe(8);
    expect(s.shields).toBe(0);
    // no shield left: the next gap resets
    expect(computeGameStreak([...week, '2026-09-09', '2026-09-11'], '2026-09-11').current).toBe(1);
    expect(computeGameStreak([...week, '2026-09-09', '2026-09-11'], '2026-09-11').best).toBe(8);
  });
});

describe('quests and XP', () => {
  it('three quests; the words target shrinks when few words are learned', () => {
    const q = questsFor({ ...EMPTY_DAY, readingCounted: 1, wordsOk: 3, sentences: 1 }, 3);
    expect(q.map((x) => x.done)).toEqual([true, true, true]);
    expect(questsFor({ ...EMPTY_DAY, wordsOk: 9 })[1].done).toBe(false);
  });
  it('a full day gives quest and chest XP on top of the work', () => {
    const d = { ...EMPTY_DAY, readingCounted: 1, readingXp: XP.readingBase + 10 * XP.readingPerCorrect, wordsOk: 10, sentences: 1 };
    const r = dayXp(d);
    expect(r.chest).toBe(true);
    expect(r.xp).toBe(30 + 20 + 5 + 3 * XP.quest + XP.chest);
  });
  it('caps word XP per day', () => {
    expect(dayXp({ ...EMPTY_DAY, wordsOk: 100 }).xp).toBe(XP.wordsCap + XP.quest);
  });
  it('a Reading attempt counts only if not rushed and not guessed', () => {
    expect(isReadingCounted(600, 9)).toBe(true);
    expect(isReadingCounted(120, 13)).toBe(false);
    expect(isReadingCounted(900, 3)).toBe(false);
  });
});

describe('exchange rate', () => {
  it('Reading pays more than any other single task', () => {
    expect(minutesForBand(6.5)).toBeGreaterThan(EARN.writing);
    expect(minutesForBand(6.5)).toBeGreaterThan(EARN.wordsCap + EARN.sentencesCap);
  });
  it('each source has its own ceiling', () => {
    const v = nonReadingValue({ wordsOk: 100, sentences: 40, writings: 3, voices: 5 });
    expect(v).toEqual({ words: EARN.wordsCap, sentence: EARN.sentencesCap, writing: EARN.writing, speaking: EARN.speaking * EARN.speakingPerDay, total: EARN.wordsCap + EARN.sentencesCap + EARN.writing + 2 * EARN.speaking });
  });
  const base = { chestDue: false, earnedToday: 0, dailyCap: 60, balance: 0, bankCap: 120 };
  it('without Reading only the free part is paid, the rest waits', () => {
    expect(settlePlan({ ...base, value: 15, paid: 0, readingDone: false })).toMatchObject({ pay: 10, held: 5 });
    // idempotent: nothing more until Reading
    expect(settlePlan({ ...base, value: 15, paid: 10, readingDone: false })).toMatchObject({ pay: 0, held: 5 });
  });
  it('Reading releases what waited, and the chest pays once', () => {
    expect(settlePlan({ ...base, value: 15, paid: 10, readingDone: true, chestDue: true })).toMatchObject({ pay: 5, chest: EARN.chest, held: 0 });
  });
  it('daily cap and bank cap clamp the payout', () => {
    expect(settlePlan({ ...base, value: 15, paid: 0, readingDone: true, earnedToday: 55 })).toMatchObject({ pay: 5, capped: true });
    expect(settlePlan({ ...base, value: 15, paid: 0, readingDone: true, balance: 118 }).pay).toBe(2);
    // a debt leaves room: earnings pay it back
    expect(settlePlan({ ...base, value: 5, paid: 0, readingDone: true, balance: -20 }).pay).toBe(5);
  });
});

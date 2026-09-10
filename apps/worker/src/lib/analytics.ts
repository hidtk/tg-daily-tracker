import { REVIEW_INTERVALS, VOCAB, addDays, weekdayMon0, type AnalyticsResponse, type AnalyticsWeek } from '@tracker/shared';
import type { Repo, UserRow } from './db';

export async function analytics(repo: Repo, user: UserRow, today: string): Promise<AnalyticsResponse> {
  const monday = addDays(today, -weekdayMon0(today));
  const weeksFrom = Array.from({ length: 8 }, (_, i) => addDays(monday, -7 * (7 - i)));
  const from = weeksFrom[0];
  const weekOf = (date: string) => weeksFrom.filter((w) => w <= date).pop() ?? null;

  const all = await repo.vocabAll(user.id);
  const reviews = await repo.vocabHistory(user.id, from);
  const sentences = await repo.sentencesHistory(user.id, from);
  const attempts = await repo.allAttemptsSince(user.id, from);
  const attemptsAll = await repo.attempts(user.id, 200);

  const weeks: AnalyticsWeek[] = weeksFrom.map((w) => ({ from: w, words_introduced: 0, reviews: 0, recalled: 0, sentences: 0, reading_tests: 0, reading_band: null }));
  const idx = new Map(weeksFrom.map((w, i) => [w, i]));
  const bands: number[][] = weeksFrom.map(() => []);

  for (const r of all) {
    const w = weekOf(r.introduced_on);
    if (w) weeks[idx.get(w)!].words_introduced++;
  }
  for (const h of reviews) {
    const w = weekOf(h.date);
    if (w) {
      weeks[idx.get(w)!].reviews += h.reviews;
      weeks[idx.get(w)!].recalled += h.correct;
    }
  }
  for (const h of sentences) {
    const w = weekOf(h.date);
    if (w) weeks[idx.get(w)!].sentences += h.n;
  }
  for (const a of attempts) {
    const w = weekOf(a.date);
    if (w) {
      weeks[idx.get(w)!].reading_tests++;
      bands[idx.get(w)!].push(a.band);
    }
  }
  weeks.forEach((wk, i) => {
    if (bands[i].length) wk.reading_band = Math.round((bands[i].reduce((s, b) => s + b, 0) / bands[i].length) * 10) / 10;
  });

  const allBands = attemptsAll.map((a) => a.band);
  const sentencesTotal = (await repo.sentencesHistory(user.id, '2000-01-01')).reduce((s, h) => s + h.n, 0);
  return {
    weeks,
    words: {
      introduced: all.length,
      mastered: all.filter((r) => r.stage >= REVIEW_INTERVALS.length).length,
      total: VOCAB.length,
      sentences_total: sentencesTotal,
    },
    reading: {
      tests: attemptsAll.length,
      avg_band: allBands.length ? Math.round((allBands.reduce((s, b) => s + b, 0) / allBands.length) * 10) / 10 : null,
      best_band: allBands.length ? Math.max(...allBands) : null,
      last: attemptsAll.slice(0, 12).map((a) => ({ date: a.date, band: a.band, test_id: a.test_id })),
    },
  };
}

/**
 * Achievements: a short list with plain rules. Progress is always recomputed from what was really done
 * (never typed in); reaching the target pays the bonus minutes once and gives the badge.
 * Titles and "how to get it" texts live in the app (i18n), keyed by id.
 */
import { addDays } from './dates';

export interface AchievementStats {
  /** paid tasks of any kind */
  paidTasks: number;
  /** Reading parts that paid (50%+ right, not rushed) */
  readingPassed: number;
  /** Reading parts with every answer right */
  readingPerfect: number;
  /** passages finished: all three parts, or the whole passage at once */
  passages: number;
  /** words typed right without a hint */
  wordsRight: number;
  sentences: number;
  writings: number;
  speakings: number;
  /** dates with at least one paid task */
  activeDays: string[];
  /** days with Reading + words/sentences + Writing/Speaking */
  mixedDays: number;
}

export type AchievementId =
  | 'first'
  | 'reading10'
  | 'passage'
  | 'perfect5'
  | 'words50'
  | 'sentences20'
  | 'writing5'
  | 'speaking5'
  | 'mix'
  | 'week'
  | 'days30';

export interface AchievementDef {
  id: AchievementId;
  target: number;
  /** bonus minutes, paid once */
  bonus: number;
  progress: (s: AchievementStats) => number;
}

/** Longest run of consecutive dates. */
export function longestRun(dates: string[]): number {
  const set = new Set(dates);
  let best = 0;
  for (const d of set) {
    if (set.has(addDays(d, -1))) continue;
    let n = 1;
    while (set.has(addDays(d, n))) n++;
    best = Math.max(best, n);
  }
  return best;
}

/** Current run ending today (or yesterday, if today has nothing yet). */
export function currentRun(dates: string[], today: string): number {
  const set = new Set(dates);
  let d = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first', target: 1, bonus: 2, progress: (s) => s.paidTasks },
  { id: 'reading10', target: 10, bonus: 5, progress: (s) => s.readingPassed },
  { id: 'passage', target: 1, bonus: 5, progress: (s) => s.passages },
  { id: 'perfect5', target: 5, bonus: 5, progress: (s) => s.readingPerfect },
  { id: 'words50', target: 50, bonus: 5, progress: (s) => s.wordsRight },
  { id: 'sentences20', target: 20, bonus: 5, progress: (s) => s.sentences },
  { id: 'writing5', target: 5, bonus: 10, progress: (s) => s.writings },
  { id: 'speaking5', target: 5, bonus: 5, progress: (s) => s.speakings },
  { id: 'mix', target: 1, bonus: 5, progress: (s) => s.mixedDays },
  { id: 'week', target: 7, bonus: 10, progress: (s) => longestRun(s.activeDays) },
  { id: 'days30', target: 30, bonus: 15, progress: (s) => new Set(s.activeDays).size },
];

export interface AchievementView {
  id: AchievementId;
  target: number;
  progress: number;
  bonus: number;
  /** date the badge was earned, null while in progress */
  earned_on: string | null;
}

export function achievementViews(stats: AchievementStats, earned: Map<string, string>): AchievementView[] {
  return ACHIEVEMENTS.map((a) => ({
    id: a.id,
    target: a.target,
    progress: Math.min(a.target, a.progress(stats)),
    bonus: a.bonus,
    earned_on: earned.get(a.id) ?? null,
  }));
}

/** Reached but not yet recorded: these pay their bonus now. */
export function newlyReached(stats: AchievementStats, earned: Set<string>): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => !earned.has(a.id) && a.progress(stats) >= a.target);
}

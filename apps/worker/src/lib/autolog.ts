import type { Skill } from '@tracker/shared';
import type { Repo, UserRow } from './db';

/**
 * Automatic day log: the day's minutes and skills are derived from what was actually done in the app,
 * so nothing has to be entered by hand. Recomputed from the source tables each time — idempotent.
 */
export const AUTO_MINUTES = { vocabReview: 0.5, sentence: 2, readingMaxPerTest: 60 } as const;

export async function syncDay(repo: Repo, user: UserRow, date: string): Promise<void> {
  const act = (await repo.listActivities(user.id)).find((a) => a.kind === 'ielts');
  if (!act) return;
  const a = await repo.activityOn(user.id, date, AUTO_MINUTES.readingMaxPerTest * 60);
  const reading = a.readingSeconds / 60;
  const vocab = a.reviews * AUTO_MINUTES.vocabReview;
  const writing = a.sentences * AUTO_MINUTES.sentence;
  const skills: Skill[] = [];
  if (a.readingTests) skills.push('reading');
  if (a.reviews) skills.push('vocab');
  if (a.sentences) skills.push('writing');
  if (!skills.length) return;
  const minutes = Math.max(1, Math.round(reading + vocab + writing));
  await repo.autoEntry(user.id, act.id, date, minutes, skills);
}

/** Never let the log break the action that triggered it. */
export async function syncDaySafe(repo: Repo, user: UserRow, date: string): Promise<void> {
  try {
    await syncDay(repo, user, date);
  } catch (e) {
    console.error('syncDay', e);
  }
}

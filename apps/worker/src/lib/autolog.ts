type Skill = 'reading' | 'vocab' | 'writing' | 'speaking';
import type { Repo, UserRow } from './db';

/**
 * Automatic day log: the day's minutes and skills are derived from what was actually done in the app,
 * so nothing has to be entered by hand. Recomputed from the source tables each time — idempotent.
 */
export const AUTO_MINUTES = { vocabReview: 0.5, sentence: 2, readingMaxPerTest: 60, speakingPrep: 1 } as const;

export async function syncDay(repo: Repo, user: UserRow, date: string): Promise<void> {
  const a = await repo.activityOn(user.id, date, AUTO_MINUTES.readingMaxPerTest * 60);
  const writings = a.writings ?? 0;
  const voices = a.voices ?? 0;
  const reading = a.readingSeconds / 60;
  const vocab = a.reviews * AUTO_MINUTES.vocabReview;
  // A Writing text counts by the time it took (capped like a Reading test); a Speaking answer by its length plus preparation.
  const writing = a.sentences * AUTO_MINUTES.sentence + (a.writingSeconds ?? 0) / 60;
  const speaking = (a.voiceSeconds ?? 0) / 60 + voices * AUTO_MINUTES.speakingPrep;
  const skills: Skill[] = [];
  if (a.readingTests) skills.push('reading');
  if (a.reviews) skills.push('vocab');
  if (a.sentences || writings) skills.push('writing');
  if (voices) skills.push('speaking');
  if (!skills.length) return;
  const minutes = Math.max(1, Math.round(reading + vocab + writing + speaking));
  await repo.autoEntry(user.id, await repo.ieltsActivityId(user.id), date, minutes, skills);
}

/** Never let the log break the action that triggered it. */
export async function syncDaySafe(repo: Repo, user: UserRow, date: string): Promise<void> {
  try {
    await syncDay(repo, user, date);
  } catch (e) {
    console.error('syncDay', e);
  }
}

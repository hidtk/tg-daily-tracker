import { describe, expect, it } from 'vitest';
import { syncDay } from '../src/lib/autolog';
import type { Repo, UserRow } from '../src/lib/db';

function fakeRepo(a: { readingTests: number; readingSeconds: number; reviews: number; sentences: number; writings?: number; writingSeconds?: number; voices?: number; voiceSeconds?: number }) {
  const calls: unknown[][] = [];
  const repo = {
    listActivities: async () => [{ id: 7, kind: 'ielts' }],
    activityOn: async () => a,
    autoEntry: async (...args: unknown[]) => void calls.push(args),
  } as unknown as Repo;
  return { repo, calls };
}
const user = { id: 1 } as UserRow;

describe('automatic day log', () => {
  it('sums reading time, reviews and sentences into one done entry', async () => {
    const { repo, calls } = fakeRepo({ readingTests: 1, readingSeconds: 1200, reviews: 10, sentences: 2 });
    await syncDay(repo, user, '2026-09-28');
    expect(calls).toEqual([[1, 7, '2026-09-28', 29, ['reading', 'vocab', 'writing']]]);
  });
  it('writes nothing on a day without activity', async () => {
    const { repo, calls } = fakeRepo({ readingTests: 0, readingSeconds: 0, reviews: 0, sentences: 0 });
    await syncDay(repo, user, '2026-09-28');
    expect(calls).toEqual([]);
  });
  it('counts at least one minute for a single review', async () => {
    const { repo, calls } = fakeRepo({ readingTests: 0, readingSeconds: 0, reviews: 1, sentences: 0 });
    await syncDay(repo, user, '2026-09-28');
    expect(calls[0][3]).toBe(1);
  });
  it('adds Writing by time and Speaking by voice length plus preparation', async () => {
    const { repo, calls } = fakeRepo({ readingTests: 0, readingSeconds: 0, reviews: 0, sentences: 0, writings: 1, writingSeconds: 900, voices: 2, voiceSeconds: 150 });
    await syncDay(repo, user, '2026-09-28');
    expect(calls).toEqual([[1, 7, '2026-09-28', 15 + 3 + 2, ['writing', 'speaking']]]);
  });
});

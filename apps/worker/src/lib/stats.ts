import type { Activity, Entry, HeatmapDay, StreakInfo } from '@tracker/shared';
import { addDays, computeStreak, diffDays, isScheduledOn, weekdayMon0 } from '@tracker/shared';
import type { Repo } from './db';

const STREAK_LOOKBACK_DAYS = 365;

export async function computeStreaks(repo: Repo, userId: number, activities: Activity[], today: string): Promise<StreakInfo[]> {
  const from = addDays(today, -STREAK_LOOKBACK_DAYS);
  const entries = await repo.entriesBetween(userId, from, today);
  const doneByActivity = new Map<number, Set<string>>();
  const totals = new Map<number, number>();
  for (const e of entries) {
    if (!e.done) continue;
    if (!doneByActivity.has(e.activity_id)) doneByActivity.set(e.activity_id, new Set());
    doneByActivity.get(e.activity_id)!.add(e.date);
    totals.set(e.activity_id, (totals.get(e.activity_id) ?? 0) + 1);
  }
  return activities.map((a) => {
    const { current, best } = computeStreak(a, doneByActivity.get(a.id) ?? new Set(), today, from);
    return { activity_id: a.id, current, best, done_total: totals.get(a.id) ?? 0 };
  });
}

export function heatmapForRange(activities: Activity[], entries: Entry[], from: string, to: string): HeatmapDay[] {
  const byDate = new Map<string, Entry[]>();
  for (const e of entries) {
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date)!.push(e);
  }
  const days: HeatmapDay[] = [];
  for (let d = from; diffDays(d, to) >= 0; d = addDays(d, 1)) {
    const es = byDate.get(d) ?? [];
    const scheduled = activities.filter((a) => isScheduledOn(a, d)).length;
    days.push({
      date: d,
      scheduled,
      planned: es.filter((e) => e.planned).length,
      done: es.filter((e) => e.done).length,
    });
  }
  return days;
}

export interface WeekStats {
  from: string;
  to: string;
  perActivity: { activity: Activity; done: number; scheduled: number }[];
  doneTotal: number;
  scheduledTotal: number;
}

/** Monday..Sunday week containing `date`. */
export function weekBounds(date: string): { from: string; to: string } {
  const from = addDays(date, -weekdayMon0(date));
  return { from, to: addDays(from, 6) };
}

export async function weekStats(repo: Repo, userId: number, activities: Activity[], anyDateInWeek: string): Promise<WeekStats> {
  const { from, to } = weekBounds(anyDateInWeek);
  const entries = await repo.entriesBetween(userId, from, to);
  const perActivity = activities.map((activity) => {
    let scheduled = 0;
    for (let d = from; diffDays(d, to) >= 0; d = addDays(d, 1)) if (isScheduledOn(activity, d)) scheduled++;
    const done = entries.filter((e) => e.activity_id === activity.id && e.done).length;
    return { activity, done, scheduled };
  });
  return {
    from,
    to,
    perActivity,
    doneTotal: perActivity.reduce((s, x) => s + x.done, 0),
    scheduledTotal: perActivity.reduce((s, x) => s + x.scheduled, 0),
  };
}

import type { Activity, Entry, HeatmapDay, IeltsResponse, Skill, StreakInfo, WeekStat } from '@tracker/shared';
import { SKILLS, addDays, computeStreak, countsAsDone, diffDays, isConfirmed, isScheduledOn, weekdayMon0 } from '@tracker/shared';
import type { Repo, UserRow } from './db';

const STREAK_LOOKBACK_DAYS = 365;

export async function computeStreaks(repo: Repo, userId: number, activities: Activity[], today: string, strict: boolean): Promise<StreakInfo[]> {
  const from = addDays(today, -STREAK_LOOKBACK_DAYS);
  const entries = await repo.entriesBetween(userId, from, today);
  const doneByActivity = new Map<number, Set<string>>();
  const skipByActivity = new Map<number, Set<string>>();
  const totals = new Map<number, number>();
  for (const e of entries) {
    if (e.skipped && !countsAsDone(e, strict)) {
      if (!skipByActivity.has(e.activity_id)) skipByActivity.set(e.activity_id, new Set());
      skipByActivity.get(e.activity_id)!.add(e.date);
    }
    if (!countsAsDone(e, strict)) continue;
    if (!doneByActivity.has(e.activity_id)) doneByActivity.set(e.activity_id, new Set());
    doneByActivity.get(e.activity_id)!.add(e.date);
    totals.set(e.activity_id, (totals.get(e.activity_id) ?? 0) + 1);
  }
  return activities.map((a) => {
    const { current, best } = computeStreak(a, doneByActivity.get(a.id) ?? new Set(), today, from, skipByActivity.get(a.id));
    return { activity_id: a.id, current, best, done_total: totals.get(a.id) ?? 0 };
  });
}

export function heatmapForRange(activities: Activity[], entries: Entry[], from: string, to: string, strict: boolean): HeatmapDay[] {
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
      done: es.filter((e) => countsAsDone(e, strict)).length,
      confirmed: es.filter((e) => isConfirmed(e)).length,
    });
  }
  return days;
}

export interface WeekStats {
  from: string;
  to: string;
  perActivity: { activity: Activity; done: number; scheduled: number; unconfirmed: number; skipped: number }[];
  doneTotal: number;
  scheduledTotal: number;
}

/** Monday..Sunday week containing `date`. */
export function weekBounds(date: string): { from: string; to: string } {
  const from = addDays(date, -weekdayMon0(date));
  return { from, to: addDays(from, 6) };
}

export async function weekStats(repo: Repo, userId: number, activities: Activity[], anyDateInWeek: string, strict: boolean): Promise<WeekStats> {
  const { from, to } = weekBounds(anyDateInWeek);
  const entries = await repo.entriesBetween(userId, from, to);
  const perActivity = activities.map((activity) => {
    let scheduled = 0;
    for (let d = from; diffDays(d, to) >= 0; d = addDays(d, 1)) if (isScheduledOn(activity, d)) scheduled++;
    const mine = entries.filter((e) => e.activity_id === activity.id);
    const done = mine.filter((e) => countsAsDone(e, strict)).length;
    const unconfirmed = mine.filter((e) => e.done && !isConfirmed(e)).length;
    const skipped = mine.filter((e) => e.skipped && !countsAsDone(e, strict)).length;
    return { activity, done, scheduled, unconfirmed, skipped };
  });
  return {
    from,
    to,
    perActivity,
    doneTotal: perActivity.reduce((s, x) => s + x.done, 0),
    scheduledTotal: perActivity.reduce((s, x) => s + x.scheduled, 0),
  };
}

/** Scheduled activities for `date` that do not count as done and were not consciously skipped. */
export function missedOn(activities: Activity[], entries: Entry[], date: string, strict: boolean): Activity[] {
  const byId = new Map(entries.filter((e) => e.date === date).map((e) => [e.activity_id, e]));
  return activities.filter((a) => {
    if (!isScheduledOn(a, date)) return false;
    const e = byId.get(a.id);
    return !(e && (countsAsDone(e, strict) || e.skipped));
  });
}

/** Consciously skipped scheduled activities for `date` with reasons. */
export function skippedOn(activities: Activity[], entries: Entry[], date: string, strict: boolean): { activity: Activity; reason: string | null }[] {
  const byId = new Map(entries.filter((e) => e.date === date).map((e) => [e.activity_id, e]));
  return activities
    .filter((a) => isScheduledOn(a, date) && byId.get(a.id)?.skipped && !countsAsDone(byId.get(a.id)!, strict))
    .map((a) => ({ activity: a, reason: byId.get(a.id)!.skip_reason }));
}

const IELTS_WEEKS = 12;

export async function ieltsStats(repo: Repo, u: UserRow, activities: Activity[], today: string): Promise<IeltsResponse> {
  const strict = !!u.strict_mode;
  const ielts = activities.filter((a) => a.kind === 'ielts');
  const ieltsIds = new Set(ielts.map((a) => a.id));
  const thisMonday = weekBounds(today).from;
  const from = addDays(thisMonday, -7 * (IELTS_WEEKS - 1));
  const entries = await repo.entriesBetween(u.id, from, today);
  const since = u.created_at.slice(0, 10); // don't count days before the user existed
  const weeks: WeekStat[] = [];
  for (let i = 0; i < IELTS_WEEKS; i++) {
    const wFrom = addDays(from, i * 7);
    const wTo = addDays(wFrom, 6);
    const minutes_by_skill = Object.fromEntries(SKILLS.map((s) => [s, 0])) as Record<Skill, number>;
    let minutes_total = 0;
    let done = 0;
    let confirmed = 0;
    let scheduled = 0;
    for (let d = wFrom; diffDays(d, wTo) >= 0 && diffDays(d, today) >= 0; d = addDays(d, 1)) {
      if (d < since) continue;
      scheduled += ielts.filter((a) => isScheduledOn(a, d)).length;
    }
    for (const e of entries) {
      if (!ieltsIds.has(e.activity_id) || e.date < wFrom || e.date > wTo) continue;
      if (countsAsDone(e, strict)) {
        done++;
        minutes_total += e.minutes;
        const sk = e.skills?.length ? e.skills : null;
        if (sk) for (const s of sk) minutes_by_skill[s] += Math.round(e.minutes / sk.length);
      }
      if (isConfirmed(e)) confirmed++;
    }
    weeks.push({ from: wFrom, minutes_by_skill, minutes_total, scheduled, done, confirmed });
  }
  const last4 = weeks.slice(-4);
  const sched4 = last4.reduce((s, w) => s + w.scheduled, 0);
  const done4 = last4.reduce((s, w) => s + w.done, 0);
  const streaks = ielts.length ? await computeStreaks(repo, u.id, ielts, today, strict) : [];
  const best = streaks.sort((a, b) => b.current - a.current)[0];
  return {
    target: u.ielts_target ?? 7,
    exam_date: u.ielts_exam_date,
    days_left: u.ielts_exam_date ? diffDays(today, u.ielts_exam_date) : null,
    deadline_editable: u.ielts_deadline_changed_on !== today,
    weekly_hours: u.ielts_weekly_hours ?? 7,
    weeks,
    mocks: await repo.listMocks(u.id),
    total_minutes: weeks.reduce((s, w) => s + w.minutes_total, 0),
    discipline: sched4 ? Math.round((done4 / sched4) * 100) : 0,
    streak: best ? { current: best.current, best: best.best } : null,
  };
}

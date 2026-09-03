import { describe, expect, it } from 'vitest';
import { computeStreak, isEditable, isScheduledOn, monthBounds, todayInTz, weekdayMon0 } from '@tracker/shared';
import { validateInitData } from '../src/lib/telegram';
import { issueToken, verifyToken } from '../src/lib/session';
import { hmacSha256, toHex } from '../src/lib/crypto';

describe('schedule', () => {
  it('daily is always scheduled', () => {
    expect(isScheduledOn({ schedule_type: 'daily', schedule_days: null, anchor_date: null }, '2026-09-02')).toBe(true);
  });
  it('every_other_day alternates from anchor', () => {
    const a = { schedule_type: 'every_other_day' as const, schedule_days: null, anchor_date: '2026-09-01' };
    expect(isScheduledOn(a, '2026-09-01')).toBe(true);
    expect(isScheduledOn(a, '2026-09-02')).toBe(false);
    expect(isScheduledOn(a, '2026-09-03')).toBe(true);
    expect(isScheduledOn(a, '2026-08-30')).toBe(true);
  });
  it('weekdays uses Monday=0', () => {
    expect(weekdayMon0('2026-09-02')).toBe(2); // Wednesday
    const a = { schedule_type: 'weekdays' as const, schedule_days: [0, 2, 4], anchor_date: null };
    expect(isScheduledOn(a, '2026-09-02')).toBe(true);
    expect(isScheduledOn(a, '2026-09-03')).toBe(false);
  });
  it('monthBounds handles Feb and Dec', () => {
    expect(monthBounds('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(monthBounds('2026-12')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });
  it('editable window', () => {
    expect(isEditable('2026-09-02', '2026-09-02')).toBe(true);
    expect(isEditable('2026-09-01', '2026-09-02')).toBe(true);
    expect(isEditable('2026-08-31', '2026-09-02')).toBe(false);
    expect(isEditable('2026-09-03', '2026-09-02')).toBe(false);
  });
  it('todayInTz', () => {
    const now = new Date('2026-09-02T22:30:00Z');
    expect(todayInTz('UTC', now)).toBe('2026-09-02');
    expect(todayInTz('Europe/Moscow', now)).toBe('2026-09-03');
  });
});

describe('streaks', () => {
  const daily = { schedule_type: 'daily' as const, schedule_days: null, anchor_date: null };
  it('counts consecutive scheduled days; unfinished today does not break', () => {
    const done = new Set(['2026-08-30', '2026-08-31', '2026-09-01']);
    expect(computeStreak(daily, done, '2026-09-02', '2026-08-01')).toEqual({ current: 3, best: 3 });
  });
  it('a missed scheduled day breaks the streak', () => {
    const done = new Set(['2026-08-28', '2026-08-29', '2026-08-31', '2026-09-01']);
    expect(computeStreak(daily, done, '2026-09-02', '2026-08-01')).toEqual({ current: 2, best: 2 });
  });
  it('every_other_day skips off days without breaking', () => {
    const eod = { schedule_type: 'every_other_day' as const, schedule_days: null, anchor_date: '2026-09-02' };
    const done = new Set(['2026-08-29', '2026-08-31', '2026-09-02']);
    expect(computeStreak(eod, done, '2026-09-02', '2026-08-20')).toEqual({ current: 3, best: 3 });
  });
});

describe('telegram initData', () => {
  const token = '123456:ABC-DEF';
  async function sign(params: Record<string, string>) {
    const dcs = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const secret = await hmacSha256('WebAppData', token);
    const hash = toHex(await hmacSha256(secret, dcs));
    return new URLSearchParams({ ...params, hash }).toString();
  }
  it('accepts valid data', async () => {
    const initData = await sign({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id: 42, first_name: 'Y' }), query_id: 'q' });
    const u = await validateInitData(initData, token);
    expect(u?.id).toBe(42);
  });
  it('rejects tampered data', async () => {
    const initData = await sign({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id: 42, first_name: 'Y' }) });
    expect(await validateInitData(initData.replace('42', '43'), token)).toBeNull();
    expect(await validateInitData(initData, 'other')).toBeNull();
  });
  it('rejects stale data', async () => {
    const initData = await sign({ auth_date: '1000', user: JSON.stringify({ id: 42, first_name: 'Y' }) });
    expect(await validateInitData(initData, token)).toBeNull();
  });
});

describe('session token', () => {
  it('roundtrips and rejects bad signature', async () => {
    const t = await issueToken(42, 'secret');
    expect(await verifyToken(t, 'secret')).toBe(42);
    expect(await verifyToken(t, 'wrong')).toBeNull();
    expect(await verifyToken(t.slice(0, -2) + 'xx', 'secret')).toBeNull();
    expect(await verifyToken(null, 'secret')).toBeNull();
  });
});

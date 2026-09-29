import { describe, expect, it } from 'vitest';
import { todayInTz, weekdayMon0 } from '@tracker/shared';
import { validateInitData } from '../src/lib/telegram';
import { issueToken, verifyToken } from '../src/lib/session';
import { hmacSha256, toHex } from '../src/lib/crypto';

describe('dates', () => {
  it('todayInTz follows the time zone', () => {
    const now = new Date('2026-09-02T22:30:00Z');
    expect(todayInTz('UTC', now)).toBe('2026-09-02');
    expect(todayInTz('Europe/Moscow', now)).toBe('2026-09-03');
  });
  it('weekdays start on Monday', () => {
    expect(weekdayMon0('2026-09-02')).toBe(2);
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

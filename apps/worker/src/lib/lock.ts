import { GateApp, todayInTz, type LockState } from '@tracker/shared';
import type { Env } from '../env';
import { Repo, walletSettings, type UserRow } from './db';
import { checkProfile, setLocked } from './nextdns';
import { Bot } from './telegram';

function randomPassword(): string {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(100000 + (a[0] % 900000));
}

export function lockState(user: UserRow, env: Env, now = new Date()): LockState {
  const configured = !!(user.nextdns_key && user.nextdns_profile);
  const until = user.lock_state === 'open' ? user.lock_until : null;
  const remaining = until ? Math.max(0, Math.ceil((Date.parse(until) - now.getTime()) / 60_000)) : 0;
  const base = (env.WEBAPP_URL || '').replace(/\/+$/, '');
  return {
    configured,
    state: configured ? ((user.lock_state as 'locked' | 'open' | null) ?? 'locked') : null,
    until,
    remaining_min: remaining,
    error: user.lock_error,
    profile_url: configured && user.sm_api_key ? `${base}/dns/${user.sm_api_key}.mobileconfig` : null,
    removal_password: configured ? user.lock_password : null,
    profile_id: user.nextdns_profile,
  };
}

function apps(user: UserRow): GateApp[] {
  const w = walletSettings(user);
  return w.apps.filter((a) => a !== 'other');
}

export async function configureLock(repo: Repo, user: UserRow, key: string, profile: string): Promise<{ ok: boolean; error?: string }> {
  const check = await checkProfile(key, profile);
  if (!check.ok) return { ok: false, error: check.error };
  const password = user.lock_password ?? randomPassword();
  await repo.updateUser(user.id, { nextdns_key: key, nextdns_profile: profile, lock_password: password, lock_state: 'locked', lock_until: null, lock_error: null });
  const r = await setLocked(key, profile, apps({ ...user, nextdns_key: key, nextdns_profile: profile }), true);
  if (!r.ok) await repo.updateUser(user.id, { lock_error: r.error ?? 'error' });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function removeLock(repo: Repo, user: UserRow) {
  if (user.nextdns_key && user.nextdns_profile) await setLocked(user.nextdns_key, user.nextdns_profile, apps(user), false).catch(() => undefined);
  await repo.updateUser(user.id, { nextdns_key: null, nextdns_profile: null, lock_state: null, lock_until: null, lock_error: null });
}

/** Spend minutes now and open the apps for that long. */
export async function unlock(repo: Repo, user: UserRow, minutes: number, now = new Date()): Promise<{ ok: boolean; error?: string }> {
  if (!user.nextdns_key || !user.nextdns_profile) return { ok: false, error: 'not_configured' };
  const balance = await repo.balance(user.id);
  if (balance < minutes) return { ok: false, error: 'insufficient' };
  const r = await setLocked(user.nextdns_key, user.nextdns_profile, apps(user), false);
  if (!r.ok) {
    await repo.updateUser(user.id, { lock_error: r.error ?? 'error' });
    return { ok: false, error: r.error };
  }
  const today = todayInTz(user.tz, now);
  const w = walletSettings(user);
  await repo.addMinutes(user.id, today, -minutes, 'spend', 'unlock', w.bank_cap);
  const until = new Date(now.getTime() + minutes * 60_000).toISOString();
  await repo.updateUser(user.id, { lock_state: 'open', lock_until: until, lock_error: null });
  return { ok: true };
}

/** Lock again; unused whole minutes are refunded when the user closes early. */
export async function lockNow(repo: Repo, user: UserRow, refund: boolean, now = new Date()): Promise<{ ok: boolean; refunded: number; error?: string }> {
  if (!user.nextdns_key || !user.nextdns_profile) return { ok: false, refunded: 0, error: 'not_configured' };
  const r = await setLocked(user.nextdns_key, user.nextdns_profile, apps(user), true);
  if (!r.ok) {
    await repo.updateUser(user.id, { lock_error: r.error ?? 'error' });
    return { ok: false, refunded: 0, error: r.error };
  }
  let refunded = 0;
  if (refund && user.lock_state === 'open' && user.lock_until) {
    refunded = Math.max(0, Math.floor((Date.parse(user.lock_until) - now.getTime()) / 60_000));
    if (refunded > 0) {
      const w = walletSettings(user);
      await repo.addMinutes(user.id, todayInTz(user.tz, now), refunded, 'manual', 'refund', w.bank_cap);
    }
  }
  await repo.updateUser(user.id, { lock_state: 'locked', lock_until: null, lock_error: null });
  return { ok: true, refunded };
}

/** Called every minute: close windows that have run out. */
export async function lockSweep(env: Env, now = new Date()): Promise<number> {
  const repo = new Repo(env.DB);
  const bot = new Bot(env.BOT_TOKEN);
  let n = 0;
  for (const u of await repo.openLocks(now.toISOString())) {
    const r = await lockNow(repo, u, false, now);
    if (r.ok) {
      n++;
      const bal = Math.floor(await repo.balance(u.id));
      await bot.sendMessage(u.tg_id, `Time is up — social media is locked again. ${bal} min left in the wallet.`).catch(() => undefined);
    }
  }
  return n;
}

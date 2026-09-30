import { GateApp, todayInTz, type LockState } from '@tracker/shared';
import type { Env } from '../env';
import { Repo, walletSettings, type UserRow } from './db';
import { checkBlocked, checkProfile, logsEnabled, setLocked, type LockCheck } from './nextdns';
import { Bot } from './telegram';
import { expireSession, secondsLeft } from '../api/gate';
import { detectBypasses, detectSwitchedOff } from './bypass';

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
  await repo.updateUser(user.id, { nextdns_key: key, nextdns_profile: profile, lock_password: password, lock_state: 'locked', lock_until: null, lock_source: null, lock_error: null });
  const r = await setLocked(key, profile, apps({ ...user, nextdns_key: key, nextdns_profile: profile }), true);
  if (!r.ok) await repo.updateUser(user.id, { lock_error: r.error ?? 'error' });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function removeLock(repo: Repo, user: UserRow) {
  if (user.nextdns_key && user.nextdns_profile) await setLocked(user.nextdns_key, user.nextdns_profile, apps(user), false).catch(() => undefined);
  await repo.updateUser(user.id, { nextdns_key: null, nextdns_profile: null, lock_state: null, lock_until: null, lock_source: null, lock_error: null });
}

/** Spend minutes now and open the apps for that long. */
export async function unlock(repo: Repo, user: UserRow, minutes: number, now = new Date()): Promise<{ ok: boolean; error?: string }> {
  if (!user.nextdns_key || !user.nextdns_profile) return { ok: false, error: 'not_configured' };
  const today = todayInTz(user.tz, now);
  // Charge first, atomically: two taps can't both spend the same minutes.
  if (!(await repo.trySpend(user.id, today, minutes, 'unlock'))) return { ok: false, error: 'insufficient' };
  const r = await setLocked(user.nextdns_key, user.nextdns_profile, apps(user), false);
  if (!r.ok) {
    const w = walletSettings(user);
    await repo.addMinutes(user.id, today, minutes, 'manual', 'refund', w.bank_cap);
    await repo.updateUser(user.id, { lock_error: r.error ?? 'error' });
    return { ok: false, error: r.error };
  }
  // Already open: extend the paid window instead of throwing away what is left of it.
  const stillOpen = user.lock_state === 'open' && user.lock_source !== 'session' && user.lock_until ? Date.parse(user.lock_until) : 0;
  const from = Math.max(now.getTime(), stillOpen || 0);
  const until = new Date(from + minutes * 60_000).toISOString();
  await repo.updateUser(user.id, { lock_state: 'open', lock_until: until, lock_source: 'manual', lock_error: null });
  await repo.addLockWindow(user.id, new Date(from).toISOString(), until);
  return { ok: true };
}

/**
 * The Shortcut reported an open with minutes: open the DNS lock until they run out. Checked again on every open,
 * so the window always matches the balance. A paid window from the app is left alone. A NextDNS error keeps the lock
 * closed (the app just doesn't load) — fail closed.
 */
export async function openForSession(repo: Repo, user: UserRow, until: Date) {
  if (!user.nextdns_key || !user.nextdns_profile) return;
  if (user.lock_state === 'open' && user.lock_source !== 'session') return; // a paid window (or one from before sessions opened NextDNS)
  if (user.lock_state !== 'open') {
    const r = await setLocked(user.nextdns_key, user.nextdns_profile, apps(user), false);
    if (!r.ok) {
      await repo.updateUser(user.id, { lock_error: r.error ?? 'error' });
      return;
    }
  }
  await repo.updateUser(user.id, { lock_state: 'open', lock_until: until.toISOString(), lock_source: 'session', lock_error: null });
  Object.assign(user, { lock_state: 'open', lock_until: until.toISOString(), lock_source: 'session' });
}

/** A Shortcuts session ended (closed, or its minutes ran out): close the DNS lock it opened. */
export async function relockAfterSession(repo: Repo, user: UserRow, now = new Date()) {
  const fresh = (await repo.getUserById(user.id)) ?? user;
  if (fresh.lock_state === 'open' && fresh.lock_source === 'session') await lockNow(repo, fresh, false, now);
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
  if (user.lock_source !== 'session') await repo.endLockWindows(user.id, now.toISOString());
  await repo.updateUser(user.id, { lock_state: 'locked', lock_until: null, lock_source: null, lock_error: null });
  Object.assign(user, { lock_state: 'locked', lock_until: null, lock_source: null });
  return { ok: true, refunded };
}

/** The NextDNS logs are read this often (minutes) for bypasses. */
export const BYPASS_CHECK_EVERY_MIN = 5;

/**
 * Called every minute. 1) The server clock: sessions whose minutes are over end (balance → 0) and the DNS lock closes
 * at once, whatever the Shortcut did. 2) Windows that have run out close. 3) Every few minutes: bypasses in the
 * NextDNS logs, and a Shortcut that has gone silent.
 */
export async function lockSweep(env: Env, now = new Date()): Promise<number> {
  const repo = new Repo(env.DB);
  const bot = new Bot(env.BOT_TOKEN);
  let n = 0;
  for (const s of await repo.openSessions()) {
    const u = await repo.getUserById(s.user_id);
    if (u && !(await expireSession(repo, u, now))) n++;
  }
  for (const u of await repo.openLocks(now.toISOString())) {
    if (u.lock_source === 'session') {
      // Minutes earned during the session make it longer: the window follows the balance.
      const open = await repo.openSession(u.id);
      const left = open ? secondsLeft(await repo.balance(u.id), open, now) : 0;
      if (left > 0) {
        await repo.updateUser(u.id, { lock_until: new Date(now.getTime() + left * 1000).toISOString() });
        continue;
      }
    }
    const manual = u.lock_source !== 'session';
    const r = await lockNow(repo, u, false, now);
    if (r.ok) {
      n++;
      if (manual) {
        const bal = Math.floor(await repo.balance(u.id));
        await bot.sendMessage(u.tg_id, `Time is up — social media is locked again. ${bal} min left in the wallet.`).catch(() => undefined);
      }
    }
  }
  if (now.getUTCMinutes() % BYPASS_CHECK_EVERY_MIN === 0) {
    for (const u of await repo.allUsers()) {
      if (!u.nextdns_key || !u.nextdns_profile) continue;
      try {
        await detectBypasses(env, repo, u, now);
        await detectSwitchedOff(repo, u, now, env);
      } catch (e) {
        console.error(`bypass check ${u.tg_id} failed`, e);
      }
    }
  }
  return n;
}

/** Diagnostics: what NextDNS really has for this user right now. Re-applies the lock if it should be closed but isn't. */
export async function lockCheck(repo: Repo, user: UserRow, now = new Date()): Promise<LockCheck & { state: string | null; repaired?: boolean; logs?: boolean | null }> {
  if (!user.nextdns_key || !user.nextdns_profile) return { ok: false, error: 'not_configured', state: null };
  const list = apps(user);
  const open = user.lock_state === 'open' && !!user.lock_until && Date.parse(user.lock_until) > now.getTime();
  let r = await checkBlocked(user.nextdns_key, user.nextdns_profile, list);
  let repaired = false;
  const first = r;
  if (first.ok && !open && list.some((a) => !first.blocked[a])) {
    const fix = await setLocked(user.nextdns_key, user.nextdns_profile, list, true);
    if (!fix.ok) await repo.updateUser(user.id, { lock_error: fix.error ?? 'error' });
    r = await checkBlocked(user.nextdns_key, user.nextdns_profile, list);
    repaired = true;
  }
  const logs = await logsEnabled(user.nextdns_key, user.nextdns_profile);
  return { ...r, state: open ? 'open' : 'locked', repaired, logs };
}

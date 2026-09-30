import { GATE_APP_LABEL, timeInTz, todayInTz, type GateApp } from '@tracker/shared';
import type { Env } from '../env';
import { walletSettings, type Repo, type UserRow } from './db';
import { appForDomain, checkBlocked, fetchLogs, setLocked } from './nextdns';
import { Bot, escapeHtml } from './telegram';

/**
 * A bypass can't be forbidden by code, but it can be noticed and made not worth it. The server reads the NextDNS
 * query log: a gated app that resolved (was not blocked) outside any Shortcuts session or paid window means the lock
 * was got around — the NextDNS rules were changed, or the device went around them. Blocked queries are not a bypass:
 * that is the lock working (and apps also knock in the background).
 * Each bypass: a penalty (a debt worked off with tasks before social media opens again), the streak starts over,
 * a line in Progress and a Telegram message to the user and the lock buddy.
 */

/** Penalty on top of the minutes used. */
export const BYPASS_PENALTY_MIN = 15;
/** Log entries show up with a delay; read up to this long ago. */
const LOG_LAG_MS = 60_000;
/** Around a session or a window: DNS caches, clocks and the log delay. */
const GRACE_BEFORE_MS = 60_000;
const GRACE_AFTER_MS = 3 * 60_000;
/** Queries closer than this are one visit. */
const EPISODE_GAP_MS = 10 * 60_000;
/** The Shortcut silent for this long while NextDNS sees the apps: the automation looks switched off. */
export const SWITCHED_OFF_AFTER_MS = 24 * 3600_000;
const SWITCHED_OFF_RECHECK_MS = 3600_000;

const ms = (iso: string) => Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);

function gatedApps(user: UserRow): GateApp[] {
  return walletSettings(user).apps.filter((a) => a !== 'other');
}

async function tell(env: Env, user: UserRow, text: string, buddyText: string) {
  const bot = new Bot(env.BOT_TOKEN);
  await bot.sendMessage(user.tg_id, text).catch(() => undefined);
  if (user.partner_chat_id) await bot.sendMessage(user.partner_chat_id, buddyText).catch(() => undefined);
}

/** Read the new part of the log and record the bypasses in it. Returns how many were recorded. */
export async function detectBypasses(env: Env, repo: Repo, user: UserRow, now = new Date()): Promise<number> {
  if (!user.nextdns_key || !user.nextdns_profile) return 0;
  const to = new Date(now.getTime() - LOG_LAG_MS);
  const since = user.bypass_checked_at ? ms(user.bypass_checked_at) : to.getTime() - 10 * 60_000;
  const from = new Date(Math.max(since, to.getTime() - SWITCHED_OFF_AFTER_MS));
  if (to <= from) return 0;
  const apps = new Set(gatedApps(user));
  const logs = await fetchLogs(user.nextdns_key, user.nextdns_profile, from, to);
  if (!logs) return 0; // NextDNS unreachable: keep the place, read it next time
  await repo.updateUser(user.id, { bypass_checked_at: to.toISOString() });
  if (!walletSettings(user).wallet_enabled) return 0;

  const hits = logs
    .filter((l) => l.status === 'default' || l.status === 'allowed')
    .map((l) => ({ t: ms(l.timestamp), app: appForDomain(l.domain) }))
    .filter((h): h is { t: number; app: GateApp } => !!h.app && apps.has(h.app) && Number.isFinite(h.t));
  if (!hits.length) return 0;
  const allowed = (await repo.allowedIntervals(user.id, new Date(from.getTime() - 3 * 3600_000).toISOString(), now.toISOString())).map((i) => [ms(i.from) - GRACE_BEFORE_MS, ms(i.to) + GRACE_AFTER_MS]);
  // The lock is open right now (a session or a paid window): the part of the log read now is covered by it.
  if (user.lock_state === 'open') allowed.push([from.getTime() - GRACE_BEFORE_MS, now.getTime()]);
  const outside = hits.filter((h) => !allowed.some(([a, b]) => h.t >= a && h.t <= b));
  if (!outside.length) return 0;

  // Our own failure to close the lock is not the user's bypass: repair it and don't punish.
  if (user.lock_error) {
    if (user.lock_state !== 'open') await setLocked(user.nextdns_key, user.nextdns_profile, [...apps], true).catch(() => undefined);
    return 0;
  }
  // The rules were changed in NextDNS: put them back (and it is a bypass).
  const state = await checkBlocked(user.nextdns_key, user.nextdns_profile, [...apps]);
  if (state.ok && user.lock_state !== 'open' && [...apps].some((a) => !state.blocked[a])) await setLocked(user.nextdns_key, user.nextdns_profile, [...apps], true);

  // One visit per app: queries closer than EPISODE_GAP_MS.
  const episodes: { app: GateApp; first: number; last: number }[] = [];
  for (const h of outside) {
    const e = episodes.find((x) => x.app === h.app && h.t - x.last <= EPISODE_GAP_MS);
    if (e) e.last = Math.max(e.last, h.t);
    else episodes.push({ app: h.app, first: h.t, last: h.t });
  }
  let n = 0;
  const today = todayInTz(user.tz, now);
  for (const e of episodes) {
    const minutes = Math.max(1, Math.ceil((e.last - e.first) / 60_000));
    const penalty = BYPASS_PENALTY_MIN + minutes;
    const first = new Date(e.first);
    const date = todayInTz(user.tz, first);
    if (!(await repo.addBypass(user.id, { date, app: e.app, first_at: first.toISOString(), last_at: new Date(e.last).toISOString(), minutes, penalty }))) continue;
    await repo.charge(user.id, today, penalty, `bypass:${e.app}`, 'penalty');
    await repo.updateUser(user.id, { streak_reset_on: today });
    n++;
    const app = GATE_APP_LABEL[e.app];
    const at = timeInTz(user.tz, first);
    await tell(
      env,
      user,
      `Bypass noticed: ${app} was used at ${at} (about ${minutes} min) without minutes. Penalty ${penalty} min — work it off with tasks before social media opens again. The streak starts over.`,
      `${escapeHtml(user.first_name)} got around the social-media lock: ${app} at ${at}, about ${minutes} min. Penalty: ${penalty} min of tasks.`,
    );
  }
  return n;
}

/**
 * The "ping": the Shortcut calls the server on every open. Silent for a day while the NextDNS log shows the apps
 * (blocked or not) — the automation was switched off. Home shows a red banner until the Shortcut calls again.
 */
export async function detectSwitchedOff(repo: Repo, user: UserRow, now = new Date(), env?: Env): Promise<boolean> {
  if (!user.nextdns_key || !user.nextdns_profile || !user.gate_seen_at || user.lock_warning) return false;
  if (now.getTime() - ms(user.gate_seen_at) < SWITCHED_OFF_AFTER_MS) return false;
  if (user.lock_warning_checked_at && now.getTime() - ms(user.lock_warning_checked_at) < SWITCHED_OFF_RECHECK_MS) return false;
  await repo.updateUser(user.id, { lock_warning_checked_at: now.toISOString() });
  const from = new Date(Math.max(ms(user.gate_seen_at), now.getTime() - SWITCHED_OFF_AFTER_MS));
  for (const app of gatedApps(user)) {
    const logs = await fetchLogs(user.nextdns_key, user.nextdns_profile, from, now, app, 1);
    if (!logs?.some((l) => appForDomain(l.domain) === app)) continue;
    await repo.updateUser(user.id, { lock_warning: now.toISOString() });
    if (env) {
      await tell(
        env,
        user,
        'The lock automation in Shortcuts looks switched off: no calls from it for a day, but social media was opened. Turn it back on — the app shows how.',
        `${escapeHtml(user.first_name)}'s lock automation looks switched off: no calls from it for a day, but social media was opened.`,
      );
    }
    return true;
  }
  return false;
}

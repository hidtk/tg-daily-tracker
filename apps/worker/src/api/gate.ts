import { GATE_BLOCK_BELOW_SECONDS, GateApp, WALLET_SESSION_HARD_CAP_MIN, todayInTz } from '@tracker/shared';
import type { Env } from '../env';
import { Repo, walletSettings, type SessionRow, type UserRow } from '../lib/db';
import { openForSession, relockAfterSession } from '../lib/lock';

/**
 * Endpoint for iOS Shortcuts automations. Plain text, so a Shortcut only needs "contains":
 *   GET /gate/<api_key>?app=any&e=open    app opened → "ALLOW <min> <sec>" (a session starts) or "BLOCK 0"
 *   GET /gate/<api_key>?app=any&e=close   app closed → the session is charged by its real time
 *   GET /gate/<api_key>?e=tick            the optional timer loop → "ALLOW <min> <sec left>", "BLOCK 0 0",
 *                                         or "ALLOW 0 0 / STOP" when no session runs (the loop ends itself)
 *   GET /gate/<api_key>?e=status          read-only
 * The clock is on the server: a session ends when its minutes run out — on the minute cron or on any request —
 * whether or not the Shortcut is still running. With NextDNS set up the lock opens only for a running session and
 * closes again at its end, so the apps stop loading even if the automation was interrupted.
 * The open check in the Shortcut is "does not contain ALLOW" (no answer = no entry).
 */

function text(body: string): Response {
  return new Response(body, { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
}

function ms(iso: string): number {
  const t = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  return Number.isFinite(t) ? t : 0;
}

function secondsBetween(fromIso: string, now: Date): number {
  return Math.max(0, (now.getTime() - ms(fromIso)) / 1000);
}

/** close — the app closed; tick — the timer loop saw the end; expired — the server clock ran the minutes out. */
export type CloseReason = 'close' | 'tick' | 'expired';

/**
 * Minutes to charge for a session. A reported end (close, tick) charges the real time — beyond the balance it becomes
 * a debt. Without one the app counts as open until the minutes run out: the whole balance, never into debt.
 */
export function sessionCharge(s: Pick<SessionRow, 'started_at'>, now: Date, reason: CloseReason, balance: number): number {
  const elapsed = Math.min(secondsBetween(s.started_at, now), WALLET_SESSION_HARD_CAP_MIN * 60);
  const sec = reason === 'expired' ? Math.min(elapsed, Math.max(0, balance) * 60) : elapsed;
  return Math.round((sec / 60) * 10) / 10;
}

/** Close an open session once and charge it. Returns the minutes charged. */
export async function closeSession(repo: Repo, user: UserRow, session: SessionRow, now: Date, reason: CloseReason): Promise<number> {
  const spent = sessionCharge(session, now, reason, await repo.balance(user.id));
  if (!(await repo.endSession(session.id, spent, reason))) return 0; // already settled by a parallel request
  if (spent > 0) await repo.charge(user.id, todayInTz(user.tz, now), spent, session.app);
  return spent;
}

/** Seconds of paid time left in a running session (the balance is charged only when it ends). */
export function secondsLeft(balance: number, s: Pick<SessionRow, 'started_at'>, now: Date): number {
  return Math.floor(balance * 60 - secondsBetween(s.started_at, now));
}

/**
 * The server clock. Ends the user's session if its minutes are over (balance → 0) and closes the DNS lock again.
 * Called by the minute cron, by the gate and by every API request. Returns the session that is still running.
 */
export async function expireSession(repo: Repo, user: UserRow, now = new Date()): Promise<SessionRow | null> {
  const open = await repo.openSession(user.id);
  if (!open) return null;
  if (secondsLeft(await repo.balance(user.id), open, now) > 0) return open;
  await closeSession(repo, user, open, now, 'expired');
  await relockAfterSession(repo, user, now);
  return null;
}

const allow = (min: number, sec: number, note?: string) => text(`ALLOW ${Math.max(0, Math.floor(min))} ${Math.max(0, Math.floor(sec))}${note ? `\n${note}` : ''}`);

export async function handleGate(req: Request, env: Env, url: URL, now = new Date()): Promise<Response> {
  void req;
  const key = url.pathname.replace(/^\/gate\//, '').replace(/\/+$/, '');
  if (!/^[0-9a-f]{32}$/.test(key)) return text('BLOCK 0\nbad key');

  const repo = new Repo(env.DB);
  const user = await repo.getUserByApiKey(key);
  if (!user) return text('BLOCK 0\nbad key');
  // The Shortcut is alive: the "automation switched off" warning goes away.
  await repo.updateUser(user.id, { gate_seen_at: now.toISOString(), lock_warning: user.lock_warning ? null : undefined });

  const w = walletSettings(user);
  const rawApp = (url.searchParams.get('app') ?? 'other').toLowerCase();
  // `app=any`: one automation for several apps at once (Shortcuts can't tell which one fired) — always gated.
  const anyApp = rawApp === 'any';
  const appParsed = GateApp.safeParse(rawApp);
  const app: GateApp = appParsed.success ? appParsed.data : 'other';
  const event = url.searchParams.get('e') ?? 'open';

  const open = await expireSession(repo, user, now);

  // status: read-only. What would be left if the running session ended now.
  if (event === 'status') {
    const balance = await repo.balance(user.id);
    const left = open ? secondsLeft(balance, open, now) : Math.floor(balance * 60);
    return left >= 60 ? allow(left / 60, left) : text('BLOCK 0');
  }

  // tick: the optional timer loop. The server ends the session by itself; the loop only makes "Home" instant.
  if (event === 'tick') {
    if (!open) {
      const last = await repo.lastSession(user.id);
      const since = last?.ended_at ? secondsBetween(last.ended_at, now) : Infinity;
      // Time ran out but the app never reported closing: keep sending Home for a while.
      if ((last?.closed_by === 'tick' || last?.closed_by === 'expired') && since < 10 * 60) return text('BLOCK 0 0');
      // Nothing running (the app was closed): tell the loop to stop so it doesn't poll in the background.
      return allow(0, 0, 'STOP');
    }
    const left = secondsLeft(await repo.balance(user.id), open, now);
    if (left <= GATE_BLOCK_BELOW_SECONDS) {
      await closeSession(repo, user, open, now, 'tick');
      await relockAfterSession(repo, user, now);
      return text('BLOCK 0 0');
    }
    await repo.touchSession(open.id);
    return allow(left / 60, left);
  }

  // When switching apps iOS may deliver "B opened" before "A closed". A close that arrives right after
  // a session start belongs to the previous app — keep the new session.
  const justStarted = open && secondsBetween(open.started_at, now) < 2;
  if (event === 'close' && justStarted) {
    const balance = await repo.balance(user.id);
    return balance >= 1 ? allow(balance, balance * 60) : text('BLOCK 0');
  }

  if (event === 'close') {
    if (open) {
      await closeSession(repo, user, open, now, 'close');
      await relockAfterSession(repo, user, now);
    } else {
      // The app really left the screen after the time ran out: stop repeating "BLOCK".
      const last = await repo.lastSession(user.id);
      if (last?.closed_by === 'tick' || last?.closed_by === 'expired') await repo.markKicked(last.id);
    }
    const balance = await repo.balance(user.id);
    return balance >= 1 ? allow(balance, balance * 60) : text('BLOCK 0');
  }

  // event === 'open'.
  const balance = await repo.balance(user.id);
  if (!w.wallet_enabled) return allow(balance, balance * 60, 'wallet off');
  if (!anyApp && !w.apps.includes(app)) return allow(balance, balance * 60, 'not gated');
  // A paid window from the app is running: that time is already charged — don't charge it twice.
  if (user.lock_state === 'open' && user.lock_source !== 'session' && user.lock_until && Date.parse(user.lock_until) > now.getTime()) {
    const sec = (Date.parse(user.lock_until) - now.getTime()) / 1000;
    return allow(sec / 60, sec, 'unlock window');
  }
  // Another gated app, or the same one again, while the session runs: the same session continues.
  if (open) {
    const left = secondsLeft(balance, open, now);
    await openForSession(repo, user, new Date(now.getTime() + left * 1000));
    return allow(left / 60, left);
  }

  if (balance < 1) {
    // No Telegram message here: the Shortcut already sends you to the Home Screen, a ping on every attempt is noise.
    return text(balance < 0 ? `BLOCK 0\ndebt ${Math.ceil(-balance)}` : 'BLOCK 0');
  }

  await repo.startSession(user.id, app);
  // The DNS lock opens only for the minutes there are, and is checked again on every open.
  await openForSession(repo, user, new Date(now.getTime() + balance * 60_000));
  return allow(balance, balance * 60);
}

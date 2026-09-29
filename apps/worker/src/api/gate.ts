import { GATE_BLOCK_BELOW_SECONDS, GATE_TICK_SECONDS, GateApp, WALLET_SESSION_HARD_CAP_MIN, WALLET_SESSION_MAX_MIN, todayInTz } from '@tracker/shared';
import type { Env } from '../env';
import { Repo, walletSettings, type SessionRow, type UserRow } from '../lib/db';

/**
 * Endpoint for iOS Shortcuts automations. Plain text, so a Shortcut only needs "contains":
 *   GET /gate/<api_key>?app=any&e=open    app opened → "ALLOW <min> <sec>" (a session starts) or "BLOCK 0"
 *   GET /gate/<api_key>?e=tick            every GATE_TICK_SECONDS from the timer loop → "ALLOW <min> <sec left>", "BLOCK 0 0",
 *                                         or "ALLOW 0 0 / STOP" when no session runs (the loop ends itself)
 *   GET /gate/<api_key>?app=any&e=close   app closed → the session is charged
 *   GET /gate/<api_key>?e=status          read-only
 * The open check in the Shortcut is "does not contain ALLOW" (no answer = no entry); the loop checks
 * "contains BLOCK", so a dropped connection mid-session doesn't throw you out — the time is charged at close anyway.
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

export type CloseReason = 'close' | 'tick' | 'open' | 'stale';

/**
 * Minutes to charge for a session.
 * A real end (the app closed, or the timer sent you Home) charges the real time — beyond the balance it becomes a debt.
 * Without an end event we only know the last heartbeat: charge up to it (or, with no heartbeats at all, up to
 * WALLET_SESSION_MAX_MIN), never into debt.
 */
export function sessionCharge(s: Pick<SessionRow, 'started_at' | 'last_seen'>, now: Date, reason: CloseReason): number {
  const elapsed = secondsBetween(s.started_at, now);
  let sec: number;
  if (reason === 'close' || reason === 'tick') sec = Math.min(elapsed, WALLET_SESSION_HARD_CAP_MIN * 60);
  else if (s.last_seen) sec = Math.min(elapsed, Math.max(0, (ms(s.last_seen) - ms(s.started_at)) / 1000) + GATE_TICK_SECONDS);
  else sec = Math.min(elapsed, WALLET_SESSION_MAX_MIN * 60);
  return Math.round((sec / 60) * 10) / 10;
}

/** Close an open session once and charge it. Returns the minutes charged. */
export async function closeSession(repo: Repo, user: UserRow, session: SessionRow, now: Date, reason: CloseReason): Promise<number> {
  const spent = sessionCharge(session, now, reason);
  if (!(await repo.endSession(session.id, spent, reason))) return 0; // already settled by a parallel request
  if (spent > 0) {
    const date = todayInTz(user.tz, now);
    if (reason === 'close' || reason === 'tick') await repo.charge(user.id, date, spent, session.app);
    else await repo.addMinutes(user.id, date, -spent, 'spend', session.app, walletSettings(user).bank_cap);
  }
  return spent;
}

/** Seconds of paid time left in a running session (the balance is charged only when it ends). */
export function secondsLeft(balance: number, s: Pick<SessionRow, 'started_at'>, now: Date): number {
  return Math.floor(balance * 60 - secondsBetween(s.started_at, now));
}

const allow = (min: number, sec: number, note?: string) => text(`ALLOW ${Math.max(0, Math.floor(min))} ${Math.max(0, Math.floor(sec))}${note ? `\n${note}` : ''}`);

export async function handleGate(req: Request, env: Env, url: URL, now = new Date()): Promise<Response> {
  void req;
  const key = url.pathname.replace(/^\/gate\//, '').replace(/\/+$/, '');
  if (!/^[0-9a-f]{32}$/.test(key)) return text('BLOCK 0\nbad key');

  const repo = new Repo(env.DB);
  const user = await repo.getUserByApiKey(key);
  if (!user) return text('BLOCK 0\nbad key');

  const w = walletSettings(user);
  const rawApp = (url.searchParams.get('app') ?? 'other').toLowerCase();
  // `app=any`: one automation for several apps at once (Shortcuts can't tell which one fired) — always gated.
  const anyApp = rawApp === 'any';
  const appParsed = GateApp.safeParse(rawApp);
  const app: GateApp = appParsed.success ? appParsed.data : 'other';
  const event = url.searchParams.get('e') ?? 'open';

  let open = await repo.openSession(user.id);

  // status: read-only. What would be left if the running session ended now.
  if (event === 'status') {
    const balance = await repo.balance(user.id);
    const left = open ? secondsLeft(balance, open, now) : Math.floor(balance * 60);
    return left >= 60 ? allow(left / 60, left) : text('BLOCK 0');
  }

  // tick: the timer loop inside the "app opened" automation. Sends you Home when the paid time is over.
  if (event === 'tick') {
    if (!open) {
      const last = await repo.lastSession(user.id);
      const since = last?.ended_at ? secondsBetween(last.ended_at, now) : Infinity;
      // Time ran out but the app never reported closing (e.g. "Home" didn't happen): keep sending Home for a while.
      if (last?.closed_by === 'tick' && since < 10 * 60) return text('BLOCK 0 0');
      // The session went stale while the loop was asleep (phone locked) and the loop is back: the app is still open.
      if (last?.closed_by === 'stale' && since < 12 * 3600 && w.wallet_enabled) {
        if ((await repo.balance(user.id)) < 1) return text('BLOCK 0 0');
        await repo.startSession(user.id, last.app);
        open = await repo.openSession(user.id);
      }
      // Nothing running (the app was closed): tell the loop to stop so it doesn't poll in the background.
      if (!open) return allow(0, 0, 'STOP');
    }
    const balance = await repo.balance(user.id);
    const left = secondsLeft(balance, open, now);
    if (left <= GATE_BLOCK_BELOW_SECONDS) {
      await closeSession(repo, user, open, now, 'tick');
      return text('BLOCK 0 0');
    }
    await repo.touchSession(open.id);
    return allow(left / 60, left);
  }

  // When switching apps iOS may deliver "B opened" before "A closed". A close that arrives right after
  // a session start belongs to the previous app — keep the new session. Kept short (2 s): with the timer
  // loop a wrongly kept session would keep running, and nobody opens and leaves an app that fast.
  const justStarted = open && secondsBetween(open.started_at, now) < 2;
  if (event === 'close' && justStarted) {
    const balance = await repo.balance(user.id);
    return balance >= 1 ? allow(balance, balance * 60) : text('BLOCK 0');
  }

  if (event === 'close') {
    if (open) await closeSession(repo, user, open, now, 'close');
    else {
      // The app really left the screen after the timer sent you Home: stop repeating "BLOCK".
      const last = await repo.lastSession(user.id);
      if (last?.closed_by === 'tick') await repo.markKicked(last.id);
    }
    const balance = await repo.balance(user.id);
    return balance >= 1 ? allow(balance, balance * 60) : text('BLOCK 0');
  }

  // event === 'open'. A session still open here lost its close event: settle it by its last heartbeat.
  if (open) await closeSession(repo, user, open, now, 'open');
  const balance = await repo.balance(user.id);

  if (!w.wallet_enabled) return allow(balance, balance * 60, 'wallet off');
  if (!anyApp && !w.apps.includes(app)) return allow(balance, balance * 60, 'not gated');
  // A paid NextDNS window is running: that time is already charged — don't charge it twice.
  if (user.lock_state === 'open' && user.lock_until && Date.parse(user.lock_until) > now.getTime()) {
    const sec = (Date.parse(user.lock_until) - now.getTime()) / 1000;
    return allow(sec / 60, sec, 'unlock window');
  }

  if (balance < 1) {
    // No Telegram message here: the Shortcut already sends you to the Home Screen, a ping on every attempt is noise.
    return text(balance < 0 ? `BLOCK 0\ndebt ${Math.ceil(-balance)}` : 'BLOCK 0');
  }

  await repo.startSession(user.id, app);
  return allow(balance, balance * 60);
}

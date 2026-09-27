import { GateApp, WALLET_SESSION_MAX_MIN, todayInTz } from '@tracker/shared';
import type { Env } from '../env';
import { Repo, walletSettings, type UserRow } from '../lib/db';

/**
 * Endpoint for iOS Shortcuts automations. Deliberately keyless-simple:
 *   GET /gate/<api_key>?app=instagram|any&e=open|close|status
 * Answers in plain text so a Shortcut can just check "contains ALLOW".
 */

function text(body: string): Response {
  return new Response(body, { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
}

function minutesBetween(fromIso: string, now: Date): number {
  const t = Date.parse(fromIso.endsWith('Z') ? fromIso : `${fromIso}Z`);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, (now.getTime() - t) / 60_000);
}

/** Close an open session and charge the elapsed time (capped, so a missed close event can't drain everything). */
export async function closeSession(
  repo: Repo,
  user: UserRow,
  session: { id: number; app: string; started_at: string },
  now: Date,
): Promise<number> {
  const elapsed = Math.min(minutesBetween(session.started_at, now), WALLET_SESSION_MAX_MIN);
  const spent = Math.round(elapsed * 10) / 10;
  if (!(await repo.endSession(session.id, spent))) return 0; // already settled by a parallel request
  if (spent > 0) {
    const w = walletSettings(user);
    await repo.addMinutes(user.id, todayInTz(user.tz, now), -spent, 'spend', session.app, w.bank_cap);
  }
  return spent;
}

export async function handleGate(req: Request, env: Env, url: URL, now = new Date()): Promise<Response> {
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

  const open = await repo.openSession(user.id);

  // status: read-only. Report what would be left if the running session ended now.
  if (event === 'status') {
    const running = open ? Math.min(minutesBetween(open.started_at, now), WALLET_SESSION_MAX_MIN) : 0;
    const left = (await repo.balance(user.id)) - running;
    return text(`${left >= 1 ? 'ALLOW' : 'BLOCK'} ${Math.max(0, Math.floor(left))}`);
  }

  // When switching apps iOS may deliver "B opened" before "A closed". A close that arrives
  // within a few seconds of a session start belongs to the previous app — keep the new session.
  const justStarted = open && minutesBetween(open.started_at, now) * 60 < 5;
  if (event === 'close' && justStarted) {
    const balance = await repo.balance(user.id);
    return text(`${balance >= 1 ? 'ALLOW' : 'BLOCK'} ${Math.floor(balance)}`);
  }

  // Any still-open session is settled first: on `close` it is the one we are closing,
  // on `open` it is a previous session whose close event never arrived.
  if (open) await closeSession(repo, user, open, now);

  let balance = await repo.balance(user.id);

  if (event === 'close') {
    return text(`${balance >= 1 ? 'ALLOW' : 'BLOCK'} ${Math.floor(balance)}`);
  }

  // event === 'open'
  if (!w.wallet_enabled) return text(`ALLOW ${Math.floor(balance)}\nwallet off`);
  if (!anyApp && !w.apps.includes(app)) return text(`ALLOW ${Math.floor(balance)}\nnot gated`);
  // A paid NextDNS window is running: that time is already charged — don't charge it twice.
  if (user.lock_state === 'open' && user.lock_until && Date.parse(user.lock_until) > now.getTime()) {
    return text(`ALLOW ${Math.floor(balance)}\nunlock window`);
  }

  if (balance < 1) {
    // No Telegram message here: the Shortcut already sends you to the Home Screen, a ping on every attempt is noise.
    return text('BLOCK 0');
  }

  await repo.startSession(user.id, app);
  balance = await repo.balance(user.id);
  return text(`ALLOW ${Math.floor(balance)}`);
}

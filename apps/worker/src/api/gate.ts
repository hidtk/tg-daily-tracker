import { GATE_APP_LABEL, GateApp, WALLET_SESSION_MAX_MIN, todayInTz } from '@tracker/shared';
import type { Env } from '../env';
import { Repo, walletSettings, type UserRow } from '../lib/db';
import { Bot } from '../lib/telegram';

/**
 * Endpoint for iOS Shortcuts automations. Deliberately keyless-simple:
 *   GET /gate/<api_key>?app=instagram&e=open|close|status
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
  await repo.endSession(session.id, spent);
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
  const appParsed = GateApp.safeParse((url.searchParams.get('app') ?? 'other').toLowerCase());
  const app: GateApp = appParsed.success ? appParsed.data : 'other';
  const event = url.searchParams.get('e') ?? 'open';

  // Any still-open session is settled first: on `close` it is the one we are closing,
  // on `open` it is a previous session whose close event never arrived.
  const open = await repo.openSession(user.id);
  if (open) await closeSession(repo, user, open, now);

  let balance = await repo.balance(user.id);

  if (event === 'close' || event === 'status') {
    return text(`${balance >= 1 ? 'ALLOW' : 'BLOCK'} ${Math.floor(balance)}`);
  }

  // event === 'open'
  if (!w.wallet_enabled) return text(`ALLOW ${Math.floor(balance)}\nwallet off`);
  if (!w.apps.includes(app)) return text(`ALLOW ${Math.floor(balance)}\nnot gated`);

  if (balance < 1) {
    if (env.BOT_TOKEN) {
      const bot = new Bot(env.BOT_TOKEN);
      await bot
        .sendMessage(
          user.tg_id,
          `🔒 <b>${GATE_APP_LABEL[app]}</b> закрыт: минут не осталось.\n\nОткрой трекер и пройди Reading-тест — 10–30 минут за один заход.`,
          env.WEBAPP_URL ? [[{ text: '📖 Заработать минуты', web_app: { url: env.WEBAPP_URL } }]] : undefined,
        )
        .catch(() => undefined);
    }
    return text('BLOCK 0');
  }

  await repo.startSession(user.id, app);
  balance = await repo.balance(user.id);
  return text(`ALLOW ${Math.floor(balance)}`);
}

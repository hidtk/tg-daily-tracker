import { z } from 'zod';
import {
  DEFAULT_SETTINGS,
  GateApp,
  LockConfigSchema,
  RESET_WORDS,
  ReadingSubmitSchema,
  ResetSchema,
  SentenceSubmitSchema,
  SettingsPutSchema,
  UnlockSchema,
  VocabAnswerSchema,
  WalletSettingsPutSchema,
  WritingSize,
  WritingStartSchema,
  WritingSubmitSchema,
  addDays,
  todayInTz,
  type AuthResponse,
  type ProgressResponse,
  type SettingsView,
  type WalletResponse,
} from '@tracker/shared';
import type { Env } from '../env';
import { Repo, userSettings, walletSettings, type UserRow } from '../lib/db';
import { HttpError, json, readJson } from '../lib/http';
import { issueToken, verifyToken } from '../lib/session';
import { validateInitData } from '../lib/telegram';
import { answerWord, vocabState } from '../lib/vocab';
import { readingTask, submitReading } from '../lib/reading';
import { speakingState, startWriting, submitWriting, writingState } from '../lib/tasks';
import { sentenceState, submitSentence } from '../lib/sentences';
import { shopState } from '../lib/shop';
import { achievementsView, taskStreak } from '../lib/wallet';
import { configureLock, lockCheck, lockNow, lockState, removeLock, unlock } from '../lib/lock';
import { secondsLeft } from './gate';

export function settingsView(u: UserRow, env: Env): SettingsView {
  return { ...userSettings(u), bot_username: env.BOT_USERNAME, onboarded: !!u.onboarded };
}

const AuthBody = z.object({ initData: z.string().min(1), tz: z.string().max(64).optional() });
const OnboardedBody = z.object({ done: z.boolean() });

function isValidTz(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

async function requireUser(req: Request, env: Env, repo: Repo): Promise<UserRow> {
  const auth = req.headers.get('authorization') ?? '';
  const tgId = await verifyToken(auth.startsWith('Bearer ') ? auth.slice(7) : null, env.SESSION_SECRET);
  if (!tgId) throw new HttpError(401, 'Unauthorized');
  const user = await repo.getUserByTg(tgId);
  if (!user) throw new HttpError(401, 'Unknown user');
  return user;
}

export async function handleApi(req: Request, env: Env, url: URL): Promise<Response> {
  const repo = new Repo(env.DB);
  const path = url.pathname.replace(/^\/api/, '');
  const method = req.method;

  // ---- POST /api/auth ----
  if (path === '/auth' && method === 'POST') {
    const body = AuthBody.parse(await readJson(req));
    const tgUser = await validateInitData(body.initData, env.BOT_TOKEN);
    if (!tgUser) throw new HttpError(401, 'Invalid initData');
    const tz = body.tz && isValidTz(body.tz) ? body.tz : DEFAULT_SETTINGS.tz;
    const { user, isNew } = await repo.ensureUser(tgUser.id, tgUser.first_name, tz);
    const res: AuthResponse = {
      token: await issueToken(tgUser.id, env.SESSION_SECRET),
      user: { tg_id: user.tg_id, first_name: user.first_name, is_new: isNew },
      settings: settingsView(user, env),
    };
    return json(res);
  }

  const user = await requireUser(req, env, repo);
  const today = todayInTz(user.tz);
  const reload = async () => Object.assign(user, await repo.getUserById(user.id));

  // ---- /api/settings ----
  if (path === '/settings' && method === 'GET') return json(settingsView(user, env));
  if (path === '/settings' && method === 'PUT') {
    const p = SettingsPutSchema.parse(await readJson(req));
    if (p.tz && !isValidTz(p.tz)) throw new HttpError(400, 'Invalid timezone');
    await repo.updateUser(user.id, { tz: p.tz, morning_time: p.morning_time, vocab_per_day: p.vocab_per_day, lang: p.lang, ielts_daily_task: p.reminders });
    await reload();
    return json(settingsView(user, env));
  }

  // ---- POST /api/onboarded ---- the first-run guide was finished or skipped
  if (path === '/onboarded' && method === 'POST') {
    const { done } = OnboardedBody.parse(await readJson(req));
    await repo.updateUser(user.id, { onboarded: done });
    return json({ ok: true });
  }

  // ---- POST /api/reset ---- «Начать заново»: progress goes, settings and the lock stay
  if (path === '/reset' && method === 'POST') {
    const { word } = ResetSchema.parse(await readJson(req));
    if (!RESET_WORDS.includes(word.trim().toUpperCase())) throw new HttpError(400, 'Type the word exactly to confirm');
    // A paid NextDNS window closes: the minutes behind it are gone with the rest.
    if (user.lock_state === 'open' && user.nextdns_key) await lockNow(repo, user, false).catch(() => undefined);
    await repo.resetProgress(user.id);
    await reload();
    return json(settingsView(user, env));
  }

  // ---- GET /api/shop ---- every task with its price, time and difficulty; the top three now
  if (path === '/shop' && method === 'GET') return json(await shopState(repo, user, today));

  // ---- Reading ----
  const readMatch = path.match(/^\/reading\/(r(?::|%3A)[a-z0-9:%A-F-]+)$/i);
  if (readMatch && method === 'GET') return json(await readingTask(repo, user, today, decodeURIComponent(readMatch[1])));
  if (path === '/reading/submit' && method === 'POST') {
    return json(await submitReading(repo, user, today, ReadingSubmitSchema.parse(await readJson(req))));
  }

  // ---- Words ----
  if (path === '/vocab' && method === 'GET') return json(await vocabState(repo, user, today));
  if (path === '/vocab/answer' && method === 'POST') {
    const body = VocabAnswerSchema.parse(await readJson(req));
    const r = await answerWord(repo, user, body.word_id, body.answer, body.hint, today);
    if (r === 'not_started') throw new HttpError(404, 'Word not started');
    if (r === 'new_today') throw new HttpError(409, 'New words are asked from tomorrow');
    if (r === 'already') throw new HttpError(409, 'This word is done for today');
    return json(r);
  }

  // ---- Sentences ----
  if (path === '/sentences' && method === 'GET') return json(await sentenceState(repo, user, today));
  if (path === '/sentences' && method === 'POST') {
    const body = SentenceSubmitSchema.parse(await readJson(req));
    return json(await submitSentence(repo, user, today, body.word_id, body.text));
  }

  // ---- Writing ----
  const ai = !!env.ANTHROPIC_API_KEY;
  if (path === '/writing' && method === 'GET') return json(await writingState(repo, user, today, WritingSize.parse(url.searchParams.get('size') ?? 'short'), ai));
  if (path === '/writing/start' && method === 'POST') return json(await startWriting(repo, user, today, WritingStartSchema.parse(await readJson(req)).size, ai));
  if (path === '/writing' && method === 'POST') {
    const body = WritingSubmitSchema.parse(await readJson(req));
    return json(await submitWriting(repo, user, today, body.size, body.text, env.ANTHROPIC_API_KEY));
  }

  // ---- Speaking ---- the cards; answers arrive as voice messages to the bot
  if (path === '/speaking' && method === 'GET') return json(await speakingState(repo, user, today, env.BOT_USERNAME));

  // ---- GET /api/progress ---- achievements, the week, the streak, recent minutes
  if (path === '/progress' && method === 'GET') {
    const from = addDays(today, -6);
    const [{ list, stats }, study, paid, streak, ledger] = await Promise.all([
      achievementsView(repo, user),
      repo.studyMinutes(user.id, '0000-00-00'),
      repo.paidTasks(user.id),
      taskStreak(repo, user, today),
      repo.ledger(user.id, 30),
    ]);
    const earnedOn = new Map<string, number>();
    for (const p of paid) earnedOn.set(p.date, (earnedOn.get(p.date) ?? 0) + p.s);
    const res: ProgressResponse = {
      today,
      achievements: list,
      week: Array.from({ length: 7 }, (_, i) => {
        const date = addDays(from, i);
        return { date, study: Math.round(study.get(date) ?? 0), earned: Math.round((earnedOn.get(date) ?? 0) * 10) / 10 };
      }),
      streak,
      totals: {
        tasks: stats.paidTasks,
        earned: Math.round(paid.reduce((s, p) => s + p.s, 0)),
        study_minutes: Math.round([...study.values()].reduce((s, v) => s + v, 0)),
        words_learned: (await repo.vocabAll(user.id)).length,
      },
      ledger,
    };
    return json(res);
  }

  // ---- /api/wallet ---- the lock settings: apps, limits, the Shortcuts link
  if (path === '/wallet' && (method === 'GET' || method === 'PUT')) {
    if (method === 'PUT') {
      const p = WalletSettingsPutSchema.parse(await readJson(req));
      await repo.updateUser(user.id, { wallet_enabled: p.wallet_enabled, sm_bank_cap: p.bank_cap, sm_daily_cap: p.daily_earn_cap, sm_apps: p.apps ? JSON.stringify(p.apps) : undefined });
      await reload();
    }
    return json(await walletView(repo, user, env, today));
  }

  // ---- /api/lock ---- DNS lock through NextDNS
  if (path === '/lock/config' && method === 'POST') {
    const body = LockConfigSchema.parse(await readJson(req));
    const r = await configureLock(repo, user, body.key.trim(), body.profile.trim().toLowerCase());
    if (!r.ok) throw new HttpError(400, r.error ?? 'NextDNS error');
    await reload();
    return json(await walletView(repo, user, env, today));
  }
  if (path === '/lock/config' && method === 'DELETE') {
    await removeLock(repo, user);
    await reload();
    return json(await walletView(repo, user, env, today));
  }
  if (path === '/lock/unlock' && method === 'POST') {
    const body = UnlockSchema.parse(await readJson(req));
    const r = await unlock(repo, user, body.minutes);
    if (!r.ok) throw new HttpError(r.error === 'insufficient' ? 402 : 400, r.error === 'insufficient' ? 'Not enough minutes' : r.error === 'not_configured' ? 'Lock is not set up' : r.error ?? 'NextDNS error');
    await reload();
    return json(await walletView(repo, user, env, today));
  }
  if (path === '/lock/check' && method === 'GET') return json(await lockCheck(repo, user));
  if (path === '/lock/close' && method === 'POST') {
    const r = await lockNow(repo, user, true);
    if (!r.ok) throw new HttpError(400, r.error ?? 'NextDNS error');
    await reload();
    return json({ ...(await walletView(repo, user, env, today)), refunded: r.refunded });
  }

  throw new HttpError(404, 'Not found');
}

async function walletView(repo: Repo, user: UserRow, env: Env, today: string): Promise<WalletResponse> {
  const w = walletSettings(user);
  const key = await repo.ensureApiKey(user);
  const earnedToday = await repo.earnedOn(user.id, today);
  const base = (env.WEBAPP_URL || '').replace(/\/+$/, '');
  const balance = await repo.balance(user.id);
  const open = await repo.openSession(user.id);
  return {
    ...w,
    balance: Math.round(balance * 10) / 10,
    session: open ? { app: GateApp.safeParse(open.app).data ?? 'other', started_at: open.started_at, seconds_left: Math.max(0, secondsLeft(balance, open, new Date())) } : null,
    earned_today: earnedToday,
    earn_left: Math.max(0, w.daily_earn_cap - earnedToday),
    gate_url: `${base}/gate/${key}`,
    lock: lockState({ ...user, sm_api_key: key }, env),
  };
}

import { z } from 'zod';
import {
  ActivityInputSchema,
  DEFAULT_SETTINGS,
  EntriesPutSchema,
  IsoDate,
  MockTestInputSchema,
  SettingsPutSchema,
  ieltsOverall,
  monthBounds,
  isEditable,
  isScheduledOn,
  todayInTz,
  type AuthResponse,
  type SettingsView,
  type StatsResponse,
  type TodayResponse,
} from '@tracker/shared';
import type { Env } from '../env';
import { Repo, userSettings, type UserRow } from '../lib/db';
import { HttpError, json, readJson } from '../lib/http';
import { issueToken, verifyToken } from '../lib/session';
import { Bot, validateInitData } from '../lib/telegram';
import { computeStreaks, heatmapForRange, ieltsStats } from '../lib/stats';

export function settingsView(u: UserRow, env: Env, today: string): SettingsView {
  return {
    ...userSettings(u),
    partner: u.partner_chat_id ? { name: u.partner_name ?? 'партнёр', linked: true } : null,
    deadline_editable: u.ielts_deadline_changed_on !== today,
    bot_username: env.BOT_USERNAME,
  };
}

const AuthBody = z.object({ initData: z.string().min(1), tz: z.string().max(64).optional() });

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
  // Bearer header normally; `?token=` is allowed only for GET /api/export (opened as a link from the Mini App).
  const url = new URL(req.url);
  const queryToken =
    req.method === 'GET' && (url.pathname === '/api/export' || /^\/api\/proofs\/\d+\/image$/.test(url.pathname)) ? url.searchParams.get('token') : null;
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : queryToken;
  const tgId = await verifyToken(token, env.SESSION_SECRET);
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
    const token = await issueToken(tgUser.id, env.SESSION_SECRET);
    const res: AuthResponse = {
      token,
      user: { tg_id: user.tg_id, first_name: user.first_name, is_new: isNew },
      settings: settingsView(user, env, todayInTz(user.tz)),
    };
    return json(res);
  }

  const user = await requireUser(req, env, repo);
  const today = todayInTz(user.tz);
  const strict = !!user.strict_mode;

  // ---- GET /api/today?date= ----
  if (path === '/today' && method === 'GET') {
    const date = url.searchParams.get('date') ?? today;
    IsoDate.parse(date);
    const activities = await repo.listActivities(user.id);
    const entries = await repo.entriesForDate(user.id, date);
    const res: TodayResponse = {
      date,
      today,
      activities,
      scheduled_ids: activities.filter((a) => isScheduledOn(a, date)).map((a) => a.id),
      entries,
      editable: isEditable(date, today),
      strict_mode: strict,
    };
    return json(res);
  }

  // ---- PUT /api/entries ----
  if (path === '/entries' && method === 'PUT') {
    const { entries } = EntriesPutSchema.parse(await readJson(req));
    const activities = await repo.listActivities(user.id, true);
    const ids = new Set(activities.map((a) => a.id));
    for (const e of entries) {
      if (!ids.has(e.activity_id)) throw new HttpError(400, `Unknown activity ${e.activity_id}`);
      if (!isEditable(e.date, today)) throw new HttpError(403, `Date ${e.date} is not editable`);
    }
    await repo.upsertEntries(user.id, entries);
    return json({ ok: true, entries: await repo.entriesForDate(user.id, entries[0].date) });
  }

  // ---- /api/activities ----
  if (path === '/activities' && method === 'GET') {
    return json({ activities: await repo.listActivities(user.id, url.searchParams.get('archived') === '1') });
  }
  if (path === '/activities' && method === 'POST') {
    const input = ActivityInputSchema.parse(await readJson(req));
    return json(await repo.createActivity(user.id, input, today), 201);
  }
  const actMatch = path.match(/^\/activities\/(\d+)$/);
  if (actMatch) {
    const id = Number(actMatch[1]);
    if (method === 'PUT') {
      const input = ActivityInputSchema.partial().extend({ sort: z.number().int().optional(), archived_at: z.string().nullable().optional() }).parse(await readJson(req));
      const a = await repo.updateActivity(user.id, id, input);
      if (!a) throw new HttpError(404, 'Not found');
      return json(a);
    }
    if (method === 'DELETE') {
      // Soft delete = archive (history is preserved).
      const a = await repo.updateActivity(user.id, id, { archived_at: new Date().toISOString() });
      if (!a) throw new HttpError(404, 'Not found');
      return json(a);
    }
  }

  // ---- GET /api/stats?month=YYYY-MM ----
  if (path === '/stats' && method === 'GET') {
    const month = url.searchParams.get('month') ?? today.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) throw new HttpError(400, 'month must be YYYY-MM');
    const { from, to } = monthBounds(month);
    const active = await repo.listActivities(user.id);
    const entries = await repo.entriesBetween(user.id, from, to);
    const res: StatsResponse = {
      month,
      today,
      streaks: await computeStreaks(repo, user.id, active, today, strict),
      days: heatmapForRange(active, entries, from, to, strict),
    };
    return json(res);
  }

  // ---- /api/settings ----
  if (path === '/settings' && method === 'GET') return json(settingsView(user, env, today));
  if (path === '/settings' && method === 'PUT') {
    const patch = SettingsPutSchema.parse(await readJson(req));
    if (patch.tz && !isValidTz(patch.tz)) throw new HttpError(400, 'Invalid timezone');
    const extra: Record<string, unknown> = {};
    if (patch.ielts_exam_date !== undefined && patch.ielts_exam_date !== user.ielts_exam_date) {
      if (user.ielts_deadline_changed_on === today) throw new HttpError(429, 'Дату экзамена можно менять один раз в день');
      extra.ielts_deadline_changed_on = today;
    }
    await repo.updateUser(user.id, { ...patch, ...extra });
    return json(settingsView((await repo.getUserByTg(user.tg_id))!, env, today));
  }

  // ---- DELETE /api/partner ----
  if (path === '/partner' && method === 'DELETE') {
    await repo.updateUser(user.id, { partner_chat_id: null, partner_name: null });
    return json({ ok: true });
  }

  // ---- GET /api/ielts ----
  if (path === '/ielts' && method === 'GET') {
    return json(await ieltsStats(repo, user, await repo.listActivities(user.id), today));
  }

  // ---- /api/mocks ----
  if (path === '/mocks' && method === 'POST') {
    const m = MockTestInputSchema.parse(await readJson(req));
    const overall = m.overall ?? ieltsOverall(m.listening, m.reading, m.writing, m.speaking);
    return json(await repo.addMock(user.id, { ...m, overall }), 201);
  }
  const mockMatch = path.match(/^\/mocks\/(\d+)$/);
  if (mockMatch && method === 'DELETE') {
    await repo.deleteMock(user.id, Number(mockMatch[1]));
    return json({ ok: true });
  }

  // ---- /api/proofs/:id ----
  const proofMatch = path.match(/^\/proofs\/(\d+)(\/image)?$/);
  if (proofMatch) {
    const proof = await repo.getProof(user.id, Number(proofMatch[1]));
    if (!proof) throw new HttpError(404, 'Not found');
    if (method === 'DELETE') {
      await repo.deleteProof(user.id, proof.id);
      return json({ ok: true });
    }
    if (method === 'GET' && proofMatch[2] && proof.file_id) {
      // Proxy the Telegram photo (file_id is opaque; the file lives on Telegram servers).
      const bot = new Bot(env.BOT_TOKEN);
      const url = await bot.fileUrl(proof.file_id);
      if (!url) throw new HttpError(502, 'Telegram file unavailable');
      const r = await fetch(url);
      return new Response(r.body, { status: r.status, headers: { 'content-type': r.headers.get('content-type') ?? 'image/jpeg', 'cache-control': 'private, max-age=86400' } });
    }
  }

  // ---- GET /api/export ----
  if (path === '/export' && method === 'GET') {
    const data = {
      exported_at: new Date().toISOString(),
      user: { tg_id: user.tg_id, first_name: user.first_name },
      settings: { ...userSettings(user), ai_key: user.ai_key ? '***' : null },
      activities: await repo.listActivities(user.id, true),
      entries: await repo.allEntries(user.id),
    };
    return json(data, 200, { 'content-disposition': `attachment; filename="tracker-export-${today}.json"` });
  }

  throw new HttpError(404, 'Not found');
}

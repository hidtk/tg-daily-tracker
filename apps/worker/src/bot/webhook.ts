import { MINUTE_PRESETS, addDays, isConfirmed, isScheduledOn, todayInTz } from '@tracker/shared';
import type { Env } from '../env';
import { Repo, type UserRow } from '../lib/db';
import { Bot, escapeHtml, type InlineKeyboardButton } from '../lib/telegram';
import { helpText, partnerLinkedText, partnerText, todayStatusText, welcomeText } from './messages';

interface TgChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  first_name?: string;
}
interface Update {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name: string; language_code?: string };
    chat: TgChat;
    text?: string;
    caption?: string;
    photo?: { file_id: string; file_size?: number; width: number; height: number }[];
    document?: { file_id: string; mime_type?: string };
    forward_origin?: unknown;
    forward_from?: unknown;
    entities?: { type: string }[];
  };
  channel_post?: { message_id: number; chat: TgChat; text?: string };
  callback_query?: { id: string; from: { id: number; first_name: string }; data?: string; message?: { chat: TgChat; message_id: number } };
}

export function webappUrl(env: Env, req?: Request): string {
  if (env.WEBAPP_URL) return env.WEBAPP_URL;
  if (req) return new URL(req.url).origin;
  return `https://t.me/${env.BOT_USERNAME}`;
}

export function openAppKeyboard(url: string): InlineKeyboardButton[][] {
  // web_app buttons require an HTTPS Mini App URL; a t.me fallback is a plain link.
  if (url.startsWith('https://t.me/')) return [[{ text: '📋 Открыть трекер', url }]];
  return [[{ text: '📋 Открыть трекер', web_app: { url } }]];
}

const CHAT_LINK_RE = /https?:\/\/(chatgpt\.com|chat\.openai\.com|claude\.ai|gemini\.google\.com|g\.co|grok\.com|x\.ai|deepseek\.com|chat\.deepseek\.com|perplexity\.ai)\/\S+/i;
const CHAT_MIN_CHARS = 200;

function randomCode(): string {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function handleWebhook(req: Request, env: Env): Promise<Response> {
  // Telegram sends this header when the webhook was set with secret_token.
  const secret = req.headers.get('x-telegram-bot-api-secret-token');
  if (secret !== env.SESSION_SECRET) return new Response('forbidden', { status: 403 });

  const update = (await req.json().catch(() => null)) as Update | null;
  if (!update) return new Response('bad request', { status: 400 });

  const bot = new Bot(env.BOT_TOKEN);
  const repo = new Repo(env.DB);
  const url = webappUrl(env, req);
  const kb = openAppKeyboard(url);

  try {
    if (update.callback_query) {
      await handleCallback(update.callback_query, bot, repo, kb);
      return new Response('ok');
    }

    // /partner posted inside a group or channel where the bot is a member → link that chat as the partner.
    const post = update.channel_post;
    if (post?.text?.trim().startsWith('/partner')) {
      await linkChatByCode(post.text, post.chat, bot, repo);
      return new Response('ok');
    }

    const msg = update.message;
    if (!msg?.from) return new Response('ok');

    if (msg.chat.type !== 'private') {
      if (msg.text?.trim().startsWith('/partner')) await linkChatByCode(msg.text, msg.chat, bot, repo);
      return new Response('ok');
    }

    const chatId = msg.chat.id;
    const text = (msg.text ?? '').trim();
    const cmd = text.split(/[\s@]/)[0].toLowerCase();

    if (cmd === '/start') {
      const arg = text.split(/\s+/)[1] ?? '';
      if (arg.startsWith('partner_')) {
        // Someone opened the partner deep link.
        const owner = await repo.getUserByPartnerCode(arg.slice('partner_'.length));
        if (!owner) {
          await bot.sendMessage(chatId, 'Ссылка недействительна или устарела. Попроси новую командой /partner.');
        } else if (owner.tg_id === msg.from.id) {
          await bot.sendMessage(chatId, 'Это твоя собственная ссылка — отправь её тому, кто будет твоим партнёром по ответственности.');
        } else {
          await repo.updateUser(owner.id, { partner_chat_id: chatId, partner_name: msg.from.first_name });
          await bot.sendMessage(chatId, partnerLinkedText(owner.first_name));
          await bot.sendMessage(owner.tg_id, `🤝 <b>${escapeHtml(msg.from.first_name)}</b> теперь твой партнёр по ответственности. Ему будут приходить недельные сводки и пропуски.`, kb);
        }
        return new Response('ok');
      }
      const { user, isNew } = await repo.ensureUser(msg.from.id, msg.from.first_name, 'UTC');
      await bot.sendMessage(chatId, welcomeText(user.first_name, isNew), kb);
      return new Response('ok');
    }

    const user = await repo.getUserByTg(msg.from.id);
    if (!user) {
      await bot.sendMessage(chatId, 'Сначала открой трекер — нажми /start.', kb);
      return new Response('ok');
    }
    const today = todayInTz(user.tz);

    if (cmd === '/today') {
      const activities = await repo.listActivities(user.id);
      const entries = await repo.entriesForDate(user.id, today);
      await bot.sendMessage(chatId, todayStatusText(today, activities, entries, !!user.strict_mode), kb);
    } else if (cmd === '/app') {
      await bot.sendMessage(chatId, 'Открыть трекер 👇', kb);
    } else if (cmd === '/help') {
      await bot.sendMessage(chatId, helpText(), kb);
    } else if (cmd === '/partner') {
      const sub = text.split(/\s+/)[1]?.toLowerCase();
      if (sub === 'off') {
        await repo.updateUser(user.id, { partner_chat_id: null, partner_name: null });
        await bot.sendMessage(chatId, 'Партнёр отвязан.');
      } else {
        let code = user.partner_code;
        if (!code) {
          code = randomCode();
          await repo.updateUser(user.id, { partner_code: code });
        }
        await bot.sendMessage(chatId, partnerText(env.BOT_USERNAME, code, user.partner_name));
      }
    } else if (msg.photo?.length) {
      // Largest photo size is last.
      const fileId = msg.photo[msg.photo.length - 1].file_id;
      await startProof(user, { type: 'photo', file_id: fileId, text: msg.caption?.trim() || null }, chatId, bot, repo, today);
    } else if (msg.document?.mime_type?.startsWith('image/')) {
      await startProof(user, { type: 'photo', file_id: msg.document.file_id, text: msg.caption?.trim() || null }, chatId, bot, repo, today);
    } else if (text && !text.startsWith('/') && (CHAT_LINK_RE.test(text) || text.length >= CHAT_MIN_CHARS || msg.forward_origin || msg.forward_from)) {
      await startProof(user, { type: 'chat', text: text.slice(0, 2000) }, chatId, bot, repo, today);
    } else {
      await bot.sendMessage(
        chatId,
        'Открой трекер кнопкой ниже 👇\n\nЧтобы подтвердить занятие — пришли фото, перешли диалог с ИИ или ссылку на него.',
        kb,
      );
    }
  } catch (e) {
    console.error('webhook error', e);
  }
  // Always 200 so Telegram doesn't retry.
  return new Response('ok');
}

// ---------- proof flow ----------

async function startProof(
  user: UserRow,
  p: { type: 'photo' | 'chat'; file_id?: string | null; text?: string | null },
  chatId: number,
  bot: Bot,
  repo: Repo,
  today: string,
) {
  const activities = await repo.listActivities(user.id);
  if (!activities.length) {
    await bot.sendMessage(chatId, 'Сначала добавь активности в трекере.');
    return;
  }
  const pendingId = await repo.addPendingProof(user.id, p);
  const entries = await repo.entriesForDate(user.id, today);
  const byId = new Map(entries.map((e) => [e.activity_id, e]));
  // Sort: scheduled & unconfirmed first, then the rest.
  const ranked = [...activities].sort((a, b) => score(b) - score(a));
  function score(a: (typeof activities)[number]) {
    const e = byId.get(a.id);
    return (isScheduledOn(a, today) ? 2 : 0) + (e && isConfirmed(e) ? -1 : 0) + (e?.planned ? 1 : 0);
  }
  const rows: InlineKeyboardButton[][] = ranked.map((a) => [
    {
      text: `${a.emoji} ${a.name}${byId.get(a.id) && isConfirmed(byId.get(a.id)!) ? ' ✅' : ''}`,
      callback_data: `pf:${pendingId}:${a.id}:${today}`,
    },
  ]);
  rows.push([{ text: `Это за вчера (${addDays(today, -1).slice(5)})`, callback_data: `pfd:${pendingId}:${addDays(today, -1)}` }]);
  rows.push([{ text: '✖ Отмена', callback_data: `pfx:${pendingId}` }]);
  await bot.sendMessage(chatId, p.type === 'photo' ? '📷 Фото получено. К какой активности привязать?' : '💬 Принял как отчёт о занятии с ИИ. К какой активности привязать?', rows);
}

async function handleCallback(cq: NonNullable<Update['callback_query']>, bot: Bot, repo: Repo, kb: InlineKeyboardButton[][]) {
  const data = cq.data ?? '';
  const chatId = cq.message?.chat.id;
  const messageId = cq.message?.message_id;
  const user = await repo.getUserByTg(cq.from.id);
  if (!user || !chatId || !messageId) {
    await bot.answerCallbackQuery(cq.id);
    return;
  }
  const [kind, ...rest] = data.split(':');

  if (kind === 'pfx') {
    await repo.deletePendingProof(Number(rest[0]));
    await bot.editMessageText(chatId, messageId, 'Отменено.');
    await bot.answerCallbackQuery(cq.id);
    return;
  }

  if (kind === 'pfd') {
    // choose activity for yesterday
    const [pendingId, date] = rest;
    const activities = await repo.listActivities(user.id);
    const rows: InlineKeyboardButton[][] = activities.map((a) => [{ text: `${a.emoji} ${a.name}`, callback_data: `pf:${pendingId}:${a.id}:${date}` }]);
    rows.push([{ text: '✖ Отмена', callback_data: `pfx:${pendingId}` }]);
    await bot.editMessageText(chatId, messageId, `За ${date}. К какой активности привязать?`, rows);
    await bot.answerCallbackQuery(cq.id);
    return;
  }

  if (kind === 'pf') {
    const [pendingIdS, activityIdS, date] = rest;
    const pending = await repo.getPendingProof(user.id, Number(pendingIdS));
    const activity = await repo.getActivity(user.id, Number(activityIdS));
    if (!pending || !activity) {
      await bot.editMessageText(chatId, messageId, 'Это подтверждение уже обработано.');
      await bot.answerCallbackQuery(cq.id);
      return;
    }
    await repo.addProof(user.id, activity.id, date, pending);
    await repo.markDone(user.id, activity.id, date);
    await repo.deletePendingProof(pending.id);
    const entry = await repo.getEntry(user.id, activity.id, date);
    const rows: InlineKeyboardButton[][] = [
      MINUTE_PRESETS.map((m) => ({ text: `${m}м`, callback_data: `pm:${activity.id}:${date}:${m}` })),
      [{ text: 'Без времени', callback_data: `pm:${activity.id}:${date}:0` }],
    ];
    const proofsCount = entry?.proofs?.length ?? 0;
    await bot.editMessageText(
      chatId,
      messageId,
      `✅ <b>${activity.emoji} ${escapeHtml(activity.name)}</b> за ${date} подтверждено (${proofsCount} ${plural(proofsCount, 'подтверждение', 'подтверждения', 'подтверждений')}).\n\nСколько минут занимался?`,
      entry && entry.minutes > 0 ? undefined : rows,
    );
    await bot.answerCallbackQuery(cq.id, 'Подтверждено ✅');
    return;
  }

  if (kind === 'pm') {
    const [activityIdS, date, minS] = rest;
    const minutes = Number(minS);
    if (minutes > 0) await repo.setMinutes(user.id, Number(activityIdS), date, minutes);
    const activity = await repo.getActivity(user.id, Number(activityIdS));
    await bot.editMessageText(
      chatId,
      messageId,
      `✅ <b>${activity?.emoji ?? ''} ${escapeHtml(activity?.name ?? '')}</b> за ${date} подтверждено${minutes ? ` · ${minutes} мин` : ''}.`,
      kb,
    );
    await bot.answerCallbackQuery(cq.id);
    return;
  }

  await bot.answerCallbackQuery(cq.id);
}

async function linkChatByCode(text: string, chat: TgChat, bot: Bot, repo: Repo) {
  const code = text.trim().split(/\s+/)[1];
  if (!code) {
    await bot.sendMessage(chat.id, 'Использование: /partner <код> — код выдаёт бот в личке по команде /partner.');
    return;
  }
  const owner = await repo.getUserByPartnerCode(code);
  if (!owner) {
    await bot.sendMessage(chat.id, 'Код не найден.');
    return;
  }
  const name = chat.title ?? chat.first_name ?? 'чат';
  await repo.updateUser(owner.id, { partner_chat_id: chat.id, partner_name: name });
  await bot.sendMessage(chat.id, `🤝 Этот чат теперь получает сводки по трекеру <b>${escapeHtml(owner.first_name)}</b>.`);
  await bot.sendMessage(owner.tg_id, `🤝 Чат <b>${escapeHtml(name)}</b> привязан как партнёр по ответственности.`);
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

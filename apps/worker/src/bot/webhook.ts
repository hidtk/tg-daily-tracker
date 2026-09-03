import { todayInTz } from '@tracker/shared';
import type { Env } from '../env';
import { Repo } from '../lib/db';
import { Bot, type InlineKeyboardButton } from '../lib/telegram';
import { helpText, todayStatusText, welcomeText } from './messages';

interface Update {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name: string; language_code?: string };
    chat: { id: number; type: string };
    text?: string;
  };
  callback_query?: { id: string; from: { id: number; first_name: string }; data?: string; message?: { chat: { id: number } } };
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
      await bot.answerCallbackQuery(update.callback_query.id);
      return new Response('ok');
    }
    const msg = update.message;
    if (!msg?.from || msg.chat.type !== 'private') return new Response('ok');
    const chatId = msg.chat.id;
    const text = (msg.text ?? '').trim();
    const cmd = text.split(/[\s@]/)[0].toLowerCase();

    if (cmd === '/start') {
      const { user, isNew } = await repo.ensureUser(msg.from.id, msg.from.first_name, 'UTC');
      await bot.sendMessage(chatId, welcomeText(user.first_name, isNew), kb);
    } else if (cmd === '/today') {
      const user = await repo.getUserByTg(msg.from.id);
      if (!user) {
        await bot.sendMessage(chatId, 'Сначала открой трекер — нажми /start.', kb);
      } else {
        const today = todayInTz(user.tz);
        const activities = await repo.listActivities(user.id);
        const entries = await repo.entriesForDate(user.id, today);
        await bot.sendMessage(chatId, todayStatusText(today, activities, entries), kb);
      }
    } else if (cmd === '/app') {
      await bot.sendMessage(chatId, 'Открыть трекер 👇', kb);
    } else if (cmd === '/help') {
      await bot.sendMessage(chatId, helpText(), kb);
    } else {
      await bot.sendMessage(chatId, 'Открой трекер кнопкой ниже 👇', kb);
    }
  } catch (e) {
    console.error('webhook error', e);
  }
  // Always 200 so Telegram doesn't retry.
  return new Response('ok');
}

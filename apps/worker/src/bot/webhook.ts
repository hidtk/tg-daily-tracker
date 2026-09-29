import { todayInTz } from '@tracker/shared';
import type { Env } from '../env';
import { Repo } from '../lib/db';
import { Bot, type InlineKeyboardButton } from '../lib/telegram';
import { acceptVoice } from '../lib/tasks';
import { appButton, helpText, voiceReplyText, welcomeText } from './messages';

interface Update {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name: string };
    chat: { id: number; type: string };
    text?: string;
    voice?: { file_id: string; file_unique_id: string; duration: number };
    forward_origin?: unknown;
    forward_date?: number;
  };
  callback_query?: { id: string; from: { id: number }; message?: { chat: { id: number }; message_id: number } };
}

export function webappUrl(env: Env, req?: Request): string {
  if (env.WEBAPP_URL) return env.WEBAPP_URL;
  if (req) return new URL(req.url).origin;
  return `https://t.me/${env.BOT_USERNAME}`;
}

export function openAppKeyboard(url: string): InlineKeyboardButton[][] {
  return [[appButton(url, 'Open the app')]];
}

/**
 * The bot does three things: /start (a greeting and the app button), /help, and Speaking answers sent as voice
 * messages. Everything else is in the app.
 */
export async function handleWebhook(req: Request, env: Env): Promise<Response> {
  // Telegram sends this header when the webhook was set with secret_token.
  if (req.headers.get('x-telegram-bot-api-secret-token') !== env.SESSION_SECRET) return new Response('forbidden', { status: 403 });
  const update = (await req.json().catch(() => null)) as Update | null;
  if (!update) return new Response('bad request', { status: 400 });

  const bot = new Bot(env.BOT_TOKEN);
  const repo = new Repo(env.DB);
  const url = webappUrl(env, req);
  const kb = openAppKeyboard(url);

  try {
    // Buttons from older messages: they all lead to the app now.
    const cq = update.callback_query;
    if (cq) {
      await bot.answerCallbackQuery(cq.id, 'Open the app');
      if (cq.message) await bot.editMessageReplyMarkup(cq.message.chat.id, cq.message.message_id, kb);
      return new Response('ok');
    }

    const msg = update.message;
    if (!msg?.from || msg.chat.type !== 'private') return new Response('ok');
    const chatId = msg.chat.id;
    const cmd = (msg.text ?? '').trim().split(/[\s@]/)[0].toLowerCase();

    if (cmd === '/start') {
      const { user } = await repo.ensureUser(msg.from.id, msg.from.first_name, 'UTC');
      await bot.sendMessage(chatId, welcomeText(user.first_name), kb);
      return new Response('ok');
    }
    if (cmd === '/help') {
      await bot.sendMessage(chatId, helpText(), kb);
      return new Response('ok');
    }

    const user = await repo.getUserByTg(msg.from.id);
    if (!user) {
      await bot.sendMessage(chatId, 'Press /start first.', kb);
      return new Response('ok');
    }

    // A voice message is a Speaking answer — checked and counted automatically.
    if (msg.voice) {
      const outcome = await acceptVoice(repo, user, todayInTz(user.tz), {
        seconds: msg.voice.duration,
        fileUniqueId: msg.voice.file_unique_id,
        forwarded: !!(msg.forward_origin || msg.forward_date),
      });
      await bot.sendMessage(chatId, voiceReplyText(outcome), [[appButton(url, 'Open the Shop', { go: 'shop' })]]);
      return new Response('ok');
    }

    await bot.sendMessage(chatId, 'Tasks are in the app. Speaking: send me a voice message here.', kb);
  } catch (e) {
    console.error('webhook error', e);
  }
  // Always 200 so Telegram doesn't retry.
  return new Response('ok');
}

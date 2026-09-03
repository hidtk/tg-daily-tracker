import { hmacSha256, toHex, timingSafeEqual } from './crypto';

export interface TgUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

const INIT_DATA_MAX_AGE_SEC = 60 * 60 * 24; // 24h

/**
 * Validate Telegram Mini App initData (HMAC-SHA256 per docs).
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export async function validateInitData(initData: string, botToken: string): Promise<TgUser | null> {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secretKey = await hmacSha256('WebAppData', botToken);
  const computed = toHex(await hmacSha256(secretKey, dataCheckString));
  if (!timingSafeEqual(computed, hash)) return null;

  const authDate = Number(params.get('auth_date') ?? 0);
  if (!authDate || Date.now() / 1000 - authDate > INIT_DATA_MAX_AGE_SEC) return null;

  const userRaw = params.get('user');
  if (!userRaw) return null;
  try {
    const u = JSON.parse(userRaw) as TgUser;
    if (typeof u.id !== 'number') return null;
    return u;
  } catch {
    return null;
  }
}

// ---------- Bot API client ----------

export interface InlineKeyboardButton {
  text: string;
  web_app?: { url: string };
  callback_data?: string;
  url?: string;
}

export class Bot {
  constructor(private token: string) {}

  private async call<T = unknown>(method: string, body: Record<string, unknown>): Promise<T | null> {
    const res = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as { ok: boolean; result?: T; description?: string } | null;
    if (!json?.ok) {
      console.warn(`tg ${method} failed:`, json?.description ?? res.status);
      return null;
    }
    return json.result ?? null;
  }

  sendMessage(chatId: number, text: string, keyboard?: InlineKeyboardButton[][]) {
    return this.call('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: keyboard ? { inline_keyboard: keyboard } : undefined,
    });
  }

  answerCallbackQuery(id: string, text?: string) {
    return this.call('answerCallbackQuery', { callback_query_id: id, text });
  }

  setWebhook(url: string, secretToken: string) {
    return this.call('setWebhook', { url, secret_token: secretToken, allowed_updates: ['message', 'callback_query'] });
  }

  setChatMenuButton(webAppUrl: string, text = 'Трекер') {
    return this.call('setChatMenuButton', { menu_button: { type: 'web_app', text, web_app: { url: webAppUrl } } });
  }

  setMyCommands(commands: { command: string; description: string }[]) {
    return this.call('setMyCommands', { commands });
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

#!/usr/bin/env node
/**
 * One-time bot setup: webhook, menu button, commands.
 *
 * Usage:
 *   BOT_TOKEN=... SESSION_SECRET=... node scripts/setup-bot.mjs https://tg-daily-tracker.<you>.workers.dev
 *
 * SESSION_SECRET must equal the Worker secret of the same name (it is used as the webhook secret token).
 */
const [, , baseUrl] = process.argv;
const { BOT_TOKEN, SESSION_SECRET } = process.env;
if (!baseUrl || !BOT_TOKEN || !SESSION_SECRET) {
  console.error('Usage: BOT_TOKEN=... SESSION_SECRET=... node scripts/setup-bot.mjs https://<worker-url>');
  process.exit(1);
}
const base = baseUrl.replace(/\/$/, '');
// Telegram accepts only A-Z a-z 0-9 _ - (1–256 chars) as the webhook secret_token.
if (!/^[A-Za-z0-9_-]{1,256}$/.test(SESSION_SECRET)) {
  console.error('SESSION_SECRET may contain only letters, digits, "_" and "-" (it is also the Telegram webhook secret). Generate one with: openssl rand -hex 32');
  process.exit(1);
}

async function call(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  console.log(method, j.ok ? '✅' : '❌', j.ok ? '' : j.description);
  return j;
}

const hook = await call('setWebhook', { url: `${base}/bot/webhook`, secret_token: SESSION_SECRET, allowed_updates: ['message', 'callback_query'], drop_pending_updates: false });
if (!hook.ok) {
  console.error('Webhook was not set — the bot will not answer. Fix the error above and run again.');
  process.exit(1);
}
await call('setChatMenuButton', { menu_button: { type: 'web_app', text: 'IELTS', web_app: { url: base } } });
await call('setMyCommands', {
  commands: [
    { command: 'app', description: 'Open the trainer' },
    { command: 'today', description: 'Today’s status' },
    { command: 'task', description: 'Today’s practice task' },
    { command: 'words', description: 'Today’s words and reviews' },
    { command: 'hw', description: 'Homework: list / add / done' },
    { command: 'minutes', description: 'Social-media minutes' },
    { command: 'unlock', description: 'Open social media for N minutes' },
    { command: 'lock', description: 'Lock social media now' },
    { command: 'partner', description: 'Accountability partner' },
    { command: 'help', description: 'Help' },
  ],
});
const info = await call('getWebhookInfo', {});
console.log('webhook:', info.result?.url, 'pending:', info.result?.pending_update_count);

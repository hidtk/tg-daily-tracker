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

await call('setWebhook', { url: `${base}/bot/webhook`, secret_token: SESSION_SECRET, allowed_updates: ['message', 'callback_query'], drop_pending_updates: true });
await call('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Трекер', web_app: { url: base } } });
await call('setMyCommands', {
  commands: [
    { command: 'app', description: 'Открыть трекер' },
    { command: 'today', description: 'Статус за сегодня' },
    { command: 'help', description: 'Справка' },
  ],
});
const info = await call('getWebhookInfo', {});
console.log('webhook:', info.result?.url, 'pending:', info.result?.pending_update_count);

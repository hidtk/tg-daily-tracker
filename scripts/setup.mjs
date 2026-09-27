#!/usr/bin/env node
/**
 * Interactive one-command setup (Windows / macOS / Linux):
 *   npm install
 *   npm run setup
 *
 * What it does:
 *   1. asks for the bot token (from @BotFather) and checks it with Telegram;
 *   2. logs into Cloudflare (browser) if needed;
 *   3. creates the D1 database `tracker-db` (or reuses it) and applies migrations;
 *   4. builds the Mini App and deploys the Worker;
 *   5. uploads secrets BOT_TOKEN / SESSION_SECRET;
 *   6. sets the webhook, menu button and commands of the bot.
 *
 * Safe to re-run: every step is idempotent. Values are remembered in apps/worker/.dev.vars (git-ignored).
 */
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workerDir = join(root, 'apps', 'worker');
const wranglerFile = join(workerDir, 'wrangler.jsonc');
const devVarsFile = join(workerDir, '.dev.vars');
const DB_NAME = 'tracker-db';

const c = { g: (s) => `\x1b[32m${s}\x1b[0m`, y: (s) => `\x1b[33m${s}\x1b[0m`, r: (s) => `\x1b[31m${s}\x1b[0m`, b: (s) => `\x1b[1m${s}\x1b[0m` };
const step = (n, s) => console.log(`\n${c.b(`[${n}/6]`)} ${s}`);
const die = (s) => {
  console.error(`\n${c.r('✖')} ${s}`);
  process.exit(1);
};

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: workerDir, stdio: opts.capture ? ['pipe', 'pipe', 'inherit'] : 'inherit', encoding: 'utf8', shell: true, input: opts.input, env: { ...process.env, ...opts.env } });
}

function readDevVars() {
  if (!existsSync(devVarsFile)) return {};
  return Object.fromEntries(
    readFileSync(devVarsFile, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
  );
}

const [major] = process.versions.node.split('.').map(Number);
if (major < 20) die(`Нужен Node.js 20 или новее (сейчас ${process.versions.node}). Скачай LTS: https://nodejs.org`);
if (!existsSync(join(root, 'node_modules', 'wrangler')) && !existsSync(join(workerDir, 'node_modules', 'wrangler'))) die('Сначала выполни: npm install');

const rl = createInterface({ input: process.stdin, output: process.stdout });
const saved = readDevVars();

console.log(c.b('\nIELTS trainer — установка в Telegram + Cloudflare (бесплатно)\n'));

// 1. Bot token
step(1, 'Telegram-бот');
let botToken = saved.BOT_TOKEN && !saved.BOT_TOKEN.includes('your-bot-token') ? saved.BOT_TOKEN : '';
let botUsername = '';
for (;;) {
  if (!botToken) {
    console.log('Создай бота в @BotFather (/newbot) и вставь токен вида 123456789:AA...');
    botToken = (await rl.question('BOT_TOKEN: ')).trim();
  }
  const me = await fetch(`https://api.telegram.org/bot${botToken}/getMe`).then((r) => r.json()).catch(() => ({ ok: false, description: 'нет связи с api.telegram.org' }));
  if (me.ok) {
    botUsername = me.result.username;
    console.log(c.g(`✔ бот @${botUsername}`));
    break;
  }
  console.log(c.y(`Токен не подошёл: ${me.description}`));
  botToken = '';
}
const sessionSecret = saved.SESSION_SECRET && !saved.SESSION_SECRET.startsWith('change-me') ? saved.SESSION_SECRET : randomBytes(32).toString('hex');
writeFileSync(devVarsFile, `BOT_TOKEN=${botToken}\nSESSION_SECRET=${sessionSecret}\n`);
console.log(c.g('✔ секреты сохранены в apps/worker/.dev.vars (не попадает в git)'));
rl.close();

// 2. Cloudflare login
step(2, 'Вход в Cloudflare');
let who = '';
try {
  who = run('npx wrangler whoami', { capture: true });
} catch {
  /* not logged in */
}
if (!/associated with the email|You are logged in/i.test(who) || /not authenticated/i.test(who)) {
  console.log('Откроется браузер — войди в Cloudflare (или зарегистрируйся бесплатно) и нажми Allow.');
  run('npx wrangler login');
}
console.log(c.g('✔ Cloudflare подключён'));

// 3. D1
step(3, `База данных D1 «${DB_NAME}»`);
const findDb = () => {
  const out = run('npx wrangler d1 list --json', { capture: true });
  const list = JSON.parse(out.slice(out.indexOf('[')));
  return list.find((d) => d.name === DB_NAME)?.uuid;
};
let dbId = findDb();
if (!dbId) {
  run(`npx wrangler d1 create ${DB_NAME}`, { capture: true });
  dbId = findDb();
}
if (!dbId) die('Не удалось создать базу D1. Проверь, что аккаунт Cloudflare активен, и запусти ещё раз.');
let cfg = readFileSync(wranglerFile, 'utf8');
cfg = cfg.replace(/("database_id":\s*")[^"]*(")/, `$1${dbId}$2`);
writeFileSync(wranglerFile, cfg);
run(`npx wrangler d1 migrations apply ${DB_NAME} --remote`);
console.log(c.g(`✔ база ${dbId}`));

// 4. Build + deploy
step(4, 'Сборка и деплой');
execSync('npm run build', { cwd: root, stdio: 'inherit', shell: true });
const log = run(`npx wrangler deploy --var BOT_USERNAME:${botUsername}`, { capture: true });
process.stdout.write(log);
const url = (log.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/) || [])[0];
if (!url) die('Не нашёл URL воркера в выводе. Если Cloudflare просит зарегистрировать поддомен workers.dev — сделай это в дашборде (Workers & Pages) и запусти setup ещё раз.');
run(`npx wrangler deploy --var BOT_USERNAME:${botUsername} --var WEBAPP_URL:${url}`, { capture: true });
console.log(c.g(`✔ ${url}`));

// 5. Secrets
step(5, 'Секреты воркера');
run('npx wrangler secret put BOT_TOKEN', { input: botToken, capture: true });
run('npx wrangler secret put SESSION_SECRET', { input: sessionSecret, capture: true });
console.log(c.g('✔ BOT_TOKEN, SESSION_SECRET'));

// 6. Bot webhook / menu
step(6, 'Настройка бота');
execSync(`node scripts/setup-bot.mjs ${url}`, { cwd: root, stdio: 'inherit', shell: true, env: { ...process.env, BOT_TOKEN: botToken, SESSION_SECRET: sessionSecret } });

console.log(`\n${c.g('Готово!')} Открой https://t.me/${botUsername} и нажми /start.\nMini App: ${url}\n`);

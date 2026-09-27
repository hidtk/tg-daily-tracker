# IELTS trainer — Telegram Mini App

[![Deploy](https://github.com/hidtk/tg-daily-tracker/actions/workflows/deploy-worker.yml/badge.svg)](https://github.com/hidtk/tg-daily-tracker/actions/workflows/deploy-worker.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Node 20+](https://img.shields.io/badge/node-%E2%89%A520-339933)
![Cloudflare free tier](https://img.shields.io/badge/hosting-Cloudflare%20free-F38020)

Личный тренажёр подготовки к IELTS прямо в Telegram: 5 новых слов каждое утро с интервальным повторением, задание дня, Reading-тесты с оценкой band, напоминания о занятиях и домашке, статистика до экзамена и «замок» соцсетей, который открывается минутами, заработанными на тестах.

Свой сервер не нужен — всё работает на бесплатных тарифах Cloudflare. Установка занимает около 10 минут.

**[⬇️ Скачать ZIP](https://github.com/hidtk/tg-daily-tracker/archive/refs/heads/main.zip)** · **[🍴 Fork](https://github.com/hidtk/tg-daily-tracker/fork)** · [Архитектура и API](docs/ARCHITECTURE.md)

---

## Содержание

- [Возможности](#возможности)
- [Что понадобится](#что-понадобится)
- [Способ 1: через GitHub, ничего не ставя](#способ-1-через-github-ничего-не-ставя-рекомендуется)
- [Способ 2: с компьютера одной командой](#способ-2-с-компьютера-одной-командой)
- [Первые шаги в боте](#первые-шаги-в-боте)
- [Обновление](#обновление)
- [Частые проблемы](#частые-проблемы)
- [Разработка](#разработка)

## Возможности

| Раздел | Что делает |
|---|---|
| **Today** | План / сделал / осознанный пропуск с причиной, минуты и навыки за день, обратный отсчёт до экзамена, занятие и домашка на сегодня |
| **Words** | 5 новых академических слов в день (банк 150+: транскрипция, значение, пример, перевод), повторение по схеме 1 / 3 / 7 / 14 / 30 дней, утренний квиз от бота |
| **Задание дня** | 40+ заданий (Writing T1/T2, Speaking cue cards, Reading, Listening, Grammar) по дням недели, `/task` в любой момент |
| **Занятия и домашка** | Расписание уроков с напоминаниями; `/hw текст` или фото с подписью «hw» привязывается к ближайшему занятию |
| **Practice** | 16 Reading-мини-тестов по 13 вопросов с band по официальной шкале; кошелёк минут соцсетей за результаты |
| **Замок соцсетей** | Instagram / TikTok / YouTube / VK закрываются, когда минут нет. На iPhone — через «Команды» (пошаговая инструкция прямо в приложении, *Practice → iPhone*) или DNS-замок NextDNS с профилем под паролем |
| **Progress** | Календарь и стрик, пробные тесты с графиком band по секциям, минуты по неделям и навыкам |
| **Партнёр** | `/partner` — другу или в группу уходят недельные итоги и пропуски |

Интерфейс переключается между русским и английским. Все данные можно выгрузить в JSON.

## Что понадобится

- Аккаунт **Telegram** — чтобы создать бота.
- Аккаунт **Cloudflare** — бесплатный, [регистрация](https://dash.cloudflare.com/sign-up).
- Для способа 1 — аккаунт **GitHub**. Для способа 2 — **[Node.js 20+](https://nodejs.org)** (LTS) на компьютере.

Сначала в любом случае создай бота: открой [@BotFather](https://t.me/BotFather) → `/newbot` → придумай имя и username → сохрани **токен** (вида `123456789:AAH...`).

## Способ 1: через GitHub, ничего не ставя (рекомендуется)

Деплой делает GitHub Actions. Плюс: после каждого обновления кода приложение пересобирается само.

1. **Сделай fork** — кнопка [Fork](https://github.com/hidtk/tg-daily-tracker/fork) вверху страницы.
2. **Создай Cloudflare API Token.** [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) → **Create Token** → шаблон **Edit Cloudflare Workers** → в *Permissions* нажми *Add more* и добавь **Account · D1 · Edit** → *Continue to summary* → *Create Token*. Скопируй токен.
3. **Добавь секреты** в своём форке: *Settings → Secrets and variables → Actions*.

   Вкладка **Secrets** → *New repository secret*:

   | Имя | Значение |
   |---|---|
   | `CLOUDFLARE_API_TOKEN` | токен из шага 2 |
   | `BOT_TOKEN` | токен бота от BotFather |
   | `SESSION_SECRET` | любая длинная случайная строка (32+ символа), см. ниже |

   Как получить случайную строку:
   - Windows (PowerShell): `[guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')`
   - macOS / Linux: `openssl rand -hex 32`

   Вкладка **Variables** → *New repository variable*: `BOT_USERNAME` — username бота **без** `@`.

4. **Включи Actions** во вкладке *Actions* форка (GitHub отключает их в форках по умолчанию) → слева **Deploy (Worker + Mini App)** → **Run workflow**.
5. Через 2–3 минуты workflow станет зелёным. Открой своего бота и нажми `/start` — готово.

Workflow сам создаёт базу D1, применяет миграции, деплоит Worker вместе с Mini App, загружает секреты, ставит webhook, команды и кнопку меню **IELTS**. Адрес приложения виден в логе шага *Deploy Worker* (`https://tg-daily-tracker.<имя>.workers.dev`).

> Опционально: secrets `CLOUDFLARE_ACCOUNT_ID` и `D1_DATABASE_ID`. Без них берётся первый аккаунт, к которому есть доступ у токена, и база с именем `tracker-db`.

## Способ 2: с компьютера одной командой

Работает на Windows, macOS и Linux.

1. Скачай проект — [ZIP](https://github.com/hidtk/tg-daily-tracker/archive/refs/heads/main.zip) (распакуй) или через git:

   ```bash
   git clone https://github.com/hidtk/tg-daily-tracker.git
   cd tg-daily-tracker
   ```

2. Установи зависимости и запусти мастер:

   ```bash
   npm install
   npm run setup
   ```

Мастер спросит токен бота и проверит его, откроет браузер для входа в Cloudflare, затем сам создаст базу, соберёт и задеплоит приложение, загрузит секреты и настроит бота. В конце он напишет ссылку на бота.

Запускать повторно безопасно: так же обновляется приложение после изменений в коде. Токен и сгенерированный `SESSION_SECRET` мастер сохраняет в `apps/worker/.dev.vars` — этот файл не попадает в git.

<details>
<summary>Полностью ручная установка (если хочется всё контролировать)</summary>

```bash
npm install
cd apps/worker
npx wrangler login
npx wrangler d1 create tracker-db        # скопируй database_id в wrangler.jsonc вместо REPLACE_WITH_D1_DATABASE_ID
npx wrangler d1 migrations apply tracker-db --remote
cd ../.. && npm run deploy               # выведет https://tg-daily-tracker.<you>.workers.dev
cd apps/worker
npx wrangler secret put BOT_TOKEN
npx wrangler secret put SESSION_SECRET
cd ../..
```

Настройка бота — macOS / Linux:

```bash
BOT_TOKEN=... SESSION_SECRET=... node scripts/setup-bot.mjs https://tg-daily-tracker.<you>.workers.dev
```

Windows (PowerShell):

```powershell
$env:BOT_TOKEN="..."; $env:SESSION_SECRET="..."; node scripts/setup-bot.mjs https://tg-daily-tracker.<you>.workers.dev
```

Затем пропиши в `apps/worker/wrangler.jsonc` → `vars` значения `WEBAPP_URL` (URL воркера, нужен для кнопок в напоминаниях) и `BOT_USERNAME`, и выполни `npm run deploy` ещё раз.

</details>

## Первые шаги в боте

1. `/start` → кнопка меню **IELTS** открывает приложение.
2. **Settings**: целевой band, дата экзамена, часы в неделю, время утренних и вечерних напоминаний, часовой пояс.
3. **Settings → Lessons**: добавь занятия с преподавателем, чтобы получать напоминания и привязывать домашку.
4. По желанию:
   - `/partner` — позвать партнёра по ответственности;
   - **Practice → iPhone: блокировка через «Команды»** — две автоматизации по инструкции в приложении, около 5 минут;
   - **Practice → замок соцсетей** (строже): зарегистрируйся на [nextdns.io](https://nextdns.io), вставь API key (*My account → API*) и ID конфигурации, потом установи на iPhone профиль по ссылке из приложения.

Команды бота: `/app`, `/today`, `/task`, `/words`, `/hw`, `/minutes`, `/unlock`, `/lock`, `/partner`, `/help`.

## Обновление

- **Способ 1:** в своём форке нажми **Sync fork → Update branch**. Push в `main` запустит деплой автоматически.
- **Способ 2:** `git pull` (или скачай ZIP заново), затем `npm install` и `npm run setup`.

Данные в базе сохраняются: новые миграции применяются поверх.

## Частые проблемы

| Симптом | Что сделать |
|---|---|
| Workflow падает на *Resolve Cloudflare account id* | У токена не хватает прав. Пересоздай его по шаблону *Edit Cloudflare Workers* и добавь **D1 · Edit** |
| *Could not register a workers.dev subdomain* | Cloudflare → *Workers & Pages* → задай поддомен вручную, затем перезапусти workflow |
| Бот молчит на `/start` | Проверь secret `BOT_TOKEN` и что шаг *Configure Telegram bot* зелёный, затем перезапусти workflow |
| Mini App пишет «Invalid initData» | `BOT_TOKEN` в Worker'е не от этого бота — исправь secret и перезапусти деплой (или `npm run setup`) |
| Нет утренних напоминаний | Проверь часовой пояс и время в *Settings*; cron срабатывает раз в 15 минут |
| Приложение не открывается в обычном браузере | Так и задумано: вход идёт через Telegram. Для разработки см. ниже |
| Нужно поправить данные в базе | *Actions → D1 SQL (admin) → Run workflow* выполняет один SQL-запрос к прод-базе |

## Разработка

| Слой | Технология |
|---|---|
| Mini App | Vite + React + TypeScript, `telegram-web-app.js`, цвета из темы Telegram |
| Backend, бот, cron | Cloudflare Workers (Worker раздаёт и статику Mini App) |
| База | Cloudflare D1 (SQLite) |
| CI/CD | GitHub Actions: CI на PR, `wrangler deploy` по push в `main` |

```bash
npm install
cp .env.example apps/worker/.dev.vars       # впиши BOT_TOKEN, SESSION_SECRET (или просто запусти npm run setup)
cd apps/worker && npx wrangler d1 migrations apply tracker-db --local && cd ../..
npm run dev:worker                          # http://localhost:8787 — API и бот
npm run dev:web                             # http://localhost:5173 — Vite, /api проксируется на 8787
```

Mini App в обычном браузере без Telegram — положи подписанный `initData` в `apps/web/.env.local`:

```bash
echo "VITE_DEV_INIT_DATA=$(BOT_TOKEN=<тот же, что в .dev.vars> node scripts/dev-initdata.mjs)" > apps/web/.env.local
```

- Бот локально: `npx wrangler dev` + туннель (`cloudflared tunnel --url http://localhost:8787`), webhook на адрес туннеля.
- Cron локально: `curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=*/15+*+*+*+*"`.
- Проверки: `npm run typecheck`, `npm test`, `npm run build`.

Структура проекта, API и модель данных описаны в [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Лицензия

[MIT](LICENSE)

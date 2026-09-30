# IELTS trainer — Telegram Mini App

[![Deploy](https://github.com/hidtk/tg-daily-tracker/actions/workflows/deploy-worker.yml/badge.svg)](https://github.com/hidtk/tg-daily-tracker/actions/workflows/deploy-worker.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Node 20+](https://img.shields.io/badge/node-%E2%89%A520-339933)
![Cloudflare free tier](https://img.shields.io/badge/hosting-Cloudflare%20free-F38020)

Личный тренажёр подготовки к IELTS прямо в Telegram по простому правилу: делаешь небольшие задания → получаешь минуты соцсетей → тратишь их в Instagram, TikTok, YouTube и VK. В «Магазине заданий» у каждой карточки своя цена в минутах, время и сложность; каждое задание проверяется на сервере, и видно, что засчитано и что исправить. Когда минут нет, «замок» (iOS «Команды» и/или NextDNS) закрывает соцсети и сам выкидывает на экран «Домой».

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
| **Главная** | Баланс минут (или долг), сколько заработано за день и 3 лучших задания сейчас |
| **Магазин** | Все задания с ценой, временем и сложностью: Reading частями (один тип вопросов, 4–5 вопросов) или текст целиком, слова вводом, предложение со словом, Writing (короткий и длинный), Speaking (голосовое боту, короткое и длинное) |
| **Прогресс** | 11 достижений с понятными условиями и прогрессом «3 из 10», неделя учёбы (считается сама), серия дней, откуда пришли и куда ушли минуты |
| **Настройки** | Язык, утреннее сообщение с тремя заданиями, новые слова в день, блокировка соцсетей (инструкция «Команд», NextDNS), «Как это работает», «Начать заново» |
| **Проверка** | Reading — по ключу (регистр, артикли, пробелы, варианты написания); слова — с допуском одной опечатки и формами слова; Writing и Speaking — по рубрике, по желанию ещё и ИИ-оценка |
| **Замок соцсетей** | Instagram / TikTok / YouTube / VK закрываются, когда минут нет. На iPhone — через «Команды» с таймером (выкидывает на экран «Домой», когда минуты кончились) или DNS-замок NextDNS с профилем под паролем |

Интерфейс переключается между русским и английским. При первом запуске — короткое знакомство из пяти экранов. Автопоказ приложения и настройки блокировки на iPhone по шагам открывается без Telegram по адресу `https://<воркер>.workers.dev/demo`.

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
   | `ANTHROPIC_API_KEY` | необязательно: ИИ-оценка текстов Writing |

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

1. `/start` → кнопка меню **IELTS** открывает приложение; при первом запуске оно само покажет, как всё устроено.
2. **Настройки → Блокировка соцсетей**: «Команды» на iPhone (две автоматизации, около 10 минут, пошаговая инструкция в приложении) и/или NextDNS (строже: API key из *My account → API* и ID конфигурации, затем профиль на iPhone по ссылке из приложения).
3. **Магазин**: выбери задание и сделай его — минуты придут, как только проверка пройдена.

Команды бота: `/start`, `/help`. Голосовое сообщение боту — ответ на задание Speaking.

**ИИ-оценка Writing (необязательно).** Добавь в GitHub secret `ANTHROPIC_API_KEY` (ключ API Anthropic) — деплой загрузит его в Worker, и к проверке текста добавится мнение ИИ: по теме ли текст, примерный балл и советы. Без ключа работает только детерминированная рубрика.

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
| Нет утреннего сообщения | Проверь часовой пояс, время и переключатель в *Настройках*; cron срабатывает раз в 15 минут |
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

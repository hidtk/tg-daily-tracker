# IELTS trainer — Telegram Mini App

Личный тренажёр подготовки к IELTS внутри Telegram: слова по утрам с интервальным повторением, задание дня, напоминания о занятиях и домашке, Reading-тесты, статистика до экзамена. Интерфейс и бот — на английском (погружение). Без своего сервера — всё на бесплатных тарифах Cloudflare.

| Слой | Технология |
|---|---|
| Mini App | Vite + React + TypeScript, официальный `telegram-web-app.js`, шрифт Goudy Old Style (локальный) / Sorts Mill Goudy (OFL, в комплекте) |
| Backend + бот + cron | Cloudflare Workers (статика Mini App раздаётся тем же Worker'ом) |
| База | Cloudflare D1 (SQLite) |
| CI/CD | GitHub Actions → `wrangler deploy` по push в `main` |

Все данные привязаны к `telegram_user_id`, авторизация — валидация `initData` по HMAC на Worker'е. Логинов и паролей нет.

## Возможности

- **Today**: план / сделал / осознанный пропуск с причиной, минуты и навыки за день, обратный отсчёт до экзамена, занятие и домашка на сегодня.
- **Words**: 5 новых слов каждое утро (банк 150+ академических слов: транскрипция, значение, пример, перевод) и повторение по схеме 1 / 3 / 7 / 14 / 30 дней. Утром бот присылает слова и квиз «выбери значение» по тем, что пора повторить; в приложении — карточки «Knew it / Forgot».
- **Задание дня**: банк из 40+ заданий (Writing T1/T2, Speaking cue cards, Reading, Listening, Grammar) по дням недели, `/task` в любой момент, кнопка «Done» засчитывает день.
- **Занятия и домашка**: уроки с преподавателем (дни, время, таймзона) — напоминания утром и за N минут; `/hw текст` или фото с подписью «hw» — домашка привязывается к ближайшему занятию, утреннее задание подстраивается под неё.
- **Practice**: Reading-мини-тесты (13 вопросов, оригинальные тексты, band по официальной шкале) и кошелёк минут соцсетей: 5.0–5.5 → 10, 6.0 → 15, 6.5+ → 30 мин; неистраченное переносится с потолком. Instagram / TikTok / YouTube / VK открываются через `GET /gate/<key>` из «Быстрых команд» на iPhone.
- **Progress**: календарь и стрик, пробные тесты с графиком band по секциям, минуты по неделям и навыкам, дисциплина.
- **Партнёр по ответственности**: `/partner` → ссылка для друга или код для группы; ему уходят недельные итоги и пропуски.
- Экспорт всех данных в JSON.

## Разверни себе за 15 минут

Нужны: аккаунт Cloudflare (free) и аккаунт GitHub. Ничего ставить локально не надо — всё делает GitHub Actions.

1. **Бот.** В [@BotFather](https://t.me/BotFather): `/newbot` → сохрани токен и username.
2. **Cloudflare API Token.** [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) → Create Token → шаблон **Edit Cloudflare Workers** → в Permissions добавь **Account · D1 · Edit** → Continue → Create.
3. **Форкни репозиторий** (или создай свой и запушь код).
4. В репозитории **Settings → Secrets and variables → Actions** добавь secrets:
   - `CLOUDFLARE_API_TOKEN` — из шага 2
   - `BOT_TOKEN` — из шага 1
   - `SESSION_SECRET` — любая длинная случайная строка (например `openssl rand -hex 32`)

   и variable `BOT_USERNAME` — username бота без `@`.
5. **Actions → Deploy (Worker + Mini App) → Run workflow** (или просто сделай push в `main`).

Workflow сам создаст базу D1, применит миграции, задеплоит Worker вместе с Mini App, положит секреты, поставит webhook и кнопку меню «Трекер». Открой бота, нажми `/start` — готово.

Опционально можно задать secrets `CLOUDFLARE_ACCOUNT_ID` и `D1_DATABASE_ID` — иначе они определяются автоматически (первый аккаунт токена; база по имени `tracker-db`).

### Ручной деплой с компьютера

```bash
npm install && npx wrangler login
cd apps/worker
npx wrangler d1 create tracker-db          # database_id → в wrangler.jsonc вместо REPLACE_WITH_D1_DATABASE_ID
npx wrangler d1 migrations apply tracker-db --remote
npx wrangler secret put BOT_TOKEN
npx wrangler secret put SESSION_SECRET
cd ../.. && npm run deploy                 # выведет https://tg-daily-tracker.<you>.workers.dev
BOT_TOKEN=... SESSION_SECRET=... node scripts/setup-bot.mjs https://tg-daily-tracker.<you>.workers.dev
```

После первого деплоя пропиши URL в `apps/worker/wrangler.jsonc` → `vars.WEBAPP_URL` (нужен для кнопок в напоминаниях) и задеплой ещё раз.

## Локальная разработка

```bash
cp .env.example apps/worker/.dev.vars       # BOT_TOKEN, SESSION_SECRET
cd apps/worker && npx wrangler d1 migrations apply tracker-db --local && cd ../..
npm run dev:worker                          # http://localhost:8787 (API + бот)
npm run dev:web                             # http://localhost:5173 (Vite, прокси /api → 8787)
```

Чтобы открыть Mini App в обычном браузере без Telegram, положи в `apps/web/.env.local` подписанный `initData`:

```bash
echo "VITE_DEV_INIT_DATA=$(BOT_TOKEN=<тот же, что в .dev.vars> node scripts/dev-initdata.mjs)" > apps/web/.env.local
```

Проверка бота локально: `npx wrangler dev` + туннель (например `cloudflared tunnel --url http://localhost:8787`), webhook на URL туннеля.

Cron локально: `curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=*/15+*+*+*+*"`.

## Структура

```
apps/web          — Mini App (Vite + React)
apps/worker       — Cloudflare Worker: API, webhook бота, cron, миграции D1
packages/shared   — типы, zod-схемы, логика расписаний/стриков (используется и клиентом, и сервером)
scripts/          — setup-bot.mjs (webhook + menu button), dev-initdata.mjs
.github/workflows — ci.yml, deploy-worker.yml
```

## API

```
POST /api/auth               { initData, tz } → { token, user, settings }
GET  /api/today?date=        активности дня + записи
PUT  /api/entries            { entries: [...] } (batch, только сегодня/вчера)
GET  /api/activities         ?archived=1 — включая архив
POST /api/activities
PUT  /api/activities/:id     поля активности, sort, archived_at (null = вернуть из архива)
DELETE /api/activities/:id   = архивировать
GET  /api/stats?month=YYYY-MM  стрики + heatmap
GET  /api/settings, PUT /api/settings
GET  /api/export             JSON (Bearer или ?token=)
GET  /api/ielts              статистика IELTS (недели, пробные тесты, дисциплина)
POST /api/mocks, DELETE /api/mocks/:id
GET  /api/proofs/:id/image   фото-подтверждение (прокси к Telegram)
DELETE /api/proofs/:id, DELETE /api/partner
GET  /api/vocab, POST /api/vocab/review   слова дня, очередь повторения, отметка «знал / забыл»
GET  /api/wallet, PUT /api/wallet   баланс, лимиты, gate-ссылка
POST /api/reading/submit     { test_id, seconds, answers } → band + начисленные минуты
GET  /gate/:key?app=&e=open|close|status  → текст «ALLOW N» / «BLOCK 0» (для iOS Shortcuts)
GET/POST /api/lessons, PUT/DELETE /api/lessons/:id
GET /api/homeworks, POST /api/homeworks/:id/done, DELETE /api/homeworks/:id
POST /bot/webhook            Telegram updates (проверяется secret_token)
cron */15 * * * *            напоминания и недельные сводки по tz пользователей
```

## Модель данных

```
users(id, tg_id, first_name, tz, morning_time, evening_time, weekly_summary, weekly_time,
      ai_endpoint, ai_key, last_morning_sent, last_evening_sent, last_weekly_sent, created_at)
activities(id, user_id, name, emoji, color, schedule_type, schedule_days, anchor_date,
           goal_text, goal_date, sort, archived_at)
entries(id, user_id, activity_id, date, planned, plan_note, done, done_note, minutes, skills, updated_at)
  unique(activity_id, date)
proofs(id, user_id, activity_id, date, type photo|chat, file_id, text)
mock_tests(id, user_id, date, listening, reading, writing, speaking, overall, note)
users +: strict_mode, partner_chat_id, partner_name, partner_code, ielts_target, ielts_exam_date, ielts_weekly_hours,
        wallet_enabled, sm_balance, sm_bank_cap, sm_daily_cap, sm_apps, sm_api_key
reading_attempts(id, user_id, test_id, date, correct, total, band, seconds, earned)
wallet_ledger(id, user_id, at, date, delta, reason, note)
wallet_sessions(id, user_id, app, started_at, ended_at, minutes)
vocab_progress(user_id, word_id, stage, introduced_on, next_review, reviews, lapses)
vocab_reviews(id, user_id, word_id, date, ok)
```

## Лицензия

MIT

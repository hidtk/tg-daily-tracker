# Дневной трекер — Telegram Mini App

Личный трекер ежедневных активностей внутри Telegram. Утром фиксируешь план, вечером — факт. Стрики, heatmap-календарь, напоминания и недельная сводка в чат. Без своего сервера — всё на бесплатных тарифах Cloudflare.

| Слой | Технология |
|---|---|
| Mini App | Vite + React + TypeScript, официальный `telegram-web-app.js` |
| Backend + бот + cron | Cloudflare Workers (статика Mini App раздаётся тем же Worker'ом) |
| База | Cloudflare D1 (SQLite) |
| CI/CD | GitHub Actions → `wrangler deploy` по push в `main` |

Все данные привязаны к `telegram_user_id`, авторизация — валидация `initData` по HMAC на Worker'е. Логинов и паролей нет.

## Возможности

- Активности с расписанием (ежедневно / через день / дни недели), эмодзи, цветом и целью-датой («осталось N дней»).
- Экран «Сегодня»: план (утро) и факт (вечер) одним тапом, заметки до 200 символов, локальный черновик не теряется при сворачивании.
- Редактирование вчерашнего дня (глубина — константа `EDIT_DAYS_BACK` в `packages/shared`).
- Стрики по каждой активности (только по дням из расписания — пропуск нерасписанного дня стрик не ломает), heatmap по месяцу, просмотр заметок по дню.
- Напоминания утром и вечером в таймзоне пользователя; не приходят, если план/факт уже заполнен.
- Недельная сводка в воскресенье: «выполнено X из Y» по активностям, лучшая активность, сравнение с прошлой неделей.
- **Подтверждения**: фото или пересланный диалог с ИИ (ссылка/текст), отправленный боту, привязывается к активности; в строгом режиме только подтверждённые занятия идут в стрики и статистику.
- **Партнёр по ответственности**: `/partner` → ссылка для друга или код для группы; ему уходят недельные итоги и уведомления о пропущенных днях.
- **IELTS**: цель и дата экзамена (меняется не чаще раза в день), минуты по навыкам, пробные тесты с band по секциям, графики тренда к цели, часов по неделям и дисциплины.
- **Задание дня по IELTS**: банк из 50+ заданий (Writing T1/T2, Speaking cue cards, Reading/Listening упражнения, словарь по темам, грамматика) — утром вместе с напоминанием, `/task` в любой момент; ответ боту (эссе, голосовое, фото) засчитывается как подтверждение.
- Экспорт всех данных в JSON.
- Заложен интерфейс AI-модуля (endpoint + key в настройках; вызовов в v1 нет).

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
users +: strict_mode, partner_chat_id, partner_name, partner_code, ielts_target, ielts_exam_date, ielts_weekly_hours
```

## Лицензия

MIT

# Архитектура

Для тех, кто хочет дорабатывать код. Установка — в [README](../README.md).

## Как это устроено

```
Telegram ──► бот (webhook) ─┐
Telegram ──► Mini App ──────┼──► Cloudflare Worker ──► D1 (SQLite)
Cloudflare Cron ────────────┘        │
                                     └──► NextDNS API (замок соцсетей, опционально)
```

- Один Worker раздаёт статику Mini App (`apps/web/dist`), обслуживает `/api/*`, принимает `/bot/webhook` и выполняет cron.
- Авторизация: Mini App шлёт `initData` → Worker проверяет HMAC токеном бота → выдаёт сессионный токен (подписан `SESSION_SECRET`).
- Все данные привязаны к `telegram_user_id`. Логинов и паролей нет.
- Миграции БД — `apps/worker/migrations/*.sql`, применяются при каждом деплое (`wrangler d1 migrations apply`).

## Структура

```
apps/web          — Mini App (Vite + React)
apps/worker       — Cloudflare Worker: API, webhook бота, cron, миграции D1
packages/shared   — типы, zod-схемы, логика расписаний/стриков (используется и клиентом, и сервером)
scripts/          — setup.mjs (мастер установки), setup-bot.mjs (webhook + menu button), dev-initdata.mjs
.github/workflows — ci.yml, deploy-worker.yml, d1-sql.yml (разовый SQL к прод-базе)
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
GET/POST /api/sentences      слово для предложения; предложение → +1 мин
GET  /api/analytics          слова, предложения, Reading по неделям
POST /api/reading/refresh    открыть следующую партию тестов
POST /api/lock/config, DELETE /api/lock/config, POST /api/lock/unlock {minutes}, POST /api/lock/close
GET  /dns/:key.mobileconfig  профиль DNS для iPhone
GET  /api/wallet, PUT /api/wallet   баланс, лимиты, gate-ссылка
POST /api/reading/submit     { test_id, seconds, answers } → band + начисленные минуты
GET  /gate/:key?app=&e=open|close|status  → текст «ALLOW N» / «BLOCK 0» (для iOS Shortcuts)
GET/POST /api/lessons, PUT/DELETE /api/lessons/:id
GET /api/homeworks, POST /api/homeworks/:id/done, DELETE /api/homeworks/:id
POST /bot/webhook            Telegram updates (проверяется secret_token)
cron */15 * * * *            напоминания и недельные сводки по tz пользователей
cron * * * * *               закрытие истёкших окон замка
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


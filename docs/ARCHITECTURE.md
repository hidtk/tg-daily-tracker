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
GET  /api/vocab               слова дня и очередь вопросов (без самих слов: перевод или пропуск в предложении)
POST /api/vocab/answer        { word_id, answer, hint } → проверка ввода на сервере, интервалы, XP/минуты
GET/POST /api/sentences      слово для предложения; предложение → XP и (первые 5 в день) +1 мин
GET  /api/game                уровень, XP, серия, квесты дня, босс, минуты за сегодня (включая «ждут Reading»)
GET  /api/writing, POST /api/writing/start, POST /api/writing { text }   Writing: тема, старт таймера, проверка
GET  /api/speaking            карточка Speaking (ответ — голосовое боту)
GET  /api/analytics          слова, предложения, Reading по неделям
POST /api/reading/refresh    открыть следующую партию тестов
POST /api/lock/config, DELETE /api/lock/config, POST /api/lock/unlock {minutes}, POST /api/lock/close
GET  /dns/:key.mobileconfig  профиль DNS для iPhone
GET  /api/wallet, PUT /api/wallet   баланс, лимиты, gate-ссылка
POST /api/reading/submit     { test_id, seconds, answers } → band, минуты, зачёт квеста, награда
POST /api/boss/submit        то же для босса: раз в день, ответы скрыты до победы
GET  /gate/:key?app=any&e=open  → «ALLOW <мин> <сек>» (сессия началась) или «BLOCK 0»
GET  /gate/:key?e=tick       каждые 20 с из цикла «Команд» → «ALLOW <мин> <сек осталось>», «BLOCK 0 0» (на экран «Домой»),
                             «ALLOW 0 0 / STOP» (сессии нет — цикл завершается)
GET  /gate/:key?app=any&e=close | e=status
GET/POST /api/lessons, PUT/DELETE /api/lessons/:id
GET /api/homeworks, POST /api/homeworks/:id/done, DELETE /api/homeworks/:id
POST /bot/webhook            Telegram updates (проверяется secret_token); голосовое = ответ Speaking
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
vocab_progress(user_id, word_id, stage, introduced_on, next_review, reviews, lapses, last_reviewed)
vocab_reviews(id, user_id, word_id, date, ok, kind self|translate|cloze, hint, practice)
reading_attempts +: counted (не наспех и не наугад — идёт в квест и серию)
wallet_sessions +: last_seen (пульс таймера), closed_by close|tick|kicked|open|stale
practice_tasks(id, user_id, kind writing|speaking, date, topic, started_at, submitted_at, status, text, words, vocab, seconds, file_unique_id)
```

## Игра и экономика

- `packages/shared/src/game.ts` — чистые правила: курс минут (`EARN`), XP, уровни и боссы, серия со щитами, квесты, `settlePlan`.
- `apps/worker/src/lib/game.ts` — `gameState` пересчитывает всё из исходных таблиц (reading_attempts, vocab_reviews, vocab_sentences, practice_tasks, wallet_ledger); `settleDay` доплачивает минуты за работу, кроме Reading (идемпотентно), и сундук.
- Без Reading за день платится не больше 10 мин за остальную работу; остальное «ждёт» и открывается Reading-тестом в тот же день.
- Время в соцсетях списывается по реальному открытию/закрытию; перерасход уходит в минус (долг), вход закрыт, пока долг не погашен.

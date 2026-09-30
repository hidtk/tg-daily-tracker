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
packages/shared   — типы, zod-схемы, каталог магазина, рубрики проверки, достижения, банк слов и Reading (клиент и сервер)
scripts/          — setup.mjs (мастер установки), setup-bot.mjs (webhook + menu button), dev-initdata.mjs
.github/workflows — ci.yml, deploy-worker.yml, d1-sql.yml (разовый SQL к прод-базе)
```

## API

```
POST /api/auth               { initData, tz } → { token, user, settings (+ onboarded) }
GET  /api/settings, PUT /api/settings   tz, reminders, morning_time, vocab_per_day, lang
POST /api/onboarded          { done } — знакомство просмотрено
POST /api/reset              { word: "ЗАНОВО" | "RESET" } — «Начать заново»
GET  /api/shop               все задания: цена, время, сложность, статус; top — 3 лучших сейчас; баланс и лимит дня
GET  /api/reading/:taskId    часть Reading (r:<тест>:tfng|mcq|gap|all) — текст и вопросы без ответов
POST /api/reading/submit     { task_id, seconds, answers } → верно, оплата, ошибки (ответы — только если сдано)
GET  /api/vocab, POST /api/vocab/answer { word_id, answer, hint }   слова вводом, проверка на сервере
GET/POST /api/sentences      слово для предложения; предложение → правила, затем проверка смысла (judge: none | workers-ai | http);
                             1 мин только после проверки смысла; модель недоступна → pending, перепроверка cron
GET/POST /api/quiz           «Быстрый тест»: 5 вопросов с выбором (пропуск / значение) без ключа; { id, answers } → проверка по ключу
GET  /api/writing?size=short|long, POST /api/writing/start { size }, POST /api/writing { size, text } → рубрика (+ ИИ)
GET  /api/speaking           карточки short/long (ответ — голосовое боту)
GET  /api/progress           достижения, неделя (учёба из автолога и заработок), серия, последние движения минут
GET  /api/wallet, PUT /api/wallet   приложения, лимиты, ссылка gate, состояние NextDNS, друг-контролёр
POST /api/friend/invite, DELETE /api/friend   ссылка-приглашение друга (t.me/<бот>?start=buddy_<код>) / убрать друга
POST /api/lock/config, DELETE /api/lock/config, POST /api/lock/unlock {minutes}, POST /api/lock/close, GET /api/lock/check
GET  /dns/:key.mobileconfig  профиль DNS для iPhone
GET  /demo                   автопоказ приложения и настройки блокировки по шагам (статика Mini App, без входа и без API)
GET  /gate/:key?app=any&e=open  → «ALLOW <мин> <сек>» (сессия началась; NextDNS открыт ровно на остаток) или «BLOCK 0»
GET  /gate/:key?app=any&e=close  списывает реальное время, NextDNS закрывается сразу
GET  /gate/:key?e=tick       необязательный старый цикл → «ALLOW <мин> <сек осталось>», «BLOCK 0 0», «ALLOW 0 0 / STOP»
GET  /gate/:key?e=status     только чтение
                             Часы — на сервере: сессия заканчивается, когда кончились минуты (cron раз в минуту и любой запрос)
POST /bot/webhook            /start, /help; голосовое = ответ Speaking
cron */15 * * * *            утреннее сообщение с тремя заданиями; перепроверка предложений в очереди (pending)
cron * * * * *               сессии, у которых кончились минуты (баланс → 0, NextDNS закрывается); истёкшие окна NextDNS;
                             раз в 5 минут — логи NextDNS: обходы и «команда молчит сутки»
```

## Модель данных

Используемые таблицы (миграции 0001–0013; старые таблицы — activities для автолога, lessons/homeworks/mock_tests/proofs — остаются в базе, но в интерфейсе их нет):

```
users(id, tg_id, first_name, tz, morning_time, last_morning_sent, ielts_daily_task (= утреннее сообщение вкл.),
      vocab_per_day, lang, onboarded, wallet_enabled, sm_balance, sm_bank_cap, sm_daily_cap, sm_apps, sm_api_key,
      nextdns_key, nextdns_profile, lock_state, lock_until, lock_source session|manual, lock_password, lock_error,
      gate_seen_at, bypass_checked_at, lock_warning, lock_warning_checked_at, streak_reset_on,
      partner_chat_id, partner_name, partner_code (друг-контролёр))
reading_attempts(id, user_id, test_id = r:<тест>:<часть>, date, correct, total, band, seconds, earned, counted)
wallet_ledger(id, user_id, at, date, delta, reason reading|words|quiz|sentence|writing|speaking|achievement|spend|manual|penalty, note = id задания)
wallet_sessions(id, user_id, app, started_at, ended_at, minutes, last_seen, closed_by close|tick|expired|kicked (старые: open|stale))
vocab_progress(user_id, word_id, stage, introduced_on, next_review, reviews, lapses, last_reviewed)
vocab_reviews(id, user_id, word_id, date, ok, kind translate|cloze, hint, practice)
vocab_sentences(id, user_id, word_id, date, text, status accepted|pending|practice|rejected, verdict JSON, tries)
quiz_sets(id, user_id, date, n, questions JSON (ключ на сервере), started_at, submitted_at, correct, paid)
llm_usage(day UTC, provider, requests)          — дневной потолок запросов к модели
lock_windows(id, user_id, opened_at, closed_at) — оплаченные окна NextDNS (для отличия обхода от честного времени)
bypasses(id, user_id, date, app, first_at, last_at, minutes, penalty)
practice_tasks(id, user_id, kind writing|speaking, task writing:short|… , date, topic, started_at, status, text, words,
               vocab, seconds, file_unique_id, feedback JSON: критерии и мнение ИИ)
achievements(user_id, id, date, bonus)          — одна строка на достижение: бонус платится один раз
activities + entries                            — автоматический журнал дня (минуты учёбы)
```

## Магазин и экономика

- `packages/shared/src/shop.ts` — цены, время и сложность заданий, деление Reading на части (`readingParts`), оплата `readingPay` (цена × доля верных; < 50 % или быстрее минимума — 0), выбор «3 лучших» (`pickTop`).
- `apps/worker/src/lib/shop.ts` — живой список: что открыто, повтор завтра, сделано сегодня, лимит.
- `apps/worker/src/lib/wallet.ts` — `pay` (лимит дня, банк, потолок вида задания) и `settleAchievements` (бонус один раз).
- Повтор одного и того же задания не платит: Reading-часть платит один раз; несданная — повтор со следующего дня; Writing и Speaking каждого размера — раз в день; слово — раз в день; слова оплачиваются за 10 ответов в день, предложения — за 5.
- Время в соцсетях списывается по реальному открытию/закрытию; перерасход уходит в минус (долг), вход закрыт, пока долг не погашен.

## Проверка

- `packages/shared/src/reading.ts` `isCorrect` — ключ ответов; регистр, артикль, пробелы/дефисы, цифры↔слова, британское/американское написание, список `accept`.
- `packages/shared/src/text.ts` — `checkTyped` (Левенштейн ≤ 1 для слов длиннее 5 букв), `wordForms` (-s, -ed, -ing, неправильные).
- `packages/shared/src/check.ts` — рубрики: предложение, Writing (объём, недавние слова, связки, предложения, английский, разнообразие, без мусора, не копия, не текст темы, время), Speaking (длина, своя запись, новая запись).
- `apps/worker/src/lib/llm.ts` — необязательная ИИ-оценка Writing (секрет `ANTHROPIC_API_KEY`): «по теме?», примерный балл, советы. Любая ошибка — остаётся только рубрика.

# CLAUDE.md — IELTS trainer (Telegram Mini App «Элвис»)

Owner: Yaroslav (writes in Russian — answer in Russian, short and plain). Single real user in prod (users.id = 1).

## What it is
Telegram Mini App + bot for IELTS prep. Cloudflare Worker serves the API, the bot webhook, cron and the built Mini App; data in D1 (SQLite).
Core loop (version 2, «магазин заданий»): user picks small tasks in the Shop, each pays its own social-media minutes, and spends them; iOS Shortcuts / NextDNS lock Instagram, TikTok, YouTube, VK when the balance is 0.

## Layout
- `packages/shared` — types, zod schemas, vocab bank, Reading tests, and the pure rules: `shop.ts` (prices, Reading parts, top-3), `check.ts` (rubrics), `achievements.ts`, `text.ts` (typed answers). `sideEffects: false` keeps Reading texts and answers out of the app bundle — the app gets a part (without answers) from `GET /api/reading/:id`.
- `apps/web` — Vite + React + TS Mini App. Four screens in `src/screens` (Home, Shop, Progress, Settings), task sheets in `src/components/tasks`, first-run guide `components/Onboarding.tsx`. UI strings via `src/i18n.ts` (keys are English, RU translations in the same file — add both).
- `apps/worker` — Worker: `src/api/routes.ts` (REST `/api/*`), `src/api/gate.ts` (`/gate/<key>` for iOS Shortcuts, plain-text `ALLOW n` / `BLOCK n`), `src/bot/*` (webhook, cron, messages — bot texts are English), `src/lib/*` (db.ts = Repo, shop, wallet = pay + achievements, reading, vocab, sentences, tasks = Writing/Speaking, llm = optional AI check, lock/NextDNS, autolog), `migrations/` (D1, numbered SQL).
- `docs/ARCHITECTURE.md` — API and data model.

## Commands
```bash
npm ci
npm run typecheck   # shared + web + worker
npm test            # vitest, apps/worker/test (flows.test.ts runs the Worker code on node:sqlite with all migrations)
npm run build       # shared + web
```
Run all three before finishing any change.

## Deploy
- Push/merge to `main` → GitHub Actions `deploy-worker.yml` builds, applies D1 migrations, deploys the Worker, sets the bot webhook. No manual deploy.
- Work on a branch, open a PR, merge when checks are green = release.
- New DB columns/tables: add a new `apps/worker/migrations/00NN_*.sql`; never edit applied migrations.
- One-off prod SQL: Actions → «D1 SQL (admin)» → Run workflow (input `sql`). Destructive SQL only when the owner explicitly asks.
- Secrets (BOT_TOKEN, SESSION_SECRET, CLOUDFLARE_API_TOKEN, optional ANTHROPIC_API_KEY for the AI Writing check) live in GitHub Actions secrets — never commit them, never print the NextDNS key.

## Product rules (keep these)
- Screens: Home (balance + 3 best tasks now), Shop, Progress (achievements, week, streak, minutes), Settings. No levels, XP, quests, chests, shields or bosses (removed in v2; the old boss passages are the "hard" Reading texts).
- Shop («магазин заданий»): each card shows the price in minutes, the expected time (≈ N min), the difficulty and «Сделаешь за ~N мин → получишь M мин соцсетей». Tasks (`shared/src/shop.ts`):
  - Reading: one question type of a passage (TFNG 5 / MCQ 4 / gap 4) or the whole passage (pays more than its parts); hard passages ×1.5. Pays price × share right; under 50 % or faster than the minimum (20 s per question, ≥ 60 s; whole passage 4 min) — nothing, the answers stay hidden (only which were wrong + a paragraph hint) and a retry opens the next day. A passed part pays once and closes. Parts and the whole passage exclude each other. Offer: the next unfinished regular passage + the next hard one.
  - Words 0.5 min per right typed answer without a hint, 10 paid a day; a sentence with a word 1 min, 5 a day; Writing short 5 / long 12, Speaking short 3 / long 6, each once a day.
  - Daily cap (`sm_daily_cap`, default 60) and the bank cap apply to all task pay; achievement bonuses are on top of the daily cap. A task never pays twice (ledger note = task id).
  - Top-3: one Reading, one words/sentence, one Writing/Speaking, best value among tasks ≤ 10 min.
- Achievements (`shared/src/achievements.ts`, 11): title + plain "how to get it" + progress «3 из 10» on the Progress screen; recomputed from source tables; reaching one records a row in `achievements` and pays the bonus once. No hidden rules.
- Checks, always with the reason and what to fix: Reading by the key (`isCorrect`: case, articles, spaces/hyphens, digits↔words, British/American spelling, `accept` list; spelling counts). Words: typed only, `checkTyped` with Levenshtein ≤ 1 for words longer than 5 letters, `wordForms` accepted, each word once a day, hint = no minutes, no self-assessment. Sentence/Writing/Speaking: deterministic rubric in `shared/src/check.ts` (length, recent words, linking words, sentences, English, variety, no gibberish, not a copy, not the prompt, time from Start; voice: length, own recording, new recording). With `ANTHROPIC_API_KEY` Writing also gets an AI opinion (`lib/llm.ts`): off-topic rejects, band + tips are shown; any AI failure → rubric alone.
- Analytics are automatic: `lib/autolog.ts` `syncDay` recomputes the day entry from reading_attempts (time, ≤60 min/test), vocab_reviews (0.5 min), vocab_sentences (2 min), Writing (time spent) and Speaking (voice length + 1 min). No manual day logging in the UI or the bot.
- Speaking = a voice message to the bot, not forwarded, each `file_unique_id` once; ≥ 100 s counts for the long task (if open), otherwise the short one (≥ 45 s).
- Onboarding: 5 screens on first run and from Settings → «Как это работает» (`users.onboarded`). Mascot only via `Mascot`. Intro video `apps/web/public/onboarding/elvis-intro.mp4` (not in git until the owner adds it; a missing file shows the poster/mascot placeholder without errors).
- «Начать заново» (Settings, confirm by typing «ЗАНОВО»/RESET, `POST /api/reset`): wipes minutes, attempts, words, sentences, Writing/Speaking, achievements, ledger, sessions and the day log; keeps settings, the gate key, NextDNS, limits and language; shows the onboarding again. Never run destructive SQL on prod for this — the owner presses the button.
- Bot: only /start (greeting + «Open the app»), /help and voice answers. Notifications always point to a concrete in-app task (the morning message lists the top-3 with `?task=<id>` buttons). No Telegram message when an app open is blocked.
- Gate must fail closed: the open check is «does not contain ALLOW» → «Перейти „Домой“». Timer loop in the same automation: every 20 s `?e=tick`, «contains BLOCK» → Home, «contains STOP» → stop. Keep the plain-text formats (`ALLOW <min> <sec>`, `BLOCK 0`, `BLOCK 0 0`, `ALLOW 0 0\nSTOP`).
- Sessions are charged by real open→close time; overuse becomes a negative balance (debt) that blocks opening. Stale sessions (no close, no heartbeat) are charged only up to the last heartbeat, never into debt.
- In-app Shortcuts guide (`ShortcutsGuide.tsx`) must match real iOS names (RU: «Получить содержимое URL», тип «Текст», «Если», «не содержит» / «содержит», «Перейти „Домой“», «Повторять», «Ожидать», «Остановить эту команду»).
- User always keeps AmneziaVPN on → DNS lock only works with NextDNS set inside Amnezia (step 7 in LockSettings).

## Design system «Элвис»
Blue palette via CSS tokens in `apps/web/src/styles.css`, Nunito, matte 3D (soft gradients ≤14%, inner bevel, solid edge + diffuse shadow). Mascot SVG in `components/Mascot.tsx` — do not redraw or recolour; reactions are whole-figure CSS moves (`mood` prop). No emoji in UI. Buttons: uppercase, verb first. Must work at 360px width; bottom nav hides while the keyboard is open.

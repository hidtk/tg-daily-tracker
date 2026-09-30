# CLAUDE.md — IELTS trainer (Telegram Mini App «Элвис»)

Owner: Yaroslav (writes in Russian — answer in Russian, short and plain). Single real user in prod (users.id = 1).

## What it is
Telegram Mini App + bot for IELTS prep. Cloudflare Worker serves the API, the bot webhook, cron and the built Mini App; data in D1 (SQLite).
Core loop (version 2, «магазин заданий»): user picks small tasks in the Shop, each pays its own social-media minutes, and spends them; iOS Shortcuts / NextDNS lock Instagram, TikTok, YouTube, VK when the balance is 0.

## Layout
- `packages/shared` — types, zod schemas, vocab bank, Reading tests, and the pure rules: `shop.ts` (prices, Reading parts, top-3), `check.ts` (rubrics), `achievements.ts`, `text.ts` (typed answers). `sideEffects: false` keeps Reading texts and answers out of the app bundle — the app gets a part (without answers) from `GET /api/reading/:id`.
- `apps/web` — Vite + React + TS Mini App. Four screens in `src/screens` (Home, Shop, Progress, Settings), task sheets in `src/components/tasks`, first-run guide `components/Onboarding.tsx`. UI strings via `src/i18n.ts` (keys are English, RU translations in the same file — add both).
- `apps/worker` — Worker: `src/api/routes.ts` (REST `/api/*`), `src/api/gate.ts` (`/gate/<key>` for iOS Shortcuts, plain-text `ALLOW n` / `BLOCK n`), `src/bot/*` (webhook, cron, messages — bot texts are English), `src/lib/*` (db.ts = Repo, shop, wallet = pay + achievements, reading, vocab, sentences, tasks = Writing/Speaking, quiz = «Быстрый тест», judge = pluggable sentence check, llm = optional AI Writing opinion, lock/NextDNS, bypass = NextDNS log watch, autolog), `migrations/` (D1, numbered SQL).
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
- Secrets (BOT_TOKEN, SESSION_SECRET, CLOUDFLARE_API_TOKEN, optional ANTHROPIC_API_KEY for the AI Writing check, optional SENTENCE_JUDGE_TOKEN) live in GitHub Actions secrets — never commit them, never print the NextDNS key.
- Sentence judge (GitHub variables): `SENTENCE_JUDGE` = `none` (default) | `workers-ai` (the deploy adds the AI binding; `WORKERS_AI_DAILY_CAP`, default 100, hard max 200 — inside the free allowance) | `http` (`SENTENCE_JUDGE_URL` = an OpenAI-compatible `/v1/chat/completions` of an own model, `SENTENCE_JUDGE_MODEL`). No paid APIs for this.

## Product rules (keep these)
- Screens: Home (balance + 3 best tasks now), Shop, Progress (achievements, week, streak, minutes), Settings. No levels, XP, quests, chests, shields or bosses (removed in v2; the old boss passages are the "hard" Reading texts).
- Shop («магазин заданий»): each card shows the price in minutes, the expected time (≈ N min), the difficulty and «Сделаешь за ~N мин → получишь M мин соцсетей». Tasks (`shared/src/shop.ts`):
  - Reading: one question type of a passage (TFNG 5 / MCQ 4 / gap 4) or the whole passage (pays more than its parts); hard passages ×1.5. Pays price × share right; under 50 % or faster than the minimum (20 s per question, ≥ 60 s; whole passage 4 min) — nothing, the answers stay hidden (only which were wrong + a paragraph hint) and a retry opens the next day. A passed part pays once and closes. Parts and the whole passage exclude each other. Offer: the next unfinished regular passage + the next hard one.
  - Words 0.5 min per right typed answer without a hint, 10 paid a day; «Быстрый тест» (5 choice questions: a gap in a bank example / the meaning of a word, by the key, ≥4 right and ≥4 s per question) 1 min, 5 a day; a sentence with a word 1 min, 5 a day — only when a model checks the meaning (judge `none` → practice, 0 min); Writing short 5 / long 12, Speaking short 3 / long 6, each once a day.
  - Daily cap (`sm_daily_cap`, default 60) and the bank cap apply to all task pay; achievement bonuses are on top of the daily cap. A task never pays twice (ledger note = task id).
  - Top-3: one Reading, one words/quiz/sentence, one Writing/Speaking, best value among tasks ≤ 10 min.
- Achievements (`shared/src/achievements.ts`, 11): title + plain "how to get it" + progress «3 из 10» on the Progress screen; recomputed from source tables; reaching one records a row in `achievements` and pays the bonus once. No hidden rules.
- Checks, always with the reason and what to fix: Reading by the key (`isCorrect`: case, articles, spaces/hyphens, digits↔words, British/American spelling, `accept` list; spelling counts). Words: typed only, `checkTyped` with Levenshtein ≤ 1 for words longer than 5 letters, `wordForms` accepted, each word once a day, hint = no minutes, no self-assessment. Sentence/Writing/Speaking: deterministic rubric in `shared/src/check.ts` (length, recent words — at most one per sentence, linking words, sentences, English, variety, no gibberish, not a copy, not the prompt, time from Start; voice: length, own recording, new recording). Sentence rules: 6–25 words, not a word list, bank words ≤ 30 % (a sentence counts for one word), not the example, not an earlier sentence reordered; then the judge (`lib/judge.ts`, strict JSON {ok, grammar, meaning, uses_word_correctly, reason_ru}) pays only if the word is used right and meaning = 2; judge unavailable/over the cap → nothing paid, the sentence waits (`pending`) and the 15-min cron rechecks it (fail closed). With `ANTHROPIC_API_KEY` Writing also gets an AI opinion (`lib/llm.ts`): off-topic rejects, band + tips are shown; any AI failure → rubric alone.
- Analytics are automatic: `lib/autolog.ts` `syncDay` recomputes the day entry from reading_attempts (time, ≤60 min/test), vocab_reviews (0.5 min), vocab_sentences (2 min), Writing (time spent) and Speaking (voice length + 1 min). No manual day logging in the UI or the bot.
- Speaking = a voice message to the bot, not forwarded, each `file_unique_id` once; ≥ 100 s counts for the long task (if open), otherwise the short one (≥ 45 s).
- Onboarding: 5 screens on first run and from Settings → «Как это работает» (`users.onboarded`). Mascot only via `Mascot`. Screen 1 plays the intro video `apps/web/public/onboarding/elvis-intro.mp4` if the owner adds it; without it the step-by-step demo (`components/DemoReel.tsx`) plays instead, without errors.
- Demo: `/demo` (no Telegram, no sign-in, static data, touches nothing real) auto-plays the app step by step in a phone frame (`components/Reel.tsx`): no minutes → turn on the lock → Shop → a task → the check → minutes → social media until they run out → an achievement; below it `components/LockReel.tsx` shows the lock setup step by step (Settings → guide → copy links → two Shortcuts automations → check). LockReel also plays on onboarding screen 4 and from Settings → lock → «Показать, как настроить». Pointers only via `Target` (`components/Pointer.tsx`: ring + label + arrow on one side, the head touching the element; leave room under a bottom hint). Keep both shows in sync with the real screens and the real iOS names.
- «Начать заново» (Settings, confirm by typing «ЗАНОВО»/RESET, `POST /api/reset`): wipes minutes, attempts, words, sentences, Writing/Speaking, achievements, ledger, sessions and the day log; keeps settings, the gate key, NextDNS, limits and language; shows the onboarding again. Never run destructive SQL on prod for this — the owner presses the button.
- Bot: only /start (greeting + «Open the app»), /help and voice answers. Notifications always point to a concrete in-app task (the morning message lists the top-3 with `?task=<id>` buttons). No Telegram message when an app open is blocked.
- Gate must fail closed: the open check is «does not contain ALLOW» → «Перейти „Домой“». Timer loop in the same automation: every 20 s `?e=tick`, «contains BLOCK» → Home, «contains STOP» → stop. Keep the plain-text formats (`ALLOW <min> <sec>`, `BLOCK 0`, `BLOCK 0 0`, `ALLOW 0 0\nSTOP`).
- The clock is on the server: `e=open` starts a session and (with NextDNS) opens the lock for exactly the minutes left, checked again on every open; the minute cron and every request end a session whose minutes ran out (balance → 0, `lockNow`). `e=close` charges the real time and relocks. No close = open until the minutes run out, never into debt. The Shortcut is only for the instant «Домой» on open; the old tick loop still works but isn't needed.
- Bypasses (`lib/bypass.ts`, every 5 min): a gated app *resolved* in the NextDNS log outside any session/paid window = a bypass → penalty 15 + minutes used (a debt), the streak resets (`streak_reset_on`), a row in Progress, a Telegram message to the user and the lock buddy (`partner_chat_id`, invite `t.me/<bot>?start=buddy_<code>`). Blocked queries are not a bypass (no message on a blocked open). Our own NextDNS error (`lock_error`) is never punished. Gate silent 24 h + the apps in the log → `lock_warning` → red banner on Home «Блокировка отключена». Settings «Сделать обход сложнее»: Screen Time limit on «Команды» with someone else's passcode, «Контент и конфиденциальность» → no deleting apps, the lock buddy.
- In-app Shortcuts guide (`ShortcutsGuide.tsx`) must match real iOS names (RU: «Получить содержимое URL», тип «Текст», «Если», «не содержит», «Перейти „Домой“»). Two links: open (`?app=any&e=open`) and close (`?app=any&e=close`).
- User always keeps AmneziaVPN on → DNS lock only works with NextDNS set inside Amnezia (step 7 in LockSettings); bypass detection needs NextDNS logs on (step 8). After a lock the feed may show cached content for ~1 min — say so, it's normal.

## Design system «Элвис»
Blue palette via CSS tokens in `apps/web/src/styles.css`, Nunito, matte 3D (soft gradients ≤14%, inner bevel, solid edge + diffuse shadow). Mascot SVG in `components/Mascot.tsx` — do not redraw or recolour; reactions are whole-figure CSS moves (`mood` prop). No emoji in UI. Buttons: uppercase, verb first. Must work at 360px width; bottom nav hides while the keyboard is open.

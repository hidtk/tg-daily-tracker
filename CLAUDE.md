# CLAUDE.md — IELTS trainer (Telegram Mini App «Элвис»)

Owner: Yaroslav (writes in Russian — answer in Russian, short and plain). Single real user in prod (users.id = 1).

## What it is
Telegram Mini App + bot for IELTS prep. Cloudflare Worker serves the API, the bot webhook, cron and the built Mini App; data in D1 (SQLite).
Core loop: user earns "social-media minutes" (Reading tests, sentences) and spends them; iOS Shortcuts / NextDNS lock Instagram, TikTok, YouTube, VK when the balance is 0.

## Layout
- `packages/shared` — types, zod schemas, vocab bank, Reading tests, pure helpers (used by both apps).
- `apps/web` — Vite + React + TS Mini App. Screens in `src/screens`, UI strings via `src/i18n.ts` (keys are English, RU translations in the same file — add both).
- `apps/worker` — Worker: `src/api/routes.ts` (REST `/api/*`), `src/api/gate.ts` (`/gate/<key>` for iOS Shortcuts, plain-text `ALLOW n` / `BLOCK n`), `src/bot/*` (webhook, cron, messages — bot texts are English), `src/lib/*` (db.ts = Repo, stats, analytics, wallet, lock/NextDNS, autolog), `migrations/` (D1, numbered SQL).
- `docs/ARCHITECTURE.md` — API and data model.

## Commands
```bash
npm ci
npm run typecheck   # shared + web + worker
npm test            # vitest, apps/worker/test
npm run build       # shared + web
```
Run all three before finishing any change.

## Deploy
- Push/merge to `main` → GitHub Actions `deploy-worker.yml` builds, applies D1 migrations, deploys the Worker, sets the bot webhook. No manual deploy.
- Work on a branch, open a PR, merge when checks are green = release.
- New DB columns/tables: add a new `apps/worker/migrations/00NN_*.sql`; never edit applied migrations.
- One-off prod SQL: Actions → «D1 SQL (admin)» → Run workflow (input `sql`). Destructive SQL only when the owner explicitly asks.
- Secrets (BOT_TOKEN, SESSION_SECRET, CLOUDFLARE_API_TOKEN) live in GitHub Actions secrets — never commit them, never print the NextDNS key.

## Product rules (keep these)
- Analytics are automatic: `lib/autolog.ts` `syncDay` recomputes the day entry from reading_attempts (time, ≤60 min/test), vocab_reviews (0.5 min), vocab_sentences (2 min). No manual day logging in the UI.
- Gate must fail closed: the Shortcut checks «does not contain ALLOW» → Go to Home Screen. Keep the plain-text format.
- No Telegram message when an app open is blocked.
- In-app Shortcuts guide (`ShortcutsGuide.tsx`) must match real iOS names (RU: «Получить содержимое URL», тип «Текст», «не содержит», «Перейти „Домой“»).
- User always keeps AmneziaVPN on → DNS lock only works with NextDNS set inside Amnezia (step 7 in LockSettings).

## Design system «Элвис»
Blue palette via CSS tokens in `apps/web/src/styles.css`, Nunito, matte 3D (soft gradients ≤14%, inner bevel, solid edge + diffuse shadow). Mascot SVG in `components/Mascot.tsx` — do not redraw or recolour. No emoji in UI. Buttons: uppercase, verb first. Must work at 360px width; bottom nav hides while the keyboard is open.

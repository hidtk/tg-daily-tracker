import { ZodError } from 'zod';
import type { Env } from './env';
import { handleApi } from './api/routes';
import { handleWebhook } from './bot/webhook';
import { runCron } from './bot/cron';
import { HttpError, json } from './lib/http';

export default {
  async fetch(req, env): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === '/bot/webhook' && req.method === 'POST') {
      return handleWebhook(req, env);
    }

    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(req, env, url);
      } catch (e) {
        if (e instanceof HttpError) return json({ error: e.message }, e.status);
        if (e instanceof ZodError) return json({ error: 'Validation failed', issues: e.issues }, 400);
        console.error(e);
        return json({ error: 'Internal error' }, 500);
      }
    }

    if (url.pathname === '/health') return json({ ok: true, ts: new Date().toISOString() });

    // Static Mini App (handled by the assets binding; fallback for safety).
    return env.ASSETS.fetch(req);
  },

  async scheduled(_event, env, ctx): Promise<void> {
    ctx.waitUntil(
      runCron(env).then((c) => console.log('cron done', JSON.stringify(c))),
    );
  },
} satisfies ExportedHandler<Env>;

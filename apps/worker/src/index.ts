import { ZodError } from 'zod';
import type { Env } from './env';
import { handleApi } from './api/routes';
import { handleGate } from './api/gate';
import { Repo } from './lib/db';
import { mobileconfig } from './lib/nextdns';
import { lockSweep } from './lib/lock';
import { handleWebhook } from './bot/webhook';
import { runCron } from './bot/cron';
import { HttpError, json } from './lib/http';

const SHORTCUT_NAMES = { 'elvis-open': 'Элвис вход', 'elvis-close': 'Элвис выход' } as const;

export default {
  async fetch(req, rawEnv): Promise<Response> {
    const url = new URL(req.url);
    // Links in the app and the bot need an absolute base; fall back to this Worker's own origin.
    const env: Env = rawEnv.WEBAPP_URL ? rawEnv : { ...rawEnv, WEBAPP_URL: url.origin };

    if (url.pathname === '/bot/webhook' && req.method === 'POST') {
      return handleWebhook(req, env);
    }

    if (url.pathname.startsWith('/gate/') && req.method === 'GET') {
      try {
        return await handleGate(req, env, url);
      } catch (e) {
        console.error(e);
        return new Response('BLOCK 0\nerror', { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } });
      }
    }

    // Apple configuration profile for the DNS lock: /dns/<user api key>.mobileconfig
    const mc = url.pathname.match(/^\/dns\/([0-9a-f]{32})\.mobileconfig$/);
    if (mc && req.method === 'GET') {
      const user = await new Repo(env.DB).getUserByApiKey(mc[1]);
      if (!user?.nextdns_profile || !user.lock_password) return new Response('not found', { status: 404 });
      return new Response(mobileconfig(user.nextdns_profile, `IELTS-${user.tg_id}`, user.lock_password), {
        headers: { 'content-type': 'application/x-apple-aspen-config; charset=utf-8', 'content-disposition': 'attachment; filename="ielts-lock.mobileconfig"', 'cache-control': 'no-store' },
      });
    }

    // Ready-made iOS Shortcuts (signed files in the Mini App assets): the file name becomes the shortcut's name.
    const sc = url.pathname.match(/^\/shortcuts\/(elvis-open|elvis-close)\.shortcut$/);
    if (sc && req.method === 'GET') {
      const res = await env.ASSETS.fetch(new Request(new URL(`/shortcuts/${sc[1]}.shortcut`, url.origin)));
      if (!res.ok || (res.headers.get('content-type') ?? '').includes('text/html')) return new Response('not found', { status: 404 });
      const name = SHORTCUT_NAMES[sc[1] as keyof typeof SHORTCUT_NAMES];
      return new Response(res.body, {
        headers: { 'content-type': 'application/octet-stream', 'content-disposition': `attachment; filename="${sc[1]}.shortcut"; filename*=UTF-8''${encodeURIComponent(name)}.shortcut`, 'cache-control': 'no-cache' },
      });
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

  async scheduled(event, env, ctx): Promise<void> {
    // Every minute: close expired unlock windows. Every 15 minutes: stale Shortcuts sessions and the morning message.
    if (event.cron === '* * * * *') {
      ctx.waitUntil(lockSweep(env).then((n) => n && console.log('locks closed', n)));
      return;
    }
    ctx.waitUntil(runCron(env).then((c) => console.log('cron done', JSON.stringify(c))));
  },
} satisfies ExportedHandler<Env>;

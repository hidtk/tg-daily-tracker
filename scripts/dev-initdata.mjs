#!/usr/bin/env node
/** Generate a signed Telegram initData string for local development in a plain browser. */
import { createHmac } from 'node:crypto';
const token = process.env.BOT_TOKEN ?? '123456:ABC-DEF';
const p = {
  auth_date: String(Math.floor(Date.now() / 1000)),
  user: JSON.stringify({ id: Number(process.env.TG_ID ?? 777), first_name: process.env.TG_NAME ?? 'Dev' }),
  query_id: 'dev',
};
const dcs = Object.entries(p).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
const secret = createHmac('sha256', 'WebAppData').update(token).digest();
const hash = createHmac('sha256', secret).update(dcs).digest('hex');
console.log(new URLSearchParams({ ...p, hash }).toString());

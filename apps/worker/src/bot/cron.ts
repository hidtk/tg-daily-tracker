import { timeInTz, todayInTz } from '@tracker/shared';
import type { Env } from '../env';
import { Repo } from '../lib/db';
import { Bot } from '../lib/telegram';
import { shopState } from '../lib/shop';
import { judgeKind, recheckPending } from '../lib/sentences';
import { webappUrl } from './webhook';
import { morningKeyboard, morningText } from './messages';

/** The morning message is sent if local time is within [target, target + WINDOW_MIN) and not yet sent today. */
const WINDOW_MIN = 90;

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function inWindow(nowHHMM: string, targetHHMM: string): boolean {
  const diff = minutes(nowHHMM) - minutes(targetHHMM);
  return diff >= 0 && diff < WINDOW_MIN;
}

/**
 * Every 15 minutes: sentences that waited for the model are checked again, and the morning message goes out.
 * (Sessions are ended by the minute cron — lockSweep — when their minutes run out.)
 */
export async function runCron(env: Env, now = new Date()): Promise<{ morning: number; sentences: number }> {
  const repo = new Repo(env.DB);
  const bot = new Bot(env.BOT_TOKEN);
  const base = webappUrl(env);
  const counts = { morning: 0, sentences: 0 };
  const users = await repo.allUsers();

  try {
    const r = await recheckPending(env, now);
    counts.sentences = r.accepted + r.rejected;
  } catch (e) {
    console.error('sentence recheck failed', e);
  }

  for (const u of users) {
    try {
      const today = todayInTz(u.tz, now);
      if (!(u.ielts_daily_task ?? 1) || u.last_morning_sent === today || !inWindow(timeInTz(u.tz, now), u.morning_time)) continue;
      await repo.markMorningSent(u.id, today);
      const shop = await shopState(repo, u, today, now, judgeKind(env));
      const top = shop.top.map((id) => shop.tasks.find((t) => t.id === id)!).filter(Boolean);
      if (!top.length) continue;
      await bot.sendMessage(u.tg_id, morningText(top, shop.balance), morningKeyboard(base, top));
      counts.morning++;
    } catch (e) {
      console.error(`cron user ${u.tg_id} failed`, e);
    }
  }
  return counts;
}

import { WALLET_SESSION_MAX_MIN, timeInTz, todayInTz } from '@tracker/shared';
import type { Env } from '../env';
import { Repo } from '../lib/db';
import { Bot } from '../lib/telegram';
import { shopState } from '../lib/shop';
import { closeSession } from '../api/gate';
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

/** Every 15 minutes: settle Shortcuts sessions that lost their close event, and send the morning message. */
export async function runCron(env: Env, now = new Date()): Promise<{ morning: number; stale: number }> {
  const repo = new Repo(env.DB);
  const bot = new Bot(env.BOT_TOKEN);
  const base = webappUrl(env);
  const counts = { morning: 0, stale: 0 };
  const users = await repo.allUsers();

  // Sessions whose "app closed" event never arrived (and whose timer went quiet): charge up to the last heartbeat.
  for (const st of await repo.staleSessions(WALLET_SESSION_MAX_MIN)) {
    const owner = users.find((x) => x.id === st.user_id);
    if (owner && (await closeSession(repo, owner, st, now, 'stale')) >= 0) counts.stale++;
  }

  for (const u of users) {
    try {
      const today = todayInTz(u.tz, now);
      if (!(u.ielts_daily_task ?? 1) || u.last_morning_sent === today || !inWindow(timeInTz(u.tz, now), u.morning_time)) continue;
      await repo.markMorningSent(u.id, today);
      const shop = await shopState(repo, u, today, now);
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

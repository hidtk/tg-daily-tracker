import { addDays, timeInTz, todayInTz, weekdayMon0 } from '@tracker/shared';
import type { Env } from '../env';
import { Repo, type UserRow } from '../lib/db';
import { weekStats } from '../lib/stats';
import { Bot } from '../lib/telegram';
import { eveningText, morningText, weeklyText } from './messages';
import { openAppKeyboard, webappUrl } from './webhook';

/** A reminder is sent if local time is within [target, target + WINDOW_MIN) and not yet sent today. */
const WINDOW_MIN = 90;

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function inWindow(nowHHMM: string, targetHHMM: string): boolean {
  const diff = minutes(nowHHMM) - minutes(targetHHMM);
  return diff >= 0 && diff < WINDOW_MIN;
}

export async function runCron(env: Env, now = new Date()): Promise<{ morning: number; evening: number; weekly: number }> {
  const repo = new Repo(env.DB);
  const bot = new Bot(env.BOT_TOKEN);
  const kb = openAppKeyboard(webappUrl(env));
  const counts = { morning: 0, evening: 0, weekly: 0 };
  const users = await repo.allUsers();

  for (const u of users) {
    try {
      const today = todayInTz(u.tz, now);
      const time = timeInTz(u.tz, now);

      if (u.last_morning_sent !== today && inWindow(time, u.morning_time)) {
        if (await sendMorning(repo, bot, u, today, kb)) counts.morning++;
      }
      if (u.last_evening_sent !== today && inWindow(time, u.evening_time)) {
        if (await sendEvening(repo, bot, u, today, kb)) counts.evening++;
      }
      if (u.weekly_summary && weekdayMon0(today) === 6 && u.last_weekly_sent !== today && inWindow(time, u.weekly_time)) {
        if (await sendWeekly(repo, bot, u, today, kb)) counts.weekly++;
      }
    } catch (e) {
      console.error(`cron user ${u.tg_id} failed`, e);
    }
  }
  return counts;
}

type Kb = ReturnType<typeof openAppKeyboard>;

async function sendMorning(repo: Repo, bot: Bot, u: UserRow, today: string, kb: Kb): Promise<boolean> {
  await repo.markSent(u.id, 'last_morning_sent', today);
  const entries = await repo.entriesForDate(u.id, today);
  if (entries.some((e) => e.planned)) return false; // plan already filled
  const activities = await repo.listActivities(u.id);
  await bot.sendMessage(u.tg_id, morningText(today, activities), kb);
  return true;
}

async function sendEvening(repo: Repo, bot: Bot, u: UserRow, today: string, kb: Kb): Promise<boolean> {
  await repo.markSent(u.id, 'last_evening_sent', today);
  const entries = await repo.entriesForDate(u.id, today);
  if (entries.some((e) => e.done)) return false; // fact already filled
  const activities = await repo.listActivities(u.id);
  await bot.sendMessage(u.tg_id, eveningText(today, activities, entries), kb);
  return true;
}

async function sendWeekly(repo: Repo, bot: Bot, u: UserRow, today: string, kb: Kb): Promise<boolean> {
  await repo.markSent(u.id, 'last_weekly_sent', today);
  const activities = await repo.listActivities(u.id);
  if (!activities.length) return false;
  const cur = await weekStats(repo, u.id, activities, today);
  const prev = await weekStats(repo, u.id, activities, addDays(cur.from, -1));
  await bot.sendMessage(u.tg_id, weeklyText(cur, prev), kb);
  return true;
}

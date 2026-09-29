import { WALLET_SESSION_MAX_MIN, addDays, diffDays, timeInTz, todayInTz, weekdayMon0 } from '@tracker/shared';
import type { Env } from '../env';
import { Repo, type UserRow } from '../lib/db';
import { missedOn, skippedOn, weekStats } from '../lib/stats';
import { Bot } from '../lib/telegram';
import { missedSelfText, missedText, weeklyText } from './messages';
import { openAppKeyboard, sendQuests, sendWords, webappUrl } from './webhook';
import { lessonReminderText } from './homework';
import { closeSession } from '../api/gate';
import { gameState } from '../lib/game';
import { eveningQuestsText, questsKeyboard } from './quests';

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

export async function runCron(env: Env, now = new Date()): Promise<{ morning: number; evening: number; weekly: number; missed: number; tasks: number; lessons: number; words: number }> {
  const repo = new Repo(env.DB);
  const bot = new Bot(env.BOT_TOKEN);
  const base = webappUrl(env);
  const kb = openAppKeyboard(base);
  const counts = { morning: 0, evening: 0, weekly: 0, missed: 0, tasks: 0, lessons: 0, words: 0 };
  const users = await repo.allUsers();
  const lessonRows = await repo.allLessonRows();

  // Sessions whose "app closed" event never arrived (and whose timer went quiet): charge up to the last heartbeat.
  for (const st of await repo.staleSessions(WALLET_SESSION_MAX_MIN)) {
    const owner = users.find((x) => x.id === st.user_id);
    if (owner) await closeSession(repo, owner, st, now, 'stale');
  }

  for (const u of users) {
    try {
      const today = todayInTz(u.tz, now);
      const time = timeInTz(u.tz, now);

      // Missed-day report (yesterday) goes out with the morning reminder window.
      if (u.last_partner_report !== today && inWindow(time, u.morning_time)) {
        if (await sendMissed(repo, bot, u, today, kb)) counts.missed++;
      }
      // Morning: one message with the day's quests (Speaking card, Writing topic), then the new words.
      if (u.last_morning_sent !== today && inWindow(time, u.morning_time)) {
        await repo.markSent(u.id, 'last_morning_sent', today);
        await repo.markSent(u.id, 'last_task_sent', today);
        if (u.ielts_daily_task ?? 1) {
          await sendQuests(repo, u, u.tg_id, bot, today, base, '<b>Good morning.</b> Today’s quests — everything is counted by itself:');
          counts.tasks++;
        }
        counts.morning++;
      }
      if ((u.vocab_per_day ?? 5) > 0 && u.last_vocab_sent !== today && inWindow(time, u.morning_time)) {
        await repo.markSent(u.id, 'last_vocab_sent', today);
        await sendWords(repo, u, u.tg_id, bot, today, base);
        counts.words++;
      }
      if (u.last_evening_sent !== today && inWindow(time, u.evening_time)) {
        if (await sendEvening(repo, bot, u, today, base)) counts.evening++;
      }
      // Lesson reminders (in the lesson's own timezone)
      for (const l of lessonRows.filter((x) => x.user_id === u.id)) {
        const lToday = todayInTz(l.tz, now);
        const lTime = timeInTz(l.tz, now);
        const weekdays = JSON.parse(l.weekdays) as number[];
        if (!weekdays.includes(weekdayMon0(lToday))) continue;
        if (l.remind_morning && l.last_morning_sent !== lToday && inWindow(lTime, u.morning_time)) {
          await repo.markLessonSent(l.id, 'last_morning_sent', lToday);
          const hws = await repo.openHomeworks(u.id);
          await bot.sendMessage(u.tg_id, lessonReminderText(l.title, l.time, 'morning', hws, lToday, l.remind_before_min), kb);
          counts.lessons++;
        }
        if (l.remind_before_min > 0 && l.last_before_sent !== lToday) {
          const target = minutes(l.time) - l.remind_before_min;
          const diff = minutes(lTime) - target;
          if (diff >= 0 && diff < 30) {
            await repo.markLessonSent(l.id, 'last_before_sent', lToday);
            const hws = await repo.openHomeworks(u.id);
            await bot.sendMessage(u.tg_id, lessonReminderText(l.title, l.time, 'before', hws, lToday, l.remind_before_min), kb);
            counts.lessons++;
          }
        }
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

/** Evening: only if a quest is still open — what is left and what is at stake (the streak, held minutes). */
async function sendEvening(repo: Repo, bot: Bot, u: UserRow, today: string, base: string): Promise<boolean> {
  await repo.markSent(u.id, 'last_evening_sent', today);
  const s = await gameState(repo, u, today);
  const text = eveningQuestsText(s);
  if (!text) return false;
  await bot.sendMessage(u.tg_id, text, questsKeyboard(base, s));
  return true;
}

async function sendWeekly(repo: Repo, bot: Bot, u: UserRow, today: string, kb: Kb): Promise<boolean> {
  await repo.markSent(u.id, 'last_weekly_sent', today);
  const activities = await repo.listActivities(u.id);
  if (!activities.length) return false;
  const cur = await weekStats(repo, u.id, activities, today, false);
  const prev = await weekStats(repo, u.id, activities, addDays(cur.from, -1), false);
  await bot.sendMessage(u.tg_id, weeklyText(cur, prev), kb);
  if (u.partner_chat_id) await bot.sendMessage(u.partner_chat_id, weeklyText(cur, prev, u.first_name));
  return true;
}

async function sendMissed(repo: Repo, bot: Bot, u: UserRow, today: string, kb: Kb): Promise<boolean> {
  await repo.markSent(u.id, 'last_partner_report', today);
  const yesterday = addDays(today, -1);
  // Don't report days before the user existed.
  if (u.created_at.slice(0, 10) > yesterday) return false;
  const activities = await repo.listActivities(u.id);
  const entries = await repo.entriesForDate(u.id, yesterday);
  const missed = missedOn(activities, entries, yesterday, false);
  const skipped = skippedOn(activities, entries, yesterday, false);
  if (!missed.length && !skipped.length) return false;
  const partnerNotified = !!(u.partner_chat_id && u.partner_notify_missed);
  if (partnerNotified) await bot.sendMessage(u.partner_chat_id!, missedText(u.first_name, yesterday, missed, skipped));
  await bot.sendMessage(u.tg_id, missedSelfText(yesterday, missed, skipped, partnerNotified ? u.partner_name : null), kb);
  return true;
}

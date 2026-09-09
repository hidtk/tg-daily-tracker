import { GATE_APP_LABEL, MINUTE_PRESETS, diffDays, quizOptions, todayInTz, weekdayMon0, type VocabCard } from '@tracker/shared';
import type { Env } from '../env';
import { Repo, walletSettings, type UserRow } from '../lib/db';
import { Bot, escapeHtml, type InlineKeyboardButton } from '../lib/telegram';
import { reviewWord, toCard, vocabToday } from '../lib/vocab';
import { helpText, partnerLinkedText, partnerText, quizText, todayStatusText, welcomeText, wordsText } from './messages';
import { formatTask, randomTask, taskForDay, taskKeyboard, type TaskKind } from './ielts-tasks';
import { composeMorning, detectTags, homeworkKeyboard, homeworkListText, nextLessonDate } from './homework';

interface TgChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  first_name?: string;
}
interface Update {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name: string; language_code?: string };
    chat: TgChat;
    text?: string;
    caption?: string;
    photo?: { file_id: string; file_size?: number; width: number; height: number }[];
    document?: { file_id: string; mime_type?: string };
  };
  channel_post?: { message_id: number; chat: TgChat; text?: string };
  callback_query?: { id: string; from: { id: number; first_name: string }; data?: string; message?: { chat: TgChat; message_id: number } };
}

export function webappUrl(env: Env, req?: Request): string {
  if (env.WEBAPP_URL) return env.WEBAPP_URL;
  if (req) return new URL(req.url).origin;
  return `https://t.me/${env.BOT_USERNAME}`;
}

export function openAppKeyboard(url: string): InlineKeyboardButton[][] {
  // web_app buttons require an HTTPS Mini App URL; a t.me fallback is a plain link.
  if (url.startsWith('https://t.me/')) return [[{ text: 'Open the trainer', url }]];
  return [[{ text: 'Open the trainer', web_app: { url } }]];
}

const HW_RE = /^(hw|homework|дз|домашк[а-я]*)\b[:\s—-]*/i;

function randomCode(): string {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function quizSeed(today: string): number {
  return Number(today.replace(/-/g, '')) % 100000;
}

export function quizKeyboard(w: VocabCard, today: string): InlineKeyboardButton[][] {
  const q = quizOptions(w, quizSeed(today));
  return q.options.map((o, i) => [{ text: o.length > 60 ? o.slice(0, 57) + '…' : o, callback_data: `vq:${w.id}:${i}:${q.answer}` }]);
}

/** Send the next due word as a quiz, or a closing line when the queue is empty. */
export async function sendNextQuiz(repo: Repo, user: UserRow, chatId: number, bot: Bot, today: string, edit?: { messageId: number; prefix: string }) {
  const due = (await repo.vocabDue(user.id, today)).map(toCard).filter((c): c is VocabCard => !!c);
  if (!due.length) {
    const text = `${edit?.prefix ?? ''}All reviews done for today.`;
    if (edit) await bot.editMessageText(chatId, edit.messageId, text);
    else await bot.sendMessage(chatId, text);
    return;
  }
  const all = await repo.vocabAll(user.id);
  const reviewedToday = all.filter((r) => r.last_reviewed === today).length;
  const w = due[0];
  const text = `${edit?.prefix ?? ''}${quizText(w, reviewedToday + 1, reviewedToday + due.length)}`;
  if (edit) await bot.editMessageText(chatId, edit.messageId, text, quizKeyboard(w, today));
  else await bot.sendMessage(chatId, text, quizKeyboard(w, today));
}

export async function sendWords(repo: Repo, user: UserRow, chatId: number, bot: Bot, today: string) {
  const { newWords, due } = await vocabToday(repo, user, today);
  const cards = newWords.map(toCard).filter((c): c is VocabCard => !!c);
  await bot.sendMessage(chatId, wordsText(cards, due.length));
  if (due.length) await sendNextQuiz(repo, user, chatId, bot, today);
}

export async function handleWebhook(req: Request, env: Env): Promise<Response> {
  // Telegram sends this header when the webhook was set with secret_token.
  const secret = req.headers.get('x-telegram-bot-api-secret-token');
  if (secret !== env.SESSION_SECRET) return new Response('forbidden', { status: 403 });

  const update = (await req.json().catch(() => null)) as Update | null;
  if (!update) return new Response('bad request', { status: 400 });

  const bot = new Bot(env.BOT_TOKEN);
  const repo = new Repo(env.DB);
  const url = webappUrl(env, req);
  const kb = openAppKeyboard(url);

  try {
    if (update.callback_query) {
      await handleCallback(update.callback_query, bot, repo, kb);
      return new Response('ok');
    }

    // /partner posted inside a group or channel where the bot is a member → link that chat as the partner.
    const post = update.channel_post;
    if (post?.text?.trim().startsWith('/partner')) {
      await linkChatByCode(post.text, post.chat, bot, repo);
      return new Response('ok');
    }

    const msg = update.message;
    if (!msg?.from) return new Response('ok');

    if (msg.chat.type !== 'private') {
      if (msg.text?.trim().startsWith('/partner')) await linkChatByCode(msg.text, msg.chat, bot, repo);
      return new Response('ok');
    }

    const chatId = msg.chat.id;
    const text = (msg.text ?? '').trim();
    const cmd = text.split(/[\s@]/)[0].toLowerCase();

    if (cmd === '/start') {
      const arg = text.split(/\s+/)[1] ?? '';
      if (arg.startsWith('partner_')) {
        const owner = await repo.getUserByPartnerCode(arg.slice('partner_'.length));
        if (!owner) {
          await bot.sendMessage(chatId, 'This link is invalid or has expired. Ask for a new one with /partner.');
        } else if (owner.tg_id === msg.from.id) {
          await bot.sendMessage(chatId, 'This is your own link — send it to the person who will be your accountability partner.');
        } else {
          await repo.updateUser(owner.id, { partner_chat_id: chatId, partner_name: msg.from.first_name });
          await bot.sendMessage(chatId, partnerLinkedText(owner.first_name));
          await bot.sendMessage(owner.tg_id, `<b>${escapeHtml(msg.from.first_name)}</b> is now your accountability partner. They will receive your weekly summaries and missed days.`, kb);
        }
        return new Response('ok');
      }
      const { user, isNew } = await repo.ensureUser(msg.from.id, msg.from.first_name, 'UTC');
      await bot.sendMessage(chatId, welcomeText(user.first_name, isNew), kb);
      return new Response('ok');
    }

    const user = await repo.getUserByTg(msg.from.id);
    if (!user) {
      await bot.sendMessage(chatId, 'Press /start first.', kb);
      return new Response('ok');
    }
    const today = todayInTz(user.tz);

    if (cmd === '/today') {
      const activities = await repo.listActivities(user.id);
      const entries = await repo.entriesForDate(user.id, today);
      await bot.sendMessage(chatId, todayStatusText(today, activities, entries), kb);
    } else if (cmd === '/app') {
      await bot.sendMessage(chatId, 'Open the trainer:', kb);
    } else if (cmd === '/task') {
      const arg = text.split(/\s+/)[1]?.toLowerCase() as TaskKind | undefined;
      const kinds: TaskKind[] = ['writing2', 'speaking', 'reading', 'writing1', 'listening', 'grammar'];
      const weekIndex = Math.floor(diffDays('2026-01-05', today) / 7);
      if (arg && kinds.includes(arg)) {
        const task = randomTask(arg);
        await bot.sendMessage(chatId, formatTask(task, 'Task'), taskKeyboard(task.id));
      } else {
        const hws = await repo.openHomeworks(user.id);
        const { text: t, keyboard } = composeMorning(user.tg_id, today, weekIndex, hws);
        const task = taskForDay(user.tg_id, today, weekdayMon0(today), weekIndex);
        await bot.sendMessage(chatId, t, [...keyboard, ...taskKeyboard(task.id)]);
      }
    } else if (cmd === '/words') {
      await sendWords(repo, user, chatId, bot, today);
    } else if (cmd === '/minutes' || cmd === '/min') {
      const bal = await repo.balance(user.id);
      const w = walletSettings(user);
      const earned = await repo.earnedOn(user.id, today);
      await bot.sendMessage(
        chatId,
        [
          `<b>${Math.floor(bal)} min</b> in the wallet.`,
          bal < 1 ? 'Social media is locked — pass a Reading test in the app.' : `Open: ${w.apps.map((a) => GATE_APP_LABEL[a]).join(', ')}.`,
          '',
          `Earned today: ${earned} of ${w.daily_earn_cap} min.`,
        ].join('\n'),
        kb,
      );
    } else if (cmd === '/hw') {
      const rest = text.slice(3).trim();
      const hws = await repo.openHomeworks(user.id);
      if (!rest) {
        await bot.sendMessage(chatId, homeworkListText(hws, today), homeworkKeyboard(hws));
      } else if (/^(done|сделал|готово)\b/i.test(rest)) {
        const n = Number(rest.split(/\s+/)[1] ?? '1');
        const h = hws[n - 1];
        if (!h) await bot.sendMessage(chatId, 'No such homework. /hw shows the list.');
        else await completeHomework(user, h.id, chatId, bot, repo, today);
      } else {
        await addHomework(user, rest, null, chatId, bot, repo, today);
      }
    } else if (cmd === '/help') {
      await bot.sendMessage(chatId, helpText(), kb);
    } else if (cmd === '/partner') {
      const sub = text.split(/\s+/)[1]?.toLowerCase();
      if (sub === 'off') {
        await repo.updateUser(user.id, { partner_chat_id: null, partner_name: null });
        await bot.sendMessage(chatId, 'Partner unlinked.');
      } else {
        let code = user.partner_code;
        if (!code) {
          code = randomCode();
          await repo.updateUser(user.id, { partner_code: code });
        }
        await bot.sendMessage(chatId, partnerText(env.BOT_USERNAME, code, user.partner_name));
      }
    } else if ((msg.photo?.length || msg.document?.mime_type?.startsWith('image/')) && HW_RE.test(msg.caption?.trim() ?? '')) {
      const fileId = msg.photo?.length ? msg.photo[msg.photo.length - 1].file_id : msg.document!.file_id;
      await addHomework(user, msg.caption!.trim().replace(HW_RE, '') || 'Homework (see photo)', fileId, chatId, bot, repo, today);
    } else if (text && HW_RE.test(text) && !text.startsWith('/')) {
      await addHomework(user, text.replace(HW_RE, ''), null, chatId, bot, repo, today);
    } else {
      await bot.sendMessage(chatId, 'Log practice in the app. Homework: <code>/hw text</code> or a photo captioned “hw”. Task: /task. Words: /words.', kb);
    }
  } catch (e) {
    console.error('webhook error', e);
  }
  // Always 200 so Telegram doesn't retry.
  return new Response('ok');
}

async function handleCallback(cq: NonNullable<Update['callback_query']>, bot: Bot, repo: Repo, kb: InlineKeyboardButton[][]) {
  const data = cq.data ?? '';
  const chatId = cq.message?.chat.id;
  const messageId = cq.message?.message_id;
  const user = await repo.getUserByTg(cq.from.id);
  if (!user || !chatId || !messageId) {
    await bot.answerCallbackQuery(cq.id);
    return;
  }
  const today = todayInTz(user.tz);
  const [kind, ...rest] = data.split(':');

  if (kind === 'hwd' || kind === 'hwx') {
    const id = Number(rest[0]);
    const h = await repo.getHomework(user.id, id);
    if (!h || h.done_at) {
      await bot.answerCallbackQuery(cq.id, 'Already handled');
      return;
    }
    if (kind === 'hwx') {
      await repo.deleteHomework(user.id, id);
      await bot.answerCallbackQuery(cq.id, 'Removed');
    } else {
      await completeHomework(user, id, chatId, bot, repo, today);
      await bot.answerCallbackQuery(cq.id, 'Done ✓');
    }
    const hws = await repo.openHomeworks(user.id);
    await bot.editMessageReplyMarkup(chatId, messageId, hws.length ? homeworkKeyboard(hws) : undefined);
    return;
  }

  if (kind === 'task') {
    const [k, currentId] = rest;
    const task = randomTask(k === 'any' ? undefined : (k as TaskKind), currentId);
    await bot.sendMessage(chatId, formatTask(task, 'Task'), taskKeyboard(task.id));
    await bot.answerCallbackQuery(cq.id);
    return;
  }

  if (kind === 'done') {
    const ielts = await ieltsActivity(repo, user);
    if (ielts) await repo.markDone(user.id, ielts.id, today);
    await bot.editMessageReplyMarkup(chatId, messageId, minutesKeyboard(ielts?.id ?? 0, today));
    await bot.answerCallbackQuery(cq.id, 'Logged for today. How long?');
    return;
  }

  if (kind === 'pm') {
    const [activityIdS, date, minS] = rest;
    const minutes = Number(minS);
    if (minutes > 0) await repo.setMinutes(user.id, Number(activityIdS), date, minutes);
    await bot.editMessageReplyMarkup(chatId, messageId, kb);
    await bot.answerCallbackQuery(cq.id, minutes ? `${minutes} min logged` : 'Logged');
    return;
  }

  if (kind === 'vq') {
    const [wordIdS, chosenS, answerS] = rest;
    const ok = chosenS === answerS;
    const card = await reviewWord(repo, user, Number(wordIdS), ok, today);
    const prefix = card ? `${ok ? '✓' : '✗'} <b>${escapeHtml(card.word)}</b> — ${escapeHtml(card.meaning)} (${escapeHtml(card.ru)})\n\n` : '';
    await bot.answerCallbackQuery(cq.id, ok ? 'Correct' : 'Not quite');
    await sendNextQuiz(repo, user, chatId, bot, today, { messageId, prefix });
    return;
  }

  await bot.answerCallbackQuery(cq.id);
}

function minutesKeyboard(activityId: number, date: string): InlineKeyboardButton[][] {
  return [MINUTE_PRESETS.slice(0, 4).map((m) => ({ text: `${m} min`, callback_data: `pm:${activityId}:${date}:${m}` })), [{ text: 'Skip', callback_data: `pm:${activityId}:${date}:0` }]];
}

async function ieltsActivity(repo: Repo, user: UserRow) {
  const activities = await repo.listActivities(user.id);
  return activities.find((a) => a.kind === 'ielts') ?? activities[0] ?? null;
}

async function linkChatByCode(text: string, chat: TgChat, bot: Bot, repo: Repo) {
  const code = text.trim().split(/\s+/)[1];
  if (!code) {
    await bot.sendMessage(chat.id, 'Usage: /partner <code> — the code comes from /partner in a private chat with the bot.');
    return;
  }
  const owner = await repo.getUserByPartnerCode(code);
  if (!owner) {
    await bot.sendMessage(chat.id, 'Code not found.');
    return;
  }
  const name = chat.title ?? chat.first_name ?? 'chat';
  await repo.updateUser(owner.id, { partner_chat_id: chat.id, partner_name: name });
  await bot.sendMessage(chat.id, `This chat now receives <b>${escapeHtml(owner.first_name)}</b>’s IELTS summaries.`);
  await bot.sendMessage(owner.tg_id, `<b>${escapeHtml(name)}</b> is linked as your accountability partner.`);
}

// ---------- homework ----------

async function addHomework(user: UserRow, text: string, fileId: string | null, chatId: number, bot: Bot, repo: Repo, today: string) {
  if (!text.trim() && !fileId) {
    await bot.sendMessage(chatId, 'Tell me what was set: <code>/hw Essay on cities, p. 45 ex. 3</code>');
    return;
  }
  const lessons = await repo.listLessons(user.id);
  const next = nextLessonDate(lessons, today, false);
  const tags = detectTags(text);
  await repo.addHomework(user.id, { text: text.trim(), file_id: fileId, tags, due_date: next?.date ?? null, lesson_id: next?.lesson.id ?? null });
  const hws = await repo.openHomeworks(user.id);
  await bot.sendMessage(
    chatId,
    `Noted${next ? ` — for <b>${escapeHtml(next.lesson.title)}</b> on ${next.date}` : ''} · skills: <i>${tags.join(', ')}</i>.\n\nTomorrow’s task will adapt: homework first, then a short extra on another skill.\n\n${homeworkListText(hws, today)}`,
    homeworkKeyboard(hws),
  );
}

async function completeHomework(user: UserRow, id: number, chatId: number, bot: Bot, repo: Repo, today: string) {
  const h = await repo.getHomework(user.id, id);
  if (!h) return;
  await repo.completeHomework(user.id, id);
  const ielts = await ieltsActivity(repo, user);
  if (ielts) await repo.markDone(user.id, ielts.id, today);
  const hws = await repo.openHomeworks(user.id);
  await bot.sendMessage(
    chatId,
    `Homework done — today counts as practised.${hws.length ? ` ${hws.length} left.` : ' The list is empty.'}\n\nHow long did it take?`,
    ielts ? minutesKeyboard(ielts.id, today) : undefined,
  );
}

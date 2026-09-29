/**
 * End-to-end checks on a real SQLite database with all migrations: the Shortcuts timer, typed words,
 * Reading and the boss, held minutes and the chest, Writing and Speaking.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EARN, READING_TESTS, SPEAKING_MIN_SECONDS, VOCAB, addDays, timeInTz, todayInTz, writingTopicFor } from '@tracker/shared';
import { runCron } from '../src/bot/cron';
import { handleGate } from '../src/api/gate';
import { Repo, type UserRow } from '../src/lib/db';
import { gameState, settleDay } from '../src/lib/game';
import { answerWord, expectedAnswers, vocabState } from '../src/lib/vocab';
import { submitReading } from '../src/lib/reading';
import { acceptVoice, startWriting, submitWriting } from '../src/lib/tasks';
import { freshDb, fakeEnv, type FakeD1 } from './d1';

let db: FakeD1;
let repo: Repo;
let user: UserRow;
const today = todayInTz('UTC');
const yesterday = addDays(today, -1);

async function reload() {
  user = (await repo.getUserById(user.id))!;
}
async function setBalance(n: number) {
  await repo.updateUser(user.id, { sm_balance: n });
  await reload();
}
/** `n` words learned yesterday, so they can be asked today. */
async function learnWords(n: number, on = yesterday) {
  for (let id = 1; id <= n; id++) {
    await db.prepare('INSERT INTO vocab_progress (user_id, word_id, stage, introduced_on, next_review) VALUES (?, ?, 0, ?, ?)').bind(user.id, id, on, today).run();
  }
}

beforeEach(async () => {
  db = await freshDb();
  repo = new Repo(db as unknown as D1Database);
  user = (await repo.ensureUser(1001, 'Test', 'UTC')).user;
  await repo.updateUser(user.id, { vocab_per_day: 0 });
  await repo.ensureApiKey(user);
  await reload();
});

// ---------- the Shortcuts gate ----------

describe('Shortcuts gate with the timer loop', () => {
  const env = () => fakeEnv(db);
  const call = async (q: string, offsetSec = 0) => {
    const url = new URL(`https://app.test/gate/${user.sm_api_key}${q}`);
    return (await handleGate(new Request(url), env(), url, new Date(Date.now() + offsetSec * 1000))).text();
  };

  it('no minutes: the app does not open, the loop stops', async () => {
    expect(await call('?app=any&e=open')).toBe('BLOCK 0');
    expect(await call('?e=tick', 20)).toContain('STOP');
  });

  it('one earned minute is one minute: the timer sends you Home when it ends', async () => {
    await setBalance(1);
    expect(await call('?app=any&e=open')).toBe('ALLOW 1 60');
    expect(await call('?e=tick', 20)).toMatch(/^ALLOW 0 (39|40)$/);
    expect(await call('?e=tick', 40)).toMatch(/^ALLOW 0 (19|20)$/);
    // 55 s in: less than 10 s left → BLOCK, the session is closed and charged
    expect(await call('?e=tick', 55)).toBe('BLOCK 0 0');
    const s = await repo.lastSession(user.id);
    expect(s?.closed_by).toBe('tick');
    expect(s?.minutes).toBeCloseTo(0.9, 1);
    // still in the app (Home didn't happen yet) → keep sending Home
    expect(await call('?e=tick', 75)).toBe('BLOCK 0 0');
    // the app really closed → the loop is told to stop
    await call('?app=any&e=close', 80);
    expect((await repo.lastSession(user.id))?.closed_by).toBe('kicked');
    expect(await call('?e=tick', 95)).toContain('STOP');
    expect(await call('?app=any&e=open', 100)).toBe('BLOCK 0');
  });

  it('closing early charges the real time; overuse becomes a debt that blocks the next open', async () => {
    await setBalance(2);
    await call('?app=any&e=open');
    await call('?app=any&e=close', 5 * 60); // 5 minutes with 2 paid — the timer was not set up
    expect(await repo.balance(user.id)).toBeCloseTo(-3, 1);
    expect(await call('?app=any&e=open', 5 * 60 + 10)).toBe('BLOCK 0\ndebt 3');
  });

  it('a lost close event is charged up to the last heartbeat, without a debt', async () => {
    await setBalance(10);
    await call('?app=any&e=open');
    await call('?e=tick', 20);
    // an hour later another app opens: the old session is settled by its heartbeat, not by the hour
    await call('?app=any&e=open', 3600);
    const [, old] = (await db.prepare('SELECT * FROM wallet_sessions ORDER BY id DESC').all<{ minutes: number; closed_by: string }>()).results;
    expect(old.closed_by).toBe('open');
    expect(old.minutes).toBeLessThan(1);
  });

  it('status is read-only', async () => {
    await setBalance(3);
    expect(await call('?e=status')).toBe('ALLOW 3 180');
    expect(await repo.openSession(user.id)).toBeNull();
  });
});

// ---------- words ----------

describe('typed word review', () => {
  it('asks without revealing the word and pays only for a right typed answer, once a day', async () => {
    await learnWords(3);
    const st = await vocabState(repo, user, today);
    expect(st.queue).toHaveLength(3);
    for (const q of st.queue) expect(JSON.stringify(q)).not.toContain(`"${VOCAB[q.word_id - 1].word}"`);

    const row = (await repo.vocabGet(user.id, 1))!;
    const right = expectedAnswers(row, today)!.shown;
    const ok = await answerWord(repo, user, 1, right.toUpperCase(), false, today);
    expect(ok).toMatchObject({ ok: true, stage: 1 });
    if (typeof ok === 'object') expect(ok.reward).toMatchObject({ xp: 2, minutes: EARN.word });
    expect(await answerWord(repo, user, 1, right, false, today)).toBe('already');

    const bad = await answerWord(repo, user, 2, 'nonsense', false, today);
    expect(bad).toMatchObject({ ok: false, stage: 0 });
    if (typeof bad === 'object') expect(bad.reward.minutes).toBe(0);

    const hinted = await answerWord(repo, user, 3, expectedAnswers((await repo.vocabGet(user.id, 3))!, today)!.shown, true, today);
    // a hint gives 1 XP and no minutes; this answer also completes the words quest (3 words, 1 missed → target 2)
    if (typeof hinted === 'object') expect(hinted.reward).toMatchObject({ xp: 1 + 10, minutes: 0, quests_done: ['words'] });
  });

  it('new words are not asked on the day they are introduced', async () => {
    await learnWords(1, today);
    expect(await answerWord(repo, user, 1, VOCAB[0].word, false, today)).toBe('new_today');
  });

  it('the words quest target follows how many words can be asked', async () => {
    await learnWords(4);
    expect((await gameState(repo, user, today)).quests[1].target).toBe(4);
  });
});

// ---------- reading, held minutes, chest, streak ----------

function answersFor(testId: string, right: number) {
  const t = READING_TESTS.find((x) => x.id === testId)!;
  return t.questions.map((q, i) => (i < right ? q.answer : 'zzz'));
}

describe('Reading and the day’s minutes', () => {
  it('a rushed attempt counts for nothing', async () => {
    const r = await submitReading(repo, user, today, { test_id: 'rt-01', seconds: 60, answers: answersFor('rt-01', 13) });
    expect(r).toMatchObject({ counted: false, earned: 0 });
    expect((await gameState(repo, user, today)).quests[0].done).toBe(false);
  });

  it('a real attempt pays by band, does the Reading quest and starts the streak', async () => {
    const r = await submitReading(repo, user, today, { test_id: 'rt-01', seconds: 600, answers: answersFor('rt-01', 11) });
    expect(r.counted).toBe(true);
    expect(r.earned).toBe(30);
    expect(r.reward?.quests_done).toContain('reading');
    const g = await gameState(repo, user, today);
    expect(g.streak).toMatchObject({ current: 1, today_done: true });
    // test XP + the Reading quest + the words quest (no words learned yet → nothing to ask, target 0)
    expect(g.xp).toBe(10 + 2 * 11 + 10 + 10);
  });

  it('other work is paid up to 10 min without Reading; Reading releases the rest and the chest', async () => {
    await learnWords(10);
    for (let id = 1; id <= 10; id++) await answerWord(repo, user, id, expectedAnswers((await repo.vocabGet(user.id, id))!, today)!.shown, false, today);
    await db.prepare("INSERT INTO practice_tasks (user_id, kind, date, topic, status, seconds) VALUES (?, 'writing', ?, 'wt-01', 'accepted', 900)").bind(user.id, today).run();
    await settleDay(repo, user, today, 'writing');
    let g = await gameState(repo, user, today);
    expect(g.minutes.earned).toBe(10); // 5 from words + 10 from Writing = 15, only 10 paid
    expect(g.minutes.held).toBe(5);

    const r = await submitReading(repo, user, today, { test_id: 'rt-02', seconds: 700, answers: answersFor('rt-02', 8) });
    g = await gameState(repo, user, today);
    expect(r.reward?.chest).toBe(true);
    expect(g.minutes.held).toBe(0);
    expect(g.minutes.by_source.unlocked).toBe(5);
    expect(g.minutes.by_source.quest).toBe(EARN.chest);
    expect(g.chest.open).toBe(true);
    // the chest opens once
    await settleDay(repo, user, today, 'words');
    expect((await gameState(repo, user, today)).minutes.by_source.quest).toBe(EARN.chest);
  });

  it('the boss opens only at its level', async () => {
    await expect(submitReading(repo, user, today, { test_id: 'boss-1', seconds: 900, answers: [] })).rejects.toThrow(/level 5/);
  });
});

// ---------- writing & speaking ----------

describe('Writing', () => {
  const essay = (words: string[]) =>
    `Many schools now ban phones, and I think this policy can ${words[0]} the problem of distraction. ` +
    `Teachers report that pupils ${words[1]} more of each lesson when screens are away, and the effect on attention is clear. ` +
    `However, a total ban may ${words[2]} learning in some cases, because phones are also useful tools for research and for contacting parents. ` +
    'A sensible rule would allow phones in the bag but not on the desk, so that pupils learn self-control instead of simply obeying. ' +
    'In my own school the change took about a month to settle, and afterwards most students agreed that break times felt more social and lessons more focused. ' +
    'On balance, the advantages of limiting phones outweigh the disadvantages, provided teachers explain the reasons and parents support the idea at home.';

  it('checks length, recent words and time on the server', async () => {
    await learnWords(40, addDays(today, -3));
    expect((await submitWriting(repo, user, today, essay(['mitigate', 'retain', 'hinder']))).reasons).toEqual(['not_started']);
    await startWriting(repo, user, today);
    const early = await submitWriting(repo, user, today, essay(['mitigate', 'retain', 'hinder']));
    expect(early.reasons).toContain('fast');
    // pretend the text took 10 minutes
    await db.prepare("UPDATE practice_tasks SET started_at = strftime('%Y-%m-%dT%H:%M:%fZ','now','-10 minutes') WHERE user_id = ?").bind(user.id).run();
    const noVocab = await submitWriting(repo, user, today, essay(['reduce', 'keep', 'slow']));
    expect(noVocab.reasons).toEqual(['vocab']);
    const ok = await submitWriting(repo, user, today, essay(['mitigate', 'retain', 'hinder']));
    expect(ok.ok).toBe(true);
    expect(ok.vocab_used).toEqual(expect.arrayContaining(['mitigate', 'retain', 'hinder']));
    expect(ok.reward).toMatchObject({ xp: 40 + 10 });
    expect(ok.state.topic.id).toBe(writingTopicFor(user.tg_id, today).id);
    expect((await submitWriting(repo, user, today, essay(['mitigate', 'retain', 'hinder']))).reasons).toEqual(['done_today']);
  });
});

describe('Speaking by voice message', () => {
  it('counts a long enough own voice once, two a day', async () => {
    expect(await acceptVoice(repo, user, today, { seconds: 20, fileUniqueId: 'a', forwarded: false })).toMatchObject({ status: 'short' });
    expect(await acceptVoice(repo, user, today, { seconds: 90, fileUniqueId: 'b', forwarded: true })).toMatchObject({ status: 'forwarded' });
    const ok = await acceptVoice(repo, user, today, { seconds: SPEAKING_MIN_SECONDS + 5, fileUniqueId: 'c', forwarded: false });
    expect(ok).toMatchObject({ status: 'ok' });
    if (ok.status === 'ok') expect(ok.reward.xp).toBe(25 + 10);
    expect(await acceptVoice(repo, user, today, { seconds: 70, fileUniqueId: 'c', forwarded: false })).toMatchObject({ status: 'duplicate' });
    expect(await acceptVoice(repo, user, today, { seconds: 70, fileUniqueId: 'd', forwarded: false })).toMatchObject({ status: 'ok' });
    expect(await acceptVoice(repo, user, today, { seconds: 70, fileUniqueId: 'e', forwarded: false })).toMatchObject({ status: 'limit' });
    // counted by the automatic day log as Speaking
    const entry = (await repo.entriesForDate(user.id, today))[0];
    expect(entry.skills).toContain('speaking');
  });
});

describe('bot notifications lead to tasks', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('the morning message lists the quests with the Speaking card and buttons into the app', async () => {
    const sent: { text: string; reply_markup?: { inline_keyboard: { text: string; web_app?: { url: string } }[][] } }[] = [];
    vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
      sent.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ ok: true, result: {} }));
    });
    await repo.updateUser(user.id, { morning_time: timeInTz('UTC'), vocab_per_day: 5 });
    await runCron(fakeEnv(db));
    const quests = sent.find((m) => m.text?.includes('Today’s quests'));
    expect(quests?.text).toContain('Speaking card');
    expect(quests?.text).not.toMatch(/Done ✓/);
    const urls = quests!.reply_markup!.inline_keyboard.flat().map((b) => b.web_app?.url);
    expect(urls).toContain('https://app.test?go=reading');
    expect(sent.some((m) => m.text?.includes('Today’s words'))).toBe(true);
  });
});

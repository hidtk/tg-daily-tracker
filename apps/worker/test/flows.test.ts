/**
 * End-to-end checks on a real SQLite database with all migrations: the Shortcuts timer, the task shop and its
 * payments, typed words, Reading parts, sentences, Writing and Speaking by the rubric, achievements and «Начать заново».
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QUIZ_PAY, QUIZ_SIZE, SPEAKING_TASKS, VOCAB, WRITING_TASKS, type JudgeVerdict, type QuizResult, addDays, findReadingPart, readingTaskId, timeInTz, todayInTz, wordForms } from '@tracker/shared';
import { runCron } from '../src/bot/cron';
import { handleGate } from '../src/api/gate';
import { handleApi } from '../src/api/routes';
import { Repo, type UserRow } from '../src/lib/db';
import { answerWord, expectedAnswers, vocabState } from '../src/lib/vocab';
import { submitReading } from '../src/lib/reading';
import { shopState } from '../src/lib/shop';
import { recheckPending, submitSentence, sentenceState } from '../src/lib/sentences';
import { WORKERS_AI_DAILY_CAP_MAX, sentenceJudge, workersAiCap, type SentenceJudge } from '../src/lib/judge';
import { quizState, submitQuiz } from '../src/lib/quiz';
import { lockSweep } from '../src/lib/lock';
import { detectBypasses, detectSwitchedOff, BYPASS_PENALTY_MIN } from '../src/lib/bypass';
import { acceptVoice, startWriting, submitWriting } from '../src/lib/tasks';
import { achievementsView, pay, taskStreak } from '../src/lib/wallet';
import { issueToken } from '../src/lib/session';
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

describe('Shortcuts gate: the clock is on the server', () => {
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

  it('closing early charges the real time', async () => {
    await setBalance(5);
    await call('?app=any&e=open');
    await call('?app=any&e=close', 2 * 60);
    expect(await repo.balance(user.id)).toBeCloseTo(3, 1);
  });

  it('no close event: the app counts as open until the minutes run out — the whole balance, never a debt', async () => {
    await setBalance(2);
    await call('?app=any&e=open');
    // five minutes later the Shortcut never said "closed": the server clock ended the session at 2 min
    expect(await call('?e=status', 5 * 60)).toBe('BLOCK 0');
    const s = await repo.lastSession(user.id);
    expect(s?.closed_by).toBe('expired');
    expect(s?.minutes).toBeCloseTo(2, 1);
    expect(await repo.balance(user.id)).toBeCloseTo(0, 1);
    expect(await call('?app=any&e=open', 5 * 60 + 10)).toBe('BLOCK 0');
  });

  it('opening another gated app during a session continues the same session', async () => {
    await setBalance(10);
    await call('?app=any&e=open');
    expect(await call('?app=any&e=open', 60)).toMatch(/^ALLOW (8 539|9 540)$/);
    expect((await db.prepare('SELECT COUNT(*) AS n FROM wallet_sessions').first<{ n: number }>())?.n).toBe(1);
  });

  it('status is read-only', async () => {
    await setBalance(3);
    expect(await call('?e=status')).toBe('ALLOW 3 180');
    expect(await repo.openSession(user.id)).toBeNull();
  });
});

// ---------- Reading parts ----------

function answersFor(taskId: string, right: number) {
  return findReadingPart(taskId)!.questions.map((q, i) => (i < right ? q.answer : 'zzz'));
}
const read = (id: string, right: number, seconds = 400, day = today) => submitReading(repo, user, day, { task_id: id, seconds, answers: answersFor(id, right) });
const tfng = readingTaskId('rt-01', 'tfng');

describe('Reading parts in the shop', () => {
  it('pays price × share right, once; the answers are shown after a pass', async () => {
    const r = await read(tfng, 4);
    expect(r).toMatchObject({ correct: 4, total: 5, passed: true, fast: false });
    expect(r.payout.minutes).toBe(Math.round(findReadingPart(tfng)!.price * 0.8));
    expect(r.wrong[0].answer).toBe(findReadingPart(tfng)!.questions[4].answer);
    await expect(read(tfng, 5)).rejects.toThrow(/already done/);
    const shop = await shopState(repo, user, today);
    expect(shop.tasks.find((t) => t.id === tfng)).toMatchObject({ status: 'done', earned: r.payout.minutes });
  });

  it('under 50%: no minutes, which answers were wrong and a paragraph hint, a retry tomorrow', async () => {
    const r = await read(tfng, 2);
    expect(r.payout.minutes).toBe(0);
    expect(r.passed).toBe(false);
    expect(r.wrong).toHaveLength(3);
    expect(r.wrong.every((w) => w.answer === null && w.explain === null)).toBe(true);
    expect(r.wrong.some((w) => w.hint)).toBe(true);
    await expect(read(tfng, 5)).rejects.toThrow(/tomorrow/);
    expect((await shopState(repo, user, today)).tasks.find((t) => t.id === tfng)?.status).toBe('wait');
    const tomorrow = addDays(today, 1);
    expect((await shopState(repo, user, tomorrow)).tasks.find((t) => t.id === tfng)?.status).toBe('retry');
    expect((await read(tfng, 5, 400, tomorrow)).payout.minutes).toBe(findReadingPart(tfng)!.price);
  });

  it('too fast is a guess: nothing paid', async () => {
    const r = await read(tfng, 5, 20);
    expect(r).toMatchObject({ fast: true, passed: false });
    expect(r.payout.minutes).toBe(0);
  });

  it('parts and the whole passage exclude each other; a finished passage makes room for the next', async () => {
    await read(tfng, 5);
    await expect(read(readingTaskId('rt-01', 'all'), 13)).rejects.toThrow(/another way/);
    await read(readingTaskId('rt-01', 'mcq'), 4);
    await read(readingTaskId('rt-01', 'gap'), 4);
    const ids = (await shopState(repo, user, addDays(today, 1))).tasks.filter((t) => t.kind === 'reading').map((t) => t.id);
    expect(ids.some((id) => id.startsWith('r:rt-01:'))).toBe(false);
    expect(ids).toEqual(expect.arrayContaining([readingTaskId('rt-02', 'tfng'), readingTaskId('rt-02', 'all'), readingTaskId('boss-1', 'gap')]));
    expect(ids.some((id) => id.startsWith('r:rt-03:'))).toBe(false);
  });

  it('the daily limit caps the pay and closes the shop for today', async () => {
    await repo.updateUser(user.id, { sm_daily_cap: 10 });
    await reload();
    const r = await read(readingTaskId('rt-01', 'all'), 13, 900);
    expect(r.payout).toMatchObject({ minutes: 10, capped: true });
    const shop = await shopState(repo, user, today);
    expect(shop.earn_left).toBe(0);
    expect(shop.tasks.filter((t) => t.status === 'open')).toEqual([]);
    expect(shop.tasks.find((t) => t.id === 'sentence')?.status).toBe('cap');
  });
});

// ---------- words ----------

describe('typed word review', () => {
  it('asks without revealing the word; pays 0.5 min only for a right answer without a hint, once a day', async () => {
    await learnWords(3);
    const st = await vocabState(repo, user, today);
    expect(st.queue).toHaveLength(3);
    for (const q of st.queue) expect(JSON.stringify(q)).not.toContain(`"${VOCAB[q.word_id - 1].word}"`);

    const right = expectedAnswers((await repo.vocabGet(user.id, 1))!, today)!.shown;
    const ok = await answerWord(repo, user, 1, right.toUpperCase(), false, today);
    expect(ok).toMatchObject({ ok: true, payout: { minutes: 0.5 } });
    expect(await answerWord(repo, user, 1, right, false, today)).toBe('already');

    const bad = await answerWord(repo, user, 2, 'nonsense', false, today);
    expect(bad).toMatchObject({ ok: false, payout: { minutes: 0 } });

    const hinted = await answerWord(repo, user, 3, expectedAnswers((await repo.vocabGet(user.id, 3))!, today)!.shown, true, today);
    expect(hinted).toMatchObject({ ok: true, payout: { minutes: 0 } });
  });

  it('accepts another form of the word', async () => {
    await learnWords(1);
    const form = wordForms(VOCAB[0].word).find((f) => f !== VOCAB[0].word)!;
    expect(await answerWord(repo, user, 1, form, false, today)).toMatchObject({ ok: true });
  });

  it('new words are not asked on the day they are introduced', async () => {
    await learnWords(1, today);
    expect(await answerWord(repo, user, 1, VOCAB[0].word, false, today)).toBe('new_today');
    expect((await shopState(repo, user, today)).tasks.find((t) => t.id === 'words')?.status).toBe('empty');
  });

  it('at most 10 paid words a day', async () => {
    await learnWords(12);
    for (let id = 1; id <= 12; id++) await answerWord(repo, user, id, expectedAnswers((await repo.vocabGet(user.id, id))!, today)!.shown, false, today);
    expect((await repo.earnedByKind(user.id, today)).words).toBe(5);
    expect((await shopState(repo, user, today)).tasks.find((t) => t.id === 'words')?.status).toBe('done');
  });
});

// ---------- sentences, Writing, Speaking ----------

describe('a sentence with a word', () => {
  const verdict = (o: Partial<JudgeVerdict> = {}): JudgeVerdict => ({ ok: true, grammar: 2, meaning: 2, uses_word_correctly: true, reason_ru: 'Хорошо.', ...o });
  const fixed = (v: JudgeVerdict | 'unavailable'): SentenceJudge => ({ kind: 'http', judge: async () => v });
  const good = (word: string) => `In my city the council hopes to ${word} the problem of traffic near the old market square.`;

  it('without a model: the rules only, kept as practice, no minutes', async () => {
    const st = await sentenceState(repo, user, today, 'none');
    expect(st.pay).toBe(0);
    const r = await submitSentence(repo, user, today, st.next!.id, good(st.next!.word), null);
    expect(r).toMatchObject({ ok: true, status: 'practice', payout: null });
    expect(await repo.balance(user.id)).toBe(0);
    expect((await submitSentence(repo, user, today, st.next!.id, good(st.next!.word), null)).blocked).toBe('done_today');
  });

  it('rules first: seven unrelated bank words, a word list, the example, a repeat — none reach the model', async () => {
    let asked = 0;
    const judge: SentenceJudge = { kind: 'http', judge: async () => (asked++, verdict()) };
    const w = VOCAB[0]; // alleviate
    const seven = await submitSentence(repo, user, today, w.id, 'Alleviate ubiquitous detrimental mitigate scrutiny exacerbate prevalent.', judge);
    expect(seven.ok).toBe(false);
    expect(seven.check?.criteria.filter((c) => !c.ok).map((c) => c.id)).toContain('bank_share');
    const list = await submitSentence(repo, user, today, w.id, 'alleviate, traffic, city, cars, pain, stress, noise', judge);
    expect(list.check?.criteria.filter((c) => !c.ok).map((c) => c.id)).toContain('list');
    const copy = await submitSentence(repo, user, today, w.id, w.example, judge);
    expect(copy.check?.criteria.filter((c) => !c.ok).map((c) => c.id)).toContain('copy');
    expect(asked).toBe(0);
    // an accepted sentence, then the same sentence for the next word with the word swapped: a repeat
    const first = await submitSentence(repo, user, today, w.id, good(w.word), judge);
    expect(first.ok).toBe(true);
    const next = VOCAB[3]; // mitigate
    const again = await submitSentence(repo, user, today, next.id, good(next.word), judge);
    expect(again.check?.criteria.filter((c) => !c.ok).map((c) => c.id)).toContain('repeat');
    expect(asked).toBe(1);
  });

  it('the model decides the meaning: a senseless sentence is not paid and the reason is shown in Russian', async () => {
    const w = VOCAB[3];
    const bad = await submitSentence(repo, user, today, w.id, 'The purple mitigate was sleeping loudly under my Tuesday homework.', fixed(verdict({ ok: false, meaning: 0, uses_word_correctly: false, reason_ru: 'Бессмыслица: mitigate — глагол «смягчать».' })));
    expect(bad.ok).toBe(false);
    expect(bad.verdict?.reason_ru).toContain('смягчать');
    expect(bad.check?.criteria.find((c) => c.id === 'meaning_ai')).toMatchObject({ ok: false });
    // the model's own "ok" is not enough: the word has to be used right
    const wrongUse = await submitSentence(repo, user, today, w.id, good(w.word), fixed(verdict({ uses_word_correctly: false })));
    expect(wrongUse.ok).toBe(false);
    const ok = await submitSentence(repo, user, today, w.id, good(w.word), fixed(verdict()));
    expect(ok).toMatchObject({ ok: true, status: 'accepted' });
    expect(ok.payout?.minutes).toBe(1);
  });

  it('model unavailable: nothing paid now (fail closed), the sentence waits and is paid after the recheck', async () => {
    const w = VOCAB[3];
    const r = await submitSentence(repo, user, today, w.id, good(w.word), fixed('unavailable'));
    expect(r).toMatchObject({ ok: false, status: 'pending', payout: null });
    expect(await repo.balance(user.id)).toBe(0);
    // the recheck with a model that is back
    const env = { ...fakeEnv(db), SENTENCE_JUDGE: 'http', SENTENCE_JUDGE_URL: 'https://judge.test/v1/chat/completions' };
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(verdict()) } }] })));
    try {
      expect(await recheckPending(env)).toMatchObject({ accepted: 1 });
    } finally {
      vi.unstubAllGlobals();
    }
    expect((await repo.earnedByKind(user.id, today)).sentence).toBe(1);
    expect((await sentenceState(repo, user, today, 'http')).recent[0]).toMatchObject({ status: 'accepted' });
  });

  it('Workers AI stops at its daily ceiling: no call, no cost, the sentence waits', async () => {
    let calls = 0;
    const env = { ...fakeEnv(db), SENTENCE_JUDGE: 'workers-ai', WORKERS_AI_DAILY_CAP: '2', AI: { run: async () => (calls++, { response: verdict() }) } };
    const judge = sentenceJudge(env, repo)!;
    expect(judge.kind).toBe('workers-ai');
    const w = VOCAB[3];
    expect(await judge.judge({ word: w.word, meaning: w.meaning, text: good(w.word) })).toMatchObject({ ok: true });
    expect(await judge.judge({ word: w.word, meaning: w.meaning, text: good(w.word) })).toMatchObject({ ok: true });
    expect(await judge.judge({ word: w.word, meaning: w.meaning, text: good(w.word) })).toBe('unavailable');
    expect(calls).toBe(2);
    // the ceiling never goes above the safe maximum, whatever the setting says
    expect(workersAiCap({ ...env, WORKERS_AI_DAILY_CAP: '100000' })).toBe(WORKERS_AI_DAILY_CAP_MAX);
    // not configured → no judge at all
    expect(sentenceJudge(fakeEnv(db), repo)).toBeNull();
  });
});

describe('«Быстрый тест»', () => {
  const rightAnswers = async (id: number) => {
    const row = await repo.quizSet(user.id, id);
    return (JSON.parse(row!.questions) as { word_id: number; options: number[] }[]).map((q) => q.options.indexOf(q.word_id));
  };
  const ago = (id: number, sec: number) => db.prepare(`UPDATE quiz_sets SET started_at = strftime('%Y-%m-%dT%H:%M:%fZ','now','-${sec} seconds') WHERE id = ?`).bind(id).run();

  it('five choice questions without the key; 4+ right pays, too fast pays nothing, a set is answered once', async () => {
    const st = await quizState(repo, user, today);
    expect(st.set?.questions).toHaveLength(QUIZ_SIZE);
    for (const q of st.set!.questions) {
      expect(q.options).toHaveLength(4);
      expect(JSON.stringify(q)).not.toMatch(/word_id|answer/);
    }
    const id = st.set!.id;
    const fast = await submitQuiz(repo, user, today, id, await rightAnswers(id));
    expect(fast).toMatchObject({ correct: QUIZ_SIZE, fast: true });
    expect(await repo.balance(user.id)).toBe(0);
    expect(await submitQuiz(repo, user, today, id, [])).toBe('already');

    const next = (fast as QuizResult).state.set!;
    await ago(next.id, 60);
    const answers = await rightAnswers(next.id);
    answers[0] = (answers[0] + 1) % 4; // one wrong: 4 of 5 still passes
    const r = await submitQuiz(repo, user, today, next.id, answers);
    expect(r).toMatchObject({ correct: QUIZ_SIZE - 1, passed: true, fast: false });
    expect((r as QuizResult).payout.minutes).toBe(QUIZ_PAY);

    const third = (r as QuizResult).state.set!;
    await ago(third.id, 60);
    const miss = (await rightAnswers(third.id)).map((x) => (x + 1) % 4);
    expect(await submitQuiz(repo, user, today, third.id, miss)).toMatchObject({ correct: 0, passed: false });
    expect((await repo.earnedByKind(user.id, today)).quiz).toBe(QUIZ_PAY);
  });

  it('is in the shop and among the vocabulary suggestions', async () => {
    const shop = await shopState(repo, user, today);
    expect(shop.tasks.find((t) => t.id === 'quiz')).toMatchObject({ status: 'open', price: QUIZ_PAY });
    expect(shop.tasks.find((t) => t.id === 'sentence')?.price).toBe(0);
  });
});

const ESSAY = (w: string[]) =>
  `Many schools now ban phones, and I think this policy can ${w[0]} the problem of distraction. ` +
  `Teachers report that pupils ${w[1]} more of each lesson when screens are away, because attention is not split. ` +
  `However, a total ban may ${w[2]} learning in some cases, since phones are also useful tools for research and for contacting parents. ` +
  'For example, a sensible rule would allow phones in the bag but not on the desk, so that pupils learn self-control instead of simply obeying. ' +
  'Moreover, clear rules help younger pupils, who often find it hard to stop checking messages during quiet reading or long tests at the end of the week. ' +
  'In my own school the change took about a month to settle, and afterwards most students agreed that break times felt more social and lessons more focused. ' +
  'In conclusion, the advantages of limiting phones outweigh the disadvantages, provided teachers explain the reasons and parents support the idea at home.';

describe('Writing by the rubric', () => {
  it('needs Start, checks every criterion on the server, pays once a day per size', async () => {
    await learnWords(40, addDays(today, -3));
    const text = ESSAY(['mitigate', 'retain', 'hinder']);
    expect((await submitWriting(repo, user, today, 'long', text)).blocked).toBe('not_started');
    await startWriting(repo, user, today, 'long', false);
    const early = await submitWriting(repo, user, today, 'long', text);
    expect(early.criteria.filter((c) => !c.ok).map((c) => c.id)).toEqual(['time']);
    await db.prepare("UPDATE practice_tasks SET started_at = strftime('%Y-%m-%dT%H:%M:%fZ','now','-15 minutes') WHERE user_id = ?").bind(user.id).run();
    const noVocab = await submitWriting(repo, user, today, 'long', ESSAY(['reduce', 'keep', 'slow']));
    expect(noVocab.criteria.filter((c) => !c.ok).map((c) => c.id)).toEqual(['vocab']);
    const ok = await submitWriting(repo, user, today, 'long', text);
    expect(ok.ok).toBe(true);
    expect(ok.payout?.minutes).toBe(WRITING_TASKS.long.price);
    expect(ok.state.done?.paid).toBe(WRITING_TASKS.long.price);
    expect((await submitWriting(repo, user, today, 'long', text)).blocked).toBe('done_today');
    // the short task is separate and still open
    expect((await shopState(repo, user, today)).tasks.find((t) => t.id === 'writing:short')?.status).toBe('open');
  });
});

describe('Speaking by voice message', () => {
  const voice = (seconds: number, id: string, forwarded = false) => acceptVoice(repo, user, today, { seconds, fileUniqueId: id, forwarded });
  it('a long voice counts for the long task, a shorter one for the short task; rejects are explained', async () => {
    expect(await voice(20, 'a')).toMatchObject({ status: 'rejected', size: 'short' });
    expect(await voice(120, 'b', true)).toMatchObject({ status: 'rejected' });
    const long = await voice(120, 'c');
    expect(long).toMatchObject({ status: 'ok', size: 'long', payout: { minutes: SPEAKING_TASKS.long.price } });
    const dup = await voice(120, 'c');
    expect(dup.status).toBe('rejected');
    if (dup.status === 'rejected') expect(dup.check.criteria.find((c) => c.id === 'new_voice')?.ok).toBe(false);
    expect(await voice(60, 'd')).toMatchObject({ status: 'ok', size: 'short', payout: { minutes: SPEAKING_TASKS.short.price } });
    expect(await voice(70, 'e')).toMatchObject({ status: 'limit' });
    const entry = await db.prepare('SELECT skills FROM entries WHERE user_id = ? AND date = ?').bind(user.id, today).first<{ skills: string }>();
    expect(JSON.parse(entry!.skills)).toContain('speaking');
  });
});

// ---------- achievements, the shop's top three, reset ----------

describe('achievements', () => {
  it('progress comes from real work; reaching a target pays the bonus once', async () => {
    const r = await read(tfng, 5);
    expect(r.payout.achievements).toEqual(['first']);
    const { list } = await achievementsView(repo, user);
    expect(list.find((a) => a.id === 'first')).toMatchObject({ progress: 1, earned_on: today });
    expect(list.find((a) => a.id === 'reading10')).toMatchObject({ progress: 1, target: 10, earned_on: null });
    expect((await repo.ledger(user.id)).filter((l) => l.reason === 'achievement')).toHaveLength(1);
    await read(readingTaskId('rt-01', 'mcq'), 4);
    const third = await read(readingTaskId('rt-01', 'gap'), 4);
    expect(third.payout.achievements).toContain('passage');
  });
});

describe('the shop', () => {
  it('suggests three tasks of different kinds, each with time, price and level', async () => {
    const shop = await shopState(repo, user, today);
    expect(shop.top).toHaveLength(3);
    const top = shop.top.map((id) => shop.tasks.find((t) => t.id === id)!);
    expect(new Set(top.map((t) => (t.kind === 'reading' ? 'r' : t.kind === 'words' || t.kind === 'quiz' || t.kind === 'sentence' ? 'v' : 'o'))).size).toBe(3);
    expect(top.every((t) => t.minutes <= 10)).toBe(true);
    for (const t of shop.tasks) {
      expect(t.minutes).toBeGreaterThan(0);
      expect([1, 2, 3]).toContain(t.level);
    }
  });
});

describe('«Начать заново»', () => {
  const env = () => fakeEnv(db);
  const api = async (method: string, path: string, body?: unknown) => {
    const token = await issueToken(user.tg_id, 's');
    const req = new Request(`https://app.test/api${path}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return handleApi(req, env(), new URL(req.url));
  };

  it('needs the word; wipes minutes, attempts, words and achievements; keeps the gate key, NextDNS and the language', async () => {
    await learnWords(3);
    await read(tfng, 5);
    await repo.updateUser(user.id, { lang: 'ru', nextdns_key: 'k'.repeat(20), nextdns_profile: 'abc123', lock_state: 'locked', onboarded: 1 });
    await reload();
    const key = user.sm_api_key;
    await expect(api('POST', '/reset', { word: 'nope' })).rejects.toThrow(/Type the word/);
    const res = await api('POST', '/reset', { word: 'заново' });
    expect((await res.json()) as { onboarded: boolean; lang: string }).toMatchObject({ onboarded: false, lang: 'ru' });
    await reload();
    expect(user).toMatchObject({ sm_balance: 0, sm_api_key: key, nextdns_profile: 'abc123', lock_state: 'locked', lang: 'ru' });
    expect(await repo.readingAttempts(user.id)).toEqual([]);
    expect(await repo.vocabAll(user.id)).toEqual([]);
    expect(await repo.ledger(user.id)).toEqual([]);
    expect(await repo.achievementRows(user.id)).toEqual([]);
    // the part can be done again
    expect((await read(tfng, 5)).payout.minutes).toBeGreaterThan(0);
  });

  it('a Reading part comes without the answers (the id may be URL-encoded)', async () => {
    const res = await api('GET', `/reading/${encodeURIComponent(tfng)}`);
    const body = (await res.json()) as { questions: Record<string, unknown>[]; paragraphs: string[] };
    expect(body.questions).toHaveLength(5);
    expect(body.paragraphs.length).toBeGreaterThan(3);
    expect(JSON.stringify(body.questions)).not.toMatch(/"answer"|"explain"/);
  });

  it('the guide can be marked as seen', async () => {
    await api('POST', '/onboarded', { done: true });
    await reload();
    expect(user.onboarded).toBe(1);
  });
});

describe('the morning message points to concrete tasks', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('three tasks with buttons that open them in the app', async () => {
    const sent: { text: string; reply_markup?: { inline_keyboard: { text: string; web_app?: { url: string } }[][] } }[] = [];
    vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
      sent.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ ok: true, result: {} }));
    });
    await repo.updateUser(user.id, { morning_time: timeInTz('UTC') });
    await runCron(fakeEnv(db));
    expect(sent).toHaveLength(1);
    expect(sent[0].text).toContain('Three good tasks for today');
    const urls = sent[0].reply_markup!.inline_keyboard.flat().map((b) => b.web_app?.url);
    expect(urls.filter((u) => u?.includes('?task='))).toHaveLength(3);
    // once a day
    await runCron(fakeEnv(db));
    expect(sent).toHaveLength(1);
  });
});

describe('the optional AI check on Writing', () => {
  afterEach(() => vi.unstubAllGlobals());
  const ready = async () => {
    await learnWords(40, addDays(today, -3));
    await startWriting(repo, user, today, 'long', true);
    await db.prepare("UPDATE practice_tasks SET started_at = strftime('%Y-%m-%dT%H:%M:%fZ','now','-15 minutes') WHERE user_id = ?").bind(user.id).run();
  };
  const reply = (json: object) =>
    new Response(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'text', text: JSON.stringify(json) }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } }), { headers: { 'content-type': 'application/json' } });

  it('an off-topic verdict rejects the text and shows the tips', async () => {
    await ready();
    vi.stubGlobal('fetch', async () => reply({ on_topic: false, band: 5.2, tips: ['Answer the question about phones.'] }));
    const r = await submitWriting(repo, user, today, 'long', ESSAY(['mitigate', 'retain', 'hinder']), 'test-key');
    expect(r.ok).toBe(false);
    expect(r.criteria.find((c) => c.id === 'topic_ai')).toMatchObject({ ok: false });
    expect(r.ai).toMatchObject({ band: 5, tips: ['Answer the question about phones.'] });
  });

  it('if the AI is unreachable, the rubric alone decides', async () => {
    await ready();
    vi.stubGlobal('fetch', async () => {
      throw new Error('network down');
    });
    const r = await submitWriting(repo, user, today, 'long', ESSAY(['mitigate', 'retain', 'hinder']), 'test-key');
    expect(r.ok).toBe(true);
    expect(r.ai).toBeNull();
  });
});

// ---------- the DNS lock on the server clock, and bypasses ----------

/** A fake NextDNS + Telegram: records calls, answers the log with `logs`. */
function fakeNet(logs: { timestamp: string; domain: string; status: string }[] = [], blocked = true) {
  const calls: { method: string; url: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ method: init?.method ?? 'GET', url, body });
    if (url.includes('/logs')) return new Response(JSON.stringify({ data: logs, meta: { pagination: { cursor: null } } }));
    if (url.includes('api.telegram.org')) return new Response(JSON.stringify({ ok: true, result: {} }));
    if (/\/profiles\/[a-z0-9]+$/.test(url)) {
      const services = ['instagram', 'tiktok', 'youtube', 'vk'].map((id) => ({ id, active: blocked }));
      return new Response(JSON.stringify({ data: { parentalControl: { services }, denylist: [], settings: { logs: { enabled: true } } } }));
    }
    return new Response(JSON.stringify({ data: {} }));
  });
  return {
    calls,
    locks: () => calls.filter((c) => c.method === 'PATCH' && c.url.includes('/parentalControl/services/')).map((c) => (c.body as { active: boolean }).active),
    messages: () => calls.filter((c) => c.url.includes('sendMessage')).map((c) => c.body as { chat_id: number; text: string }),
  };
}

describe('the DNS lock follows the server clock', () => {
  afterEach(() => vi.unstubAllGlobals());
  const env = () => fakeEnv(db);
  const at = (sec: number) => new Date(Date.now() + sec * 1000);
  const gate = async (q: string, sec = 0) => {
    const url = new URL(`https://app.test/gate/${user.sm_api_key}${q}`);
    return (await handleGate(new Request(url), env(), url, at(sec))).text();
  };
  beforeEach(async () => {
    await repo.updateUser(user.id, { nextdns_key: 'k'.repeat(20), nextdns_profile: 'abc123', lock_state: 'locked' });
    await reload();
  });

  it('1 minute: the lock opens for it; 61 s later the state is BLOCK and the lock closes by itself (lockNow)', async () => {
    const net = fakeNet();
    await setBalance(1);
    expect(await gate('?app=any&e=open')).toBe('ALLOW 1 60');
    expect(net.locks()).toEqual([false, false, false, false]);
    expect((await repo.getUserById(user.id))?.lock_source).toBe('session');
    // the Shortcut went quiet (no tick, no close): the minute cron alone ends it
    await lockSweep(env(), at(61));
    expect(net.locks().slice(4)).toEqual([true, true, true, true]);
    const u = (await repo.getUserById(user.id))!;
    expect(u.lock_state).toBe('locked');
    expect(await repo.balance(user.id)).toBeCloseTo(0, 5);
    expect((await repo.lastSession(user.id))?.closed_by).toBe('expired');
    expect(await gate('?e=status', 61)).toBe('BLOCK 0');
    expect(await gate('?e=tick', 61)).toBe('BLOCK 0 0');
    expect(await gate('?app=any&e=open', 62)).toBe('BLOCK 0');
    // no second unlock: no minutes
    expect(net.locks()).toHaveLength(8);
  });

  it('any API request also ends a session that ran out', async () => {
    fakeNet();
    await setBalance(1);
    await gate('?app=any&e=open');
    await db.prepare("UPDATE wallet_sessions SET started_at = strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 minutes')").run();
    const token = await issueToken(user.tg_id, 's');
    await handleApi(new Request('https://app.test/api/shop', { headers: { authorization: `Bearer ${token}` } }), env(), new URL('https://app.test/api/shop'));
    expect((await repo.lastSession(user.id))?.closed_by).toBe('expired');
    expect((await repo.getUserById(user.id))?.lock_state).toBe('locked');
  });

  it('closing the app closes the lock at once and charges the real time', async () => {
    const net = fakeNet();
    await setBalance(10);
    await gate('?app=any&e=open');
    await gate('?app=any&e=close', 90);
    expect(net.locks()).toEqual([false, false, false, false, true, true, true, true]);
    expect(await repo.balance(user.id)).toBeCloseTo(8.5, 1);
  });
});

describe('bypasses in the NextDNS log', () => {
  afterEach(() => vi.unstubAllGlobals());
  const env = () => fakeEnv(db);
  const iso = (secAgo: number) => new Date(Date.now() - secAgo * 1000).toISOString();
  beforeEach(async () => {
    await repo.updateUser(user.id, { nextdns_key: 'k'.repeat(20), nextdns_profile: 'abc123', lock_state: 'locked', bypass_checked_at: iso(15 * 60), partner_chat_id: 555, partner_name: 'Ann' });
    await reload();
  });

  it('social media resolved with no minutes and no session: penalty debt, streak reset, a line in Progress, messages', async () => {
    const net = fakeNet([
      { timestamp: iso(8 * 60), domain: 'i.instagram.com', status: 'default' },
      { timestamp: iso(5 * 60), domain: 'scontent.cdninstagram.com', status: 'default' },
      { timestamp: iso(4 * 60), domain: 'www.tiktok.com', status: 'blocked' }, // the lock working, not a bypass
      { timestamp: iso(3 * 60), domain: 'example.com', status: 'default' },
    ]);
    await pay(repo, user, yesterday, 'words', 1, 'x'); // a streak to lose
    await pay(repo, user, today, 'words', 1, 'y');
    expect((await taskStreak(repo, user, today)).current).toBe(2);
    expect(await detectBypasses(env(), repo, user)).toBe(1);
    await reload();
    expect(await repo.balance(user.id)).toBeCloseTo(2 - (BYPASS_PENALTY_MIN + 3), 1);
    expect((await taskStreak(repo, user, today)).current).toBe(0);
    const list = await repo.bypassList(user.id);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ app: 'instagram', minutes: 3, penalty: BYPASS_PENALTY_MIN + 3 });
    expect(net.messages().map((m) => m.chat_id)).toEqual([user.tg_id, 555]);
    // read again: the same visit is not counted twice
    await repo.updateUser(user.id, { bypass_checked_at: iso(15 * 60) });
    await reload();
    expect(await detectBypasses(env(), repo, user)).toBe(0);
    // a blocked open of the app sends no message (only bypasses do)
    expect(net.messages()).toHaveLength(2);
  });

  it('use inside a paid session is not a bypass', async () => {
    fakeNet([{ timestamp: iso(60), domain: 'i.instagram.com', status: 'default' }]);
    await setBalance(10);
    const url = new URL(`https://app.test/gate/${user.sm_api_key}?app=any&e=open`);
    await handleGate(new Request(url), env(), url, new Date(Date.now() - 120_000));
    await db.prepare("UPDATE wallet_sessions SET started_at = strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 minutes')").run();
    await reload();
    expect(await detectBypasses(env(), repo, user)).toBe(0);
  });

  it('our own failure to close the lock is not punished', async () => {
    fakeNet([{ timestamp: iso(5 * 60), domain: 'i.instagram.com', status: 'default' }]);
    await repo.updateUser(user.id, { lock_error: 'NextDNS error 500' });
    await reload();
    expect(await detectBypasses(env(), repo, user)).toBe(0);
    expect(await repo.balance(user.id)).toBe(0);
  });

  it('the Shortcut silent for a day while NextDNS sees the apps: the banner, until the Shortcut calls again', async () => {
    fakeNet([{ timestamp: iso(3600), domain: 'i.instagram.com', status: 'blocked' }]);
    await repo.updateUser(user.id, { gate_seen_at: iso(25 * 3600) });
    await reload();
    expect(await detectSwitchedOff(repo, user, new Date(), env())).toBe(true);
    await reload();
    expect((await shopState(repo, user, today)).lock_alert).not.toBeNull();
    const url = new URL(`https://app.test/gate/${user.sm_api_key}?e=status`);
    await handleGate(new Request(url), env(), url);
    await reload();
    expect((await shopState(repo, user, today)).lock_alert).toBeNull();
  });
});

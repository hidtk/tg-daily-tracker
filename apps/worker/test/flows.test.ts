/**
 * End-to-end checks on a real SQLite database with all migrations: the Shortcuts timer, the task shop and its
 * payments, typed words, Reading parts, sentences, Writing and Speaking by the rubric, achievements and «Начать заново».
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SPEAKING_TASKS, VOCAB, WRITING_TASKS, addDays, findReadingPart, readingTaskId, timeInTz, todayInTz, wordForms } from '@tracker/shared';
import { runCron } from '../src/bot/cron';
import { handleGate } from '../src/api/gate';
import { handleApi } from '../src/api/routes';
import { Repo, type UserRow } from '../src/lib/db';
import { answerWord, expectedAnswers, vocabState } from '../src/lib/vocab';
import { submitReading } from '../src/lib/reading';
import { shopState } from '../src/lib/shop';
import { submitSentence, sentenceState } from '../src/lib/sentences';
import { acceptVoice, startWriting, submitWriting } from '../src/lib/tasks';
import { achievementsView } from '../src/lib/wallet';
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
    expect(ids).toEqual(expect.arrayContaining([readingTaskId('rt-02', 'tfng'), readingTaskId('rt-03', 'all'), readingTaskId('boss-1', 'gap')]));
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
  it('rubric first; an accepted sentence pays 1 min, the same word not twice a day', async () => {
    const st = await sentenceState(repo, user, today);
    const w = st.next!;
    const bad = await submitSentence(repo, user, today, w.id, 'Too short.');
    expect(bad.ok).toBe(false);
    expect(bad.check?.criteria.filter((c) => !c.ok).map((c) => c.id)).toEqual(expect.arrayContaining(['length']));
    const text = `In my city the council decided to use the word ${w.word} in every report about transport and housing.`;
    const ok = await submitSentence(repo, user, today, w.id, text);
    expect(ok.ok).toBe(true);
    expect(ok.payout?.minutes).toBe(1);
    expect((await submitSentence(repo, user, today, w.id, text)).blocked).toBe('done_today');
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
    expect(new Set(top.map((t) => (t.kind === 'reading' ? 'r' : t.kind === 'words' || t.kind === 'sentence' ? 'v' : 'o'))).size).toBe(3);
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

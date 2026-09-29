import { useEffect, useRef, useState } from 'react';
import type { ReadingResult, ReadingTask as Task } from '@tracker/shared';
import { api, ApiError } from '../../api';
import { haptic } from '../../tg';
import { useT } from '../../i18n';
import { useToast } from '../Toast';
import { Section, Sheet, confirmDialog } from '../ui';
import { Mascot } from '../Mascot';
import { useReward } from '../Reward';

const TFNG_OPTIONS = ['TRUE', 'FALSE', 'NOT GIVEN'];
const MCQ_LETTERS = ['A', 'B', 'C', 'D'];

function clock(sec: number): string {
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}

/** A Reading part: the passage, only this part's questions, a timer; checked on the server by the key. */
export function ReadingTask({ id, onClose, onDone }: { id: string; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const toast = useToast();
  const reward = useReward();
  const [task, setTask] = useState<Task | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [sec, setSec] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReadingResult | null>(null);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    api
      .reading(id)
      .then((x) => {
        setTask(x);
        setAnswers(x.questions.map(() => ''));
        startedAt.current = Date.now();
      })
      .catch((e: unknown) => {
        toast(e instanceof ApiError ? t(e.message) : t('Could not load'));
        onClose();
      });
  }, [id]);

  useEffect(() => {
    if (result || !task) return;
    const timer = setInterval(() => setSec(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [result, task]);

  if (!task) return <Sheet title="Reading" onClose={onClose}><span className="spinner" /></Sheet>;

  const answered = answers.filter(Boolean).length;
  const set = (i: number, v: string) => setAnswers((a) => a.map((x, j) => (j === i ? v : x)));

  const submit = async () => {
    if (busy) return;
    if (sec < task.min_seconds && !(await confirmDialog(t('Less than {m} min: this is counted as a guess and pays nothing. Send anyway?', { m: Math.ceil(task.min_seconds / 60) })))) return;
    setBusy(true);
    try {
      const r = await api.submitReading({ task_id: task.id, seconds: sec, answers });
      setResult(r);
      if (r.passed) haptic.success();
      else haptic.warning();
      reward(r.payout);
      onDone();
    } catch (e) {
      haptic.warning();
      toast(e instanceof ApiError ? t(e.message) : t('Error'));
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    const mood = result.passed ? 'cheer' : 'think';
    const line = result.fast
      ? t('Too fast: under {m} min is a guess, so no minutes. A retry opens tomorrow.', { m: Math.ceil(task.min_seconds / 60) })
      : !result.passed
        ? t('Less than half is right — no minutes this time. Look at the hints below; a retry opens tomorrow.')
        : result.correct === result.total
          ? t('Every answer is right!')
          : t('Passed. Minutes are paid for the share of right answers.');
    return (
      <Sheet title={t('Result')} onClose={onClose}>
        <div className="center">
          <div className="el-mascot center"><Mascot size={90} mood={mood} message={line} /></div>
          <div className="result-band">{result.correct}<span className="muted" style={{ fontSize: 28 }}> / {result.total}</span></div>
          <div className="muted small">{t('right answers')} · {clock(sec)}</div>
          <div className={`result-earn${result.payout.minutes ? '' : ' zero'}`} style={{ marginTop: 10 }}>{result.payout.minutes ? t('+{n} min of social media', { n: result.payout.minutes }) : t('no minutes')}</div>
          {result.passed && result.payout.minutes < Math.round((result.price * result.correct) / result.total) && <div className="hint">{t('Today’s limit of minutes cut the payment.')}</div>}
          <div className="hint">{t('How it is paid: {p} min × share of right answers; under half right — nothing.', { p: result.price })}</div>
        </div>
        {result.wrong.length > 0 && (
          <Section label={t('Mistakes')}>
            {result.wrong.map((x) => (
              <div key={x.n} className="wrong">
                <b>{x.n}.</b> {t('yours')}: <i>{x.given || '—'}</i>
                {x.answer ? (
                  <>
                    {' '}· {t('correct')}: <b>{x.answer}</b>
                    <div className="muted small">{x.explain}</div>
                  </>
                ) : (
                  <div className="muted small">{x.hint ? t('Look again at paragraph {p}.', { p: x.hint }) : t('Read the whole text again.')}</div>
                )}
              </div>
            ))}
            {!result.passed && <div className="hint">{t('The right answers are shown once the task is passed — so the retry is real practice.')}</div>}
          </Section>
        )}
        <button className="btn solid block" onClick={onClose}>{t('Back to the Shop')}</button>
      </Sheet>
    );
  }

  return (
    <Sheet title={task.title} onClose={onClose}>
      <div className="timer">{clock(sec)} · {t('about {m} min', { m: task.minutes })} · {t('answered {a} of {b}', { a: answered, b: task.questions.length })}</div>
      <div className="passage">{task.paragraphs.map((p, i) => <p key={i}>{p}</p>)}</div>
      <div className="label" style={{ marginTop: 8 }}>{t('Questions')}</div>
      {task.questions.map((q, i) => (
        <div key={q.n} className="q">
          <div className="q-prompt"><b>{q.n}.</b> {q.prompt}</div>
          {q.type === 'tfng' && (
            <div className="chips">
              {TFNG_OPTIONS.map((o) => <button key={o} className={`chip ${answers[i] === o ? 'on' : ''}`} onClick={() => { haptic.select(); set(i, o); }}>{o}</button>)}
            </div>
          )}
          {q.type === 'mcq' && (
            <div className="opts">
              {(q.options ?? []).map((o, k) => (
                <button key={k} className={`opt${answers[i] === MCQ_LETTERS[k] ? ' on' : ''}`} onClick={() => { haptic.select(); set(i, MCQ_LETTERS[k]); }}><b>{MCQ_LETTERS[k]}</b>{o}</button>
              ))}
            </div>
          )}
          {q.type === 'gap' && <input placeholder={t('one or two words from the text')} value={answers[i]} autoCapitalize="off" autoCorrect="off" onChange={(e) => set(i, e.target.value)} />}
        </div>
      ))}
      <button className="btn solid block" style={{ marginTop: 16 }} disabled={busy || !answered} onClick={() => void submit()}>{busy ? t('Checking…') : t('Check the answers ({a}/{b})', { a: answered, b: task.questions.length })}</button>
      <div className="hint">{t('Checked by the answer key. Case, “a/the”, spaces and British or American spelling do not matter; spelling does, like in the exam.')}</div>
    </Sheet>
  );
}

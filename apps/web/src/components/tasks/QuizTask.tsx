import { useEffect, useState } from 'react';
import type { QuizResult, QuizState } from '@tracker/shared';
import { api, ApiError } from '../../api';
import { haptic } from '../../tg';
import { useT } from '../../i18n';
import { useToast } from '../Toast';
import { Sheet } from '../ui';
import { Icon, Mascot } from '../Mascot';
import { useReward } from '../Reward';

/** «Быстрый тест»: five choice questions, one at a time; checked by the key on the server. */
export function QuizTask({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const t = useT();
  const toast = useToast();
  const reward = useReward();
  const [st, setSt] = useState<QuizState | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [res, setRes] = useState<QuizResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.quiz().then(setSt).catch((e: unknown) => toast(e instanceof ApiError ? t(e.message) : t('Could not load')));
  }, []);

  if (!st) return <Sheet title={t('Quick test')} onClose={onClose}><span className="spinner" /></Sheet>;

  const set = res ? null : st.set;
  const i = answers.length;

  const choose = async (k: number) => {
    if (!set || busy) return;
    haptic.select();
    const next = [...answers, k];
    setAnswers(next);
    if (next.length < set.questions.length) return;
    setBusy(true);
    try {
      const r = await api.submitQuiz(set.id, next);
      setRes(r);
      if (r.payout.minutes > 0) {
        haptic.success();
        reward(r.payout);
        onDone();
      } else haptic.warning();
    } catch (e) {
      toast(e instanceof ApiError ? t(e.message) : t('Error'));
    } finally {
      setBusy(false);
    }
  };

  const again = () => {
    if (!res) return;
    setSt(res.state);
    setRes(null);
    setAnswers([]);
  };

  return (
    <Sheet title={t('Quick test')} onClose={onClose}>
      <div className="muted small" style={{ marginBottom: 10 }}>
        {t('Test {a} of {b} today · {p}+ right of {n} pays {m} min', { a: Math.min(st.per_day, st.done_today + 1), b: st.per_day, p: st.pass, n: st.set?.questions.length ?? 5, m: st.pay })}
      </div>

      {set && i < set.questions.length && (
        <>
          <div className="quiz-step">{t('Question {a} of {b}', { a: i + 1, b: set.questions.length })}</div>
          {set.questions[i].kind === 'cloze' ? (
            <>
              <div className="quiz-ask">{t('Which word fits the gap (in any form)?')}</div>
              <div className="quiz-prompt">{set.questions[i].prompt}</div>
            </>
          ) : (
            <>
              <div className="quiz-ask">{t('What does it mean?')}</div>
              <div className="quiz-prompt word">{set.questions[i].prompt}</div>
            </>
          )}
          <div className="quiz-opts">
            {set.questions[i].options.map((o, k) => (
              <button key={k} className="btn quiz-opt" disabled={busy} onClick={() => void choose(k)}>{o}</button>
            ))}
          </div>
        </>
      )}

      {res && st.set && (
        <>
          <Mascot size={64} mood={res.payout.minutes > 0 ? 'cheer' : 'wait'} message={
            res.fast
              ? t('{a} of {b} right, but too fast to read the questions — no minutes. Take a moment for each one.', { a: res.correct, b: res.total })
              : res.passed
                ? t('{a} of {b} right: +{m} min.', { a: res.correct, b: res.total, m: res.payout.minutes })
                : t('{a} of {b} right — {p} are needed for minutes. The right answers are below.', { a: res.correct, b: res.total, p: st.pass })
          } />
          <ul className="checklist">
            {st.set.questions.map((q, k) => {
              const ok = answers[k] === res.right[k];
              return (
                <li key={k} className={ok ? 'ok' : 'bad'}>
                  <span className="mark">{ok ? Icon.check(16) : Icon.cross(16)}</span>
                  <span>{q.prompt} — <b>{q.options[res.right[k]]}</b>{!ok && answers[k] >= 0 ? <span className="muted"> ({t('yours')}: {q.options[answers[k]]})</span> : null}</span>
                </li>
              );
            })}
          </ul>
          {res.state.set ? <button className="btn solid block" style={{ marginTop: 12 }} onClick={again}>{t('Next test')}</button> : <div className="hint">{t('Enough tests for today. New ones tomorrow.')}</div>}
        </>
      )}

      {!st.set && !res && <Mascot size={64} mood="cheer" message={t('Enough tests for today. New ones tomorrow.')} />}
      <div className="hint">{t('Checked by the key: a gap in a sentence from the word bank, or the meaning of a word. Nothing to type — just choose.')}</div>
    </Sheet>
  );
}

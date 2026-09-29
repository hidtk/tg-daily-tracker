import { useEffect, useRef, useState } from 'react';
import { WORDS_PAID_PER_DAY, WORD_PAY, normalizeWord, type VocabAnswerResult, type VocabCard, type VocabResponse } from '@tracker/shared';
import { api, ApiError } from '../../api';
import { haptic } from '../../tg';
import { useT } from '../../i18n';
import { useToast } from '../Toast';
import { Section, Sheet } from '../ui';
import { Icon, Mascot } from '../Mascot';
import { useReward } from '../Reward';

function WordEntry({ w }: { w: VocabCard }) {
  return (
    <div className="word-card">
      <div>
        <span className="word">{w.word}</span>
        <span className="ipa">/{w.ipa}/</span>
        <span className="pos">{w.pos}</span>
      </div>
      <div className="meaning">{w.meaning} <span className="ru">— {w.ru}</span></div>
      <div className="example">{w.example}</div>
    </div>
  );
}

/** Typed word review: the answer is checked on the server (other forms and one wrong letter in long words are fine). */
export function WordsTask({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const t = useT();
  const toast = useToast();
  const reward = useReward();
  const [data, setData] = useState<VocabResponse | null>(null);
  const [queue, setQueue] = useState<VocabResponse['queue']>([]);
  const [answer, setAnswer] = useState('');
  const [hint, setHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VocabAnswerResult | null>(null);
  const [retype, setRetype] = useState('');
  const [paid, setPaid] = useState(0);
  const [session, setSession] = useState({ ok: 0, n: 0 });
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .vocab()
      .then((d) => {
        setData(d);
        setQueue(d.queue);
        setPaid(d.paid_today);
      })
      .catch((e: unknown) => toast(e instanceof ApiError ? t(e.message) : t('Could not load')));
  }, []);

  const q = queue[0];
  useEffect(() => {
    input.current?.focus();
  }, [q?.word_id, result]);

  if (!data) return <Sheet title={t('Words')} onClose={onClose}><span className="spinner" /></Sheet>;

  const next = () => {
    setQueue((x) => x.slice(1));
    setResult(null);
    setAnswer('');
    setRetype('');
    setHint(false);
  };

  const submit = async () => {
    if (!q || !answer.trim() || busy) return;
    setBusy(true);
    try {
      const r = await api.answerWord(q.word_id, answer, hint);
      setResult(r);
      setSession((s) => ({ ok: s.ok + (r.ok ? 1 : 0), n: s.n + 1 }));
      if (r.payout.minutes > 0) setPaid((n) => n + 1);
      if (r.ok) haptic.success();
      else haptic.warning();
      reward(r.payout);
      onDone();
    } catch (e) {
      haptic.warning();
      toast(e instanceof ApiError ? t(e.message) : t('Error'));
      if (e instanceof ApiError && e.status === 409) next();
    } finally {
      setBusy(false);
    }
  };

  const canNext = result && (result.ok || normalizeWord(retype) === normalizeWord(result.answer));

  return (
    <Sheet title={t('Words')} onClose={onClose}>
      <div className="row between small muted" style={{ marginBottom: 10 }}>
        <span>{t('Paid today: {a} of {b} words', { a: Math.min(paid, WORDS_PAID_PER_DAY), b: WORDS_PAID_PER_DAY })}</span>
        <span>{t('{n} min per word', { n: WORD_PAY })}</span>
      </div>

      {!q ? (
        <Mascot
          size={80}
          mood={session.n ? 'cheer' : 'calm'}
          message={session.n ? t('Done for now: {ok} of {n} right. Missed words come back tomorrow.', { ok: session.ok, n: session.n }) : t('Nothing to review right now. Study the new words below — they are asked from tomorrow.')}
        />
      ) : (
        <div className="typed-card">
          <div className="row between small muted" style={{ marginBottom: 8 }}>
            <span>{t('{n} left', { n: queue.length })}</span>
            <span>{q.kind === 'cloze' ? t('Fill the gap') : t('Translate')}</span>
          </div>
          {q.kind === 'cloze' ? (
            <>
              <div className="cloze">{q.sentence}</div>
              <div className="muted small" style={{ marginTop: 6 }}>{q.ru} · <i>{q.pos}</i></div>
            </>
          ) : (
            <>
              <div className="prompt-ru">{q.ru}</div>
              <div className="muted small" style={{ marginTop: 4 }}><i>{q.pos}</i> · {q.meaning}</div>
            </>
          )}
          <div className="letters" aria-hidden="true">
            {Array.from({ length: Math.min(q.letters, 24) }, (_, i) => <i key={i}>{hint && i === 0 ? q.first : ''}</i>)}
          </div>
          {!result ? (
            <>
              <input ref={input} value={answer} placeholder={t('Type the English word')} autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false} onChange={(e) => setAnswer(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }} />
              <div className="row between" style={{ marginTop: 10, flexWrap: 'nowrap' }}>
                <button className="btn link" disabled={hint} onClick={() => { haptic.tap(); setHint(true); }}>{hint ? t('Hint: the first letter') : t('Show a hint')}</button>
                <button className="btn solid" disabled={busy || !answer.trim()} onClick={() => void submit()}>{busy ? '…' : t('Check')}</button>
              </div>
              <div className="hint">{hint ? t('With a hint the word does not pay and comes back tomorrow.') : t('Other forms are fine (-s, -ed, -ing); in words longer than 5 letters one wrong letter is forgiven.')}</div>
            </>
          ) : (
            <div className={`answer-box ${result.ok ? 'ok' : 'bad'}`}>
              <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'nowrap' }}>
                {result.ok ? Icon.check(22) : Icon.cross(22)}
                <b>{result.ok ? (result.typo ? t('Right, with one wrong letter') : t('Right')) : t('Not quite')}</b>
              </div>
              <div style={{ marginTop: 6 }}><span className="word" style={{ fontSize: 22 }}>{result.answer}</span>{result.answer !== result.word && <span className="muted small"> ({result.word})</span>}</div>
              <div className="small">{result.meaning} — {result.ru}</div>
              <div className="example">{result.example}</div>
              {!result.ok && (
                <>
                  <input ref={input} value={retype} placeholder={t('Type it once to remember')} autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false} style={{ marginTop: 10 }} onChange={(e) => setRetype(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && canNext) next(); }} />
                  <div className="hint">{t('The word comes back tomorrow and starts its schedule again.')}</div>
                </>
              )}
              <button className="btn solid block" style={{ marginTop: 10 }} disabled={!canNext} onClick={next}>{t('Next word')}</button>
            </div>
          )}
        </div>
      )}

      {data.new_words.length > 0 && (
        <Section label={t('New words today')}>
          {data.new_words.map((w) => <WordEntry key={w.id} w={w} />)}
          <div className="hint">{t('Study them now: from tomorrow they are asked by typing — after 1, 3, 7, 14 and 30 days.')}</div>
        </Section>
      )}
      <div className="hint">{t('{a} of {b} words of the bank learned.', { a: data.learned, b: data.total })}</div>
    </Sheet>
  );
}

import { useEffect, useRef, useState } from 'react';
import type { SentenceState, VocabAnswerResult, VocabCard, VocabQuestion, VocabResponse } from '@tracker/shared';
import { EARN, REVIEW_INTERVALS, normalizeWord } from '@tracker/shared';
import { api, ApiError } from '../api';
import { haptic } from '../tg';
import { useToast } from '../components/Toast';
import { Section } from '../components/ui';
import { useT } from '../i18n';
import { Icon, Mascot } from '../components/Mascot';
import { useCelebrate } from '../components/Game';

function WordEntry({ w, showStages }: { w: VocabCard; showStages?: boolean }) {
  return (
    <div className="word-card">
      <div className="row between" style={{ alignItems: 'baseline' }}>
        <div>
          <span className="word">{w.word}</span>
          <span className="ipa">/{w.ipa}/</span>
          <span className="pos">{w.pos}</span>
        </div>
        {showStages && (
          <div className="stages" title={`stage ${w.stage} of ${REVIEW_INTERVALS.length}`}>
            {REVIEW_INTERVALS.map((_, i) => <i key={i} className={i < w.stage ? 'on' : ''} />)}
          </div>
        )}
      </div>
      <div className="meaning">{w.meaning} <span className="ru">— {w.ru}</span></div>
      <div className="example">{w.example}</div>
    </div>
  );
}

function Sentences() {
  const toast = useToast();
  const t = useT();
  const celebrate = useCelebrate();
  const [st, setSt] = useState<SentenceState | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [showMeaning, setShowMeaning] = useState(false);

  useEffect(() => {
    void api.sentences().then(setSt).catch(() => undefined);
  }, []);

  if (!st) return null;

  const submit = async () => {
    if (!st.next || !text.trim()) return;
    setBusy(true);
    try {
      const r = await api.submitSentence(st.next.id, text);
      if (r.ok) {
        haptic.success();
        celebrate(r.reward);
        setText('');
        setShowMeaning(false);
      } else {
        haptic.warning();
        const reasons: Record<string, string> = {
          short: t('At least 7 words.'),
          missing: t('Use the word itself (any form).'),
          copy: t('Too close to the example — write your own.'),
          language: t('Write it in English.'),
          cap: t('Enough sentences for today.'),
          done_today: t('This word is done for today.'),
        };
        toast(reasons[r.reason ?? ''] ?? t('Error'));
      }
      setSt(r.state);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : t('Error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section label={`${t('Sentence with a word')} · ${st.count} / ${st.cap}`}>
      {st.next ? (
        <>
          <div className="row between" style={{ alignItems: 'baseline' }}>
            <div><span className="word">{st.next.word}</span><span className="ipa">/{st.next.ipa}/</span><span className="pos">{st.next.pos}</span></div>
            <button className="btn link small" onClick={() => setShowMeaning((v) => !v)}>{showMeaning ? t('Hide') : t('Meaning')}</button>
          </div>
          {showMeaning && <div className="meaning">{st.next.meaning} <span className="ru">— {st.next.ru}</span></div>}
          <textarea rows={3} style={{ marginTop: 10 }} placeholder={t('Your own sentence with this word, at least 7 words.')} value={text} onChange={(e) => setText(e.target.value)} maxLength={400} />
          <div className="row between" style={{ marginTop: 10 }}>
            <span className="muted small">{st.count < EARN.sentencesCap ? t('+5 XP and +1 min (first {n} a day)', { n: EARN.sentencesCap }) : t('+5 XP (minutes: the daily {n} are done)', { n: EARN.sentencesCap })}</span>
            <button className="btn solid" disabled={busy || !text.trim()} onClick={() => void submit()}>{busy ? '…' : t('Check')}</button>
          </div>
        </>
      ) : (
        <p className="muted small">{t('Enough sentences for today. Tomorrow — new words.')}</p>
      )}
      <div className="hint">{t('Counts for the “Your own English” quest.')}</div>
    </Section>
  );
}

/** One typed question: the answer is checked on the server (case and a small typo are forgiven). */
function Review({ data, onAnswered }: { data: VocabResponse; onAnswered: (ok: boolean) => void }) {
  const t = useT();
  const toast = useToast();
  const celebrate = useCelebrate();
  const [queue, setQueue] = useState<VocabQuestion[]>(data.queue);
  const [answer, setAnswer] = useState('');
  const [hint, setHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VocabAnswerResult | null>(null);
  const [retype, setRetype] = useState('');
  const [session, setSession] = useState({ ok: 0, n: 0 });
  const input = useRef<HTMLInputElement>(null);
  const q = queue[0];

  useEffect(() => {
    input.current?.focus();
  }, [q?.word_id, result]);

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
      onAnswered(r.ok);
      if (r.ok) {
        haptic.success();
        celebrate(r.reward);
      } else haptic.warning();
    } catch (e) {
      haptic.warning();
      toast(e instanceof ApiError ? e.message : t('Error'));
      if (e instanceof ApiError && e.status === 409) next();
    } finally {
      setBusy(false);
    }
  };

  if (!q) {
    return (
      <Mascot
        size={80}
        mood={session.n ? 'cheer' : 'calm'}
        message={session.n ? t('Done for now: {ok} of {n} right. Missed words come back tomorrow.', { ok: session.ok, n: session.n }) : t('Nothing to review right now. New words are asked from tomorrow.')}
      />
    );
  }

  const canNext = result && (result.ok || normalizeWord(retype) === normalizeWord(result.answer));
  return (
    <div className="typed-card">
      <div className="row between small muted" style={{ marginBottom: 8 }}>
        <span>{q.practice ? t('Extra practice') : t('Review')} · {queue.length} {t('left')}</span>
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
          <input
            ref={input}
            value={answer}
            placeholder={t('Type the English word')}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
          />
          <div className="row between" style={{ marginTop: 10, flexWrap: 'nowrap' }}>
            <button className="btn link" disabled={hint} onClick={() => { haptic.tap(); setHint(true); }}>{hint ? t('Hint: first letter') : t('Hint')}</button>
            <button className="btn solid" disabled={busy || !answer.trim()} onClick={() => void submit()}>{busy ? '…' : t('Check')}</button>
          </div>
          <div className="hint">{hint ? t('With a hint: +1 XP, no minutes, the word comes back tomorrow.') : t('Right without a hint: +2 XP and +{m} min (up to {c} min a day).', { m: EARN.word, c: EARN.wordsCap })}</div>
        </>
      ) : (
        <div className={`answer-box ${result.ok ? 'ok' : 'bad'}`}>
          <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'nowrap' }}>
            {result.ok ? Icon.check(22) : Icon.cross(22)}
            <b>{result.ok ? (result.typo ? t('Right, with a small typo') : t('Right')) : t('Not quite')}</b>
          </div>
          <div style={{ marginTop: 6 }}><span className="word" style={{ fontSize: 22 }}>{result.answer}</span>{result.answer !== result.word && <span className="muted small"> ({result.word})</span>}</div>
          <div className="small">{result.meaning} — {result.ru}</div>
          <div className="example">{result.example}</div>
          {!result.ok && (
            <>
              <input
                ref={input}
                value={retype}
                placeholder={t('Type it once to remember')}
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                style={{ marginTop: 10 }}
                onChange={(e) => setRetype(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && canNext) next(); }}
              />
              <div className="hint">{t('The word comes back tomorrow and starts its schedule again.')}</div>
            </>
          )}
          <button className="btn solid block" style={{ marginTop: 10 }} disabled={!canNext} onClick={next}>{t('Continue')}</button>
        </div>
      )}
    </div>
  );
}

export function Words() {
  const t = useT();
  const [data, setData] = useState<VocabResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [okNow, setOkNow] = useState(0);

  useEffect(() => {
    api.vocab().then(setData).catch((e: unknown) => setErr(e instanceof ApiError ? e.message : t('Could not load')));
  }, []);

  if (err) return <div className="screen"><div className="err">{err}</div></div>;
  if (!data) return <span className="spinner" />;

  const pct = data.total ? Math.round((data.learned / data.total) * 100) : 0;

  return (
    <div className="screen">
      <h1>{t('Words')}</h1>

      <Section label={`${t('Review')} · ${t('quest')} ${Math.min(data.words_target, data.correct_today + okNow)}/${data.words_target}`}>
        <Review data={data} onAnswered={(ok) => ok && setOkNow((n) => n + 1)} />
        <div className="hint">{t('Only typed answers count: you see the Russian meaning or a sentence with a gap and type the English word. Each word once a day; due words first, then extra practice.')}</div>
      </Section>

      <Sentences />

      <Section label={data.new_words.length ? t('Today’s words') : t('New words')}>
        {data.new_words.length ? data.new_words.map((w) => <WordEntry key={w.id} w={w} />) : (
          <p className="muted">{data.per_day ? t('The whole bank has been introduced.') : t('Daily words are switched off in Settings.')}</p>
        )}
        {data.new_words.length > 0 && <div className="hint">{t('Study them now — from tomorrow they are asked by typing: after 1, 3, 7, 14 and 30 days. Five right answers in a row and a word is yours.')}</div>}
      </Section>

      <Section label={t('Progress')}>
        <div className="progress-line">
          <span>{t('{n} of {total} introduced', { n: data.learned, total: data.total })}</span>
          <i style={{ ['--w' as string]: `${pct}%` }} />
          <span>{t('{n} mastered', { n: data.mastered })}</span>
        </div>
        {data.history.length > 0 && (
          <div className="hint">
            {t('Last two weeks: {r} reviews, {p}% recalled.', { r: data.history.reduce((s, h) => s + h.reviews, 0), p: Math.round((data.history.reduce((s, h) => s + h.correct, 0) / Math.max(1, data.history.reduce((s, h) => s + h.reviews, 0))) * 100) })}
          </div>
        )}
      </Section>
    </div>
  );
}

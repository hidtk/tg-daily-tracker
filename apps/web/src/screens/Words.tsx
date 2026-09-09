import { useEffect, useState } from 'react';
import type { VocabCard, VocabResponse } from '@tracker/shared';
import { REVIEW_INTERVALS } from '@tracker/shared';
import { api, ApiError } from '../api';
import { haptic } from '../tg';
import { useToast } from '../components/Toast';
import { Section } from '../components/ui';

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

export function Words() {
  const toast = useToast();
  const [data, setData] = useState<VocabResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [queue, setQueue] = useState<VocabCard[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [okCount, setOkCount] = useState(0);

  const load = () =>
    api
      .vocab()
      .then((r) => {
        setData(r);
        setQueue(r.due);
        setRevealed(false);
      })
      .catch((e: unknown) => setErr(e instanceof ApiError ? e.message : 'Could not load'));

  useEffect(() => {
    void load();
  }, []);

  if (err) return <div className="screen"><div className="err">{err}</div></div>;
  if (!data) return <span className="spinner" />;

  const current = queue[0];
  const total = doneCount + queue.length;

  const answer = async (ok: boolean) => {
    if (!current) return;
    ok ? haptic.success() : haptic.warning();
    setQueue((q) => q.slice(1));
    setRevealed(false);
    setDoneCount((n) => n + 1);
    if (ok) setOkCount((n) => n + 1);
    try {
      await api.reviewWord(current.id, ok);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not save the review');
    }
  };

  const pct = data.total ? Math.round((data.learned / data.total) * 100) : 0;

  return (
    <div className="screen">
      <h1>Words</h1>

      {(current || doneCount > 0) && (
        <Section label={current ? `Review · ${doneCount + 1} of ${total}` : 'Review'}>
          {current ? (
            <div className="review-card">
              <div className="word">{current.word}</div>
              <div className="ipa" style={{ marginLeft: 0 }}>/{current.ipa}/ <span className="pos">{current.pos}</span></div>
              {revealed ? (
                <>
                  <div className="meaning" style={{ marginTop: 14 }}>{current.meaning}</div>
                  <div className="ru">{current.ru}</div>
                  <div className="example">{current.example}</div>
                  <div className="review-actions">
                    <button className="btn quiet" onClick={() => void answer(false)}>Forgot</button>
                    <button className="btn solid" onClick={() => void answer(true)}>Knew it</button>
                  </div>
                </>
              ) : (
                <button className="btn block" style={{ marginTop: 28 }} onClick={() => { haptic.tap(); setRevealed(true); }}>Show meaning</button>
              )}
            </div>
          ) : (
            <p className="muted">Done for today: {okCount} of {doneCount} recalled. Missed words come back tomorrow; the rest move up a step.</p>
          )}
        </Section>
      )}

      <Section label={data.new_words.length ? 'Today’s words' : 'New words'}>
        {data.new_words.length ? data.new_words.map((w) => <WordEntry key={w.id} w={w} />) : (
          <p className="muted">{data.per_day ? 'The whole bank has been introduced.' : 'Daily words are switched off in Settings.'}</p>
        )}
        {data.new_words.length > 0 && <div className="hint">These come back tomorrow, then after 3, 7, 14 and 30 days. Five recalls in a row and a word is yours.</div>}
      </Section>

      <Section label="Progress">
        <div className="progress-line">
          <span>{data.learned} of {data.total} introduced</span>
          <i style={{ ['--w' as string]: `${pct}%` }} />
          <span>{data.mastered} mastered</span>
        </div>
        {data.history.length > 0 && (
          <div className="hint">
            Last two weeks: {data.history.reduce((s, h) => s + h.reviews, 0)} reviews, {Math.round((data.history.reduce((s, h) => s + h.correct, 0) / Math.max(1, data.history.reduce((s, h) => s + h.reviews, 0))) * 100)}% recalled.
          </div>
        )}
      </Section>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { countWords, linkingUsed, vocabUsed, type TaskSize, type WritingResult, type WritingState } from '@tracker/shared';
import { api, ApiError } from '../../api';
import { haptic } from '../../tg';
import { useT } from '../../i18n';
import { useToast } from '../Toast';
import { Section, Sheet } from '../ui';
import { Mascot } from '../Mascot';
import { Checklist } from '../Checklist';
import { useReward } from '../Reward';

function mmss(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const draftKey = (date: string, size: TaskSize) => `writing-draft-${size}-${date}`;

/** Writing: press Start, write on the topic, send; the server checks the rubric and shows each criterion. */
export function WritingTask({ size, onClose, onDone }: { size: TaskSize; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const toast = useToast();
  const reward = useReward();
  const [st, setSt] = useState<WritingState | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<WritingResult | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    api
      .writing(size)
      .then((s) => {
        setSt(s);
        try { setText(localStorage.getItem(draftKey(s.today, size)) ?? ''); } catch { /* no storage */ }
      })
      .catch((e: unknown) => toast(e instanceof ApiError ? t(e.message) : t('Could not load')));
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [size]);

  const words = countWords(text);
  const used = useMemo(() => (st ? vocabUsed(text, st.vocab) : []), [text, st]);
  const links = useMemo(() => linkingUsed(text), [text]);
  const title = size === 'long' ? `Writing · ${t('long text')}` : `Writing · ${t('short text')}`;

  if (!st) return <Sheet title={title} onClose={onClose}><span className="spinner" /></Sheet>;

  const started = st.started_at ? Date.parse(st.started_at) : null;
  const elapsed = started ? (now - started) / 1000 : 0;
  const needVocab = Math.min(st.rules.vocab, st.vocab.length);

  const start = async () => {
    haptic.tap();
    try { setSt(await api.startWriting(size)); } catch (e) { toast(e instanceof ApiError ? t(e.message) : t('Error')); }
  };
  const save = (v: string) => {
    setText(v);
    try { localStorage.setItem(draftKey(st.today, size), v); } catch { /* no storage */ }
  };
  const submit = async () => {
    setBusy(true);
    try {
      const r = await api.submitWriting(size, text);
      setRes(r);
      setSt(r.state);
      if (r.ok) {
        haptic.success();
        reward(r.payout);
        onDone();
        try { localStorage.removeItem(draftKey(st.today, size)); } catch { /* no storage */ }
      } else haptic.warning();
    } catch (e) {
      haptic.warning();
      toast(e instanceof ApiError ? t(e.message) : t('Error'));
    } finally {
      setBusy(false);
    }
  };

  const ai = res?.ai ?? st.done?.feedback ?? null;

  return (
    <Sheet title={title} onClose={onClose}>
      <Section label={t('Topic')}>
        <div className="boss-title">{st.topic.title}</div>
        <p style={{ margin: '6px 0 0' }}>{st.topic.prompt}</p>
      </Section>

      <Section label={t('What is checked')}>
        <ul className="rules">
          <li>{t('At least {n} words', { n: st.rules.min_words })}</li>
          {needVocab > 0 && <li>{t('{n} of your recent words (they light up below when found)', { n: needVocab })}</li>}
          <li>{t('{n} linking words: because, however, for example…', { n: st.rules.linking })}</li>
          <li>{t('At least {n} full sentences', { n: st.rules.sentences })}</li>
          <li>{t('English, your own words: no filler, no random letters, not a copy of your earlier texts or of the topic')}</li>
          <li>{t('At least {n} min from Start (the server keeps the time)', { n: Math.round(st.rules.min_seconds / 60) })}</li>
          {st.ai && <li>{t('On topic — an AI check reads the text and gives tips')}</li>}
        </ul>
        <div className="hint">{t('Accepted: +{n} min of social media, once a day.', { n: st.price })}</div>
      </Section>

      {st.vocab.length > 0 && (
        <Section label={`${t('Your recent words')} · ${used.length}/${needVocab}`}>
          <div className="chips">
            {st.vocab.map((w) => <span key={w.id} className={`chip${used.includes(w.id) ? ' on' : ''}`} title={w.ru}>{w.word}</span>)}
          </div>
        </Section>
      )}

      {st.done ? (
        <Section label={t('Accepted today')}>
          <Mascot size={64} mood="cheer" message={t('Accepted: {n} words, +{m} min. A new topic tomorrow.', { n: st.done.words, m: st.done.paid })} />
          {res?.criteria.length ? <Checklist criteria={res.criteria} /> : null}
          <div className="passage small"><p>{st.done.text}</p></div>
        </Section>
      ) : !started ? (
        <button className="btn solid block" onClick={() => void start()}>{t('Start writing')}</button>
      ) : (
        <>
          <textarea rows={10} value={text} onChange={(e) => save(e.target.value)} placeholder={t('Write here in English…')} maxLength={6000} />
          <div className="row between small" style={{ marginTop: 8 }}>
            <span className={words >= st.rules.min_words ? 'ok-ink' : 'muted'}>{t('{n} / {m} words', { n: words, m: st.rules.min_words })}</span>
            <span className={links.length >= st.rules.linking ? 'ok-ink' : 'muted'}>{t('links {n}/{m}', { n: links.length, m: st.rules.linking })}</span>
            <span className={elapsed >= st.rules.min_seconds ? 'ok-ink' : 'muted'}>{mmss(elapsed)} / {mmss(st.rules.min_seconds)}</span>
          </div>
          {res && !res.ok && res.criteria.length > 0 && (
            <div className="answer-box bad" style={{ marginTop: 10 }}>
              <b>{t('Not accepted yet. What to fix:')}</b>
              <Checklist criteria={res.criteria} />
            </div>
          )}
          <button className="btn solid block" style={{ marginTop: 12 }} disabled={busy || !text.trim()} onClick={() => void submit()}>{busy ? t('Checking…') : t('Send for checking')}</button>
          <div className="hint">{t('The draft is kept on this phone until you send it.')}</div>
        </>
      )}

      {ai && (
        <Section label={t('AI opinion')}>
          <div className="small">{t('Estimated band: {b}', { b: ai.band.toFixed(1) })}</div>
          {ai.tips.length > 0 && <ul className="rules">{ai.tips.map((x) => <li key={x}>{x}</li>)}</ul>}
          <div className="hint">{t('An estimate to learn from; the minutes depend on the checks above.')}</div>
        </Section>
      )}
    </Sheet>
  );
}

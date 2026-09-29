import { useEffect, useState } from 'react';
import { SENTENCE_MIN_WORDS, countWords, type SentenceResult, type SentenceState } from '@tracker/shared';
import { api, ApiError } from '../../api';
import { haptic } from '../../tg';
import { useT } from '../../i18n';
import { useToast } from '../Toast';
import { Sheet } from '../ui';
import { Mascot } from '../Mascot';
import { Checklist } from '../Checklist';
import { useReward } from '../Reward';

/** One sentence with a given word, checked by the rubric; accepted ones pay a minute. */
export function SentenceTask({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const t = useT();
  const toast = useToast();
  const reward = useReward();
  const [st, setSt] = useState<SentenceState | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<SentenceResult | null>(null);
  const [meaning, setMeaning] = useState(false);

  useEffect(() => {
    api.sentences().then(setSt).catch((e: unknown) => toast(e instanceof ApiError ? t(e.message) : t('Could not load')));
  }, []);

  if (!st) return <Sheet title={t('A sentence with a word')} onClose={onClose}><span className="spinner" /></Sheet>;

  const submit = async () => {
    if (!st.next || !text.trim()) return;
    setBusy(true);
    try {
      const r = await api.submitSentence(st.next.id, text);
      setRes(r);
      setSt(r.state);
      if (r.ok) {
        haptic.success();
        reward(r.payout);
        setText('');
        setMeaning(false);
        onDone();
      } else haptic.warning();
    } catch (e) {
      toast(e instanceof ApiError ? t(e.message) : t('Error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={t('A sentence with a word')} onClose={onClose}>
      <div className="muted small" style={{ marginBottom: 10 }}>{t('Today: {a} of {b}', { a: st.count, b: st.per_day })}</div>
      {res?.ok && <Mascot size={64} mood="cheer" message={t('Accepted. Here is the next word.')} />}
      {st.next ? (
        <>
          <div className="row between" style={{ alignItems: 'baseline' }}>
            <div><span className="word">{st.next.word}</span><span className="ipa">/{st.next.ipa}/</span><span className="pos">{st.next.pos}</span></div>
            <button className="btn link small" onClick={() => setMeaning((v) => !v)}>{meaning ? t('Hide') : t('Meaning')}</button>
          </div>
          {meaning && <div className="meaning">{st.next.meaning} <span className="ru">— {st.next.ru}</span></div>}
          <textarea rows={3} style={{ marginTop: 10 }} placeholder={t('Your own sentence with this word, at least {n} words.', { n: SENTENCE_MIN_WORDS })} value={text} onChange={(e) => setText(e.target.value)} maxLength={400} />
          <div className="row between" style={{ marginTop: 10 }}>
            <span className={countWords(text) >= SENTENCE_MIN_WORDS ? 'ok-ink small' : 'muted small'}>{t('{n} words', { n: countWords(text) })}</span>
            <button className="btn solid" disabled={busy || !text.trim()} onClick={() => void submit()}>{busy ? '…' : t('Check')}</button>
          </div>
        </>
      ) : (
        <Mascot size={64} mood="cheer" message={t('Enough sentences for today. New words tomorrow.')} />
      )}
      {res && !res.ok && res.check && (
        <div className="answer-box bad" style={{ marginTop: 12 }}>
          <b>{t('Not accepted yet. What to fix:')}</b>
          <Checklist criteria={res.check.criteria} />
        </div>
      )}
      {res?.blocked === 'done_today' && <div className="hint">{t('This word is done for today.')}</div>}
      <div className="hint">{t('Checked: the word is used (any form), {n}+ words, English, no filler or random letters, not a copy of the example or of your earlier sentences.', { n: SENTENCE_MIN_WORDS })}</div>
    </Sheet>
  );
}

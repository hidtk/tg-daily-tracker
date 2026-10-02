import { useEffect, useState } from 'react';
import { SENTENCE_MAX_WORDS, SENTENCE_MIN_WORDS, countWords, type SentenceResult, type SentenceState, type SentenceStatus } from '@tracker/shared';
import { api, ApiError } from '../../api';
import { haptic } from '../../tg';
import { useT } from '../../i18n';
import { useToast } from '../Toast';
import { Sheet } from '../ui';
import { Mascot } from '../Mascot';
import { Checklist } from '../Checklist';
import { useReward } from '../Reward';

const STATUS: Record<SentenceStatus, string> = { accepted: 'Accepted', pending: 'Waiting for the check', practice: 'Practice, no minutes', rejected: 'Not accepted' };

/**
 * One sentence with a given word. The rules first; then a model (if the server has one) checks the meaning — only
 * then it pays. Without a model it is practice: minutes for words come from the Quick test and the Words task.
 */
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
      if (r.ok || r.status === 'pending') {
        haptic.success();
        if (r.payout) reward(r.payout);
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
      {st.judge === 'none' && !res && <div className="hint" style={{ marginTop: 0 }}>{t('Practice: sentences are checked by the rules only and give no minutes — rules can’t tell sense from a string of words. Minutes for words: the Quick test and the Words task.')}</div>}
      {res?.status === 'accepted' && <Mascot size={64} mood="cheer" message={t('Accepted. Here is the next word.')} />}
      {res?.status === 'practice' && <Mascot size={64} mood="calm" message={t('Passed the rules. Practice — no minutes. Here is the next word.')} />}
      {res?.status === 'pending' && <Mascot size={64} mood="wait" message={t('The meaning check is not available right now. The sentence is saved: it is checked later, and the minute comes then if it is accepted.')} />}
      {st.next ? (
        <>
          <div className="row between" style={{ alignItems: 'baseline' }}>
            <div><span className="word">{st.next.word}</span><span className="ipa">/{st.next.ipa}/</span><span className="pos">{st.next.pos}</span></div>
            <button className="btn link small" onClick={() => setMeaning((v) => !v)}>{meaning ? t('Hide') : t('Meaning')}</button>
          </div>
          {meaning && <div className="meaning">{st.next.meaning} <span className="ru">— {st.next.ru}</span></div>}
          <textarea rows={3} style={{ marginTop: 10 }} placeholder={t('Your own sentence with this word, {a} to {b} words.', { a: SENTENCE_MIN_WORDS, b: SENTENCE_MAX_WORDS })} value={text} onChange={(e) => setText(e.target.value)} maxLength={400} />
          <div className="row between" style={{ marginTop: 10 }}>
            <span className={countWords(text) >= SENTENCE_MIN_WORDS && countWords(text) <= SENTENCE_MAX_WORDS ? 'ok-ink small' : 'muted small'}>{t('{n} words', { n: countWords(text) })}</span>
            <button className="btn solid" disabled={busy || !text.trim()} onClick={() => void submit()}>{busy ? '…' : t('Check')}</button>
          </div>
        </>
      ) : (
        <Mascot size={64} mood="cheer" message={t('Enough sentences for today. New words tomorrow.')} />
      )}
      {res && !res.ok && res.status !== 'pending' && res.check && (
        <div className="answer-box bad" style={{ marginTop: 12 }}>
          <b>{t('Not accepted yet. What to fix:')}</b>
          {res.verdict?.reason_ru && <p style={{ margin: '6px 0' }}>{res.verdict.reason_ru}</p>}
          <Checklist criteria={res.check.criteria} />
        </div>
      )}
      {res?.blocked === 'done_today' && <div className="hint">{t('This word is done for today.')}</div>}
      {st.recent.length > 0 && (
        <ul className="sent-list">
          {st.recent.map((r, k) => (
            <li key={k}>
              <span className={`st ${r.status}`}>{r.word} · {t(STATUS[r.status])}</span>
              {r.text}
              {r.reason && <div className="muted small">{r.reason}</div>}
            </li>
          ))}
        </ul>
      )}
      <div className="hint">{t('Checked: the word is used (any form), {a} to {b} words, a sentence and not a list, few bank words (a sentence counts for one word), English, not the example or your earlier sentences.', { a: SENTENCE_MIN_WORDS, b: SENTENCE_MAX_WORDS })}{st.judge !== 'none' ? ` ${t('Then a model checks that it makes sense and uses the word in the right meaning — only then it pays.')}` : ''}</div>
    </Sheet>
  );
}

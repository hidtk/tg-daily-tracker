import { useEffect, useMemo, useState } from 'react';
import { EARN, countWords, vocabUsed, type SpeakingState, type WritingResult, type WritingState } from '@tracker/shared';
import { api, ApiError } from '../api';
import { haptic, tg } from '../tg';
import { useT } from '../i18n';
import { useToast } from './Toast';
import { Section, Sheet } from './ui';
import { Icon, Mascot } from './Mascot';
import { useCelebrate } from './Game';

function Steps({ items }: { items: string[] }) {
  return (
    <div>
      {items.map((s, i) => (
        <div key={i} className="sc-step">
          <div className="sc-num">{i + 1}</div>
          <div className="sc-body small">{s}</div>
        </div>
      ))}
    </div>
  );
}

function mmss(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const draftKey = (date: string) => `writing-draft-${date}`;

// ---------- Writing ----------

export function WritingSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const toast = useToast();
  const celebrate = useCelebrate();
  const [st, setSt] = useState<WritingState | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<WritingResult | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    api
      .writing()
      .then((s) => {
        setSt(s);
        try { setText(localStorage.getItem(draftKey(s.today)) ?? ''); } catch { /* no storage */ }
      })
      .catch((e: unknown) => toast(e instanceof ApiError ? e.message : t('Could not load')));
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const words = countWords(text);
  const used = useMemo(() => (st ? vocabUsed(text, st.vocab) : []), [text, st]);

  if (!st) return <Sheet title="Writing" onClose={onClose}><span className="spinner" /></Sheet>;

  const started = st.started_at ? Date.parse(st.started_at) : null;
  const elapsed = started ? (now - started) / 1000 : 0;

  const start = async () => {
    haptic.tap();
    try { setSt(await api.startWriting()); } catch (e) { toast(e instanceof ApiError ? e.message : t('Error')); }
  };
  const save = (v: string) => {
    setText(v);
    try { localStorage.setItem(draftKey(st.today), v); } catch { /* no storage */ }
  };
  const submit = async () => {
    setBusy(true);
    try {
      const r = await api.submitWriting(text);
      setRes(r);
      setSt(r.state);
      if (r.ok) {
        haptic.success();
        celebrate(r.reward);
        try { localStorage.removeItem(draftKey(st.today)); } catch { /* no storage */ }
      } else haptic.warning();
    } catch (e) {
      haptic.warning();
      toast(e instanceof ApiError ? e.message : t('Error'));
    } finally {
      setBusy(false);
    }
  };

  const reasonText: Record<WritingResult['reasons'][number], string> = {
    short: t('Too short: {n} words, at least {m} needed.', { n: res?.words ?? words, m: st.min_words }),
    vocab: t('Use at least {m} of your recent words (found: {n}).', { m: st.min_vocab, n: res?.vocab_used.length ?? used.length }),
    language: t('Write it in English.'),
    fast: t('Too fast: a text like this takes at least {m} minutes from the start.', { m: Math.round(st.min_seconds / 60) }),
    repeat: t('This text repeats one you already sent. Write a new one.'),
    not_started: t('Press “Start” first — the timer starts on the server.'),
    done_today: t('Today’s Writing is already counted. A new topic tomorrow.'),
  };

  return (
    <Sheet title={`Writing · ${st.topic.title}`} onClose={onClose}>
      <Section label={t('How it works')}>
        <Steps
          items={[
            t('Press “Start”: the server notes the time. Then write on the topic below.'),
            t('At least {w} words, and use at least {v} words from your recent vocabulary (the chips below light up when found).', { w: st.min_words, v: st.min_vocab }),
            t('Send it. The server checks length, your words, English and time (at least {m} minutes). Accepted: +40 XP and +{min} min, once a day.', { m: Math.round(st.min_seconds / 60), min: EARN.writing }),
          ]}
        />
      </Section>

      <Section label={t('Topic')}>
        <p style={{ margin: 0 }}>{st.topic.prompt}</p>
      </Section>

      <Section label={`${t('Your recent words')} · ${used.length}/${st.min_vocab}`}>
        <div className="chips">
          {st.vocab.map((w) => (
            <span key={w.id} className={`chip${used.includes(w.id) ? ' on' : ''}`} title={w.ru}>{w.word}</span>
          ))}
        </div>
        {!st.vocab.length && <p className="muted small">{t('No words learned yet — open Words first.')}</p>}
      </Section>

      {st.done ? (
        <Section label={t('Counted today')}>
          <Mascot size={72} mood="cheer" message={t('Accepted: {n} words, used: {v}. A new topic tomorrow.', { n: st.done.words, v: st.done.vocab.join(', ') })} />
          <div className="passage small"><p>{st.done.text}</p></div>
        </Section>
      ) : !started ? (
        <button className="btn solid block" onClick={() => void start()}>{t('Start writing')}</button>
      ) : (
        <>
          <textarea rows={10} value={text} onChange={(e) => save(e.target.value)} placeholder={t('Write here in English…')} maxLength={4000} />
          <div className="row between small" style={{ marginTop: 8 }}>
            <span className={words >= st.min_words ? 'ok-ink' : 'muted'}>{t('{n} / {m} words', { n: words, m: st.min_words })}</span>
            <span className={elapsed >= st.min_seconds ? 'ok-ink' : 'muted'}>{mmss(elapsed)} / {mmss(st.min_seconds)}</span>
          </div>
          {res && !res.ok && (
            <div className="answer-box bad" style={{ marginTop: 10 }}>
              {res.reasons.map((r) => <div key={r}>{reasonText[r]}</div>)}
            </div>
          )}
          <button className="btn solid block" style={{ marginTop: 12 }} disabled={busy || !text.trim()} onClick={() => void submit()}>{busy ? t('Checking…') : t('Send for checking')}</button>
          <div className="hint">{t('The draft is kept on this phone until you send it.')}</div>
        </>
      )}
    </Sheet>
  );
}

// ---------- Speaking ----------

export function SpeakingSheet({ onClose, botUsername }: { onClose: () => void; botUsername: string }) {
  const t = useT();
  const toast = useToast();
  const [st, setSt] = useState<SpeakingState | null>(null);

  useEffect(() => {
    api.speaking().then(setSt).catch((e: unknown) => toast(e instanceof ApiError ? e.message : t('Could not load')));
  }, []);

  const openBot = () => {
    haptic.tap();
    const url = `https://t.me/${st?.bot_username || botUsername}`;
    try { tg.openTelegramLink(url); } catch { window.open(url, '_blank'); }
  };

  return (
    <Sheet title="Speaking" onClose={onClose}>
      {!st ? <span className="spinner" /> : (
        <>
          <Section label={t('How it works')}>
            <Steps
              items={[
                t('Read the card below and think for a minute: what you will say on each point.'),
                t('Press “Open the chat with the bot”, hold the microphone and answer in English — at least {s} seconds (1–2 minutes is ideal, like IELTS Part 2).', { s: st.min_seconds }),
                t('The bot counts the voice message by itself and replies: +25 XP and +{m} min. Up to {n} answers a day, each on its own card.', { m: EARN.speaking, n: st.per_day }),
              ]}
            />
            <div className="hint">{t('Not counted: shorter than {s} seconds, forwarded voice messages, the same voice twice. The bot cannot hear the content — the honesty is yours, the practice too.', { s: st.min_seconds })}</div>
          </Section>

          {st.card ? (
            <Section label={t('Card {n} of {m}', { n: st.done_today.length + 1, m: st.per_day })}>
              <div className="boss-title">{st.card.title}</div>
              <p style={{ margin: '6px 0' }}>{st.card.prompt}</p>
              <div className="muted small">{t('You should say:')}</div>
              <ul className="card-points">
                {st.card.points.map((p) => <li key={p}>{p}</li>)}
              </ul>
              <button className="btn solid block" style={{ marginTop: 10 }} onClick={openBot}>{Icon.mic(18)} {t('Open the chat with the bot')}</button>
            </Section>
          ) : (
            <Mascot size={72} mood="cheer" message={t('Today’s Speaking is done. New cards tomorrow.')} />
          )}

          {st.done_today.length > 0 && (
            <Section label={t('Counted today')}>
              {st.done_today.map((d, i) => (
                <div key={i} className="row between small" style={{ padding: '4px 0' }}>
                  <span>{d.card}</span>
                  <span className="ok-ink">{mmss(d.seconds)}</span>
                </div>
              ))}
            </Section>
          )}
        </>
      )}
    </Sheet>
  );
}

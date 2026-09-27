import { useEffect, useRef, useState } from 'react';
import { GATE_APP_LABEL, MCQ_LETTERS, READING_TESTS, TFNG_OPTIONS, UNLOCK_PRESETS, type ReadingResult, type ReadingTest, type WalletResponse } from '@tracker/shared';
import { api, ApiError } from '../api';
import { haptic } from '../tg';
import { useToast } from '../components/Toast';
import { Section, Sheet } from '../components/ui';
import { useT } from '../i18n';
import { Mascot } from '../components/Mascot';

/** Server times are UTC ISO strings (sometimes without the Z) — show them in the device's time. */
function fmtLocal(iso: string): string {
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return iso.slice(5, 16).replace('T', ' ');
  return d.toLocaleString(undefined, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60);
  return `${String(m).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}

export function Practice() {
  const toast = useToast();
  const t = useT();
  const [w, setW] = useState<WalletResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [test, setTest] = useState<ReadingTest | null>(null);

  const load = () => api.wallet().then(setW).catch((e: unknown) => setErr(e instanceof ApiError ? e.message : t('Could not load')));
  useEffect(() => {
    void load();
  }, []);

  if (err) return <div className="screen"><div className="err">{err}</div></div>;
  if (!w) return <span className="spinner" />;

  const done = new Set(w.done_test_ids);
  const patch = async (p: Parameters<typeof api.saveWallet>[0]) => {
    setW(await api.saveWallet(p));
    haptic.success();
  };

  return (
    <div className="screen">
      <h1>{t('Practice')}</h1>

      <Section label={`${t('Reading')} · ${w.library.filter((x) => !done.has(x.id)).length} ${t('to do')}`}>
        <p className="muted small">{t('Thirteen questions, band on the official scale. A pass earns social-media minutes:')} <b>5.0–5.5 → 10</b>, <b>6.0 → 15</b>, <b>6.5 {t('and up')} → 30</b>. {t('Over the time limit the reward is halved; a test counts once.')}</p>
        {w.library.filter((x) => !done.has(x.id)).map((x) => (
          <button key={x.id} className="test-row" onClick={() => { haptic.tap(); setTest(READING_TESTS.find((r) => r.id === x.id) ?? null); }}>
            <div>
              <div>{x.title}</div>
              <div className="muted small">{x.topic} · {x.questions} {t('questions')} · {t('about')} {x.minutes} {t('min')}</div>
            </div>
            <span className="arrow">→</span>
          </button>
        ))}
        {w.library.every((x) => done.has(x.id)) && (
          <p className="muted small" style={{ marginTop: 8 }}>{w.can_refresh ? t('All done. Refresh the library to unlock the next four.') : t('All tests in the bank are done — new ones will come with an update.')}</p>
        )}
        {w.can_refresh && (
          <button className="btn solid" style={{ marginTop: 6 }} onClick={async () => { haptic.tap(); setW(await api.refreshLibrary()); toast(t('Four new tests unlocked')); }}>{t('Refresh library')}</button>
        )}
        <div className="hint">{t('{a} of {b} tests unlocked', { a: w.library.length, b: w.total_tests })}</div>
      </Section>

      {w.attempts.length > 0 && (
        <Section label={t('Archive')}>
          {[...new Map(w.attempts.map((a) => [a.test_id, a])).values()].map((a) => {
            const meta = READING_TESTS.find((r) => r.id === a.test_id);
            return (
              <button key={a.test_id} className="test-row done" onClick={() => { haptic.tap(); setTest(meta ?? null); }}>
                <div>
                  <div>{meta?.title ?? a.test_id}</div>
                  <div className="muted small">{a.date} · {a.correct}/{a.total} · band {a.band.toFixed(1)} · +{a.earned} {t('min')}</div>
                </div>
                <span className="arrow">↻</span>
              </button>
            );
          })}
          <div className="hint">{t('Retake any test for practice — minutes are paid once.')}</div>
        </Section>
      )}

      <Section label={t('Minutes')}>
        <div className="balance">{Math.floor(w.balance)}<span>{t('min')}</span></div>
        <div className="muted small">
          {w.balance < 1
            ? t('Social media is locked. Pass a Reading test to open it.')
            : t('About {n} minutes in {apps}.', { n: Math.floor(w.balance), apps: w.apps.map((a) => GATE_APP_LABEL[a]).join(', ') || t('the gated apps') })}
        </div>
        <div className="muted small" style={{ marginTop: 4 }}>{t('Earned today {a} · {b} more possible · bank up to {c}', { a: w.earned_today, b: w.earn_left, c: w.bank_cap })}</div>
      </Section>

      <Section label={t('Open social media')}>
        {w.lock.configured ? (
          <>
            <div className="row between">
              <div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{w.lock.state === 'open' ? t('Open · {n} min left', { n: w.lock.remaining_min }) : t('Locked')}</div>
                <div className="muted small">{w.apps.map((a) => GATE_APP_LABEL[a]).join(', ')}</div>
              </div>
              {w.lock.state === 'open' && <button className="btn" onClick={async () => { haptic.tap(); try { const r = await api.lockNow(); setW(r); toast(r.refunded ? t('{n} min returned', { n: r.refunded }) : t('Locked')); } catch (e) { haptic.warning(); toast(e instanceof ApiError ? e.message : t('Error')); } }}>{t('Lock now')}</button>}
            </div>
            <div className="chips" style={{ marginTop: 12 }}>
              {UNLOCK_PRESETS.map((m) => (
                <button key={m} className="chip" disabled={w.balance < m} onClick={async () => { haptic.tap(); try { setW(await api.unlock(m)); toast(t('Open for {n} min', { n: m })); } catch (e) { haptic.warning(); toast(e instanceof ApiError ? e.message : t('Error')); } }}>{w.lock.state === 'open' ? `+${m}` : t('Open {n} min', { n: m })}</button>
              ))}
            </div>
            {w.lock.error && <div className="hint" style={{ color: 'var(--danger)' }}>NextDNS: {w.lock.error}</div>}
            <div className="hint">{t('Minutes are spent when you open; closing early returns the unused ones. When time runs out the lock closes by itself and the bot tells you.')}</div>
          </>
        ) : (
          <p className="muted small" style={{ margin: 0 }}>{t('With the Shortcuts lock, apps open by themselves while you have minutes. The lock itself is set up in Settings → Social-media lock.')}</p>
        )}
      </Section>

      {w.sessions.length > 0 && (
        <Section label={t('Recent sessions')}>
          {w.sessions.slice(0, 8).map((s) => (
            <div key={s.id} className="row between small" style={{ padding: '4px 0' }}>
              <span>{GATE_APP_LABEL[s.app]}</span>
              <span className="muted">{fmtLocal(s.started_at)}</span>
              <span>{s.ended_at ? `−${s.minutes < 1 ? '<1' : Math.round(s.minutes)}` : '…'}</span>
            </div>
          ))}
        </Section>
      )}

      {test && (
        <ReadingRunner
          test={test}
          onClose={() => setTest(null)}
          onDone={(r) => {
            void load();
            toast(r.earned ? `+${r.earned} ${t('min')} · band ${r.band.toFixed(1)}` : `Band ${r.band.toFixed(1)} · ${t('no minutes')}`);
          }}
        />
      )}
    </div>
  );
}

function ReadingRunner({ test, onClose, onDone }: { test: ReadingTest; onClose: () => void; onDone: (r: ReadingResult) => void }) {
  const toast = useToast();
  const t = useT();
  const startedAt = useRef(Date.now());
  const [sec, setSec] = useState(0);
  const [answers, setAnswers] = useState<string[]>(() => test.questions.map(() => ''));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReadingResult | null>(null);

  useEffect(() => {
    if (result) return; // freeze the clock once the test is checked
    const t = setInterval(() => setSec(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [result]);

  const limit = (test.minutes + 10) * 60;
  const answered = answers.filter(Boolean).length;
  const set = (i: number, v: string) => setAnswers((a) => a.map((x, j) => (j === i ? v : x)));

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await api.submitReading({ test_id: test.id, seconds: sec, answers });
      setResult(r);
      haptic.success();
      onDone(r);
    } catch (e) {
      haptic.warning();
      toast(e instanceof ApiError ? e.message : t('Error'));
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <Sheet title={t('Result')} onClose={onClose}>
        <div className="center">
          <div className="el-mascot center"><Mascot size={96} message={result.earned ? t('Great work!') : t('Almost! Try again.')} /></div>
          <div className="result-band">{result.band.toFixed(1)}</div>
          <div className="muted">{result.correct} {t('of')} {result.total} · {fmtClock(sec)}</div>
          <div className={`result-earn${result.earned ? '' : ' zero'}`}>{result.earned ? `+${result.earned} ${t('min')}` : t('no minutes')}</div>
          {result.repeat && <div className="hint">{t('This test was already counted — a repeat earns nothing.')}</div>}
          {result.halved && !result.repeat && <div className="hint">{t('Over the limit ({n} min) — the reward is halved.', { n: test.minutes + 10 })}</div>}
          {result.capped && !result.repeat && <div className="hint">{t('Daily limit or bank cap reached.')}</div>}
          <div className="muted small" style={{ marginTop: 6 }}>{t('Balance')}: {Math.floor(result.balance)} {t('min')}</div>
        </div>
        {result.wrong.length > 0 && (
          <Section label={t('Mistakes')}>
            {result.wrong.map((x) => (
              <div key={x.n} className="wrong">
                <b>{x.n}.</b> {t('yours')}: <i>{x.given || '—'}</i> · {t('correct')}: <b>{x.answer}</b>
                <div className="muted small">{x.explain}</div>
              </div>
            ))}
          </Section>
        )}
      </Sheet>
    );
  }

  return (
    <Sheet title={test.title} onClose={onClose}>
      <div className={`timer${sec > limit ? ' over' : ''}`}>{fmtClock(sec)} · {t('limit')} {test.minutes + 10} {t('min')} · {t('answered')} {answered}/{test.questions.length}</div>
      <div className="passage">
        {test.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
      </div>
      <div className="label" style={{ marginTop: 8 }}>{t('Questions')}</div>
      {test.questions.map((q, i) => (
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
          {q.type === 'gap' && <input placeholder={t('one word')} value={answers[i]} onChange={(e) => set(i, e.target.value)} />}
        </div>
      ))}
      <button className="btn solid block" style={{ marginTop: 16 }} disabled={busy || !answered} onClick={submit}>{busy ? t('Checking…') : `${t('Check')} (${answered}/${test.questions.length})`}</button>
      <div className="hint">{t('No point cheating: the minutes are yours, and the band shows your real level before the exam.')}</div>
    </Sheet>
  );
}

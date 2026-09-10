import { useEffect, useMemo, useRef, useState } from 'react';
import { GATE_APP_LABEL, MCQ_LETTERS, READING_TESTS, TFNG_OPTIONS, type GateApp, type ReadingResult, type ReadingTest, type WalletResponse } from '@tracker/shared';
import { api, ApiError } from '../api';
import { haptic, tg } from '../tg';
import { useToast } from '../components/Toast';
import { Field, Section, Sheet, Toggle } from '../components/ui';
import { useT } from '../i18n';

const ALL_APPS: GateApp[] = ['instagram', 'tiktok', 'youtube', 'vk'];

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
  const [howto, setHowto] = useState(false);

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

      <Section label={t('Reading')}>
        <p className="muted small">{t('Thirteen questions, band on the official scale. A pass earns social-media minutes:')} <b>5.0–5.5 → 10</b>, <b>6.0 → 15</b>, <b>6.5 {t('and up')} → 30</b>. {t('Over the time limit the reward is halved; a test counts once.')}</p>
        {READING_TESTS.map((x) => (
          <button key={x.id} className={`test-row${done.has(x.id) ? ' done' : ''}`} onClick={() => { haptic.tap(); setTest(x); }}>
            <div>
              <div>{x.title}</div>
              <div className="muted small">{x.topic} · {x.questions.length} {t('questions')} · {t('about')} {x.minutes} {t('min')}</div>
            </div>
            <span className="arrow">{done.has(x.id) ? '✓' : '→'}</span>
          </button>
        ))}
      </Section>

      <Section label={t('Minutes')}>
        <div className="balance">{Math.floor(w.balance)}<span>{t('min')}</span></div>
        <div className="muted small">
          {w.balance < 1
            ? t('Social media is locked. Pass a Reading test to open it.')
            : t('About {n} minutes in {apps}.', { n: Math.floor(w.balance), apps: w.apps.map((a) => GATE_APP_LABEL[a]).join(', ') || t('the gated apps') })}
        </div>
        <div className="muted small" style={{ marginTop: 4 }}>{t('Earned today {a} · {b} more possible · bank up to {c}', { a: w.earned_today, b: w.earn_left, c: w.bank_cap })}</div>
      </Section>

      <Section label={t('Locked apps')}>
        <Toggle label={t('Wallet on')} sub={t('Off, and the apps stop being blocked')} on={w.wallet_enabled} onChange={(v) => void patch({ wallet_enabled: v })} />
        <div className="field" style={{ marginTop: 10 }}>
          <label>{t('Which apps')}</label>
          <div className="chips">
            {ALL_APPS.map((a) => (
              <button key={a} className={`chip ${w.apps.includes(a) ? 'on' : ''}`} onClick={() => { haptic.select(); void patch({ apps: w.apps.includes(a) ? w.apps.filter((x) => x !== a) : [...w.apps, a] }); }}>{GATE_APP_LABEL[a]}</button>
            ))}
          </div>
        </div>
        <div className="field-grid">
          <Field label={t('Bank, max min')}><input type="number" min={0} max={600} defaultValue={w.bank_cap} onBlur={(e) => void patch({ bank_cap: Number(e.target.value) })} /></Field>
          <Field label={t('Daily limit')}><input type="number" min={0} max={600} defaultValue={w.daily_earn_cap} onBlur={(e) => void patch({ daily_earn_cap: Number(e.target.value) })} /></Field>
        </div>
        <button className="btn" onClick={() => { haptic.tap(); setHowto(true); }}>{t('Set up on iPhone')}</button>
      </Section>

      {w.sessions.length > 0 && (
        <Section label={t('Recent sessions')}>
          {w.sessions.slice(0, 8).map((s) => (
            <div key={s.id} className="row between small" style={{ padding: '4px 0' }}>
              <span>{GATE_APP_LABEL[s.app]}</span>
              <span className="muted">{s.started_at.slice(5, 16).replace('T', ' ')}</span>
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
      {howto && <Howto url={w.gate_url} apps={w.apps} onClose={() => setHowto(false)} />}
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
    const t = setInterval(() => setSec(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const limit = (test.minutes + 10) * 60;
  const answered = answers.filter(Boolean).length;
  const set = (i: number, v: string) => setAnswers((a) => a.map((x, j) => (j === i ? v : x)));

  const submit = async () => {
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

function Howto({ url, apps, onClose }: { url: string; apps: GateApp[]; onClose: () => void }) {
  const toast = useToast();
  const t = useT();
  const names = useMemo(() => apps.map((a) => GATE_APP_LABEL[a]).join(', ') || 'Instagram', [apps]);
  const copy = (s: string) => navigator.clipboard?.writeText(s).then(() => toast(t('Copied')), () => toast(t('Copy it by hand')));
  return (
    <Sheet title={t('iPhone Shortcuts')} onClose={onClose}>
      <p className="muted small">{t('iOS cannot ask a server for permission by itself, but Shortcuts can. Two automations per app ({apps}).', { apps: names })}</p>

      <Section label={t('Gate link')}>
        <code className="gate-url">{url}?app=instagram&e=open</code>
        <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
          <button className="btn link" onClick={() => copy(`${url}?app=instagram&e=open`)}>{t('Copy “opened”')}</button>
          <button className="btn link" onClick={() => copy(`${url}?app=instagram&e=close`)}>{t('Copy “closed”')}</button>
          <button className="btn link" onClick={() => { haptic.tap(); try { tg.openLink(`${url}?app=instagram&e=status`); } catch { window.open(`${url}?app=instagram&e=status`, '_blank'); } }}>{t('Test it')}</button>
        </div>
        <div className="hint">{t('For other apps replace')} <i>app=instagram</i> {t('with')} <i>tiktok</i>, <i>youtube</i> {t('or')} <i>vk</i>. {t('The link is personal — do not share it.')}</div>
      </Section>

      <Section label={t('Automation 1 — open')}>
        <div className="steps">
          <p>1. {t('Shortcuts → Automation → + → App.')}</p>
          <p>2. {t('App: Instagram. When: Is Opened. Run Immediately, notifications off.')}</p>
          <p>3. {t('Action Get Contents of URL → paste the “opened” link.')}</p>
          <p>4. {t('Action If: [Contents of URL] contains ALLOW.')}</p>
          <p>5. {t('In Otherwise: Show Notification (“Out of minutes — do a Reading”) and Open App → Shortcuts (or go Home via Open App → Settings).')}</p>
        </div>
      </Section>

      <Section label={t('Automation 2 — close')}>
        <div className="steps">
          <p>{t('The same, but When: Is Closed, with the “closed” link — it charges the minutes you used.')}</p>
          <p className="muted small">{t('If the close event never fires, the session closes itself after 45 minutes at most.')}</p>
        </div>
      </Section>

      <Section label={t('Make it stick')}>
        <div className="steps">
          <p>{t('Screen Time → a one-minute limit on these apps, and give the passcode to your partner. Then bypassing the automation stops being a two-second job.')}</p>
        </div>
      </Section>

      <button className="btn link" onClick={() => { haptic.tap(); try { tg.openLink('https://support.apple.com/guide/shortcuts/apd690170742/ios'); } catch { /* noop */ } }}>{t('Apple’s guide to automations')}</button>
    </Sheet>
  );
}

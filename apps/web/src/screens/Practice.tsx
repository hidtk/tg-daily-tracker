import { useEffect, useMemo, useRef, useState } from 'react';
import { GATE_APP_LABEL, MCQ_LETTERS, READING_TESTS, TFNG_OPTIONS, type GateApp, type ReadingResult, type ReadingTest, type WalletResponse } from '@tracker/shared';
import { api, ApiError } from '../api';
import { haptic, tg } from '../tg';
import { useToast } from '../components/Toast';
import { Field, Section, Sheet, Toggle } from '../components/ui';

const ALL_APPS: GateApp[] = ['instagram', 'tiktok', 'youtube', 'vk'];

function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60);
  return `${String(m).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}

export function Practice() {
  const toast = useToast();
  const [w, setW] = useState<WalletResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [test, setTest] = useState<ReadingTest | null>(null);
  const [howto, setHowto] = useState(false);

  const load = () => api.wallet().then(setW).catch((e: unknown) => setErr(e instanceof ApiError ? e.message : 'Could not load'));
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
      <h1>Practice</h1>

      <Section label="Reading">
        <p className="muted small">Thirteen questions, band on the official scale. A pass earns social-media minutes: <b>5.0–5.5 → 10</b>, <b>6.0 → 15</b>, <b>6.5 and up → 30</b>. Over the time limit the reward is halved; a test counts once.</p>
        {READING_TESTS.map((t) => (
          <button key={t.id} className={`test-row${done.has(t.id) ? ' done' : ''}`} onClick={() => { haptic.tap(); setTest(t); }}>
            <div>
              <div>{t.title}</div>
              <div className="muted small">{t.topic} · {t.questions.length} questions · about {t.minutes} min</div>
            </div>
            <span className="arrow">{done.has(t.id) ? '✓' : '→'}</span>
          </button>
        ))}
      </Section>

      <Section label="Minutes">
        <div className="balance">{Math.floor(w.balance)}<span>min</span></div>
        <div className="muted small">
          {w.balance < 1
            ? 'Social media is locked. Pass a Reading test to open it.'
            : `About ${Math.floor(w.balance)} minutes in ${w.apps.map((a) => GATE_APP_LABEL[a]).join(', ') || 'the gated apps'}.`}
        </div>
        <div className="muted small" style={{ marginTop: 4 }}>Earned today {w.earned_today} · {w.earn_left} more possible · bank up to {w.bank_cap}</div>
      </Section>

      <Section label="Locked apps">
        <Toggle label="Wallet on" sub="Off, and the apps stop being blocked" on={w.wallet_enabled} onChange={(v) => void patch({ wallet_enabled: v })} />
        <div className="field" style={{ marginTop: 10 }}>
          <label>Which apps</label>
          <div className="chips">
            {ALL_APPS.map((a) => (
              <button key={a} className={`chip ${w.apps.includes(a) ? 'on' : ''}`} onClick={() => { haptic.select(); void patch({ apps: w.apps.includes(a) ? w.apps.filter((x) => x !== a) : [...w.apps, a] }); }}>{GATE_APP_LABEL[a]}</button>
            ))}
          </div>
        </div>
        <div className="field-grid">
          <Field label="Bank, max min"><input type="number" min={0} max={600} defaultValue={w.bank_cap} onBlur={(e) => void patch({ bank_cap: Number(e.target.value) })} /></Field>
          <Field label="Daily limit"><input type="number" min={0} max={600} defaultValue={w.daily_earn_cap} onBlur={(e) => void patch({ daily_earn_cap: Number(e.target.value) })} /></Field>
        </div>
        <button className="btn" onClick={() => { haptic.tap(); setHowto(true); }}>Set up on iPhone</button>
      </Section>

      {w.sessions.length > 0 && (
        <Section label="Recent sessions">
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
            toast(r.earned ? `+${r.earned} min · band ${r.band.toFixed(1)}` : `Band ${r.band.toFixed(1)} · no minutes`);
          }}
        />
      )}
      {howto && <Howto url={w.gate_url} apps={w.apps} onClose={() => setHowto(false)} />}
    </div>
  );
}

function ReadingRunner({ test, onClose, onDone }: { test: ReadingTest; onClose: () => void; onDone: (r: ReadingResult) => void }) {
  const toast = useToast();
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
      toast(e instanceof ApiError ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <Sheet title="Result" onClose={onClose}>
        <div className="center">
          <div className="result-band">{result.band.toFixed(1)}</div>
          <div className="muted">{result.correct} of {result.total} · {fmtClock(sec)}</div>
          <div className={`result-earn${result.earned ? '' : ' zero'}`}>{result.earned ? `+${result.earned} min` : 'no minutes'}</div>
          {result.repeat && <div className="hint">This test was already counted — a repeat earns nothing.</div>}
          {result.halved && !result.repeat && <div className="hint">Over the limit ({test.minutes + 10} min) — the reward is halved.</div>}
          {result.capped && !result.repeat && <div className="hint">Daily limit or bank cap reached.</div>}
          <div className="muted small" style={{ marginTop: 6 }}>Balance: {Math.floor(result.balance)} min</div>
        </div>
        {result.wrong.length > 0 && (
          <Section label="Mistakes">
            {result.wrong.map((x) => (
              <div key={x.n} className="wrong">
                <b>{x.n}.</b> yours: <i>{x.given || '—'}</i> · correct: <b>{x.answer}</b>
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
      <div className={`timer${sec > limit ? ' over' : ''}`}>{fmtClock(sec)} · limit {test.minutes + 10} min · answered {answered}/{test.questions.length}</div>
      <div className="passage">
        {test.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
      </div>
      <div className="label" style={{ marginTop: 8 }}>Questions</div>
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
          {q.type === 'gap' && <input placeholder="one word" value={answers[i]} onChange={(e) => set(i, e.target.value)} />}
        </div>
      ))}
      <button className="btn solid block" style={{ marginTop: 16 }} disabled={busy || !answered} onClick={submit}>{busy ? 'Checking…' : `Check (${answered}/${test.questions.length})`}</button>
      <div className="hint">No point cheating: the minutes are yours, and the band shows your real level before the exam.</div>
    </Sheet>
  );
}

function Howto({ url, apps, onClose }: { url: string; apps: GateApp[]; onClose: () => void }) {
  const toast = useToast();
  const names = useMemo(() => apps.map((a) => GATE_APP_LABEL[a]).join(', ') || 'Instagram', [apps]);
  const copy = (s: string) => navigator.clipboard?.writeText(s).then(() => toast('Copied'), () => toast('Copy it by hand'));
  return (
    <Sheet title="iPhone Shortcuts" onClose={onClose}>
      <p className="muted small">iOS cannot ask a server for permission by itself, but Shortcuts can. Two automations per app ({names}).</p>

      <Section label="Gate link">
        <code className="gate-url">{url}?app=instagram&e=open</code>
        <div className="row" style={{ gap: 16 }}>
          <button className="btn link" onClick={() => copy(`${url}?app=instagram&e=open`)}>Copy “opened”</button>
          <button className="btn link" onClick={() => copy(`${url}?app=instagram&e=close`)}>Copy “closed”</button>
        </div>
        <div className="hint">For other apps replace <i>app=instagram</i> with <i>tiktok</i>, <i>youtube</i> or <i>vk</i>. The link is personal — do not share it.</div>
      </Section>

      <Section label="Automation 1 — open">
        <div className="steps">
          <p>1. Shortcuts → <b>Automation</b> → + → <b>App</b>.</p>
          <p>2. App: <b>Instagram</b>. When: <b>Is Opened</b>. <b>Run Immediately</b>, notifications off.</p>
          <p>3. Action <b>Get Contents of URL</b> → paste the “opened” link.</p>
          <p>4. Action <b>If</b>: [Contents of URL] <b>contains</b> <i>ALLOW</i>.</p>
          <p>5. In <b>Otherwise</b>: <b>Show Notification</b> (“Out of minutes — do a Reading”) and <b>Open App → Shortcuts</b> (or go Home via Open App → Settings).</p>
        </div>
      </Section>

      <Section label="Automation 2 — close">
        <div className="steps">
          <p>The same, but When: <b>Is Closed</b>, with the “closed” link — it charges the minutes you used.</p>
          <p className="muted small">If the close event never fires, the session closes itself after 45 minutes at most.</p>
        </div>
      </Section>

      <Section label="Make it stick">
        <div className="steps">
          <p>Screen Time → a one-minute limit on these apps, and give the passcode to your partner. Then bypassing the automation stops being a two-second job.</p>
        </div>
      </Section>

      <button className="btn link" onClick={() => { haptic.tap(); try { tg.openLink('https://support.apple.com/guide/shortcuts/apd690170742/ios'); } catch { /* noop */ } }}>Apple’s guide to automations</button>
    </Sheet>
  );
}

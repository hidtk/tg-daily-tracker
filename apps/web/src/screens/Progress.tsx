import { useEffect, useState } from 'react';
import type { IeltsResponse, MockTest, Skill, StatsResponse, WeekStat } from '@tracker/shared';
import { SKILLS, SKILL_LABEL, ieltsOverall, todayInTz, weekdayMon0 } from '@tracker/shared';
import { api, ApiError } from '../api';
import { deviceTz, haptic } from '../tg';
import { useToast } from '../components/Toast';
import { Field, MONTHS, Section, Sheet, WD, confirmDialog, fmtShort } from '../components/ui';

const SKILL_COLOR: Record<Skill, string> = { listening: 'var(--c5)', reading: 'var(--c2)', writing: 'var(--c1)', speaking: 'var(--c3)', vocab: 'var(--c4)', grammar: 'var(--c6)' };
const BAND_SERIES = ['overall', 'listening', 'reading', 'writing', 'speaking'] as const;
type BandSeries = (typeof BAND_SERIES)[number];

function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function level(done: number, scheduled: number): string {
  if (!done) return '';
  if (!scheduled) return 'l2';
  const r = done / scheduled;
  return r >= 1 ? 'l4' : r >= 0.66 ? 'l3' : r >= 0.34 ? 'l2' : 'l1';
}

export function Progress() {
  const [data, setData] = useState<IeltsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addMock, setAddMock] = useState(false);
  const [month, setMonth] = useState(todayInTz(deviceTz()).slice(0, 7));
  const [stats, setStats] = useState<StatsResponse | null>(null);

  const load = () => api.ielts().then(setData).catch((e: unknown) => setError(e instanceof ApiError ? e.message : 'Could not load'));
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    setStats(null);
    void api.stats(month).then(setStats);
  }, [month]);

  if (error) return <div className="screen"><div className="err">{error}</div></div>;
  if (!data) return <span className="spinner" />;

  const today = stats?.today ?? todayInTz(deviceTz());
  const thisWeek = data.weeks[data.weeks.length - 1];
  const hoursThisWeek = thisWeek.minutes_total / 60;
  const lastMock = data.mocks[data.mocks.length - 1];
  const [y, m] = month.split('-').map(Number);
  const lead = weekdayMon0(`${month}-01`);
  const streak = stats?.streaks[0];

  return (
    <div className="screen">
      <h1>Progress</h1>

      <div className="tiles">
        <div className="tile">
          <div className="v">{data.days_left != null ? (data.days_left >= 0 ? data.days_left : '—') : '—'}</div>
          <div className="l">{data.exam_date ? `days to the exam · ${fmtShort(data.exam_date)}` : 'exam date not set'}</div>
        </div>
        <div className="tile">
          <div className="v">{lastMock?.overall != null ? lastMock.overall.toFixed(1) : '—'}<span className="muted" style={{ fontSize: 18 }}> / {data.target.toFixed(1)}</span></div>
          <div className="l">{lastMock ? `last mock · target` : 'no mock tests yet'}</div>
        </div>
        <div className="tile">
          <div className="v">{hoursThisWeek.toFixed(1)}<span className="muted" style={{ fontSize: 18 }}> / {data.weekly_hours} h</span></div>
          <div className="l">this week</div>
        </div>
        <div className="tile">
          <div className="v">{streak?.current ?? data.streak?.current ?? 0}</div>
          <div className="l">day streak · best {streak?.best ?? data.streak?.best ?? 0} · {data.discipline}% over 4 weeks</div>
        </div>
      </div>

      <Section label="Calendar">
        <div className="row between cal-nav" style={{ marginBottom: 8 }}>
          <button className="btn link" onClick={() => { haptic.tap(); setMonth(shiftMonth(month, -1)); }}>‹</button>
          <span>{MONTHS[m - 1]} {y}</span>
          <button className="btn link" disabled={month >= today.slice(0, 7)} onClick={() => { haptic.tap(); setMonth(shiftMonth(month, 1)); }}>›</button>
        </div>
        {!stats ? <span className="spinner" /> : (
          <div className="cal">
            {WD.map((w) => <div key={w} className="wd">{w}</div>)}
            {Array.from({ length: lead }).map((_, i) => <div key={`e${i}`} />)}
            {stats.days.map((d) => (
              <div key={d.date} className={`day ${d.date > today ? 'future' : level(d.done, d.scheduled)} ${d.date === today ? 'today' : ''}`} title={`${d.done}/${d.scheduled}`}>{Number(d.date.slice(8))}</div>
            ))}
          </div>
        )}
      </Section>

      <Section label="Mock tests">
        {data.mocks.length ? <BandChart mocks={data.mocks} target={data.target} /> : <p className="muted small">Add your first mock test result and the band chart appears here.</p>}
        {data.mocks.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div className="mock-row"><span className="h">Date</span><span className="h">L</span><span className="h">R</span><span className="h">W</span><span className="h">S</span><span className="h">All</span><span /></div>
            {[...data.mocks].reverse().map((mk) => (
              <div key={mk.id} className="mock-row">
                <span>{fmtShort(mk.date)}</span>
                <b>{mk.listening ?? '—'}</b><b>{mk.reading ?? '—'}</b><b>{mk.writing ?? '—'}</b><b>{mk.speaking ?? '—'}</b>
                <b style={{ color: (mk.overall ?? 0) >= data.target ? 'var(--ok)' : 'inherit' }}>{mk.overall ?? '—'}</b>
                <button className="btn link" style={{ color: 'var(--muted)', textDecoration: 'none' }} onClick={async () => {
                  if (!(await confirmDialog('Delete this result?'))) return;
                  await api.deleteMock(mk.id);
                  haptic.success();
                  void load();
                }}>✕</button>
              </div>
            ))}
          </div>
        )}
        <button className="btn sm" style={{ marginTop: 12 }} onClick={() => { haptic.tap(); setAddMock(true); }}>Add a mock test</button>
      </Section>

      <Section label="Minutes by week">
        <MinutesChart weeks={data.weeks} targetHours={data.weekly_hours} />
        <div className="legend-row">
          {SKILLS.map((s) => <span key={s}><i style={{ background: SKILL_COLOR[s] }} />{SKILL_LABEL[s]}</span>)}
          <span><i style={{ background: 'var(--rule)' }} />untagged</span>
        </div>
        <div className="hint">{(data.total_minutes / 60).toFixed(1)} hours over twelve weeks.</div>
      </Section>

      <Section label="Discipline · done of planned days">
        <DisciplineChart weeks={data.weeks} />
      </Section>

      {addMock && <MockForm onClose={() => setAddMock(false)} onSaved={() => { setAddMock(false); void load(); }} />}
    </div>
  );
}

// ---------- Charts (inline SVG, ink on paper) ----------

const W = 340;

function BandChart({ mocks, target }: { mocks: MockTest[]; target: number }) {
  const H = 170;
  const pad = { l: 26, r: 10, t: 14, b: 22 };
  const [series, setSeries] = useState<BandSeries>('overall');
  const xs = mocks.map((_, i) => pad.l + (mocks.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (mocks.length - 1)));
  const min = 4, max = 9;
  const y = (v: number) => pad.t + ((max - v) / (max - min)) * (H - pad.t - pad.b);
  const vals = mocks.map((mk) => mk[series]);
  const pts = vals.map((v, i) => (v == null ? null : ([xs[i], y(v)] as const)));
  const path = pts.filter(Boolean).map((p, i) => `${i ? 'L' : 'M'}${p![0]},${p![1]}`).join(' ');
  return (
    <>
      <div className="chips" style={{ marginBottom: 6 }}>
        {BAND_SERIES.map((k) => (
          <button key={k} type="button" className={`chip ${series === k ? 'on' : ''}`} onClick={() => { haptic.select(); setSeries(k); }}>{k === 'overall' ? 'Overall' : SKILL_LABEL[k]}</button>
        ))}
      </div>
      <svg className="viz" viewBox={`0 0 ${W} ${H}`}>
        {[5, 6, 7, 8, 9].map((v) => (
          <g key={v}>
            <line className="grid" x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} />
            <text x={pad.l - 6} y={y(v) + 4} textAnchor="end">{v}</text>
          </g>
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={y(target)} y2={y(target)} stroke="var(--accent)" strokeWidth={1} strokeDasharray="3 4" />
        <text x={W - pad.r} y={y(target) - 4} textAnchor="end" style={{ fill: 'var(--accent)' }}>target {target.toFixed(1)}</text>
        <path d={path} fill="none" stroke="var(--ink)" strokeWidth={1.5} strokeLinejoin="round" />
        {pts.map((p, i) => p && (
          <g key={i}>
            <circle cx={p[0]} cy={p[1]} r={3.5} fill="var(--paper)" stroke="var(--ink)" strokeWidth={1.5} />
            {mocks.length <= 8 && <text x={p[0]} y={p[1] - 9} textAnchor="middle" style={{ fill: 'var(--ink)' }}>{vals[i]?.toFixed(1)}</text>}
          </g>
        ))}
        {mocks.map((mk, i) => (mocks.length <= 8 || i % 2 === 0 || i === mocks.length - 1) && <text key={mk.id} x={xs[i]} y={H - 6} textAnchor="middle">{fmtShort(mk.date)}</text>)}
      </svg>
    </>
  );
}

function MinutesChart({ weeks, targetHours }: { weeks: WeekStat[]; targetHours: number }) {
  const H = 160;
  const pad = { l: 30, r: 6, t: 12, b: 20 };
  const maxMin = Math.max(targetHours * 60, ...weeks.map((w) => w.minutes_total), 60);
  const y = (v: number) => pad.t + (1 - v / maxMin) * (H - pad.t - pad.b);
  const bw = (W - pad.l - pad.r) / weeks.length;
  const ticks = [0, 0.5, 1].map((f) => Math.round((maxMin * f) / 30) * 30);
  return (
    <svg className="viz" viewBox={`0 0 ${W} ${H}`}>
      {ticks.map((t) => (
        <g key={t}>
          <line className="grid" x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
          <text x={pad.l - 5} y={y(t) + 4} textAnchor="end">{t >= 60 ? `${(t / 60).toFixed(t % 60 ? 1 : 0)}h` : `${t}m`}</text>
        </g>
      ))}
      {targetHours > 0 && <line x1={pad.l} x2={W - pad.r} y1={y(targetHours * 60)} y2={y(targetHours * 60)} stroke="var(--accent)" strokeWidth={1} strokeDasharray="3 4" />}
      {weeks.map((w, i) => {
        const x = pad.l + i * bw + 3;
        const width = Math.max(4, bw - 6);
        let acc = 0;
        const tagged = SKILLS.reduce((s, k) => s + w.minutes_by_skill[k], 0);
        const untagged = Math.max(0, w.minutes_total - tagged);
        const segs = [...SKILLS.map((k) => ({ k: k as string, v: w.minutes_by_skill[k], c: SKILL_COLOR[k] })), { k: 'other', v: untagged, c: 'var(--rule)' }].filter((s) => s.v > 0);
        return (
          <g key={w.from}>
            {segs.map((s) => {
              const y0 = y(acc + s.v);
              const h = y(acc) - y0;
              acc += s.v;
              return <rect key={s.k} x={x} y={y0} width={width} height={Math.max(0, h - 1)} fill={s.c} />;
            })}
            {i === weeks.length - 1 && w.minutes_total > 0 && <text x={x + width / 2} y={y(w.minutes_total) - 4} textAnchor="middle" style={{ fill: 'var(--ink)' }}>{(w.minutes_total / 60).toFixed(1)}h</text>}
            {(i % 3 === 0 || i === weeks.length - 1) && <text x={x + width / 2} y={H - 6} textAnchor="middle">{fmtShort(w.from)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

function DisciplineChart({ weeks }: { weeks: WeekStat[] }) {
  const H = 110;
  const pad = { l: 30, r: 6, t: 12, b: 20 };
  const y = (v: number) => pad.t + (1 - v / 100) * (H - pad.t - pad.b);
  const bw = (W - pad.l - pad.r) / weeks.length;
  return (
    <svg className="viz" viewBox={`0 0 ${W} ${H}`}>
      {[0, 50, 100].map((t) => (
        <g key={t}>
          <line className="grid" x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
          <text x={pad.l - 5} y={y(t) + 4} textAnchor="end">{t}%</text>
        </g>
      ))}
      {weeks.map((w, i) => {
        const pct = w.scheduled ? Math.round((w.done / w.scheduled) * 100) : 0;
        const x = pad.l + i * bw + 3;
        const width = Math.max(4, bw - 6);
        return (
          <g key={w.from}>
            {w.scheduled > 0 && <rect x={x} y={y(pct)} width={width} height={Math.max(0, y(0) - y(pct))} fill={pct >= 80 ? 'var(--ink)' : pct >= 50 ? 'var(--c3)' : 'var(--accent)'} />}
            {w.scheduled > 0 && i === weeks.length - 1 && <text x={x + width / 2} y={y(pct) - 4} textAnchor="middle" style={{ fill: 'var(--ink)' }}>{pct}%</text>}
            {(i % 3 === 0 || i === weeks.length - 1) && <text x={x + width / 2} y={H - 6} textAnchor="middle">{fmtShort(w.from)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// ---------- Forms ----------

const BANDS = [4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9];

export function BandSelect({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}>
      <option value="">—</option>
      {BANDS.map((b) => <option key={b} value={b}>{b.toFixed(1)}</option>)}
    </select>
  );
}

function MockForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [date, setDate] = useState(todayInTz(deviceTz()));
  const [l, setL] = useState<number | null>(null);
  const [r, setR] = useState<number | null>(null);
  const [w, setW] = useState<number | null>(null);
  const [s, setS] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const overall = ieltsOverall(l, r, w, s);
  const submit = async () => {
    if ([l, r, w, s].every((x) => x === null)) return toast('Enter at least one section');
    setBusy(true);
    try {
      await api.addMock({ date, listening: l, reading: r, writing: w, speaking: s, overall, note: note.trim() || null });
      haptic.success();
      onSaved();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet title="Mock test" onClose={onClose}>
      <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <div className="grid5">
        <Field label="Listening"><BandSelect value={l} onChange={setL} /></Field>
        <Field label="Reading"><BandSelect value={r} onChange={setR} /></Field>
        <Field label="Writing"><BandSelect value={w} onChange={setW} /></Field>
        <Field label="Speaking"><BandSelect value={s} onChange={setS} /></Field>
      </div>
      <div className="muted small" style={{ marginBottom: 12 }}>Overall: <b>{overall?.toFixed(1) ?? '— (all four sections needed)'}</b></div>
      <Field label="Note"><input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Cambridge 18, Test 2" /></Field>
      <button className="btn solid block" disabled={busy} onClick={submit}>Save</button>
    </Sheet>
  );
}

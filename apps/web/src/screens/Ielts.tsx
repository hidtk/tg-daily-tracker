import { useEffect, useState } from 'react';
import type { IeltsResponse, MockTest, Skill, WeekStat } from '@tracker/shared';
import { SKILLS, SKILL_LABEL, ieltsOverall, todayInTz } from '@tracker/shared';
import { api, ApiError } from '../api';
import { deviceTz, haptic, tg } from '../tg';
import { useToast } from '../components/Toast';
import { Field, Sheet } from '../components/ui';

// Categorical palette (validated, see dataviz reference): fixed order per skill.
const SKILL_COLOR: Record<Skill, string> = {
  listening: '#2a78d6',
  reading: '#eb6834',
  writing: '#1baf7a',
  speaking: '#eda100',
  vocab: '#e87ba4',
  grammar: '#4a3aa7',
};
const BAND_COLORS = { overall: '#2a78d6', listening: '#eb6834', reading: '#1baf7a', writing: '#eda100', speaking: '#e87ba4' } as const;

function fmtShort(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${Number(d)}.${m}`;
}

export function Ielts() {
  const [data, setData] = useState<IeltsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addMock, setAddMock] = useState(false);
  const [editGoal, setEditGoal] = useState(false);

  const load = () => api.ielts().then(setData).catch((e: unknown) => setError(e instanceof ApiError ? e.message : 'Ошибка'));
  useEffect(() => {
    void load();
  }, []);

  if (error) return <div className="screen"><div className="err">{error}</div></div>;
  if (!data) return <span className="spinner" />;

  const thisWeek = data.weeks[data.weeks.length - 1];
  const hoursThisWeek = thisWeek.minutes_total / 60;
  const weekPct = data.weekly_hours ? Math.min(100, Math.round((hoursThisWeek / data.weekly_hours) * 100)) : 0;
  const lastMock = data.mocks[data.mocks.length - 1];
  const gap = lastMock?.overall != null ? Math.round((data.target - lastMock.overall) * 2) / 2 : null;
  const weeksLeft = data.days_left != null ? Math.max(0, Math.floor(data.days_left / 7)) : null;

  return (
    <div className="screen">
      <h1>IELTS</h1>

      <div className="tiles">
        <div className="tile wide" onClick={() => setEditGoal(true)} role="button">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="v">{data.days_left != null ? (data.days_left >= 0 ? `${data.days_left} дн.` : 'Экзамен прошёл') : 'Дата не задана'}</div>
              <div className="l">
                {data.exam_date ? `до экзамена · ${data.exam_date}` : 'нажми, чтобы задать дату'}
                {weeksLeft != null && data.days_left! >= 0 && ` · ${weeksLeft} нед. × ${data.weekly_hours} ч = ${Math.round(weeksLeft * data.weekly_hours)} ч практики`}
              </div>
            </div>
            <div className="center">
              <div className="v">{data.target.toFixed(1)}</div>
              <div className="l">цель</div>
            </div>
          </div>
          {!data.deadline_editable && <div className="small muted" style={{ marginTop: 6 }}>Дату уже меняли сегодня — снова можно завтра.</div>}
        </div>
        <div className="tile">
          <div className="v">{hoursThisWeek.toFixed(1)} ч</div>
          <div className="l">на этой неделе из {data.weekly_hours} ч</div>
          <div className="bar"><i style={{ width: `${weekPct}%` }} /></div>
        </div>
        <div className="tile">
          <div className="v" style={{ color: data.discipline >= 80 ? 'var(--ok)' : data.discipline >= 50 ? '#d97706' : 'var(--destructive)' }}>{data.discipline}%</div>
          <div className="l">дисциплина за 4 недели</div>
          <div className="small muted">🔥 стрик {data.streak?.current ?? 0} · лучший {data.streak?.best ?? 0}</div>
        </div>
        {lastMock && (
          <div className="tile wide">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div className="v">{lastMock.overall?.toFixed(1) ?? '—'}</div>
                <div className="l">последний пробный · {fmtShort(lastMock.date)}</div>
              </div>
              <div className="center">
                <div className="v" style={{ color: gap != null && gap <= 0 ? 'var(--ok)' : 'inherit' }}>{gap != null ? (gap <= 0 ? '✓' : `−${gap.toFixed(1)}`) : '—'}</div>
                <div className="l">до цели</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="section-title">Пробные тесты · band</div>
      <div className="card">
        {data.mocks.length < 1 ? (
          <div className="muted small">Добавь результат первого пробного теста — здесь появится график движения к {data.target.toFixed(1)}.</div>
        ) : (
          <BandChart mocks={data.mocks} target={data.target} />
        )}
        <button className="btn secondary" style={{ marginTop: 10 }} onClick={() => { haptic.tap(); setAddMock(true); }}>+ Добавить пробный тест</button>
        {data.mocks.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div className="mock-row"><span className="h">Дата</span><span className="h">L</span><span className="h">R</span><span className="h">W</span><span className="h">S</span><span className="h">Overall</span><span /></div>
            {[...data.mocks].reverse().map((m) => (
              <div key={m.id} className="mock-row">
                <span>{fmtShort(m.date)}</span>
                <b>{m.listening ?? '—'}</b><b>{m.reading ?? '—'}</b><b>{m.writing ?? '—'}</b><b>{m.speaking ?? '—'}</b>
                <b style={{ color: (m.overall ?? 0) >= data.target ? 'var(--ok)' : 'inherit' }}>{m.overall ?? '—'}</b>
                <button className="btn ghost" style={{ padding: 0, color: 'var(--hint)' }} onClick={async () => {
                  const ok = await confirmDialog('Удалить результат?');
                  if (!ok) return;
                  await api.deleteMock(m.id);
                  haptic.success();
                  void load();
                }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section-title">Минуты по неделям · навыки</div>
      <div className="card">
        <MinutesChart weeks={data.weeks} targetHours={data.weekly_hours} />
        <div className="legend-row">
          {SKILLS.map((s) => <span key={s}><i style={{ background: SKILL_COLOR[s] }} />{SKILL_LABEL[s]}</span>)}
          <span><i style={{ background: 'var(--hint)' }} />без навыка</span>
        </div>
        <div className="small muted" style={{ marginTop: 6 }}>Всего за 12 недель: {(data.total_minutes / 60).toFixed(1)} ч. Отмечай минуты и навыки на экране «Сегодня» или отвечай боту после фото.</div>
      </div>

      <div className="section-title">Дисциплина · подтверждено из запланированных</div>
      <div className="card">
        <DisciplineChart weeks={data.weeks} />
      </div>

      {addMock && (
        <MockForm
          onClose={() => setAddMock(false)}
          onSaved={() => { setAddMock(false); void load(); }}
        />
      )}
      {editGoal && (
        <GoalForm
          target={data.target}
          examDate={data.exam_date}
          weeklyHours={data.weekly_hours}
          editable={data.deadline_editable}
          onClose={() => setEditGoal(false)}
          onSaved={() => { setEditGoal(false); void load(); }}
        />
      )}
    </div>
  );
}

function confirmDialog(msg: string): Promise<boolean> {
  return new Promise((res) => {
    try {
      tg.showConfirm(msg, res);
    } catch {
      res(window.confirm(msg));
    }
  });
}

// ---------- Charts (inline SVG, theme-aware via CSS vars) ----------

const W = 340;

function BandChart({ mocks, target }: { mocks: MockTest[]; target: number }) {
  const H = 170;
  const pad = { l: 28, r: 10, t: 12, b: 22 };
  const [sel, setSel] = useState<number | null>(null);
  const [series, setSeries] = useState<keyof typeof BAND_COLORS>('overall');
  const xs = mocks.map((_, i) => pad.l + (mocks.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (mocks.length - 1)));
  const min = 4, max = 9;
  const y = (v: number) => pad.t + ((max - v) / (max - min)) * (H - pad.t - pad.b);
  const vals = mocks.map((m) => m[series]);
  const pts = vals.map((v, i) => (v == null ? null : [xs[i], y(v)] as const));
  const path = pts.filter(Boolean).map((p, i) => `${i ? 'L' : 'M'}${p![0]},${p![1]}`).join(' ');
  return (
    <>
      <div className="chips" style={{ marginBottom: 6 }}>
        {(Object.keys(BAND_COLORS) as (keyof typeof BAND_COLORS)[]).map((k) => (
          <button key={k} type="button" className={`chip sel ${series === k ? 'on' : ''}`} onClick={() => { haptic.select(); setSeries(k); }}>
            {k === 'overall' ? 'Overall' : SKILL_LABEL[k]}
          </button>
        ))}
      </div>
      <svg className="viz" viewBox={`0 0 ${W} ${H}`} onClick={() => setSel(null)}>
        {[5, 6, 7, 8, 9].map((v) => (
          <g key={v}>
            <line className="grid" x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} />
            <text x={pad.l - 6} y={y(v) + 4} textAnchor="end">{v}</text>
          </g>
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={y(target)} y2={y(target)} stroke="var(--ok)" strokeWidth={1.5} strokeDasharray="4 4" />
        <text x={W - pad.r} y={y(target) - 4} textAnchor="end" fill="var(--ok)" style={{ fill: 'var(--ok)', fontWeight: 600 }}>цель {target.toFixed(1)}</text>
        <path d={path} fill="none" stroke={BAND_COLORS[series]} strokeWidth={2} strokeLinejoin="round" />
        {pts.map((p, i) => p && (
          <g key={i} onClick={(e) => { e.stopPropagation(); setSel(sel === i ? null : i); }}>
            <circle cx={p[0]} cy={p[1]} r={12} fill="transparent" />
            <circle cx={p[0]} cy={p[1]} r={4} fill={BAND_COLORS[series]} stroke="var(--section)" strokeWidth={2} />
            {(sel === i || mocks.length <= 6) && (
              <text x={p[0]} y={p[1] - 9} textAnchor="middle" style={{ fill: 'var(--text)', fontWeight: 600 }}>{vals[i]?.toFixed(1)}</text>
            )}
          </g>
        ))}
        {mocks.map((m, i) => (
          (mocks.length <= 8 || i % 2 === 0 || i === mocks.length - 1) && <text key={m.id} x={xs[i]} y={H - 6} textAnchor="middle">{fmtShort(m.date)}</text>
        ))}
      </svg>
    </>
  );
}

function MinutesChart({ weeks, targetHours }: { weeks: WeekStat[]; targetHours: number }) {
  const H = 160;
  const pad = { l: 30, r: 6, t: 10, b: 20 };
  const [sel, setSel] = useState<number | null>(null);
  const maxMin = Math.max(targetHours * 60, ...weeks.map((w) => w.minutes_total), 60);
  const y = (v: number) => pad.t + (1 - v / maxMin) * (H - pad.t - pad.b);
  const bw = (W - pad.l - pad.r) / weeks.length;
  const ticks = [0, 0.5, 1].map((f) => Math.round((maxMin * f) / 30) * 30);
  return (
    <svg className="viz" viewBox={`0 0 ${W} ${H}`} onClick={() => setSel(null)}>
      {ticks.map((t) => (
        <g key={t}>
          <line className="grid" x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
          <text x={pad.l - 5} y={y(t) + 4} textAnchor="end">{t >= 60 ? `${(t / 60).toFixed(t % 60 ? 1 : 0)}ч` : `${t}м`}</text>
        </g>
      ))}
      {targetHours > 0 && <line x1={pad.l} x2={W - pad.r} y1={y(targetHours * 60)} y2={y(targetHours * 60)} stroke="var(--ok)" strokeWidth={1.5} strokeDasharray="4 4" />}
      {weeks.map((w, i) => {
        const x = pad.l + i * bw + 3;
        const width = Math.max(4, bw - 6);
        let acc = 0;
        const tagged = SKILLS.reduce((s, k) => s + w.minutes_by_skill[k], 0);
        const untagged = Math.max(0, w.minutes_total - tagged);
        const segs: { k: string; v: number; c: string }[] = [
          ...SKILLS.map((k) => ({ k, v: w.minutes_by_skill[k], c: SKILL_COLOR[k] })),
          { k: 'other', v: untagged, c: 'var(--hint)' },
        ].filter((s) => s.v > 0);
        return (
          <g key={w.from} onClick={(e) => { e.stopPropagation(); setSel(sel === i ? null : i); }}>
            <rect x={pad.l + i * bw} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
            {segs.map((s) => {
              const y0 = y(acc + s.v);
              const h = y(acc) - y0;
              acc += s.v;
              return <rect key={s.k} x={x} y={y0} width={width} height={Math.max(0, h - 1)} fill={s.c} rx={2} />;
            })}
            {(sel === i || i === weeks.length - 1) && w.minutes_total > 0 && (
              <text x={x + width / 2} y={y(w.minutes_total) - 4} textAnchor="middle" style={{ fill: 'var(--text)', fontWeight: 600 }}>{(w.minutes_total / 60).toFixed(1)}ч</text>
            )}
            {(i % 3 === 0 || i === weeks.length - 1) && <text x={x + width / 2} y={H - 6} textAnchor="middle">{fmtShort(w.from)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

function DisciplineChart({ weeks }: { weeks: WeekStat[] }) {
  const H = 110;
  const pad = { l: 30, r: 6, t: 10, b: 20 };
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
        const color = pct >= 80 ? 'var(--ok)' : pct >= 50 ? '#eda100' : 'var(--destructive)';
        return (
          <g key={w.from}>
            {w.scheduled > 0 && <rect x={x} y={y(pct)} width={width} height={Math.max(0, y(0) - y(pct))} fill={color} rx={2} opacity={i === weeks.length - 1 ? 1 : 0.8} />}
            {w.scheduled > 0 && (i === weeks.length - 1 || pct === 100) && <text x={x + width / 2} y={y(pct) - 4} textAnchor="middle" style={{ fill: 'var(--text)', fontWeight: 600 }}>{pct}%</text>}
            {(i % 3 === 0 || i === weeks.length - 1) && <text x={x + width / 2} y={H - 6} textAnchor="middle">{fmtShort(w.from)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// ---------- Forms ----------

const BANDS = [4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9];

function BandSelect({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}>
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
    if ([l, r, w, s].every((x) => x === null)) return toast('Укажи хотя бы одну секцию');
    setBusy(true);
    try {
      await api.addMock({ date, listening: l, reading: r, writing: w, speaking: s, overall, note: note.trim() || null });
      haptic.success();
      onSaved();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet title="Пробный тест" onClose={onClose}>
      <Field label="Дата"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <div className="grid5">
        <Field label="Listening"><BandSelect value={l} onChange={setL} /></Field>
        <Field label="Reading"><BandSelect value={r} onChange={setR} /></Field>
        <Field label="Writing"><BandSelect value={w} onChange={setW} /></Field>
        <Field label="Speaking"><BandSelect value={s} onChange={setS} /></Field>
      </div>
      <div className="small muted" style={{ marginBottom: 10 }}>Overall: <b>{overall?.toFixed(1) ?? '— (нужны все 4 секции)'}</b></div>
      <Field label="Заметка"><input className="input" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Cambridge 18, Test 2" /></Field>
      <button className="btn" disabled={busy} onClick={submit}>Сохранить</button>
    </Sheet>
  );
}

function GoalForm({ target, examDate, weeklyHours, editable, onClose, onSaved }: { target: number; examDate: string | null; weeklyHours: number; editable: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [t, setT] = useState(target);
  const [d, setD] = useState(examDate ?? '');
  const [h, setH] = useState(weeklyHours);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const patch: Parameters<typeof api.saveSettings>[0] = { ielts_target: t, ielts_weekly_hours: h };
      if ((d || null) !== examDate) patch.ielts_exam_date = d || null;
      await api.saveSettings(patch);
      haptic.success();
      onSaved();
    } catch (e) {
      haptic.warning();
      toast(e instanceof ApiError ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet title="Цель IELTS" onClose={onClose}>
      <Field label="Целевой балл"><BandSelect value={t} onChange={(v) => setT(v ?? 7)} /></Field>
      <Field label={editable ? 'Дата экзамена (менять можно раз в день)' : 'Дата экзамена — уже меняли сегодня'}>
        <input className="input" type="date" value={d} disabled={!editable} onChange={(e) => setD(e.target.value)} />
      </Field>
      <Field label="Цель часов практики в неделю">
        <input className="input" type="number" min={0} max={80} step={0.5} value={h} onChange={(e) => setH(Number(e.target.value))} />
      </Field>
      <button className="btn" disabled={busy} onClick={submit}>Сохранить</button>
    </Sheet>
  );
}

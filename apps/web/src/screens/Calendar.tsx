import { useEffect, useState } from 'react';
import type { Activity, StatsResponse, TodayResponse } from '@tracker/shared';
import { todayInTz, weekdayMon0 } from '@tracker/shared';
import { api } from '../api';
import { deviceTz, haptic } from '../tg';
import { MONTHS_RU, Sheet, WD_RU, fmtDate } from '../components/ui';

function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function level(done: number, scheduled: number): string {
  if (!scheduled || !done) return done ? 'l2' : '';
  const r = done / scheduled;
  if (r >= 1) return 'l4';
  if (r >= 0.66) return 'l3';
  if (r >= 0.34) return 'l2';
  return 'l1';
}

export function Calendar() {
  const [month, setMonth] = useState(todayInTz(deviceTz()).slice(0, 7));
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const today = stats?.today ?? todayInTz(deviceTz());
  const [activities, setActivities] = useState<Activity[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [day, setDay] = useState<TodayResponse | null>(null);

  useEffect(() => {
    setStats(null);
    void api.stats(month).then(setStats);
  }, [month]);
  useEffect(() => {
    void api.activities().then((r) => setActivities(r.activities));
  }, []);
  useEffect(() => {
    if (!sel) return;
    setDay(null);
    void api.today(sel).then(setDay);
  }, [sel]);

  const [y, m] = month.split('-').map(Number);
  const first = `${month}-01`;
  const lead = weekdayMon0(first);
  const byDate = new Map(stats?.days.map((d) => [d.date, d]) ?? []);
  const actById = new Map(activities.map((a) => [a.id, a]));

  return (
    <div className="screen">
      <div className="datenav">
        <button onClick={() => { haptic.tap(); setMonth(shiftMonth(month, -1)); }}>‹</button>
        <div className="d">{MONTHS_RU[m - 1]} {y}</div>
        <button disabled={month >= today.slice(0, 7)} onClick={() => { haptic.tap(); setMonth(shiftMonth(month, 1)); }}>›</button>
      </div>

      <div className="card">
        {!stats ? (
          <span className="spinner" />
        ) : (
          <>
            <div className="cal">
              {WD_RU.map((w) => <div key={w} className="wd">{w}</div>)}
              {Array.from({ length: lead }).map((_, i) => <div key={`e${i}`} className="day empty" />)}
              {stats.days.map((d) => {
                const dn = Number(d.date.slice(8));
                const future = d.date > today;
                return (
                  <button
                    key={d.date}
                    className={`day ${future ? 'future' : level(d.done, d.scheduled)} ${d.date === today ? 'today' : ''} ${sel === d.date ? 'sel' : ''}`}
                    disabled={future}
                    onClick={() => { haptic.select(); setSel(d.date); }}
                    title={`${d.done}/${d.scheduled}`}
                  >
                    {dn}
                  </button>
                );
              })}
            </div>
            <div className="legend">
              меньше <i /> <i className="l1" /> <i className="l2" /> <i className="l3" /> <i className="l4" /> больше
            </div>
          </>
        )}
      </div>

      <div className="section-title">Стрики</div>
      <div className="card">
        {stats && stats.streaks.length === 0 && <div className="muted small">Нет активных активностей</div>}
        {stats?.streaks.map((s) => {
          const a = actById.get(s.activity_id);
          if (!a) return null;
          return (
            <div key={s.activity_id} className="streak">
              <span style={{ fontSize: 22 }}>{a.emoji}</span>
              <div className="grow">
                <div>{a.name}</div>
                <div className="best">Лучший: {s.best} · всего {s.done_total}</div>
              </div>
              <div className="num">🔥 {s.current}</div>
            </div>
          );
        })}
      </div>

      {sel && (
        <Sheet title={fmtDate(sel, today)} onClose={() => setSel(null)}>
          {!day ? (
            <span className="spinner" />
          ) : (
            <DayDetails day={day} byDateInfo={byDate.get(sel)} />
          )}
        </Sheet>
      )}
    </div>
  );
}

function DayDetails({ day, byDateInfo }: { day: TodayResponse; byDateInfo?: { done: number; scheduled: number } }) {
  const entries = new Map(day.entries.map((e) => [e.activity_id, e]));
  const ids = new Set(day.scheduled_ids);
  const rows = day.activities.filter((a) => ids.has(a.id) || entries.has(a.id));
  if (!rows.length) return <div className="muted">Ничего не было запланировано.</div>;
  return (
    <>
      {byDateInfo && <div className="muted small" style={{ marginBottom: 8 }}>Выполнено {byDateInfo.done} из {byDateInfo.scheduled}</div>}
      {rows.map((a) => {
        const e = entries.get(a.id);
        return (
          <div key={a.id} className="list-item" style={{ ['--act-color' as string]: a.color, alignItems: 'flex-start' }}>
            <div className="emoji">{a.emoji}</div>
            <div className="grow">
              <div>
                {a.name} {e?.done ? '✅' : e?.planned ? '⬜' : <span className="muted">—</span>}
                {!ids.has(a.id) && <span className="chip" style={{ marginLeft: 6 }}>вне расписания</span>}
              </div>
              {e?.plan_note && <div className="sub">📝 План: {e.plan_note}</div>}
              {e?.done_note && <div className="sub">✅ Факт: {e.done_note}</div>}
              {e?.planned && !e.done && <div className="sub">Планировал, не отмечено</div>}
            </div>
          </div>
        );
      })}
    </>
  );
}

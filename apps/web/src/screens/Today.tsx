import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Activity, Entry, TodayResponse } from '@tracker/shared';
import { NOTE_MAX, addDays, diffDays, isEditable } from '@tracker/shared';
import { api, ApiError } from '../api';
import { haptic, tg, inTelegram } from '../tg';
import { useToast } from '../components/Toast';
import { fmtDate } from '../components/ui';

type Draft = Record<number, Omit<Entry, 'updated_at'>>; // by activity_id

const draftKey = (date: string) => `draft:${date}`;

function emptyEntry(activity_id: number, date: string): Omit<Entry, 'updated_at'> {
  return { activity_id, date, planned: false, plan_note: null, done: false, done_note: null };
}

function loadDraft(date: string): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(date));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

export function Today({ isNew }: { isNew: boolean }) {
  const toast = useToast();
  const [date, setDate] = useState<string | undefined>(undefined);
  const [data, setData] = useState<TodayResponse | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOthers, setShowOthers] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const load = useCallback(async (d?: string) => {
    setError(null);
    try {
      const r = await api.today(d);
      setData(r);
      const base: Draft = {};
      for (const e of r.entries) base[e.activity_id] = { ...e };
      const saved = loadDraft(r.date);
      if (saved && r.editable) {
        Object.assign(base, saved);
        setDirty(true);
        toast('Восстановлен черновик');
      } else {
        setDirty(false);
      }
      setDraft(base);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка загрузки');
    }
  }, [toast]);

  useEffect(() => {
    void load(date);
  }, [date, load]);

  // Persist draft locally so nothing is lost when the app is minimized.
  useEffect(() => {
    if (!data) return;
    try {
      if (dirty) localStorage.setItem(draftKey(data.date), JSON.stringify(draft));
      else localStorage.removeItem(draftKey(data.date));
    } catch {
      /* ignore */
    }
  }, [draft, dirty, data]);

  const update = (id: number, patch: Partial<Entry>) => {
    if (!data?.editable) return;
    setDraft((d) => ({ ...d, [id]: { ...(d[id] ?? emptyEntry(id, data.date)), ...patch } }));
    setDirty(true);
  };

  const save = useCallback(async () => {
    if (!data || saving) return;
    setSaving(true);
    try {
      const entries = Object.values(draftRef.current).map((e) => ({
        ...e,
        plan_note: e.plan_note?.trim() || null,
        done_note: e.done_note?.trim() || null,
      }));
      if (!entries.length) return;
      const r = await api.saveEntries(entries);
      const next: Draft = {};
      for (const e of r.entries) next[e.activity_id] = e;
      setDraft(next);
      setDirty(false);
      haptic.success();
      toast('Сохранено');
    } catch (e) {
      haptic.warning();
      toast(e instanceof ApiError ? e.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  }, [data, saving, toast]);

  // Telegram MainButton as the save control
  useEffect(() => {
    if (!inTelegram) return;
    const mb = tg.MainButton;
    if (dirty && data?.editable) {
      mb.setText(saving ? 'Сохраняю…' : 'Сохранить');
      mb.show();
      if (saving) mb.showProgress();
      else mb.hideProgress();
    } else mb.hide();
    mb.onClick(save);
    return () => {
      mb.offClick(save);
    };
  }, [dirty, saving, data?.editable, save]);

  const today = data?.today;
  const scheduled = useMemo(() => {
    if (!data) return [] as Activity[];
    const ids = new Set(data.scheduled_ids);
    return data.activities.filter((a) => ids.has(a.id));
  }, [data]);
  const others = useMemo(() => {
    if (!data) return [] as Activity[];
    const ids = new Set(data.scheduled_ids);
    return data.activities.filter((a) => !ids.has(a.id));
  }, [data]);

  if (error) return <div className="screen"><div className="err">{error}</div></div>;
  if (!data || !today) return <span className="spinner" />;

  const cur = data.date;
  const canBack = isEditable(addDays(cur, -1), today, 60); // browse history up to 60 days
  const canFwd = diffDays(cur, today) > 0;
  const touchedOthers = others.filter((a) => draft[a.id]?.done || draft[a.id]?.planned);
  const doneCount = scheduled.filter((a) => draft[a.id]?.done).length;

  return (
    <div className="screen">
      {isNew && (
        <div className="card" style={{ background: 'color-mix(in srgb, var(--btn) 12%, var(--section))' }}>
          <div className="card-title">Добро пожаловать 👋</div>
          <div className="small" style={{ marginTop: 4 }}>
            Мы добавили три активности по шаблону. Утром отмечай план, вечером — факт. Настроить активности можно во вкладке «Активности».
          </div>
        </div>
      )}

      <div className="datenav">
        <button disabled={!canBack} onClick={() => { haptic.tap(); setDate(addDays(cur, -1)); }}>‹</button>
        <div className="center">
          <div className="d">{fmtDate(cur, today)}</div>
          {cur !== today && <div className="small muted">{cur}</div>}
        </div>
        <button disabled={!canFwd} onClick={() => { haptic.tap(); setDate(diffDays(cur, today) === 1 ? undefined : addDays(cur, 1)); }}>›</button>
      </div>

      {!data.editable && <div className="chip" style={{ marginBottom: 10 }}>Только просмотр — редактировать можно сегодня и вчера</div>}

      {scheduled.length === 0 && (
        <div className="card center muted">На этот день ничего не запланировано по расписанию.</div>
      )}

      {scheduled.length > 0 && (
        <div className="row" style={{ margin: '0 4px 8px' }}>
          <span className="muted small">Сделано {doneCount} из {scheduled.length}</span>
        </div>
      )}

      {scheduled.map((a) => (
        <ActivityCard key={a.id} a={a} e={draft[a.id]} date={cur} editable={data.editable} onChange={(p) => update(a.id, p)} />
      ))}

      {others.length > 0 && (
        <>
          <button className="btn ghost" style={{ margin: '4px 0 8px' }} onClick={() => setShowOthers((v) => !v)}>
            {showOthers ? 'Скрыть' : 'Показать'} вне расписания ({others.length}){touchedOthers.length && !showOthers ? ` · отмечено ${touchedOthers.length}` : ''}
          </button>
          {showOthers && others.map((a) => (
            <ActivityCard key={a.id} a={a} e={draft[a.id]} date={cur} editable={data.editable} onChange={(p) => update(a.id, p)} offSchedule />
          ))}
        </>
      )}

      {dirty && data.editable && !inTelegram && (
        <button className="btn savebar" disabled={saving} onClick={save}>
          {saving ? 'Сохраняю…' : 'Сохранить'}
        </button>
      )}
    </div>
  );
}

function statusOf(e?: Omit<Entry, 'updated_at'>): { text: string; cls: string } | null {
  if (!e) return null;
  if (e.planned && e.done) return { text: 'План ✓ · Факт ✓', cls: 'good' };
  if (e.planned && !e.done) return { text: 'Запланировано, ещё не отмечено', cls: '' };
  if (!e.planned && e.done) return { text: 'Не планировал, но сделал', cls: 'bonus' };
  return null;
}

function ActivityCard({
  a, e, date, editable, onChange, offSchedule,
}: {
  a: Activity;
  e?: Omit<Entry, 'updated_at'>;
  date: string;
  editable: boolean;
  onChange: (p: Partial<Entry>) => void;
  offSchedule?: boolean;
}) {
  const st = statusOf(e);
  const daysLeft = a.goal_date ? diffDays(date, a.goal_date) : null;
  return (
    <div className="card act" style={{ ['--act-color' as string]: a.color, opacity: offSchedule ? 0.85 : 1 }}>
      <div className="emoji">{a.emoji}</div>
      <div className="grow">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="name">{a.name}</div>
          {offSchedule && <span className="chip">вне расписания</span>}
        </div>
        {a.goal_text && (
          <div className="goal">
            🎯 {a.goal_text}
            {daysLeft !== null && (daysLeft >= 0 ? ` · осталось ${daysLeft} дн.` : ` · прошло ${-daysLeft} дн.`)}
          </div>
        )}
        <div className="marks">
          <button
            type="button"
            className={`mark plan ${e?.planned ? 'on' : ''}`}
            disabled={!editable}
            onClick={() => { haptic.tap(); onChange({ planned: !e?.planned }); }}
          >
            <span className="box">{e?.planned ? '✓' : ''}</span>
            <span className="lbl">Планирую</span>
          </button>
          <button
            type="button"
            className={`mark done ${e?.done ? 'on' : ''}`}
            disabled={!editable}
            onClick={() => { e?.done ? haptic.tap() : haptic.success(); onChange({ done: !e?.done }); }}
          >
            <span className="box">{e?.done ? '✓' : ''}</span>
            <span className="lbl">Сделано</span>
          </button>
        </div>
        {(e?.planned || e?.plan_note) && (
          <textarea
            className="note"
            placeholder="План (напр. Listening part 2, 30 мин)"
            maxLength={NOTE_MAX}
            rows={1}
            disabled={!editable}
            value={e?.plan_note ?? ''}
            onChange={(ev) => onChange({ plan_note: ev.target.value })}
          />
        )}
        {(e?.done || e?.done_note) && (
          <textarea
            className="note"
            placeholder="Как прошло? (необязательно)"
            maxLength={NOTE_MAX}
            rows={1}
            disabled={!editable}
            value={e?.done_note ?? ''}
            onChange={(ev) => onChange({ done_note: ev.target.value })}
          />
        )}
        {st && <div className={`status ${st.cls}`}>{st.text}</div>}
      </div>
    </div>
  );
}

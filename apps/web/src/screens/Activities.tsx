import { useEffect, useState } from 'react';
import type { Activity, ActivityInput, ScheduleType } from '@tracker/shared';
import { NAME_MAX, diffDays, todayInTz } from '@tracker/shared';
import { api, ApiError } from '../api';
import { deviceTz, haptic, tg } from '../tg';
import { useToast } from '../components/Toast';
import { Field, Segmented, Sheet, WD_RU } from '../components/ui';

const COLORS = ['#3b82f6', '#a855f7', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#64748b'];
const EMOJIS = ['🇬🇧', '🎓', '🏋️', '📚', '💻', '🏃', '🧘', '🎸', '✍️', '🧠', '💧', '🥗', '😴', '🎨', '🗣️', '✅'];

function scheduleLabel(a: Activity): string {
  if (a.schedule_type === 'daily') return 'Ежедневно';
  if (a.schedule_type === 'every_other_day') return 'Через день';
  return (a.schedule_days ?? []).map((d) => WD_RU[d]).join(', ') || 'Никогда';
}

export function Activities({ onChanged }: { onChanged: () => void }) {
  const toast = useToast();
  const [list, setList] = useState<Activity[] | null>(null);
  const [archived, setArchived] = useState<Activity[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Activity | 'new' | null>(null);
  const today = todayInTz(deviceTz());

  const reload = async () => {
    const r = await api.activities(true);
    setList(r.activities.filter((a) => !a.archived_at));
    setArchived(r.activities.filter((a) => a.archived_at));
  };
  useEffect(() => {
    void reload();
  }, []);

  const archive = async (a: Activity) => {
    const ok = await confirm(`Архивировать «${a.name}»? История сохранится.`);
    if (!ok) return;
    await api.archiveActivity(a.id);
    haptic.success();
    toast('В архиве');
    await reload();
    onChanged();
  };
  const restore = async (a: Activity) => {
    await api.updateActivity(a.id, { archived_at: null });
    haptic.success();
    await reload();
    onChanged();
  };
  const move = async (idx: number, dir: -1 | 1) => {
    if (!list) return;
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[idx], next[j]] = [next[j], next[idx]];
    setList(next);
    haptic.select();
    await Promise.all(next.map((a, i) => (a.sort !== i ? api.updateActivity(a.id, { sort: i }) : null)));
    onChanged();
  };

  if (!list) return <span className="spinner" />;

  return (
    <div className="screen">
      <h1>Активности</h1>
      <div className="card">
        {list.length === 0 && <div className="muted small">Пока пусто — добавь первую активность.</div>}
        {list.map((a, i) => (
          <div key={a.id} className="list-item" style={{ ['--act-color' as string]: a.color }}>
            <div className="emoji">{a.emoji}</div>
            <div className="grow" onClick={() => setEditing(a)}>
              <div>{a.name}</div>
              <div className="sub">
                {scheduleLabel(a)}
                {a.goal_text && ` · 🎯 ${a.goal_text}`}
                {a.goal_date && ` (${diffDays(today, a.goal_date)} дн.)`}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <button className="btn ghost" style={{ padding: '2px 6px' }} disabled={i === 0} onClick={() => move(i, -1)}>▲</button>
              <button className="btn ghost" style={{ padding: '2px 6px' }} disabled={i === list.length - 1} onClick={() => move(i, 1)}>▼</button>
            </div>
          </div>
        ))}
      </div>
      <button className="btn" onClick={() => { haptic.tap(); setEditing('new'); }}>+ Добавить активность</button>

      {archived.length > 0 && (
        <>
          <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? 'Скрыть архив' : `Архив (${archived.length})`}
          </button>
          {showArchived && (
            <div className="card">
              {archived.map((a) => (
                <div key={a.id} className="list-item" style={{ ['--act-color' as string]: a.color, opacity: 0.7 }}>
                  <div className="emoji">{a.emoji}</div>
                  <div className="grow">{a.name}</div>
                  <button className="btn sm secondary" onClick={() => restore(a)}>Вернуть</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {editing && (
        <ActivityForm
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onArchive={editing !== 'new' ? () => { setEditing(null); void archive(editing); } : undefined}
          onSaved={async () => {
            setEditing(null);
            await reload();
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function confirm(msg: string): Promise<boolean> {
  return new Promise((res) => {
    try {
      tg.showConfirm(msg, res);
    } catch {
      res(window.confirm(msg));
    }
  });
}

function ActivityForm({ initial, onClose, onSaved, onArchive }: { initial: Activity | null; onClose: () => void; onSaved: () => void; onArchive?: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(initial?.name ?? '');
  const [emoji, setEmoji] = useState(initial?.emoji ?? '✅');
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
  const [type, setType] = useState<ScheduleType>(initial?.schedule_type ?? 'daily');
  const [days, setDays] = useState<number[]>(initial?.schedule_days ?? [0, 1, 2, 3, 4]);
  const [goalText, setGoalText] = useState(initial?.goal_text ?? '');
  const [goalDate, setGoalDate] = useState(initial?.goal_date ?? '');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return toast('Введи название');
    if (type === 'weekdays' && !days.length) return toast('Выбери хотя бы один день');
    setBusy(true);
    try {
      const input: ActivityInput = {
        name: name.trim().slice(0, NAME_MAX),
        emoji,
        color,
        schedule_type: type,
        schedule_days: type === 'weekdays' ? [...days].sort() : null,
        anchor_date: type === 'every_other_day' ? (initial?.anchor_date ?? todayInTz(deviceTz())) : null,
        goal_text: goalText.trim() || null,
        goal_date: goalDate || null,
      };
      if (initial) await api.updateActivity(initial.id, input);
      else await api.createActivity(input);
      haptic.success();
      toast('Сохранено');
      onSaved();
    } catch (e) {
      haptic.warning();
      toast(e instanceof ApiError ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={initial ? 'Активность' : 'Новая активность'} onClose={onClose}>
      <Field label="Название">
        <input className="input" value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} placeholder="English (IELTS)" autoFocus={!initial} />
      </Field>
      <Field label="Эмодзи">
        <div className="emojis">
          {EMOJIS.map((e) => (
            <button key={e} type="button" className={emoji === e ? 'on' : ''} onClick={() => { haptic.select(); setEmoji(e); }}>{e}</button>
          ))}
        </div>
      </Field>
      <Field label="Цвет">
        <div className="swatches">
          {COLORS.map((c) => (
            <button key={c} type="button" className={color === c ? 'on' : ''} style={{ background: c }} onClick={() => { haptic.select(); setColor(c); }} />
          ))}
        </div>
      </Field>
      <Field label="Расписание">
        <Segmented value={type} onChange={setType} options={[{ v: 'daily', l: 'Ежедневно' }, { v: 'every_other_day', l: 'Через день' }, { v: 'weekdays', l: 'Дни недели' }]} />
        {type === 'weekdays' && (
          <div className="wdays" style={{ marginTop: 8 }}>
            {WD_RU.map((w, i) => (
              <button key={w} type="button" className={days.includes(i) ? 'on' : ''} onClick={() => { haptic.select(); setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i])); }}>{w}</button>
            ))}
          </div>
        )}
        {type === 'every_other_day' && <div className="small muted" style={{ marginTop: 6 }}>Отсчёт начинается {initial?.anchor_date ?? 'с сегодня'}.</div>}
      </Field>
      <Field label="Цель (необязательно)">
        <input className="input" value={goalText} maxLength={80} onChange={(e) => setGoalText(e.target.value)} placeholder="IELTS" />
      </Field>
      <Field label="Дата цели">
        <input className="input" type="date" value={goalDate} onChange={(e) => setGoalDate(e.target.value)} />
      </Field>
      <button className="btn" disabled={busy} onClick={submit}>{initial ? 'Сохранить' : 'Добавить'}</button>
      {onArchive && (
        <button className="btn danger" style={{ marginTop: 8 }} onClick={onArchive}>В архив</button>
      )}
    </Sheet>
  );
}

import { useEffect, useState } from 'react';
import type { Lesson, LessonInput } from '@tracker/shared';
import { api, ApiError } from '../api';
import { deviceTz, haptic, tg } from '../tg';
import { useToast } from './Toast';
import { Field, Sheet, Toggle, WD_RU } from './ui';

const TZ_LIST = ['Europe/Moscow', 'Europe/Kaliningrad', 'Europe/Samara', 'Asia/Yekaterinburg', 'Asia/Novosibirsk', 'Asia/Almaty', 'Europe/Minsk', 'Europe/Kyiv', 'Europe/Berlin', 'Europe/London', 'Asia/Dubai', 'UTC'];

function confirmDialog(msg: string): Promise<boolean> {
  return new Promise((res) => {
    try {
      tg.showConfirm(msg, res);
    } catch {
      res(window.confirm(msg));
    }
  });
}

export function LessonsCard() {
  const toast = useToast();
  const [list, setList] = useState<Lesson[] | null>(null);
  const [editing, setEditing] = useState<Lesson | 'new' | null>(null);

  const reload = () => api.lessons().then((r) => setList(r.lessons));
  useEffect(() => {
    void reload();
  }, []);

  return (
    <div className="card">
      {!list ? (
        <span className="spinner" />
      ) : list.length === 0 ? (
        <div className="hint" style={{ marginTop: 0 }}>Уроки с преподавателем: бот напомнит утром и за N минут до начала, а домашка к ним привязывается автоматически.</div>
      ) : (
        list.map((l) => (
          <div key={l.id} className="list-item" onClick={() => setEditing(l)}>
            <div className="emoji" style={{ ['--act-color' as string]: '#a855f7' }}>🎓</div>
            <div className="grow">
              <div>{l.title}</div>
              <div className="sub">
                {l.weekdays.map((d) => WD_RU[d]).join(', ')} · {l.time} · {l.tz.split('/').pop()}
                {l.remind_before_min > 0 && ` · за ${l.remind_before_min} мин`}
                {l.remind_morning && ' · утром'}
              </div>
            </div>
            <span className="muted">›</span>
          </div>
        ))
      )}
      <button className="btn secondary" style={{ marginTop: list?.length ? 10 : 8 }} onClick={() => { haptic.tap(); setEditing('new'); }}>+ Добавить занятие</button>
      <div className="hint">Домашку присылай боту: <b>/hw текст</b> или фото с подписью «дз» — утреннее задание подстроится под неё.</div>
      {editing && (
        <LessonForm
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void reload(); }}
          onDelete={editing !== 'new' ? async () => {
            if (!(await confirmDialog(`Удалить «${editing.title}»?`))) return;
            await api.deleteLesson(editing.id);
            haptic.success();
            toast('Удалено');
            setEditing(null);
            void reload();
          } : undefined}
        />
      )}
    </div>
  );
}

function LessonForm({ initial, onClose, onSaved, onDelete }: { initial: Lesson | null; onClose: () => void; onSaved: () => void; onDelete?: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState(initial?.title ?? 'Английский');
  const [days, setDays] = useState<number[]>(initial?.weekdays ?? [0, 2]);
  const [time, setTime] = useState(initial?.time ?? '19:30');
  const [tz, setTz] = useState(initial?.tz ?? (TZ_LIST.includes(deviceTz()) ? deviceTz() : 'Europe/Moscow'));
  const [morning, setMorning] = useState(initial?.remind_morning ?? true);
  const [before, setBefore] = useState(initial?.remind_before_min ?? 90);
  const [busy, setBusy] = useState(false);
  const tzOptions = TZ_LIST.includes(tz) ? TZ_LIST : [tz, ...TZ_LIST];

  const submit = async () => {
    if (!title.trim()) return toast('Введи название');
    if (!days.length) return toast('Выбери дни');
    setBusy(true);
    try {
      const input: LessonInput = { title: title.trim(), weekdays: [...days].sort(), time, tz, remind_morning: morning, remind_before_min: before };
      if (initial) await api.updateLesson(initial.id, input);
      else await api.createLesson(input);
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
    <Sheet title={initial ? 'Занятие' : 'Новое занятие'} onClose={onClose}>
      <Field label="Название"><input className="input" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label="Дни">
        <div className="wdays">
          {WD_RU.map((w, i) => (
            <button key={w} type="button" className={days.includes(i) ? 'on' : ''} onClick={() => { haptic.select(); setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i])); }}>{w}</button>
          ))}
        </div>
      </Field>
      <div className="field-grid">
        <Field label="Время начала"><input className="input" type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        <Field label="За сколько минут напомнить">
          <select className="input" value={before} onChange={(e) => setBefore(Number(e.target.value))}>
            {[0, 30, 60, 90, 120, 180].map((m) => <option key={m} value={m}>{m === 0 ? 'не напоминать' : `${m} мин`}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Часовой пояс занятия">
        <select className="input" value={tz} onChange={(e) => setTz(e.target.value)}>
          {tzOptions.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <Toggle label="Напоминать утром" sub="Вместе с утренним напоминанием трекера" on={morning} onChange={setMorning} />
      <button className="btn" style={{ marginTop: 12 }} disabled={busy} onClick={submit}>{initial ? 'Сохранить' : 'Добавить'}</button>
      {onDelete && <button className="btn danger" style={{ marginTop: 8 }} onClick={onDelete}>Удалить</button>}
    </Sheet>
  );
}

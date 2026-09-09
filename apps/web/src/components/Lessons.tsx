import { useEffect, useState } from 'react';
import type { Lesson, LessonInput } from '@tracker/shared';
import { api, ApiError } from '../api';
import { deviceTz, haptic } from '../tg';
import { useToast } from './Toast';
import { Field, Sheet, Toggle, WD, confirmDialog } from './ui';

const TZ_LIST = ['Europe/Moscow', 'Europe/Kaliningrad', 'Europe/Samara', 'Asia/Yekaterinburg', 'Asia/Novosibirsk', 'Asia/Almaty', 'Europe/Minsk', 'Europe/Kyiv', 'Europe/Berlin', 'Europe/London', 'Asia/Dubai', 'UTC'];

export function LessonsCard() {
  const toast = useToast();
  const [list, setList] = useState<Lesson[] | null>(null);
  const [editing, setEditing] = useState<Lesson | 'new' | null>(null);

  const reload = () => api.lessons().then((r) => setList(r.lessons));
  useEffect(() => {
    void reload();
  }, []);

  return (
    <>
      {!list ? (
        <span className="spinner" />
      ) : list.length === 0 ? (
        <p className="muted small">Lessons with a teacher: a reminder in the morning and N minutes before, and homework attaches to the next one automatically.</p>
      ) : (
        list.map((l) => (
          <button key={l.id} className="list-item" onClick={() => setEditing(l)}>
            <div className="grow">
              <div>{l.title}</div>
              <div className="sub">
                {l.weekdays.map((d) => WD[d]).join(', ')} · {l.time} · {l.tz.split('/').pop()}
                {l.remind_before_min > 0 && ` · ${l.remind_before_min} min before`}
                {l.remind_morning && ' · morning'}
              </div>
            </div>
            <span className="muted">›</span>
          </button>
        ))
      )}
      <button className="btn sm" style={{ marginTop: 10 }} onClick={() => { haptic.tap(); setEditing('new'); }}>Add a lesson</button>
      <div className="hint">Send homework to the bot: <i>/hw text</i> or a photo captioned “hw” — the morning task adapts to it.</div>
      {editing && (
        <LessonForm
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void reload(); }}
          onDelete={editing !== 'new' ? async () => {
            if (!(await confirmDialog(`Delete “${editing.title}”?`))) return;
            await api.deleteLesson(editing.id);
            haptic.success();
            toast('Deleted');
            setEditing(null);
            void reload();
          } : undefined}
        />
      )}
    </>
  );
}

function LessonForm({ initial, onClose, onSaved, onDelete }: { initial: Lesson | null; onClose: () => void; onSaved: () => void; onDelete?: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState(initial?.title ?? 'English lesson');
  const [days, setDays] = useState<number[]>(initial?.weekdays ?? [0, 2]);
  const [time, setTime] = useState(initial?.time ?? '19:30');
  const [tz, setTz] = useState(initial?.tz ?? (TZ_LIST.includes(deviceTz()) ? deviceTz() : 'Europe/Moscow'));
  const [morning, setMorning] = useState(initial?.remind_morning ?? true);
  const [before, setBefore] = useState(initial?.remind_before_min ?? 90);
  const [busy, setBusy] = useState(false);
  const tzOptions = TZ_LIST.includes(tz) ? TZ_LIST : [tz, ...TZ_LIST];

  const submit = async () => {
    if (!title.trim()) return toast('Enter a title');
    if (!days.length) return toast('Pick the days');
    setBusy(true);
    try {
      const input: LessonInput = { title: title.trim(), weekdays: [...days].sort(), time, tz, remind_morning: morning, remind_before_min: before };
      if (initial) await api.updateLesson(initial.id, input);
      else await api.createLesson(input);
      haptic.success();
      toast('Saved');
      onSaved();
    } catch (e) {
      haptic.warning();
      toast(e instanceof ApiError ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={initial ? 'Lesson' : 'New lesson'} onClose={onClose}>
      <Field label="Title"><input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label="Days">
        <div className="chips">
          {WD.map((w, i) => (
            <button key={w} type="button" className={`chip ${days.includes(i) ? 'on' : ''}`} onClick={() => { haptic.select(); setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i])); }}>{w}</button>
          ))}
        </div>
      </Field>
      <div className="field-grid">
        <Field label="Starts at"><input type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        <Field label="Remind before">
          <select value={before} onChange={(e) => setBefore(Number(e.target.value))}>
            {[0, 30, 60, 90, 120, 180].map((m) => <option key={m} value={m}>{m === 0 ? 'no reminder' : `${m} min`}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Lesson time zone">
        <select value={tz} onChange={(e) => setTz(e.target.value)}>
          {tzOptions.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <Toggle label="Morning reminder" sub="Together with the morning message" on={morning} onChange={setMorning} />
      <button className="btn solid block" style={{ marginTop: 14 }} disabled={busy} onClick={submit}>{initial ? 'Save' : 'Add'}</button>
      {onDelete && <button className="btn link" style={{ marginTop: 12, color: 'var(--accent)' }} onClick={onDelete}>Delete</button>}
    </Sheet>
  );
}

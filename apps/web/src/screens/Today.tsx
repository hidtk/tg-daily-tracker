import { useCallback, useEffect, useRef, useState } from 'react';
import type { Entry, Skill, TodayResponse } from '@tracker/shared';
import { MINUTE_PRESETS, NOTE_MAX, SKILLS, SKILL_LABEL, addDays, diffDays, isEditable } from '@tracker/shared';
import { api, ApiError } from '../api';
import { haptic, tg, inTelegram } from '../tg';
import { useToast } from '../components/Toast';
import { Section, fmtDate } from '../components/ui';
import { useLang, useT } from '../i18n';

type DraftEntry = Omit<Entry, 'updated_at' | 'proofs'>;
const draftKey = (date: string) => `draft:${date}`;

function emptyEntry(activity_id: number, date: string): DraftEntry {
  return { activity_id, date, planned: false, plan_note: null, done: false, done_note: null, minutes: 0, skills: null, skipped: false, skip_reason: null };
}

function loadDraft(date: string): DraftEntry | null {
  try {
    const raw = localStorage.getItem(draftKey(date));
    return raw ? (JSON.parse(raw) as DraftEntry) : null;
  } catch {
    return null;
  }
}

export function Today({ isNew }: { isNew: boolean }) {
  const toast = useToast();
  const t = useT();
  const { lang } = useLang();
  const [date, setDate] = useState<string | undefined>(undefined);
  const [data, setData] = useState<TodayResponse | null>(null);
  const [draft, setDraft] = useState<DraftEntry | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const load = useCallback(async (d?: string) => {
    setError(null);
    try {
      const r = await api.today(d);
      setData(r);
      const act = r.activities.find((a) => a.kind === 'ielts') ?? r.activities[0];
      if (!act) return;
      const server = r.entries.find((e) => e.activity_id === act.id);
      const { proofs: _p, updated_at: _u, ...base } = server ?? { ...emptyEntry(act.id, r.date), proofs: [], updated_at: '' };
      const saved = r.editable ? loadDraft(r.date) : null;
      if (saved && saved.activity_id === act.id) {
        setDraft(saved);
        setDirty(true);
      } else {
        setDraft(base);
        setDirty(false);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('Could not load'));
    }
  }, []);

  useEffect(() => {
    void load(date);
  }, [date, load]);

  useEffect(() => {
    if (!data || !draft) return;
    try {
      if (dirty) localStorage.setItem(draftKey(data.date), JSON.stringify(draft));
      else localStorage.removeItem(draftKey(data.date));
    } catch {
      /* ignore */
    }
  }, [draft, dirty, data]);

  const update = (patch: Partial<DraftEntry>) => {
    if (!data?.editable || !draft) return;
    setDraft({ ...draft, ...patch });
    setDirty(true);
  };

  const save = useCallback(async () => {
    const d = draftRef.current;
    if (!data || saving || !d) return;
    setSaving(true);
    try {
      const r = await api.saveEntries([{ ...d, plan_note: d.plan_note?.trim() || null, done_note: d.done_note?.trim() || null }]);
      const e = r.entries.find((x) => x.activity_id === d.activity_id);
      if (e) {
        const { proofs: _p, updated_at: _u, ...rest } = e;
        setDraft(rest);
      }
      setDirty(false);
      haptic.success();
      toast(t('Saved'));
    } catch (e) {
      haptic.warning();
      toast(e instanceof ApiError ? e.message : t('Could not save'));
    } finally {
      setSaving(false);
    }
  }, [data, saving, toast]);

  useEffect(() => {
    if (!inTelegram) return;
    const mb = tg.MainButton;
    if (dirty && data?.editable) {
      mb.setText(saving ? t('Saving…') : t('Save'));
      mb.show();
      if (saving) mb.showProgress();
      else mb.hideProgress();
    } else mb.hide();
    mb.onClick(save);
    return () => {
      mb.offClick(save);
    };
  }, [dirty, saving, data?.editable, save, t]);

  if (error) return <div className="screen"><div className="err">{error}</div></div>;
  if (!data || !draft) return <span className="spinner" />;

  const today = data.today;
  const cur = data.date;
  const canBack = isEditable(addDays(cur, -1), today, 60);
  const canFwd = diffDays(cur, today) > 0;
  const e = draft;
  const daysLeft = data.exam_date ? diffDays(cur, data.exam_date) : null;
  const toggleSkill = (sk: Skill) => {
    const list = e.skills ?? [];
    update({ skills: list.includes(sk) ? list.filter((x) => x !== sk) : [...list, sk] });
  };

  return (
    <div className="screen">
      <div className="date-head">
        <h1 style={{ margin: 0 }}>{fmtDate(cur, today, lang)}</h1>
        <div className="nav-arrows">
          <button disabled={!canBack} onClick={() => { haptic.tap(); setDate(addDays(cur, -1)); }}>‹</button>
          <button disabled={!canFwd} onClick={() => { haptic.tap(); setDate(diffDays(cur, today) === 1 ? undefined : addDays(cur, 1)); }}>›</button>
        </div>
      </div>
      <div className="countdown">
        {daysLeft != null
          ? daysLeft >= 0
            ? <><b>{daysLeft}</b> {t('days to the exam')} · {t('target')} <b>{data.target.toFixed(1)}</b></>
            : t('The exam date has passed')
          : <>{t('Target')} <b>{data.target.toFixed(1)}</b> · {t('set the exam date in Settings')}</>}
        {!data.editable && ` · ${t('read-only')}`}
      </div>

      {isNew && (
        <Section>
          <p>{t('Welcome. Each morning you get five words and a task; in the evening, log what you did here. Lessons, homework and the exam date are in Settings.')}</p>
        </Section>
      )}

      {(data.lessons_today.length > 0 || data.homeworks.length > 0) && (
        <Section label={data.lessons_today.length ? t('Lesson') : t('Homework')}>
          {data.lessons_today.map((l) => (
            <div key={l.id}><b>{l.title}</b> {t('today at')} {l.time}</div>
          ))}
          {data.homeworks.length > 0 && (
            <div style={{ marginTop: data.lessons_today.length ? 10 : 0 }}>
              {data.homeworks.map((h) => (
                <div key={h.id} className="hw-row">
                  <button type="button" className="hw-check" title="Done" onClick={async () => {
                    haptic.success();
                    await api.completeHomework(h.id);
                    void load(date);
                  }} />
                  <div className="grow">
                    <div>{h.text}</div>
                    <div className="muted small">
                      {h.due_date ? (diffDays(today, h.due_date) === 0 ? t('due today') : diffDays(today, h.due_date) < 0 ? t('overdue') : `${t('due')} ${h.due_date}`) : t('no deadline')}
                      {h.tags.length ? ` · ${h.tags.join(', ')}` : ''}
                    </div>
                  </div>
                </div>
              ))}
              <div className="hint">{t('Add homework in the chat:')} <i>/hw text</i>, {t('or a photo captioned “hw”.')}</div>
            </div>
          )}
        </Section>
      )}

      <Section label={t('Practice')}>
        <div className="marks">
          <button type="button" className={`mark ${e.planned ? 'on' : ''}`} disabled={!data.editable} onClick={() => { haptic.tap(); update({ planned: !e.planned }); }}>{t('Planned')}</button>
          <button type="button" className={`mark ${e.done ? 'on' : ''}`} disabled={!data.editable} onClick={() => { e.done ? haptic.tap() : haptic.success(); update({ done: !e.done, skipped: false }); }}>{t('Done')}</button>
          <button type="button" className={`mark skip ${e.skipped && !e.done ? 'on' : ''}`} disabled={!data.editable} onClick={() => { haptic.warning(); update({ skipped: !(e.skipped && !e.done), done: false }); }}>{t('Skip')}</button>
        </div>
        {e.skipped && !e.done && (
          <textarea className="note" placeholder={t('Why? (ill, exam, no energy — be honest)')} maxLength={NOTE_MAX} rows={1} disabled={!data.editable} value={e.skip_reason ?? ''} onChange={(ev) => update({ skip_reason: ev.target.value })} />
        )}
        {(e.planned || e.plan_note) && (
          <textarea className="note" placeholder={t('Plan (e.g. Listening section 2, 30 min)')} maxLength={NOTE_MAX} rows={1} disabled={!data.editable} value={e.plan_note ?? ''} onChange={(ev) => update({ plan_note: ev.target.value })} />
        )}
        {e.done && (
          <>
            <div className="label" style={{ marginTop: 12 }}>{t('Minutes')}</div>
            <div className="chips">
              {MINUTE_PRESETS.map((m) => (
                <button key={m} type="button" className={`chip ${e.minutes === m ? 'on' : ''}`} disabled={!data.editable} onClick={() => { haptic.select(); update({ minutes: e.minutes === m ? 0 : m }); }}>{m}</button>
              ))}
            </div>
            <div className="label" style={{ marginTop: 12 }}>{t('Skills')}</div>
            <div className="chips">
              {SKILLS.map((sk) => (
                <button key={sk} type="button" className={`chip ${e.skills?.includes(sk) ? 'on' : ''}`} disabled={!data.editable} onClick={() => { haptic.select(); toggleSkill(sk); }}>{t(SKILL_LABEL[sk])}</button>
              ))}
            </div>
            <textarea className="note" placeholder={t('How did it go? (optional)')} maxLength={NOTE_MAX} rows={1} disabled={!data.editable} value={e.done_note ?? ''} onChange={(ev) => update({ done_note: ev.target.value })} />
          </>
        )}
        {e.skipped && !e.done && <div className="status">{t('A deliberate skip: once a week it does not break the streak. Your partner sees the reason.')}</div>}
        {e.planned && !e.done && !e.skipped && <div className="status">{t('Planned, not yet done.')}</div>}
      </Section>

      {dirty && data.editable && !inTelegram && (
        <button className="btn solid block savebar" disabled={saving} onClick={save}>{saving ? t('Saving…') : t('Save')}</button>
      )}
    </div>
  );
}

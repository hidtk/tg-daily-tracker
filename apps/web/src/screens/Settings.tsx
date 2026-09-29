import { useState } from 'react';
import type { Settings, SettingsView } from '@tracker/shared';
import { api, ApiError, exportUrl } from '../api';
import { deviceTz, haptic, inTelegram, tg } from '../tg';
import { useToast } from '../components/Toast';
import { Field, Section, Toggle } from '../components/ui';
import { LessonsCard } from '../components/Lessons';
import { LockSettings } from '../components/LockSettings';
import { BandSelect } from './Progress';
import { useLang, useT, type Lang } from '../i18n';

const TZ_LIST = [
  'Europe/Moscow', 'Europe/Kaliningrad', 'Europe/Samara', 'Asia/Yekaterinburg', 'Asia/Omsk', 'Asia/Novosibirsk', 'Asia/Krasnoyarsk',
  'Asia/Irkutsk', 'Asia/Yakutsk', 'Asia/Vladivostok', 'Europe/Kyiv', 'Europe/Minsk', 'Asia/Almaty', 'Asia/Tbilisi', 'Asia/Yerevan',
  'Europe/Istanbul', 'Europe/Berlin', 'Europe/London', 'Asia/Dubai', 'Asia/Bangkok', 'America/New_York', 'UTC',
];

export function SettingsScreen({ initial }: { initial: SettingsView }) {
  const toast = useToast();
  const t = useT();
  const { lang, setLang } = useLang();
  const [s, setS] = useState<SettingsView>(initial);
  const [saved, setSaved] = useState<SettingsView>(initial);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const tzOptions = TZ_LIST.includes(s.tz) ? TZ_LIST : [s.tz, ...TZ_LIST];
  const devTz = deviceTz();

  const patch = (p: Partial<Settings>) => {
    setS((x) => ({ ...x, ...p }));
    setDirty(true);
  };
  const setExamDate = (v: string) => {
    const next = v || null;
    setS((x) => {
      if (x.ielts_exam_date === next) return x;
      setDirty(true);
      return { ...x, ielts_exam_date: next };
    });
  };

  const save = async () => {
    setBusy(true);
    try {
      const { partner: _p, deadline_editable: _d, bot_username: _b, ...plain } = { ...s, lang };
      if (plain.ielts_exam_date === saved.ielts_exam_date) delete (plain as Partial<Settings>).ielts_exam_date;
      const r = await api.saveSettings(plain);
      setS(r);
      setSaved(r);
      setDirty(false);
      haptic.success();
      toast(t('Saved'));
    } catch (e) {
      haptic.warning();
      toast(e instanceof ApiError ? e.message : t('Error'));
    } finally {
      setBusy(false);
    }
  };

  const doExport = async () => {
    haptic.tap();
    if (inTelegram) {
      tg.openLink(exportUrl());
      return;
    }
    const data = await api.export();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ielts-export.json';
    a.click();
  };

  return (
    <div className="screen">
      <h1>{t('Settings')}</h1>

      <Section label={t('Language')}>
        <div className="chips">
          {(['en', 'ru'] as Lang[]).map((l) => (
            <button key={l} className={`chip ${lang === l ? 'on' : ''}`} onClick={() => { haptic.select(); setLang(l); }}>{l === 'en' ? t('English') : t('Russian')}</button>
          ))}
        </div>
      </Section>

      <Section label={t('Exam')}>
          <Field label={t('Target band')}><BandSelect value={s.ielts_target} onChange={(v) => patch({ ielts_target: v ?? 7 })} /></Field>
          <Field label={t('Exam date')}>
            {/* iOS "Reset" in the date picker fires `input`/`blur` but not always React's onChange — listen to all three. */}
            <input
              type="date"
              value={s.ielts_exam_date ?? ''}
              onChange={(e) => setExamDate(e.target.value)}
              onInput={(e) => setExamDate((e.target as HTMLInputElement).value)}
              onBlur={(e) => setExamDate(e.target.value)}
            />
          </Field>
        {s.ielts_exam_date && <button className="btn link" style={{ margin: '-6px 0 14px' }} onClick={() => { haptic.tap(); setExamDate(''); }}>{t('Remove the exam date')}</button>}
        <Field label={t('Practice hours per week')}><input type="number" min={0} max={80} step={0.5} value={s.ielts_weekly_hours} onChange={(e) => patch({ ielts_weekly_hours: Number(e.target.value) })} /></Field>
        <div className="hint">{s.deadline_editable ? t('The exam date can be moved later once a day — so it stays a deadline, not a wish. Moving it earlier is always allowed.') : t('The date was already moved later today. Moving it later (or removing it) is possible tomorrow; earlier — right now.')}</div>
      </Section>

      <Section label={t('Mornings and evenings')}>
        <div className="field-grid">
          <Field label={t('Morning')}><input type="time" step={300} value={s.morning_time} onChange={(e) => patch({ morning_time: e.target.value })} /></Field>
          <Field label={t('Evening')}><input type="time" step={300} value={s.evening_time} onChange={(e) => patch({ evening_time: e.target.value })} /></Field>
        </div>
        <Field label={t('Time zone')}>
          <select value={s.tz} onChange={(e) => patch({ tz: e.target.value })}>
            {tzOptions.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        {devTz !== s.tz && <button className="btn link" onClick={() => patch({ tz: devTz })}>{t('Use {tz}', { tz: devTz })}</button>}
        <div style={{ marginTop: 10 }}>
          <Toggle label={t('Words in the morning')} sub={t('{n} new words a day, plus reviews', { n: s.vocab_per_day || t('no') })} on={s.vocab_per_day > 0} onChange={(v) => patch({ vocab_per_day: v ? 5 : 0 })} />
          {s.vocab_per_day > 0 && (
            <div className="chips" style={{ margin: '4px 0 10px' }}>
              {[3, 5, 8, 10].map((n) => <button key={n} className={`chip ${s.vocab_per_day === n ? 'on' : ''}`} onClick={() => { haptic.select(); patch({ vocab_per_day: n }); }}>{n}</button>)}
            </div>
          )}
          <Toggle label={t('Quests in the morning')} sub={t('The day’s quests, a Speaking card and a Writing topic')} on={s.ielts_daily_task} onChange={(v) => patch({ ielts_daily_task: v })} />
          <Toggle label={t('Weekly summary on Sunday')} on={s.weekly_summary} onChange={(v) => patch({ weekly_summary: v })} />
        </div>
        {s.weekly_summary && (
          <div className="field-grid" style={{ marginTop: 10 }}>
            <Field label={t('Sunday, at')}><input type="time" step={300} value={s.weekly_time} onChange={(e) => patch({ weekly_time: e.target.value })} /></Field>
          </div>
        )}
        <div className="hint">{t('The evening message comes only if a quest is still open.')}</div>
      </Section>

      <Section label={t('Lessons')}>
        <LessonsCard />
      </Section>

      <LockSettings />

      <Section label={t('Accountability partner')}>
        {s.partner ? (
          <>
            <div className="row between">
              <div>{s.partner.name}</div>
              <button className="btn link" onClick={async () => { await api.unlinkPartner(); haptic.success(); setS((x) => ({ ...x, partner: null })); toast(t('Partner unlinked')); }}>{t('Unlink')}</button>
            </div>
            <Toggle label={t('Report missed days')} sub={t('In the morning, if yesterday was not logged')} on={s.partner_notify_missed} onChange={(v) => patch({ partner_notify_missed: v })} />
            <div className="hint">{t('The weekly summary always goes to the partner while they are linked.')}</div>
          </>
        ) : (
          <>
            <p className="muted small">{t('A person or a group who receives your weekly summary and missed days. Social pressure works better than any reminder.')}</p>
            <button className="btn link" onClick={() => { haptic.tap(); try { tg.openTelegramLink(`https://t.me/${s.bot_username}`); } catch { /* noop */ } }}>{t('Get a link: /partner in the bot')}</button>
          </>
        )}
      </Section>

      <Section label={t('Data')}>
        <button className="btn link" onClick={doExport}>{t('Export everything as JSON')}</button>
      </Section>

      {dirty && <button className="btn solid block savebar" disabled={busy} onClick={save}>{busy ? t('Saving…') : t('Save settings')}</button>}
    </div>
  );
}

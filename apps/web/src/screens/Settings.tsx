import { useState } from 'react';
import type { Settings, SettingsView } from '@tracker/shared';
import { api, ApiError } from '../api';
import { deviceTz, haptic } from '../tg';
import { useToast } from '../components/Toast';
import { Field, Section, Toggle } from '../components/ui';
import { LockSettings } from '../components/LockSettings';
import { ResetCard } from '../components/ResetCard';
import { useLang, useT, type Lang } from '../i18n';

const TZ_LIST = [
  'Europe/Moscow', 'Europe/Kaliningrad', 'Europe/Samara', 'Asia/Yekaterinburg', 'Asia/Omsk', 'Asia/Novosibirsk', 'Asia/Krasnoyarsk',
  'Asia/Irkutsk', 'Asia/Yakutsk', 'Asia/Vladivostok', 'Europe/Kyiv', 'Europe/Minsk', 'Asia/Almaty', 'Asia/Tbilisi', 'Asia/Yerevan',
  'Europe/Istanbul', 'Europe/Berlin', 'Europe/London', 'Asia/Dubai', 'Asia/Bangkok', 'America/New_York', 'UTC',
];

/** Settings: language, the morning message, words a day, the lock, "How it works" and «Начать заново». */
export function SettingsScreen({ initial, onGuide, onReset }: { initial: SettingsView; onGuide: () => void; onReset: (s: SettingsView) => void }) {
  const toast = useToast();
  const t = useT();
  const { lang, setLang } = useLang();
  const [s, setS] = useState<SettingsView>(initial);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const tzOptions = TZ_LIST.includes(s.tz) ? TZ_LIST : [s.tz, ...TZ_LIST];
  const devTz = deviceTz();

  const patch = (p: Partial<Settings>) => {
    setS((x) => ({ ...x, ...p }));
    setDirty(true);
  };

  const save = async () => {
    setBusy(true);
    try {
      const r = await api.saveSettings({ tz: s.tz, reminders: s.reminders, morning_time: s.morning_time, vocab_per_day: s.vocab_per_day, lang });
      setS(r);
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

  return (
    <div className="screen">
      <h1>{t('Settings')}</h1>

      <Section label={t('How it works')}>
        <p className="muted small" style={{ marginTop: 0 }}>{t('Five short screens: how minutes are earned and spent, the iPhone lock, achievements and checks.')}</p>
        <button className="btn solid" onClick={() => { haptic.tap(); onGuide(); }}>{t('Show how it works')}</button>
      </Section>

      <Section label={t('Language')}>
        <div className="chips">
          {(['en', 'ru'] as Lang[]).map((l) => (
            <button key={l} className={`chip ${lang === l ? 'on' : ''}`} onClick={() => { haptic.select(); setLang(l); }}>{l === 'en' ? 'English' : 'Русский'}</button>
          ))}
        </div>
      </Section>

      <Section label={t('Bot message in the morning')}>
        <Toggle label={t('Three tasks for the day')} sub={t('A short message with buttons that open the tasks')} on={s.reminders} onChange={(v) => patch({ reminders: v })} />
        {s.reminders && (
          <div style={{ marginTop: 8 }}>
            <Field label={t('At')}><input type="time" step={300} value={s.morning_time} onChange={(e) => patch({ morning_time: e.target.value })} /></Field>
          </div>
        )}
        <Field label={t('Time zone')}>
          <select value={s.tz} onChange={(e) => patch({ tz: e.target.value })}>
            {tzOptions.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        </Field>
        {devTz !== s.tz && <button className="btn link" onClick={() => patch({ tz: devTz })}>{t('Use {tz}', { tz: devTz })}</button>}
      </Section>

      <Section label={t('New words a day')}>
        <div className="chips">
          {[0, 3, 5, 8, 10].map((n) => <button key={n} className={`chip ${s.vocab_per_day === n ? 'on' : ''}`} onClick={() => { haptic.select(); patch({ vocab_per_day: n }); }}>{n === 0 ? t('Off') : n}</button>)}
        </div>
        <div className="hint">{t('New words appear in the Words task; from the next day they are asked by typing.')}</div>
      </Section>

      <LockSettings />

      <ResetCard onReset={(r) => { setS(r); onReset(r); }} />

      {dirty && <button className="btn solid block savebar" disabled={busy} onClick={() => void save()}>{busy ? t('Saving…') : t('Save settings')}</button>}
    </div>
  );
}

import { useState } from 'react';
import type { SettingsView } from '@tracker/shared';
import { api, ApiError } from '../api';
import { haptic } from '../tg';
import { useLang, useT } from '../i18n';
import { useToast } from './Toast';
import { Section } from './ui';

/**
 * «Начать заново»: wipes minutes, attempts, words, achievements and history. The lock (gate link, NextDNS),
 * the lock settings and the language stay. Confirmed by typing a word, so it can't happen by a stray tap.
 */
export function ResetCard({ onReset }: { onReset: (s: SettingsView) => void }) {
  const t = useT();
  const toast = useToast();
  const { lang } = useLang();
  const word = lang === 'ru' ? 'ЗАНОВО' : 'RESET';
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setBusy(true);
    try {
      const s = await api.reset(typed);
      haptic.success();
      toast(t('Started again'));
      onReset(s);
    } catch (e) {
      haptic.warning();
      toast(e instanceof ApiError ? t(e.message) : t('Error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section label={t('Start again')}>
      <p className="muted small" style={{ marginTop: 0 }}>{t('Minutes, tasks, words, achievements and history go to zero. The iPhone lock, NextDNS, limits and language stay as they are.')}</p>
      {!open ? (
        <button className="btn danger" onClick={() => { haptic.tap(); setOpen(true); }}>{t('Start again')}</button>
      ) : (
        <>
          <div className="field">
            <label>{t('Type {w} to confirm', { w: word })}</label>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" autoCorrect="off" spellCheck={false} placeholder={word} />
          </div>
          <div className="row" style={{ gap: 12 }}>
            <button className="btn danger" disabled={busy || typed.trim().toUpperCase() !== word} onClick={() => void go()}>{busy ? '…' : t('Erase and start again')}</button>
            <button className="btn link" onClick={() => { setOpen(false); setTyped(''); }}>{t('Cancel')}</button>
          </div>
        </>
      )}
    </Section>
  );
}

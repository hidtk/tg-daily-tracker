import type { ReactNode } from 'react';
import { haptic, tg } from '../tg';
import { translate, useT, type Lang } from '../i18n';

export function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      className={`switch ${on ? 'on' : ''}`}
      aria-checked={on}
      role="switch"
      onClick={() => {
        haptic.select();
        onChange(!on);
      }}
    />
  );
}

export function Toggle({ label, sub, on, onChange }: { label: string; sub?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="toggle">
      <div>
        <div>{label}</div>
        {sub && <div className="small muted">{sub}</div>}
      </div>
      <Switch on={on} onChange={onChange} />
    </div>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const t = useT();
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="btn link" onClick={onClose}>{t('Close')}</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

export function Section({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="section">
      {label && <div className="label">{label}</div>}
      {children}
    </div>
  );
}

export function confirmDialog(msg: string): Promise<boolean> {
  return new Promise((res) => {
    try {
      tg.showConfirm(msg, res);
    } catch {
      res(window.confirm(msg));
    }
  });
}

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const WD_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function fmtDate(iso: string, today?: string, lang: Lang = 'en'): string {
  if (iso === today) return translate(lang, 'Today');
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const wd = translate(lang, WD_LONG[(dt.getUTCDay() + 6) % 7]);
  return `${wd}, ${d} ${translate(lang, MONTHS_SHORT[m - 1])}`;
}

export function fmtShort(iso: string, lang: Lang = 'en'): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${translate(lang, MONTHS_SHORT[m - 1])}`;
}

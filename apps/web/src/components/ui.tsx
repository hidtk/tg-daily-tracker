import type { ReactNode } from 'react';
import { haptic } from '../tg';

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
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>{title}</h2>
          <button className="btn ghost" onClick={onClose}>
            Закрыть
          </button>
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

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          className={value === o.v ? 'on' : ''}
          onClick={() => {
            haptic.select();
            onChange(o.v);
          }}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

export const MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export const MONTHS_GEN_RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const WD_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function fmtDate(iso: string, today?: string): string {
  if (iso === today) return 'Сегодня';
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const wd = WD_RU[(dt.getUTCDay() + 6) % 7];
  return `${wd}, ${d} ${MONTHS_GEN_RU[m - 1]}`;
}

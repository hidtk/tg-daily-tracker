import type { ReactNode } from 'react';

/**
 * Элвис — the chipmunk mascot from the «Элвис» design system (assets/Logos/elvis-mascot.svg, 200×200).
 * Copied verbatim from the design system bundle: do not recolour, stretch or add details.
 * Once per screen: welcome, hints, results.
 */
const MASCOT_SVG =
  '<path d="M132 176 C 176 174, 190 136, 180 104 C 172 78, 150 70, 140 84 C 132 96, 150 104, 156 118 C 162 136, 150 150, 132 152 Z" fill="#38c5f0"/><path d="M152 92 C 166 106, 170 128, 158 146" fill="none" stroke="#c4e1ff" stroke-width="7" stroke-linecap="round"/><ellipse cx="100" cy="160" rx="42" ry="36" fill="#1668e3"/><ellipse cx="100" cy="166" rx="26" ry="26" fill="#e3f1ff"/><ellipse cx="80" cy="192" rx="14" ry="7" fill="#0d4ea6"/><ellipse cx="120" cy="192" rx="14" ry="7" fill="#0d4ea6"/><circle cx="56" cy="46" r="15" fill="#1668e3"/><circle cx="144" cy="46" r="15" fill="#1668e3"/><circle cx="56" cy="47" r="7" fill="#c4e1ff"/><circle cx="144" cy="47" r="7" fill="#c4e1ff"/><ellipse cx="100" cy="90" rx="62" ry="54" fill="#1668e3"/><rect x="95" y="38" width="10" height="20" rx="5" fill="#0d4ea6"/><rect x="79" y="42" width="8" height="14" rx="4" fill="#0d4ea6"/><rect x="113" y="42" width="8" height="14" rx="4" fill="#0d4ea6"/><ellipse cx="100" cy="112" rx="48" ry="30" fill="#e3f1ff"/><ellipse cx="62" cy="116" rx="9" ry="5.5" fill="#ffb8c6"/><ellipse cx="138" cy="116" rx="9" ry="5.5" fill="#ffb8c6"/><circle cx="76" cy="86" r="19" fill="#ffffff" stroke="#0b1f3f" stroke-width="4"/><circle cx="124" cy="86" r="19" fill="#ffffff" stroke="#0b1f3f" stroke-width="4"/><path d="M95 84 Q 100 80 105 84" fill="none" stroke="#0b1f3f" stroke-width="4" stroke-linecap="round"/><circle cx="78" cy="88" r="9.5" fill="#0b1f3f"/><circle cx="122" cy="88" r="9.5" fill="#0b1f3f"/><circle cx="81" cy="84.5" r="3.6" fill="#ffffff"/><circle cx="125" cy="84.5" r="3.6" fill="#ffffff"/><circle cx="75.5" cy="92" r="1.6" fill="#ffffff"/><circle cx="119.5" cy="92" r="1.6" fill="#ffffff"/><ellipse cx="100" cy="106" rx="6.5" ry="4.5" fill="#0b1f3f"/><path d="M89 114 Q 100 124 111 114" fill="none" stroke="#0b1f3f" stroke-width="3" stroke-linecap="round"/><rect x="95.5" y="118" width="9" height="7" rx="2.5" fill="#ffffff" stroke="#0b1f3f" stroke-width="2"/>';

export function Mascot({ size = 96, message }: { size?: number; message?: ReactNode }) {
  return (
    <div className="el-mascot">
      <span className="el-mascot-pad">
        <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label="Элвис" dangerouslySetInnerHTML={{ __html: MASCOT_SVG }} />
      </span>
      {message && <div className="el-bubble">{message}</div>}
    </div>
  );
}

/** Filled icons with round ends, from the design system (Elvis.Icon). */
export const Icon = {
  streak: (s = 20) => (
    <svg viewBox="0 0 24 24" width={s} height={s} aria-hidden="true"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1.5-5 3-6 0 2 1 3 2 3-1-3 0-6 1-9z" fill="var(--streak)" /></svg>
  ),
  gems: (s = 20) => (
    <svg viewBox="0 0 24 24" width={s} height={s} aria-hidden="true"><path d="M6 3h12l4 6-10 12L2 9z" fill="var(--sky-400)" /><path d="M2 9h20M9 3 7 9l5 12 5-12-2-6" fill="none" stroke="var(--blue-500)" strokeWidth={1.5} strokeLinejoin="round" /></svg>
  ),
  star: (s = 20) => (
    <svg viewBox="0 0 24 24" width={s} height={s} aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill="currentColor" /></svg>
  ),
  check: (s = 20) => (
    <svg viewBox="0 0 24 24" width={s} height={s} aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  cross: (s = 20) => (
    <svg viewBox="0 0 24 24" width={s} height={s} aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" /></svg>
  ),
  lock: (s = 20) => (
    <svg viewBox="0 0 24 24" width={s} height={s} aria-hidden="true"><rect x={5} y={10} width={14} height={11} rx={3} fill="currentColor" /><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth={2.6} /></svg>
  ),
  book: (s = 20) => (
    <svg viewBox="0 0 24 24" width={s} height={s} aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" fill="currentColor" /><path d="M4 21a2 2 0 0 1 2-2h13v2z" fill="currentColor" opacity={0.6} /></svg>
  ),
  chart: (s = 20) => (
    <svg viewBox="0 0 24 24" width={s} height={s} aria-hidden="true"><rect x={3} y={12} width={5} height={9} rx={2.5} fill="currentColor" /><rect x={9.5} y={7} width={5} height={14} rx={2.5} fill="currentColor" /><rect x={16} y={3} width={5} height={18} rx={2.5} fill="currentColor" /></svg>
  ),
  gear: (s = 20) => (
    <svg viewBox="0 0 24 24" width={s} height={s} aria-hidden="true"><path d="M10.3 2h3.4l.6 2.8 2 .9 2.4-1.5 2.4 2.4-1.5 2.4.9 2 2.8.6v3.4l-2.8.6-.9 2 1.5 2.4-2.4 2.4-2.4-1.5-2 .9-.6 2.8h-3.4l-.6-2.8-2-.9-2.4 1.5-2.4-2.4 1.5-2.4-.9-2L2 13.7v-3.4l2.8-.6.9-2-1.5-2.4 2.4-2.4 2.4 1.5 2-.9z" fill="currentColor" /><circle cx={12} cy={12} r={3.6} fill="var(--surface-raised)" /></svg>
  ),
};

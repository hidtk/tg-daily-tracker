import { useId, useMemo, type ReactNode } from 'react';

/**
 * Элвис — the matte 3D chipmunk mascot from the «Элвис» design system (assets/Logos/elvis-mascot.svg, 200×200).
 * Copied verbatim from the design system bundle: do not recolour, stretch, add highlights or details.
 * Gradient/filter ids are made unique per instance, so two mascots on one page don't share defs.
 * Once per screen: welcome, hints, results.
 */
const MASCOT_SVG =
  '<defs><radialGradient id="elv-fur" cx="0.38" cy="0.3" r="0.8"><stop offset="0" stop-color="#4b93f5"/><stop offset="0.55" stop-color="#1b6ce6"/><stop offset="1" stop-color="#0e4fb0"/></radialGradient><radialGradient id="elv-cream" cx="0.4" cy="0.3" r="0.85"><stop offset="0" stop-color="#f7fbff"/><stop offset="0.6" stop-color="#e3f1ff"/><stop offset="1" stop-color="#bcd8f6"/></radialGradient><radialGradient id="elv-tail" cx="0.35" cy="0.3" r="0.9"><stop offset="0" stop-color="#7ddaf6"/><stop offset="0.6" stop-color="#38c5f0"/><stop offset="1" stop-color="#1f9cc8"/></radialGradient><radialGradient id="elv-ear" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="#a9cdf5"/><stop offset="1" stop-color="#7fb1ea"/></radialGradient><radialGradient id="elv-lens" cx="0.4" cy="0.35" r="0.75"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e2ecf7"/></radialGradient><radialGradient id="elv-pupil" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="#26406a"/><stop offset="1" stop-color="#0b1f3f"/></radialGradient><linearGradient id="elv-foot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b5fc4"/><stop offset="1" stop-color="#0b3f8e"/></linearGradient><filter id="elv-soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4"/></filter><filter id="elv-softer" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="3"/></filter></defs><ellipse cx="104" cy="194" rx="62" ry="6" fill="#0b1f3f" opacity="0.18" filter="url(#elv-softer)"/><path d="M132 176 C 176 174, 190 136, 180 104 C 172 78, 150 70, 140 84 C 132 96, 150 104, 156 118 C 162 136, 150 150, 132 152 Z" fill="url(#elv-tail)"/><path d="M152 92 C 166 106, 170 128, 158 146" fill="none" stroke="#c4e1ff" stroke-width="7" stroke-linecap="round" opacity="0.85"/><ellipse cx="100" cy="160" rx="42" ry="36" fill="url(#elv-fur)"/><ellipse cx="100" cy="166" rx="26" ry="26" fill="url(#elv-cream)"/><ellipse cx="100" cy="134" rx="46" ry="10" fill="#0b1f3f" opacity="0.28" filter="url(#elv-soft)"/><ellipse cx="80" cy="190" rx="14" ry="7" fill="url(#elv-foot)"/><ellipse cx="120" cy="190" rx="14" ry="7" fill="url(#elv-foot)"/><circle cx="56" cy="46" r="15" fill="url(#elv-fur)"/><circle cx="144" cy="46" r="15" fill="url(#elv-fur)"/><circle cx="56" cy="47" r="7" fill="url(#elv-ear)"/><circle cx="144" cy="47" r="7" fill="url(#elv-ear)"/><ellipse cx="100" cy="90" rx="62" ry="54" fill="url(#elv-fur)"/><rect x="95" y="38" width="10" height="20" rx="5" fill="#0d4ea6" opacity="0.9"/><rect x="79" y="42" width="8" height="14" rx="4" fill="#0d4ea6" opacity="0.9"/><rect x="113" y="42" width="8" height="14" rx="4" fill="#0d4ea6" opacity="0.9"/><ellipse cx="100" cy="116" rx="48" ry="30" fill="#0b1f3f" opacity="0.18" filter="url(#elv-soft)"/><ellipse cx="100" cy="112" rx="48" ry="30" fill="url(#elv-cream)"/><ellipse cx="62" cy="116" rx="9" ry="5.5" fill="#ffb8c6" opacity="0.85" filter="url(#elv-softer)"/><ellipse cx="138" cy="116" rx="9" ry="5.5" fill="#ffb8c6" opacity="0.85" filter="url(#elv-softer)"/><circle cx="77" cy="90" r="20" fill="#0b1f3f" opacity="0.22" filter="url(#elv-softer)"/><circle cx="125" cy="90" r="20" fill="#0b1f3f" opacity="0.22" filter="url(#elv-softer)"/><circle cx="76" cy="86" r="19" fill="url(#elv-lens)" stroke="#0b1f3f" stroke-width="4"/><circle cx="124" cy="86" r="19" fill="url(#elv-lens)" stroke="#0b1f3f" stroke-width="4"/><path d="M95 84 Q 100 80 105 84" fill="none" stroke="#0b1f3f" stroke-width="4" stroke-linecap="round"/><circle cx="78" cy="88" r="9.5" fill="url(#elv-pupil)"/><circle cx="122" cy="88" r="9.5" fill="url(#elv-pupil)"/><circle cx="81" cy="84.5" r="3.4" fill="#ffffff" opacity="0.9"/><circle cx="125" cy="84.5" r="3.4" fill="#ffffff" opacity="0.9"/><circle cx="75.5" cy="92" r="1.5" fill="#ffffff" opacity="0.7"/><circle cx="119.5" cy="92" r="1.5" fill="#ffffff" opacity="0.7"/><ellipse cx="100" cy="106" rx="6.5" ry="4.5" fill="url(#elv-pupil)"/><path d="M89 114 Q 100 124 111 114" fill="none" stroke="#0b1f3f" stroke-width="3" stroke-linecap="round"/><rect x="95.5" y="118" width="9" height="7" rx="2.5" fill="#f7fbff" stroke="#0b1f3f" stroke-width="2"/>';

export function Mascot({ size = 96, message }: { size?: number; message?: ReactNode }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const html = useMemo(() => MASCOT_SVG.replace(/elv-/g, `elv${uid}-`), [uid]);
  return (
    <div className="el-mascot">
      <span className="el-mascot-pad">
        <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label="Элвис" dangerouslySetInnerHTML={{ __html: html }} />
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

import type { ReactNode } from 'react';

export type HintSide = 'top' | 'bottom' | 'left' | 'right';

/** A straight arrow; drawn pointing down, turned by CSS towards the target. */
function Arrow() {
  return (
    <svg viewBox="0 0 24 30" width="20" height="26" aria-hidden="true">
      <path d="M12 2 V25" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M4 17 L12 26 L20 17" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * "Tap here": wraps the real element, rings it, and puts a label with an arrow on one `side` of it,
 * the arrow head touching the element's edge. `align` moves a top/bottom label to one edge when the
 * element sits near the side of the screen.
 */
export function Target({ label, side = 'top', align = 'center', block = false, children }: { label: string; side?: HintSide; align?: 'center' | 'start' | 'end'; block?: boolean; children: ReactNode }) {
  const before = side === 'top' || side === 'left';
  return (
    <span className={`target${block ? ' block' : ''}`}>
      {children}
      <span className={`tap-hint tap-hint-${side} tap-hint-${align}`} aria-hidden="true">
        {before && <span className="tap-hint-label">{label}</span>}
        <Arrow />
        {!before && <span className="tap-hint-label">{label}</span>}
      </span>
    </span>
  );
}

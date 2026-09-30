/** A curved arrow with a label that points at a real button in a mock-up ("tap here"). */
export function Pointer({ label, dir = 'down' }: { label: string; dir?: 'down' | 'left' | 'up' }) {
  return (
    <span className={`pointer ${dir}`} aria-hidden="true">
      <span className="pointer-label">{label}</span>
      <svg viewBox="0 0 48 40" width="44" height="36">
        <path d="M6 4 C 10 22, 22 30, 38 30" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <path d="M30 22 L 40 30 L 30 37" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

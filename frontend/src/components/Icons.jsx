// Small inline icons; they inherit the text colour and scale with font-size.
const base = { width: '1em', height: '1em', viewBox: '0 0 24 24', 'aria-hidden': true, focusable: 'false' };

export function PlayIcon() {
  return <svg {...base} fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" /></svg>;
}

export function SearchIcon() {
  return <svg {...base} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m20 20-4.8-4.8" /></svg>;
}

export function CloseIcon() {
  return <svg {...base} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>;
}

export function ChevronIcon({ direction = 'right' }) {
  return (
    <svg {...base} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d={direction === 'left' ? 'm15 5-7 7 7 7' : 'm9 5 7 7-7 7'} />
    </svg>
  );
}

export function BackIcon() {
  return <svg {...base} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5m6-7-7 7 7 7" /></svg>;
}

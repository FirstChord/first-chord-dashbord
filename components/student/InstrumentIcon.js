// Hand-drawn-style instrument icons matching the First Chord illustration
// language (flat colours, slightly wonky shapes).

function GuitarIcon({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <g transform="rotate(38 12 12) translate(12 12) scale(1.28) translate(-12 -12)">
        <rect x="11.15" y="0.8" width="1.7" height="12" rx="0.85" fill="#5b4233" />
        <rect x="10.5" y="0" width="3" height="2.3" rx="0.8" fill="#3e2d22" />
        <ellipse cx="12" cy="11.6" rx="3.4" ry="3" fill="#b08163" />
        <ellipse cx="12" cy="15.4" rx="4.6" ry="4.1" fill="#b08163" />
        <circle cx="12" cy="13.4" r="1.7" fill="#4a352a" />
        <line x1="12" y1="1.6" x2="12" y2="13.2" stroke="#ecdfc8" strokeWidth="0.55" />
      </g>
    </svg>
  );
}

function BassIcon({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <g transform="rotate(38 12 12) translate(12 12) scale(1.22) translate(-12 -12)">
        <rect x="11.25" y="-1.2" width="1.5" height="14.5" rx="0.75" fill="#33261d" />
        <rect x="10.6" y="-2" width="2.8" height="2.2" rx="0.7" fill="#221912" />
        <ellipse cx="12" cy="12.6" rx="3.1" ry="2.8" fill="#7c4f33" />
        <ellipse cx="12" cy="16.2" rx="4.2" ry="3.8" fill="#7c4f33" />
        <circle cx="12" cy="14.3" r="1.5" fill="#31221a" />
        <line x1="12" y1="-0.6" x2="12" y2="14.2" stroke="#d8c6ab" strokeWidth="0.55" />
      </g>
    </svg>
  );
}

function UkuleleIcon({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <g transform="rotate(38 12 12) translate(12 12) scale(1.25) translate(-12 -12)">
        <rect x="11.2" y="3.6" width="1.6" height="9.5" rx="0.8" fill="#6d4c33" />
        <rect x="10.6" y="2.8" width="2.8" height="2.1" rx="0.7" fill="#4a3324" />
        <ellipse cx="12" cy="13.4" rx="2.9" ry="2.6" fill="#d9a066" />
        <ellipse cx="12" cy="16.6" rx="3.8" ry="3.4" fill="#d9a066" />
        <circle cx="12" cy="14.9" r="1.4" fill="#5c4030" />
        <line x1="12" y1="4.2" x2="12" y2="14.8" stroke="#f3e3c8" strokeWidth="0.5" />
      </g>
    </svg>
  );
}

function PianoIcon({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2.2" fill="#ffffff" stroke="#2b2b2b" strokeWidth="1.2" />
      <line x1="8.7" y1="4.6" x2="8.5" y2="19.4" stroke="#2b2b2b" strokeWidth="0.7" />
      <line x1="15.4" y1="4.6" x2="15.6" y2="19.4" stroke="#2b2b2b" strokeWidth="0.7" />
      <rect x="6.7" y="4.4" width="3.1" height="9.2" rx="0.6" fill="#222222" transform="rotate(-1.5 8.2 9)" />
      <rect x="13.5" y="4.4" width="3.1" height="10.3" rx="0.6" fill="#222222" transform="rotate(1.5 15 9.5)" />
    </svg>
  );
}

function NotesIcon({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <g fill="#222222">
        <ellipse cx="9" cy="16.6" rx="2" ry="1.55" transform="rotate(-14 9 16.6)" />
        <rect x="10.35" y="6.6" width="1" height="10" rx="0.5" />
        <ellipse cx="16.5" cy="14.9" rx="2" ry="1.55" transform="rotate(-14 16.5 14.9)" />
        <rect x="17.85" y="4.9" width="1" height="10" rx="0.5" />
        <polygon points="10.35,6.6 18.85,4.9 18.85,7.3 10.35,9" />
        <ellipse cx="4.4" cy="20.4" rx="1.35" ry="1.05" transform="rotate(-14 4.4 20.4)" />
        <rect x="5.3" y="14" width="0.75" height="6.6" rx="0.37" />
        <path d="M5.3 14 q1.9 0.3 2.2 2.1 q-1.1-0.9 -2.2-0.9 Z" />
      </g>
    </svg>
  );
}

const ICON_BY_KEY = {
  guitar: GuitarIcon,
  bass: BassIcon,
  ukulele: UkuleleIcon,
  piano: PianoIcon,
  voice: NotesIcon,
  singing: NotesIcon,
};

function iconKeysFor(instrument = '') {
  const lower = instrument.toLowerCase();
  const keys = [];
  if (lower.includes('ukulele')) keys.push('ukulele');
  if (lower.includes('bass')) keys.push('bass');
  else if (lower.includes('guitar')) keys.push('guitar');
  if (lower.includes('piano')) keys.push('piano');
  if (lower.includes('voice') || lower.includes('singing')) keys.push('voice');
  return keys;
}

export default function InstrumentIcon({ instrument, size = 30 }) {
  const keys = iconKeysFor(instrument);
  if (keys.length === 0) return null;
  return (
    <span
      role="img"
      aria-label={instrument}
      title={instrument}
      className="inline-flex shrink-0 items-center gap-1"
    >
      {keys.map((key) => {
        const Icon = ICON_BY_KEY[key];
        return <Icon key={key} size={size} />;
      })}
    </span>
  );
}

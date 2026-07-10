// Flat cut-out-style icons drawn from motifs in the First Chord illustration
// (sheet-music readers, summit flag, shooting star, piano-key stairs, speech).
// House palette: deep green #2F6B3D, sage #6E9B6B, pale sage #A7C8A2,
// coral #F0876E, periwinkle #8B8BE0.

export function SheetMusicIcon({ className }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="7" y="4" width="26" height="32" rx="3" fill="#ffffff" stroke="#2F6B3D" strokeWidth="2" />
      <path d="M12 13 q4 -2.5 8 0 t8 0" stroke="#2F6B3D" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M12 20 q4 -2.5 8 0 t8 0" stroke="#2F6B3D" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M12 27 q4 -2.5 8 0 t8 0" stroke="#6E9B6B" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <circle cx="25" cy="30.5" r="2.6" fill="#2F6B3D" />
      <rect x="27.1" y="19" width="1.6" height="11.5" rx="0.8" fill="#2F6B3D" />
    </svg>
  );
}

// Two people reading a score together — the duo from the First Chord
// illustration (also in the bottom-right banner)
export function ScoreReadersIcon({ className }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      {/* left figure */}
      <circle cx="12.5" cy="8.5" r="4.6" fill="#8D5524" />
      <path d="M6.5 38 L6.5 22 C6.5 17.6 9.2 15 13 15 C16.8 15 19 17.6 19 22 L19 38 Z" fill="#F0876E" />
      {/* right figure */}
      <circle cx="28" cy="8" r="4.6" fill="#5C3A21" />
      <path d="M21.5 38 L21.5 21.5 C21.5 17.1 24.2 14.5 28 14.5 C31.8 14.5 34.5 17.1 34.5 21.5 L34.5 38 Z" fill="#8B8BE0" />
      {/* the score held between them */}
      <g transform="rotate(-4 20 25)">
        <rect x="12.5" y="19.5" width="15" height="11.5" rx="1.5" fill="#ffffff" stroke="#2F6B3D" strokeWidth="1.4" />
        <line x1="15" y1="23" x2="25" y2="23" stroke="#2F6B3D" strokeWidth="1.1" />
        <line x1="15" y1="26" x2="25" y2="26" stroke="#2F6B3D" strokeWidth="1.1" />
        <circle cx="22.5" cy="28.3" r="1.3" fill="#2F6B3D" />
      </g>
    </svg>
  );
}

export function ShootingStarIcon({ className }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <path d="M3 26 C10 22 18 18 26 15 L27.5 19.5 C19 22 11 26 5 30 Z" fill="#8B8BE0" />
      <path d="M4.5 30.5 C11 26.5 18.5 23 26.5 20.5 L27.5 23.5 C20 26 13 29.5 7 33 Z" fill="#A7C8A2" />
      <path
        d="M31 9 l2.2 4.6 5 0.6 -3.7 3.4 1 4.9 -4.5 -2.5 -4.4 2.5 0.9 -4.9 -3.7 -3.4 5 -0.6 Z"
        fill="#E8B84B"
      />
    </svg>
  );
}

export function MountainFlagIcon({ className }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <path d="M4 36 L20 8 L36 36 Z" fill="#6E9B6B" />
      <path d="M20 8 L26.5 19.5 C24 21.5 22 19 20 20.5 C18 22 16.5 19.8 14 20.8 Z" fill="#ffffff" />
      <rect x="19.2" y="1" width="1.6" height="9" rx="0.8" fill="#2F6B3D" />
      <path d="M20.8 1.5 L29 3.5 L20.8 5.8 Z" fill="#F0876E" />
    </svg>
  );
}

export function PianoStairsIcon({ className }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="4" y="10" width="32" height="20" rx="3" fill="#ffffff" stroke="#2F6B3D" strokeWidth="2" />
      <line x1="12" y1="10" x2="12" y2="30" stroke="#2F6B3D" strokeWidth="1.5" />
      <line x1="20" y1="10" x2="20" y2="30" stroke="#2F6B3D" strokeWidth="1.5" />
      <line x1="28" y1="10" x2="28" y2="30" stroke="#2F6B3D" strokeWidth="1.5" />
      <rect x="9.5" y="10" width="5" height="12" rx="1" fill="#2F6B3D" />
      <rect x="22.5" y="10" width="5" height="12" rx="1" fill="#2F6B3D" transform="rotate(1.5 25 16)" />
    </svg>
  );
}

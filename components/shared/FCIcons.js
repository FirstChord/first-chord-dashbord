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

export function SpeechNoteIcon({ className }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <path
        d="M20 5 C11 5 4.5 10.8 4.5 18.2 C4.5 25.6 11 31.4 20 31.4 C21.4 31.4 22.8 31.2 24.1 30.9 L31.5 35 L29.8 27.6 C33.3 25.2 35.5 21.9 35.5 18.2 C35.5 10.8 29 5 20 5 Z"
        fill="#F0876E"
      />
      <circle cx="16" cy="22.5" r="2.7" fill="#ffffff" />
      <circle cx="24.5" cy="21" r="2.7" fill="#ffffff" />
      <rect x="18.2" y="11.5" width="1.7" height="11" rx="0.85" fill="#ffffff" />
      <rect x="26.7" y="10" width="1.7" height="11" rx="0.85" fill="#ffffff" />
      <polygon points="18.2,11.5 28.4,10 28.4,13 18.2,14.5" fill="#ffffff" />
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

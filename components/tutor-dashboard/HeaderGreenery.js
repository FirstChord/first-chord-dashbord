// Matisse-cutout-style greenery for the header banner: flat colours, no
// shading, shapes reduced to essence. Purely decorative.

function Fern({ className, flip = false }) {
  const leaflets = [
    { y: 16, rx: 11, side: 1 }, { y: 22, rx: 12, side: -1 },
    { y: 30, rx: 10, side: 1 }, { y: 37, rx: 10, side: -1 },
    { y: 45, rx: 8, side: 1 }, { y: 52, rx: 7, side: -1 },
    { y: 60, rx: 5, side: 1 }, { y: 66, rx: 4, side: -1 },
  ];
  return (
    <svg viewBox="0 0 60 80" className={className} aria-hidden="true" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M30 80 C30 55 28 30 34 8" stroke="#2F6B3D" strokeWidth="3" fill="none" strokeLinecap="round" />
      {leaflets.map(({ y, rx, side }, i) => (
        <ellipse
          key={i}
          cx={31 + side * (rx * 0.8)}
          cy={y + 8}
          rx={rx}
          ry={rx * 0.34}
          fill="#2F6B3D"
          transform={`rotate(${side * -28} ${31 + side * (rx * 0.8)} ${y + 8})`}
        />
      ))}
    </svg>
  );
}

function Grass({ className, color = '#6E9B6B' }) {
  return (
    <svg viewBox="0 0 50 60" className={className} aria-hidden="true">
      <path d="M10 60 C8 40 4 28 2 18 C10 28 14 42 15 60 Z" fill={color} />
      <path d="M22 60 C22 34 24 18 28 4 C30 22 28 42 27 60 Z" fill={color} />
      <path d="M36 60 C38 44 44 32 48 24 C44 38 41 48 40 60 Z" fill={color} />
    </svg>
  );
}

function Sprig({ className, flip = false }) {
  const leaves = [
    { x: 24, y: 14, r: 6 }, { x: 34, y: 24, r: 6.5 },
    { x: 22, y: 32, r: 7 }, { x: 36, y: 42, r: 7.5 },
    { x: 24, y: 50, r: 8 },
  ];
  return (
    <svg viewBox="0 0 60 70" className={className} aria-hidden="true" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M30 70 C30 50 28 28 26 8" stroke="#A7C8A2" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {leaves.map(({ x, y, r }, i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#A7C8A2" />
      ))}
    </svg>
  );
}

export default function HeaderGreenery() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* left cluster */}
      <Fern className="absolute -bottom-2 left-4 h-20 w-16 opacity-90" />
      <Grass className="absolute -bottom-1 left-16 h-12 w-12 opacity-80" />
      <Sprig className="absolute -bottom-3 left-28 h-16 w-12 opacity-80" flip />
      {/* right cluster (clear of the Switch Tutor button) */}
      <Sprig className="absolute -bottom-3 right-40 h-16 w-12 opacity-80" />
      <Grass className="absolute -bottom-1 right-32 h-12 w-12 opacity-80" color="#2F6B3D" />
      <Fern className="absolute -bottom-2 right-44 h-20 w-16 opacity-90" flip />
    </div>
  );
}

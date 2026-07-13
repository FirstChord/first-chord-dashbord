'use client';

import { useEffect, useState } from 'react';
import { getTimeOfDaySky } from '@/lib/time-of-day-sky.mjs';

const DAYTIME_SKY = getTimeOfDaySky(12 * 60);

function currentLocalMinutes() {
  if (process.env.NODE_ENV === 'development') {
    const preview = new URLSearchParams(window.location.search).get('skyTime');
    const match = preview?.match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
      const hours = Number(match[1]);
      const minutes = Number(match[2]);
      if (hours < 24 && minutes < 60) return hours * 60 + minutes;
    }
  }

  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function withAlpha(hex, alpha) {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
  return `rgb(${channels.join(' ')} / ${alpha})`;
}

function skyStyles(sky) {
  const glow = withAlpha(sky.glow, sky.glowOpacity);
  const glowEdge = withAlpha(sky.glow, sky.glowOpacity * 0.4);

  return {
    '--dashboard-header-sky': sky.header,
    '--dashboard-header-background': `linear-gradient(115deg, rgba(219, 234, 254, 0.96) 0%, ${sky.header} 58%, rgba(224, 242, 254, 0.92) 100%)`,
    backgroundColor: sky.base,
    backgroundImage: `radial-gradient(ellipse 68% 44% at 78% 62%, ${glow} 0%, ${glowEdge} 32%, transparent 70%), linear-gradient(to top, ${sky.base} 0%, ${sky.base} 18%, ${sky.low} 42%, ${sky.horizon} 67%, ${sky.top} 100%)`,
  };
}

export default function TimeOfDaySky({ children, className = '' }) {
  // Starting from a fixed daytime value keeps server and browser markup equal;
  // the local palette is applied immediately after hydration.
  const [sky, setSky] = useState(DAYTIME_SKY);

  useEffect(() => {
    const updateSky = () => setSky(getTimeOfDaySky(currentLocalMinutes()));
    updateSky();
    const interval = window.setInterval(updateSky, 60 * 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className={className} data-sky={sky.name} style={skyStyles(sky)}>
      {children}
    </div>
  );
}

import React, { useMemo } from 'react';

// A faint, noisy, decaying "training loss" line drawn under the navbar in Train mode.
export default function LossCurve() {
  const d = useMemo(() => {
    const pts = [];
    let seed = 7;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i <= 120; i += 1) {
      const x = (i / 120) * 1000;
      const base = Math.exp(-i / 28);
      const noise = (rand() - 0.5) * 0.18 * (0.35 + base);
      const y = 4 + (1 - Math.min(1, base + noise)) * 0 + (base + noise) * 22;
      pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${(30 - y).toFixed(1)}`);
    }
    return pts.join(' ');
  }, []);

  return (
    <svg className="loss-curve" viewBox="0 0 1000 30" preserveAspectRatio="none" aria-hidden="true">
      <path d={d} pathLength="1" />
    </svg>
  );
}

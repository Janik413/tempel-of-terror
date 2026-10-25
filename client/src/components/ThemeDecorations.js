import React, { useMemo } from 'react';

const PARTICLE_COUNT = 18;

/**
 * Background particles: falling snow for Christmas, drifting bats and ghosts
 * for Halloween. Purely decorative and ignored by pointer events.
 */
function ThemeDecorations({ theme }) {
  // Random positions are created once per theme so they do not jump on re-render
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, index) => ({
        id: index,
        symbol: theme.particles[index % theme.particles.length],
        left: Math.random() * 100,
        size: 0.8 + Math.random() * 1.4,
        duration: 10 + Math.random() * 14,
        delay: -Math.random() * 24
      })),
    [theme]
  );

  return (
    <div className={`theme-decorations ${theme.id}`} aria-hidden="true">
      {particles.map(particle => (
        <span
          key={particle.id}
          className="theme-particle"
          style={{
            left: `${particle.left}%`,
            fontSize: `${particle.size}rem`,
            animationDuration: `${particle.duration}s`,
            animationDelay: `${particle.delay}s`
          }}
        >
          {particle.symbol}
        </span>
      ))}
    </div>
  );
}

export default ThemeDecorations;

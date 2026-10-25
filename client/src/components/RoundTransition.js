import React, { useState, useEffect, useRef } from 'react';

const VISIBLE_MS = 4500;
const FADE_MS = 300;

// Full screen animation between two rounds
function RoundTransition({ round, roundCount, keyHolderName, game, theme, onComplete }) {
  const [countdown, setCountdown] = useState(3);
  const [isVisible, setIsVisible] = useState(true);

  // Keep the latest callback in a ref so re-renders of the parent do not restart the timers
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const countdownInterval = setInterval(() => {
      setCountdown(previous => Math.max(0, previous - 1));
    }, 1000);

    let fadeTimer;
    const closeTimer = setTimeout(() => {
      setIsVisible(false);
      fadeTimer = setTimeout(() => onCompleteRef.current(), FADE_MS);
    }, VISIBLE_MS);

    return () => {
      clearInterval(countdownInterval);
      clearTimeout(closeTimer);
      clearTimeout(fadeTimer);
    };
  }, []);

  return (
    <div className={`round-transition-overlay ${isVisible ? 'visible' : 'hidden'}`}>
      <div className={`round-transition-modal ${isVisible ? 'visible' : 'hidden'}`}>
        <div className="round-transition-icon">{theme.titleIcon}</div>

        <h1 className="round-transition-title">
          Round {round + 1} of {roundCount}
        </h1>

        <div className="round-transition-divider"></div>

        <div className="round-transition-info">
          <p className="round-transition-message">🔄 Cards are being shuffled and redistributed</p>

          <p className="round-transition-keyholder">
            🗝️ <strong>{keyHolderName}</strong> holds the key
          </p>

          <div className="round-transition-stats">
            <div className="stat-item">
              <span className="stat-icon">{theme.chambers.gold.icon}</span>
              <span className="stat-text">
                {game.found.gold}/{game.total.gold} {theme.chambers.gold.name}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-icon">{theme.chambers.trap.icon}</span>
              <span className="stat-text">
                {game.found.trap}/{game.total.trap} Traps
              </span>
            </div>
          </div>
        </div>

        {countdown > 0 && <div className="round-transition-countdown">{countdown}</div>}
        <div className="round-transition-ready">{countdown === 0 && '✨ Ready!'}</div>
      </div>
    </div>
  );
}

export default RoundTransition;

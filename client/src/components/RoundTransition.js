import React, { useState, useEffect } from 'react';

function RoundTransition({ round, keyHolderName, gameState, onComplete }) {
  const [countdown, setCountdown] = useState(3);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Countdown timer
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Auto-close after 3.5 seconds
    const closeTimer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        onComplete();
      }, 300); // Wait for fade out animation
    }, 3500);

    return () => {
      clearInterval(countdownInterval);
      clearTimeout(closeTimer);
    };
  }, [onComplete]);

  return (
    <div className={`round-transition-overlay ${isVisible ? 'visible' : 'hidden'}`}>
      <div className={`round-transition-modal ${isVisible ? 'visible' : 'hidden'}`}>
        <div className="round-transition-icon">🏛️</div>
        
        <h1 className="round-transition-title">
          Round {round + 1} of 4
        </h1>
        
        <div className="round-transition-divider"></div>
        
        <div className="round-transition-info">
          <p className="round-transition-message">
            🔄 Cards are being shuffled and redistributed
          </p>
          
          <p className="round-transition-keyholder">
            🗝️ <strong>{keyHolderName}</strong> holds the key
          </p>

          {gameState && (
            <div className="round-transition-stats">
              <div className="stat-item">
                <span className="stat-icon">💰</span>
                <span className="stat-text">{gameState.foundGold}/{gameState.totalGold} Gold</span>
              </div>
              <div className="stat-item">
                <span className="stat-icon">🔥</span>
                <span className="stat-text">{gameState.foundTraps}/{gameState.totalTraps} Traps</span>
              </div>
            </div>
          )}
        </div>

        {countdown > 0 && (
          <div className="round-transition-countdown">
            {countdown}
          </div>
        )}

        <div className="round-transition-ready">
          {countdown === 0 && '✨ Ready!'}
        </div>
      </div>
    </div>
  );
}

export default RoundTransition;

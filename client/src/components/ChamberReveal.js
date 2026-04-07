import React, { useState, useEffect } from 'react';

function ChamberReveal({ playerName, chamberType, onComplete }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Auto-close after 3 seconds
    const closeTimer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        onComplete();
      }, 300); // Wait for fade out animation
    }, 3000);

    return () => {
      clearTimeout(closeTimer);
    };
  }, [onComplete]);

  const chamberInfo = {
    gold: { icon: '💰', name: 'Gold!', color: 'gold' },
    empty: { icon: '📭', name: 'Empty Room', color: 'empty' },
    trap: { icon: '🔥', name: 'Fire Trap!', color: 'trap' }
  };

  const info = chamberInfo[chamberType];

  return (
    <div className={`chamber-reveal-overlay ${isVisible ? 'visible' : 'hidden'}`}>
      <div className={`chamber-reveal-modal ${isVisible ? 'visible' : 'hidden'}`}>
        <h2 className="chamber-reveal-title">Chamber Revealed!</h2>
        
        <div className="chamber-reveal-player">
          {playerName}'s Chamber
        </div>

        <div className={`chamber-reveal-icon ${info.color}`}>
          {info.icon}
        </div>

        <div className={`chamber-reveal-name ${info.color}`}>
          {info.name}
        </div>

        {chamberType === 'gold' && (
          <div className="chamber-reveal-subtitle">
            ⚔️ Good for Adventurers!
          </div>
        )}

        {chamberType === 'trap' && (
          <div className="chamber-reveal-subtitle">
            🧙‍♀️ Good for Hexen!
          </div>
        )}

        {chamberType === 'empty' && (
          <div className="chamber-reveal-subtitle">
            Time wasted...
          </div>
        )}
      </div>
    </div>
  );
}

export default ChamberReveal;

import React, { useState, useEffect, useRef } from 'react';

const VISIBLE_MS = 3000;
const FADE_MS = 300;

// Full screen animation that shows the content of the chamber that was just opened
function ChamberReveal({ playerName, chamberType, theme, onComplete }) {
  const [isVisible, setIsVisible] = useState(true);

  // Keep the latest callback in a ref so re-renders of the parent do not restart the timer
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let fadeTimer;
    const closeTimer = setTimeout(() => {
      setIsVisible(false);
      fadeTimer = setTimeout(() => onCompleteRef.current(), FADE_MS);
    }, VISIBLE_MS);

    return () => {
      clearTimeout(closeTimer);
      clearTimeout(fadeTimer);
    };
  }, []);

  const chamber = theme.chambers[chamberType];
  const subtitles = {
    gold: `${theme.roles.adventurer.icon} Good for the ${theme.roles.adventurer.plural}!`,
    trap: `${theme.roles.hexe.icon} Good for the ${theme.roles.hexe.plural}!`,
    empty: theme.emptySubtitle
  };

  return (
    <div className={`chamber-reveal-overlay ${isVisible ? 'visible' : 'hidden'}`}>
      <div className={`chamber-reveal-modal ${isVisible ? 'visible' : 'hidden'}`}>
        <h2 className="chamber-reveal-title">Chamber Revealed!</h2>
        <div className="chamber-reveal-player">{playerName}'s Chamber</div>
        <div className={`chamber-reveal-icon ${chamberType}`}>{chamber.icon}</div>
        <div className={`chamber-reveal-name ${chamberType}`}>{chamber.revealName}</div>
        <div className="chamber-reveal-subtitle">{subtitles[chamberType]}</div>
      </div>
    </div>
  );
}

export default ChamberReveal;

import React, { useState, useEffect } from 'react';

function GameOver({ socket, allPlayers, gameState, onLeave }) {
  const [gameOverData, setGameOverData] = useState(null);

  useEffect(() => {
    socket.on('gameOver', (data) => {
      console.log('Game Over Data Received:', data);
      setGameOverData(data);
    });

    // If gameState already has winner, use that with allPlayers
    if (gameState?.winner) {
      console.log('Using gameState winner, allPlayers:', allPlayers);
      
      setGameOverData({
        winner: gameState.winner,
        reason: gameState.reason || 'Game Over',
        players: allPlayers || []
      });
    }

    return () => {
      socket.off('gameOver');
    };
  }, [socket, gameState, allPlayers]);

  if (!gameOverData) {
    return <div className="loading">Loading results...</div>;
  }

  console.log('Rendering GameOver with data:', gameOverData);
  
  const isAdventurerWin = gameOverData.winner === 'adventurers';
  const adventurers = gameOverData.players?.filter(p => p.role === 'adventurer') || [];
  const guardians = gameOverData.players?.filter(p => p.role === 'guardian') || [];

  console.log('Adventurers:', adventurers);
  console.log('Guardians:', guardians);

  return (
    <div className="game-over-screen">
      <div className="temple-bg"></div>
      <div className="game-over-content">
        <div className={`victory-banner ${gameOverData.winner}`}>
          <div className="victory-icon">
            {isAdventurerWin ? '⚔️' : '🛡️'}
          </div>
          <h1 className="victory-title">
            {isAdventurerWin ? 'Adventurers Win!' : 'Guardians Win!'}
          </h1>
          <p className="victory-reason">{gameOverData.reason}</p>
        </div>

        <div className="final-roles">
          <h2>🎭 All Roles Revealed</h2>
          <p className="roles-subtitle">Everyone's secret identity is now shown!</p>
          
          <div className="role-columns">
            <div className="role-column adventurers">
              <h3>⚔️ Adventurers ({adventurers.length})</h3>
              <div className="role-list">
                {adventurers.length > 0 ? (
                  adventurers.map(p => (
                    <div key={p.id || p.name} className="role-item adventurer">
                      {p.name}
                    </div>
                  ))
                ) : (
                  <div className="no-players">No adventurers</div>
                )}
              </div>
            </div>

            <div className="role-column guardians">
              <h3>🛡️ Guardians ({guardians.length})</h3>
              <div className="role-list">
                {guardians.length > 0 ? (
                  guardians.map(p => (
                    <div key={p.id || p.name} className="role-item guardian">
                      {p.name}
                    </div>
                  ))
                ) : (
                  <div className="no-players">No guardians</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="game-over-actions">
          <button onClick={onLeave} className="btn btn-large btn-primary">
            Play Again (New Room)
          </button>
          <button onClick={onLeave} className="btn btn-large btn-secondary">
            Back to Menu
          </button>
        </div>
      </div>
    </div>
  );
}

export default GameOver;

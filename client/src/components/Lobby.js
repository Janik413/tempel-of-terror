import React from 'react';

// Helper function for guardian count
function getGuardianCount(playerCount) {
  const guardianMap = {
    3: 2, 4: 2, 5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 4
  };
  return guardianMap[playerCount] || 2;
}

// Helper function for chamber distribution
function getChamberDistribution(playerCount) {
  const distributions = {
    3: { gold: 5, empty: 8, traps: 2 },
    4: { gold: 6, empty: 12, traps: 2 },
    5: { gold: 7, empty: 16, traps: 2 },
    6: { gold: 8, empty: 20, traps: 2 },
    7: { gold: 7, empty: 26, traps: 2 },
    8: { gold: 8, empty: 30, traps: 2 },
    9: { gold: 9, empty: 34, traps: 2 },
    10: { gold: 10, empty: 37, traps: 3 }
  };
  return distributions[playerCount] || { gold: 7, empty: 16, traps: 2 };
}

function Lobby({ room, socket, onStartGame, onLeave, error }) {
  const isHost = room && socket.id === room.host;
  const currentCount = room?.players.length || 0;
  const targetCount = room?.targetPlayerCount;
  const canStart = currentCount >= 3 && currentCount <= 10;
  const atTarget = targetCount && currentCount === targetCount;
  
  const distribution = getChamberDistribution(currentCount);
  const adventurerCount = currentCount - getGuardianCount(currentCount);
  const guardianCount = getGuardianCount(currentCount);

  return (
    <div className="lobby-screen">
      <div className="temple-bg"></div>
      <div className="lobby-content">
        <div className="lobby-header">
          <h1>🏛️ Temple of Horror</h1>
          <div className="room-code-display">
            <span className="label">Room Code:</span>
            <span className="code">{room?.code}</span>
          </div>
        </div>

        <div className="lobby-main">
          <div className="players-section">
            <h2>
              Players ({currentCount}/10)
              {targetCount && ` - Target: ${targetCount}`}
            </h2>
            <div className="player-list">
              {room?.players.map((player) => (
                <div key={player.id} className="player-item">
                  <span className="player-name">
                    {player.name}
                    {player.id === room.host && ' 👑'}
                  </span>
                </div>
              ))}
            </div>

            <div className="player-count-notice">
              {currentCount < 3 && (
                <p className="warning">⚠️ Need at least 3 players to start</p>
              )}
              {currentCount >= 3 && !atTarget && targetCount && (
                <p className="info">
                  Waiting for {targetCount - currentCount} more player{targetCount - currentCount !== 1 ? 's' : ''}...
                </p>
              )}
              {currentCount >= 3 && atTarget && (
                <p className="success">✅ Target reached! Ready to start!</p>
              )}
              {currentCount >= 3 && !targetCount && (
                <p className="success">✅ Ready to start!</p>
              )}
            </div>
          </div>

          <div className="game-setup-info">
            <h3>Game Setup</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Current Players</span>
                <span className="info-value">{currentCount}</span>
              </div>
              <div className="info-item adventurer-color">
                <span className="info-label">Adventurers</span>
                <span className="info-value">{adventurerCount}</span>
              </div>
              <div className="info-item guardian-color">
                <span className="info-label">Guardians</span>
                <span className="info-value">{guardianCount}</span>
              </div>
            </div>

            <div className="chamber-distribution">
              <h4>Treasure Chambers</h4>
              <div className="chamber-stats">
                <div className="chamber-stat gold">
                  <span className="icon">💰</span>
                  <span className="count">{distribution.gold}</span>
                  <span className="type">Gold</span>
                </div>
                <div className="chamber-stat empty">
                  <span className="icon">📭</span>
                  <span className="count">{distribution.empty}</span>
                  <span className="type">Empty</span>
                </div>
                <div className="chamber-stat trap">
                  <span className="icon">🔥</span>
                  <span className="count">{distribution.traps}</span>
                  <span className="type">Traps</span>
                </div>
              </div>
            </div>

            <div className="rules-summary">
              <h4>Quick Rules</h4>
              <ul>
                <li>🎭 Secret roles assigned randomly</li>
                <li>🗝️ Key holder opens a chamber each turn</li>
                <li>💰 Adventurers win if all gold is found</li>
                <li>🔥 Guardians win if all traps trigger</li>
                <li>⏰ Guardians win after 4 rounds if gold not found</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="lobby-actions">
          {isHost && (
            <button
              onClick={onStartGame}
              disabled={!canStart}
              className={`btn btn-large ${canStart ? 'btn-primary' : 'btn-disabled'}`}
            >
              {canStart ? 'Start Game' : 'Waiting for Players...'}
            </button>
          )}

          {!isHost && (
            <div className="waiting-message">
              Waiting for host to start the game...
            </div>
          )}

          <button onClick={onLeave} className="btn btn-secondary">
            Leave Room
          </button>

          {error && <div className="error-message">{error}</div>}
        </div>
      </div>
    </div>
  );
}

export default Lobby;

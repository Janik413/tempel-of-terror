import React, { useState, useEffect } from 'react';
import GameOver from './GameOver';
import RoundTransition from './RoundTransition';

function Game({ room, socket, playerRole, playerChambers, onLeave }) {
  const [gameState, setGameState] = useState(room?.gameState || {});
  const [message, setMessage] = useState('');
  const [showRoleModal, setShowRoleModal] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [selectedChamber, setSelectedChamber] = useState(null);
  const [allPlayers, setAllPlayers] = useState(room?.players || []);
  const [showRoundTransition, setShowRoundTransition] = useState(false);
  const [roundTransitionData, setRoundTransitionData] = useState(null);

  // Sync allPlayers with room data when it updates
  useEffect(() => {
    if (room?.players) {
      setAllPlayers(room.players);
    }
  }, [room]);

  useEffect(() => {
    // Get initial room state
    socket.emit('getRoomState', (response) => {
      if (response.success && response.room) {
        setAllPlayers(response.room.players);
      }
    });

    // Chamber revealed
    socket.on('chamberRevealed', (data) => {
      setGameState(data.gameState);
      
      // Update the player's chamber in allPlayers
      setAllPlayers(prevPlayers => {
        return prevPlayers.map(player => {
          if (player.id === data.playerId) {
            const updatedChambers = [...(player.chambers || [])];
            if (updatedChambers[data.chamberIndex]) {
              updatedChambers[data.chamberIndex] = {
                ...updatedChambers[data.chamberIndex],
                revealed: true,
                type: data.chamberType
              };
            }
            return { ...player, chambers: updatedChambers };
          }
          return player;
        });
      });
      
      const chamberTypes = {
        gold: '💰 Gold',
        empty: '📭 Empty',
        trap: '🔥 Fire Trap'
      };
      
      setMessage(`${data.playerName}'s chamber revealed: ${chamberTypes[data.chamberType]}!`);
      setTimeout(() => setMessage(''), 4000);
      
      setSelectedPlayer(null);
      setSelectedChamber(null);
    });

    // Key holder changed
    socket.on('keyHolderChanged', (data) => {
      setGameState(prev => ({
        ...prev,
        keyHolderIndex: allPlayers.findIndex(p => p.id === data.keyHolderId)
      }));
      setMessage(`${data.keyHolder} is now the key holder! 🗝️`);
      setTimeout(() => setMessage(''), 3000);
    });

    // Next round
    socket.on('nextRound', (data) => {
      setGameState(data.gameState);
      
      // Show round transition modal
      setRoundTransitionData({
        round: data.round,
        keyHolderName: data.keyHolder,
        gameState: data.gameState
      });
      setShowRoundTransition(true);
      
      // Don't show message banner, the modal handles it
      
      // Request updated room state to get new chambers
      socket.emit('getRoomState', (response) => {
        if (response.success && response.room) {
          setAllPlayers(response.room.players);
        }
      });
    });

    // Game started event to get initial player data
    socket.on('gameStarted', (data) => {
      if (data.players) {
        setAllPlayers(data.players.map(p => ({
          ...p,
          chambers: Array(p.chamberCount).fill(null).map(() => ({ revealed: false, type: null }))
        })));
      }
    });

    // Game over event - update players with their roles
    socket.on('gameOver', (data) => {
      console.log('Game.js received gameOver event:', data);
      if (data.players) {
        // Update allPlayers with role information
        setAllPlayers(data.players);
      }
    });

    return () => {
      socket.off('chamberRevealed');
      socket.off('keyHolderChanged');
      socket.off('nextRound');
      socket.off('gameStarted');
      socket.off('gameOver');
    };
  }, [socket]);

  const currentPlayer = allPlayers.find(p => p.id === socket.id);
  const keyHolder = allPlayers[gameState.keyHolderIndex];
  const isKeyHolder = keyHolder?.id === socket.id;

  const openChamber = () => {
    console.log('=== OPEN CHAMBER CALLED ===');
    console.log('Selected Player:', selectedPlayer);
    console.log('Selected Chamber:', selectedChamber);
    console.log('Is Key Holder:', isKeyHolder);
    console.log('All Players:', allPlayers);
    
    if (!selectedPlayer || selectedChamber === null) {
      setMessage('Please select a player and chamber first!');
      setTimeout(() => setMessage(''), 2000);
      return;
    }

    console.log('Emitting openChamber to server...');
    socket.emit('openChamber', selectedPlayer, selectedChamber, (response) => {
      console.log('Server response:', response);
      if (!response.success) {
        setMessage('Error: ' + (response.error || 'Could not open chamber'));
        setTimeout(() => setMessage(''), 3000);
      }
    });
  };

  if (gameState.phase === 'gameOver') {
    return <GameOver socket={socket} allPlayers={allPlayers} gameState={gameState} onLeave={onLeave} />;
  }

  return (
    <div className="game-screen">
      <div className="temple-bg"></div>

      {/* Round Transition Modal */}
      {showRoundTransition && roundTransitionData && (
        <RoundTransition
          round={roundTransitionData.round}
          keyHolderName={roundTransitionData.keyHolderName}
          gameState={roundTransitionData.gameState}
          onComplete={() => setShowRoundTransition(false)}
        />
      )}

      {/* Role reveal modal */}
      {showRoleModal && (
        <div className="modal-overlay" onClick={() => setShowRoleModal(false)}>
          <div className="modal role-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Your Role</h2>
            <div className={`role-badge ${playerRole}`}>
              {playerRole === 'adventurer' ? '⚔️ Adventurer' : '🛡️ Guardian'}
            </div>
            <div className="role-description">
              {playerRole === 'adventurer' ? (
                <>
                  <p>You are an <strong>Adventurer</strong>!</p>
                  <p>Find all the <strong>💰 Gold</strong> before 4 rounds end.</p>
                  <p>Avoid the <strong>🔥 Fire Traps</strong> - they help Guardians win!</p>
                </>
              ) : (
                <>
                  <p>You are a <strong>Guardian</strong>!</p>
                  <p>Prevent Adventurers from finding all gold.</p>
                  <p>Lead them to <strong>🔥 Fire Traps</strong> or <strong>📭 Empty rooms</strong>!</p>
                  <p>Survive 4 rounds and you win!</p>
                </>
              )}
            </div>
            
            <div className="your-chambers">
              <h4>Your Chambers (Secret!)</h4>
              <div className="chamber-preview">
                {playerChambers.map((chamber, idx) => (
                  <div key={idx} className={`chamber-icon ${chamber.revealed ? 'revealed' : ''}`}>
                    {chamber.revealed ? (
                      chamber.type === 'gold' ? '💰' :
                      chamber.type === 'trap' ? '🔥' : '📭'
                    ) : '❓'}
                  </div>
                ))}
              </div>
            </div>
            
            <button onClick={() => setShowRoleModal(false)} className="btn btn-primary">
              Start Playing!
            </button>
          </div>
        </div>
      )}

      {/* Game header */}
      <div className="game-header">
        <div className="header-left">
          <h1>🏛️ Temple of Horror</h1>
          <div className="room-code-small">Room: {room?.code}</div>
        </div>
        <div className="header-right">
          <button onClick={() => setShowRoleModal(true)} className="btn btn-small">
            View Role
          </button>
          <button onClick={onLeave} className="btn btn-small btn-secondary">
            Leave
          </button>
        </div>
      </div>

      {/* Progress Tracker - NOW ON RIGHT SIDE */}
      <div className="game-layout">
        <div className="game-main-area">
          {/* Message banner */}
          {message && (
            <div className="message-banner">
              {message}
            </div>
          )}

          {/* Game info */}
          <div className="game-info-bar">
            <div className="info-item key-holder-info">
              <span className="label">🗝️ Key Holder:</span>
              <span className="value">{keyHolder?.name}</span>
              {isKeyHolder && <span className="badge">YOU!</span>}
            </div>
            <div className="info-item">
              <span className="label">Chambers Opened:</span>
              <span className="value">{gameState.chambersOpenedThisRound} / {gameState.chambersToOpenThisRound}</span>
            </div>
          </div>

          {/* ALL PLAYERS VIEW - Everyone sees all players */}
          <div className="all-players-view">
            <h2 className="section-title">
              {isKeyHolder ? '🗝️ Choose a Chamber to Open' : '⏳ Waiting for Key Holder'}
            </h2>
            
            <div className="players-grid">
              {allPlayers.map((player) => {
                let playerChambers = player.chambers || [];
                
                if (playerChambers.length === 0 && player.chamberCount) {
                  playerChambers = Array(player.chamberCount).fill(null).map(() => ({ 
                    revealed: false, 
                    type: null 
                  }));
                }
                
                const unrevealedCount = playerChambers.filter(c => c && !c.revealed).length;
                const isOwnChamber = player.id === socket.id;
                const canSelect = isKeyHolder && playerChambers.length > 0 && unrevealedCount > 0 && !isOwnChamber;
                const isCurrentKeyHolder = player.id === keyHolder?.id;
                
                return (
                  <div
                    key={player.id}
                    className={`player-card ${selectedPlayer === player.id ? 'selected' : ''} ${
                      !canSelect && isKeyHolder ? 'not-selectable' : ''
                    } ${isCurrentKeyHolder ? 'has-key' : ''}`}
                  >
                    <div className="player-card-header">
                      <div className="player-avatar">
                        {player.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="player-info">
                        <div className="player-card-name">
                          {player.name}
                          {isOwnChamber && ' (You)'}
                        </div>
                        <div className="player-badges">
                          {isCurrentKeyHolder && <span className="key-badge">🗝️ Key</span>}
                          {isOwnChamber && <span className="you-badge-small">YOU</span>}
                        </div>
                      </div>
                    </div>

                    <div className="chambers-row">
                      {playerChambers.map((chamber, idx) => (
                        <div
                          key={idx}
                          className={`chamber-card ${chamber?.revealed ? 'revealed' : 'locked'} ${
                            selectedPlayer === player.id && selectedChamber === idx ? 'chamber-selected' : ''
                          } ${canSelect ? 'clickable' : ''}`}
                          onClick={() => {
                            if (canSelect && chamber && !chamber.revealed) {
                              if (selectedPlayer !== player.id) {
                                setSelectedPlayer(player.id);
                              }
                              setSelectedChamber(idx);
                              console.log('Selected chamber:', idx, 'for player:', player.name);
                            }
                          }}
                        >
                          {chamber?.revealed ? (
                            <div className={`chamber-content ${chamber.type}`}>
                              <div className="chamber-icon-large">
                                {chamber.type === 'gold' && '💰'}
                                {chamber.type === 'empty' && '📭'}
                                {chamber.type === 'trap' && '🔥'}
                              </div>
                              <div className="chamber-label">
                                {chamber.type === 'gold' && 'Gold'}
                                {chamber.type === 'empty' && 'Empty'}
                                {chamber.type === 'trap' && 'Trap'}
                              </div>
                            </div>
                          ) : (
                            <div className="chamber-locked-view">
                              <div className="chamber-icon-large">
                                {isOwnChamber ? (
                                  // Show actual content to owner
                                  <>
                                    {chamber?.type === 'gold' && '💰'}
                                    {chamber?.type === 'empty' && '📭'}
                                    {chamber?.type === 'trap' && '🔥'}
                                  </>
                                ) : (
                                  '🚪'
                                )}
                              </div>
                              {isOwnChamber && (
                                <div className="secret-label-small">
                                  {chamber?.type === 'gold' && 'Gold'}
                                  {chamber?.type === 'empty' && 'Empty'}
                                  {chamber?.type === 'trap' && 'Trap'}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {isOwnChamber && !isKeyHolder && (
                      <div className="player-note">Your chambers (others see 🚪)</div>
                    )}
                    {isKeyHolder && isOwnChamber && (
                      <div className="player-note warning">Can't select your own chambers</div>
                    )}
                    {playerChambers.length > 0 && unrevealedCount === 0 && (
                      <div className="player-note">All revealed</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Action button for key holder */}
            {isKeyHolder && selectedPlayer && selectedChamber !== null && (
              <div className="action-panel-center">
                <div className="selection-summary">
                  <p>
                    Opening chamber {selectedChamber + 1} of{' '}
                    <strong>{allPlayers.find(p => p.id === selectedPlayer)?.name}</strong>
                  </p>
                </div>
                <button onClick={openChamber} className="btn btn-large btn-primary">
                  🗝️ Open Selected Chamber
                </button>
              </div>
            )}
          </div>
        </div>

        {/* PROGRESS TRACKER - COMPACT SIDEBAR */}
        <div className="progress-sidebar">
          <div className="round-indicator-compact">
            <div className="round-label">Round</div>
            <div className="round-number">{gameState.round + 1}/4</div>
            <div className="round-dots">
              {[1, 2, 3, 4].map(r => (
                <div key={r} className={`round-dot ${r <= gameState.round + 1 ? 'active' : ''}`}></div>
              ))}
            </div>
          </div>

          <div className="progress-section-compact">
            <h3>Progress</h3>
            
            <div className="progress-item-compact gold">
              <div className="progress-header-compact">
                <span className="icon">💰</span>
                <span className="label">Gold</span>
              </div>
              <div className="progress-bar-compact">
                <div 
                  className="progress-fill gold-fill"
                  style={{ width: `${(gameState.foundGold / gameState.totalGold) * 100}%` }}
                ></div>
              </div>
              <div className="progress-count">{gameState.foundGold} / {gameState.totalGold}</div>
            </div>

            <div className="progress-item-compact empty">
              <div className="progress-header-compact">
                <span className="icon">📭</span>
                <span className="label">Empty</span>
              </div>
              <div className="progress-bar-compact">
                <div 
                  className="progress-fill empty-fill"
                  style={{ width: `${(gameState.foundEmpty / gameState.totalEmpty) * 100}%` }}
                ></div>
              </div>
              <div className="progress-count">{gameState.foundEmpty} / {gameState.totalEmpty}</div>
            </div>

            <div className="progress-item-compact trap">
              <div className="progress-header-compact">
                <span className="icon">🔥</span>
                <span className="label">Traps</span>
              </div>
              <div className="progress-bar-compact">
                <div 
                  className="progress-fill trap-fill"
                  style={{ width: `${(gameState.foundTraps / gameState.totalTraps) * 100}%` }}
                ></div>
              </div>
              <div className="progress-count">{gameState.foundTraps} / {gameState.totalTraps}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Game;

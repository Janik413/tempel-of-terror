import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import GameOver from './GameOver';
import RoundTransition from './RoundTransition';
import ChamberReveal from './ChamberReveal';

const CHAMBER_TYPES = ['gold', 'empty', 'trap'];

// One distinct color per seat, used for avatars and door markers
const PLAYER_COLORS = [
  '#ff6b6b', '#4dabf7', '#51cf66', '#fcc419', '#cc5de8',
  '#ff922b', '#20c997', '#f06595', '#94d82d', '#74c0fc'
];

// Leaving a door is reported with a short delay, so moving between two doors does not flicker
const HOVER_LEAVE_DELAY_MS = 150;

function isSamePointer(first, second) {
  if (!first || !second) return first === second;
  return first.targetPlayerId === second.targetPlayerId && first.chamberIndex === second.chamberIndex;
}

/**
 * Main game screen. Everything shown here comes from the personal snapshot
 * sent by the server (state). Local state is only used for the current
 * selection and for the animations.
 */
function Game({ state, theme, socket, onThemeChange, onOpenProfile, onLeave }) {
  const { game, players, me } = state;

  const [message, setMessage] = useState('');
  const [showRoleModal, setShowRoleModal] = useState(true);
  const [selection, setSelection] = useState(null); // { playerId, chamberIndex }
  const [revealData, setRevealData] = useState(null);
  const [showRoundTransition, setShowRoundTransition] = useState(false);

  const lastReveal = game.lastReveal;
  const lastRevealSeq = lastReveal?.seq ?? 0;

  // ------------------------------------------------------------------------
  // Detect changes in the snapshot to trigger animations
  // ------------------------------------------------------------------------

  // Initialized with the current values, so a reconnect does not replay old animations
  const previousSeqRef = useRef(lastRevealSeq);
  const previousRoundRef = useRef(game.round);
  const previousPhaseRef = useRef(game.phase);

  // A new chamber was opened
  useEffect(() => {
    if (lastRevealSeq > previousSeqRef.current && lastReveal) {
      setRevealData(lastReveal);
    }
    previousSeqRef.current = lastRevealSeq;
  }, [lastRevealSeq, lastReveal]);

  // A new round started
  useEffect(() => {
    if (game.round > previousRoundRef.current) {
      setShowRoundTransition(true);
    }
    previousRoundRef.current = game.round;
  }, [game.round]);

  // A new game started in the same room (rematch)
  useEffect(() => {
    if (previousPhaseRef.current === 'gameOver' && game.phase !== 'gameOver') {
      setShowRoleModal(true);
      setRevealData(null);
      setShowRoundTransition(false);
      setMessage('');
    }
    previousPhaseRef.current = game.phase;
  }, [game.phase]);

  // Any change of the board invalidates the current selection
  useEffect(() => {
    setSelection(null);
  }, [lastRevealSeq, game.round, game.phase]);

  // ------------------------------------------------------------------------
  // Pointing at doors (live hover markers of all players)
  // ------------------------------------------------------------------------

  // Door under my mouse, door I tapped (touch devices) and markers of the other players
  const [hoveredDoor, setHoveredDoor] = useState(null); // { targetPlayerId, chamberIndex }
  const [tappedDoor, setTappedDoor] = useState(null);
  const [pointers, setPointers] = useState({}); // fromPlayerId -> { targetPlayerId, chamberIndex }
  const hoverLeaveTimerRef = useRef(null);
  const lastSentPointerRef = useRef(null);

  // Receive markers of the other players
  useEffect(() => {
    const handlePointer = ({ fromId, pointer }) => {
      setPointers(previous => {
        const next = { ...previous };
        if (pointer) next[fromId] = pointer;
        else delete next[fromId];
        return next;
      });
    };
    socket.on('pointer', handlePointer);
    return () => socket.off('pointer', handlePointer);
  }, [socket]);

  // Revealing a door or a new round makes all markers obsolete
  useEffect(() => {
    setPointers({});
    setHoveredDoor(null);
    setTappedDoor(null);
    lastSentPointerRef.current = null;
  }, [lastRevealSeq, game.round, game.phase]);

  useEffect(() => () => clearTimeout(hoverLeaveTimerRef.current), []);

  // What I point at: hovered door first, otherwise my selection (key holder) or tapped door
  const pinnedDoor = useMemo(
    () => (selection ? { targetPlayerId: selection.playerId, chamberIndex: selection.chamberIndex } : tappedDoor),
    [selection, tappedDoor]
  );
  const myPointer = useMemo(
    () => (game.phase === 'selection' ? hoveredDoor || pinnedDoor : null),
    [game.phase, hoveredDoor, pinnedDoor]
  );

  // Send my pointer only when it actually changes
  useEffect(() => {
    if (isSamePointer(myPointer, lastSentPointerRef.current)) return;
    lastSentPointerRef.current = myPointer;
    socket.emit('pointChamber', myPointer);
  }, [myPointer, socket]);

  const handleDoorEnter = (targetPlayerId, chamberIndex) => {
    clearTimeout(hoverLeaveTimerRef.current);
    setHoveredDoor(previous => {
      const next = { targetPlayerId, chamberIndex };
      return isSamePointer(previous, next) ? previous : next;
    });
  };

  const handleDoorLeave = () => {
    clearTimeout(hoverLeaveTimerRef.current);
    hoverLeaveTimerRef.current = setTimeout(() => setHoveredDoor(null), HOVER_LEAVE_DELAY_MS);
  };

  const closeReveal = useCallback(() => setRevealData(null), []);
  const closeRoundTransition = useCallback(() => setShowRoundTransition(false), []);

  // ------------------------------------------------------------------------
  // Derived values
  // ------------------------------------------------------------------------

  const keyHolder = players.find(player => player.id === game.keyHolderId);
  const isHost = me.id === state.hostId;
  const isKeyHolder = keyHolder?.id === me.id;
  const isActingForOfflineKeyHolder = Boolean(keyHolder && !keyHolder.connected && isHost && !isKeyHolder);
  const canAct = game.phase === 'selection' && (isKeyHolder || isActingForOfflineKeyHolder);
  const myChambers = players.find(player => player.id === me.id)?.chambers || [];
  const myRole = theme.roles[me.role] || theme.roles.adventurer;

  const showTemporaryMessage = (text, durationMs = 3000) => {
    setMessage(text);
    setTimeout(() => setMessage(''), durationMs);
  };

  const openChamber = () => {
    if (!selection) {
      showTemporaryMessage('Please select a chamber first!', 2000);
      return;
    }
    socket.emit(
      'openChamber',
      { targetPlayerId: selection.playerId, chamberIndex: selection.chamberIndex },
      response => {
        if (!response.success) showTemporaryMessage('Error: ' + (response.error || 'Could not open chamber'));
      }
    );
  };

  const restartGame = () => {
    socket.emit('restartGame', response => {
      if (!response.success) showTemporaryMessage(response.error || 'Could not restart game');
    });
  };

  if (game.phase === 'gameOver') {
    return (
      <GameOver
        state={state}
        theme={theme}
        message={message}
        onRestart={restartGame}
        onThemeChange={onThemeChange}
        onOpenProfile={onOpenProfile}
        onLeave={onLeave}
      />
    );
  }

  // Headline above the board
  let statusText;
  if (game.phase === 'roundEnd') statusText = '🔄 Round complete – shuffling the cards...';
  else if (game.phase === 'ending') statusText = '⌛ The game is decided...';
  else if (isActingForOfflineKeyHolder) statusText = `🗝️ ${keyHolder.name} is offline – choose a chamber for them`;
  else if (isKeyHolder) statusText = '🗝️ Choose a Chamber to Open';
  else if (keyHolder && !keyHolder.connected) statusText = `⏳ ${keyHolder.name} is offline – the host can act for them`;
  else statusText = `⏳ Waiting for ${keyHolder?.name}`;

  const selectedPlayer = selection && players.find(player => player.id === selection.playerId);

  // Seat colors and lookup for the door markers
  const colorById = {};
  const nameById = {};
  players.forEach((player, index) => {
    colorById[player.id] = PLAYER_COLORS[index % PLAYER_COLORS.length];
    nameById[player.id] = player.name;
  });
  const canPoint = game.phase === 'selection';

  return (
    <div className="game-screen">
      <div className="temple-bg"></div>

      {revealData && (
        <ChamberReveal
          key={revealData.seq}
          playerName={revealData.playerName}
          chamberType={revealData.type}
          theme={theme}
          onComplete={closeReveal}
        />
      )}

      {showRoundTransition && !revealData && (
        <RoundTransition
          round={game.round}
          roundCount={game.roundCount}
          keyHolderName={keyHolder?.name}
          game={game}
          theme={theme}
          onComplete={closeRoundTransition}
        />
      )}

      {/* Role modal: shown at game start and on demand */}
      {showRoleModal && (
        <div className="modal-overlay" onClick={() => setShowRoleModal(false)}>
          <div className="modal role-modal" onClick={event => event.stopPropagation()}>
            <h2>Your Role</h2>
            <div className={`role-badge ${me.role}`}>
              {myRole.icon} {myRole.name}
            </div>
            <div className="role-description">
              {me.role === 'adventurer' ? (
                <>
                  <p>
                    You are one of the <strong>{theme.roles.adventurer.plural}</strong>!
                  </p>
                  <p>
                    Find all <strong>{theme.chambers.gold.icon} {theme.chambers.gold.name}</strong> before 4 rounds end.
                  </p>
                  <p>
                    Avoid the <strong>{theme.chambers.trap.icon} traps</strong> – they help the{' '}
                    {theme.roles.hexe.plural}!
                  </p>
                </>
              ) : (
                <>
                  <p>
                    You are one of the <strong>{theme.roles.hexe.plural}</strong>!
                  </p>
                  <p>
                    Prevent the {theme.roles.adventurer.plural} from finding all {theme.chambers.gold.icon}.
                  </p>
                  <p>
                    Lead them to <strong>{theme.chambers.trap.icon} traps</strong> or{' '}
                    <strong>{theme.chambers.empty.icon} empty rooms</strong>!
                  </p>
                  <p>Survive 4 rounds and you win!</p>
                </>
              )}
            </div>

            <div className="your-chambers">
              <h4>Your Chambers this Round (Secret!)</h4>
              <div className="chamber-preview">
                {myChambers.map((chamber, index) => (
                  <div key={index} className={`chamber-icon ${chamber.revealed ? 'revealed' : ''}`}>
                    {theme.chambers[chamber.type]?.icon || '❓'}
                  </div>
                ))}
              </div>
              <p className="chamber-summary">
                {CHAMBER_TYPES.map(type => {
                  const count = myChambers.filter(chamber => chamber.type === type && !chamber.revealed).length;
                  return `${theme.chambers[type].icon} ${count}`;
                }).join('   ')}
              </p>
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
          <h1>
            {theme.titleIcon} {theme.title}
          </h1>
          <div className="room-code-small">Room: {state.code}</div>
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

      <div className="game-layout">
        <div className="game-main-area">
          {message && <div className="message-banner">{message}</div>}

          <div className="game-info-bar">
            <div className="info-item key-holder-info">
              <span className="label">🗝️ Key Holder:</span>
              <span className="value">{keyHolder?.name}</span>
              {isKeyHolder && <span className="badge">YOU!</span>}
            </div>
            <div className="info-item">
              <span className="label">Chambers Opened:</span>
              <span className="value">
                {game.openedThisRound} / {game.toOpenThisRound}
              </span>
            </div>
          </div>

          <div className="all-players-view">
            <h2 className="section-title">{statusText}</h2>
            {canPoint && <p className="pointer-hint">Hover (or tap) a door to show the others where you point</p>}

            <div className="players-grid">
              {players.map(player => {
                const unrevealedCount = player.chambers.filter(chamber => !chamber.revealed).length;
                const isOwnCard = player.id === me.id;
                const isPlayerKeyHolder = player.id === keyHolder?.id;
                const canSelect = canAct && !isPlayerKeyHolder && unrevealedCount > 0;

                return (
                  <div
                    key={player.id}
                    className={[
                      'player-card',
                      selection?.playerId === player.id ? 'selected' : '',
                      canAct && !canSelect ? 'not-selectable' : '',
                      isPlayerKeyHolder ? 'has-key' : '',
                      player.connected ? '' : 'offline'
                    ].join(' ')}
                  >
                    <div className="player-card-header">
                      <div className="player-avatar" style={{ background: colorById[player.id] }}>
                        {player.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="player-info">
                        <div className="player-card-name">
                          {player.name}
                          {isOwnCard && ' (You)'}
                        </div>
                        <div className="player-badges">
                          {isPlayerKeyHolder && <span className="key-badge">🗝️ Key</span>}
                          {isOwnCard && <span className="you-badge-small">YOU</span>}
                          {player.id === state.hostId && <span className="host-badge-small">👑</span>}
                          {!player.connected && <span className="offline-badge">offline</span>}
                        </div>
                      </div>
                    </div>

                    <div className="chambers-row">
                      {player.chambers.map((chamber, index) => {
                        const isSelected = selection?.playerId === player.id && selection?.chamberIndex === index;
                        const isClickable = canSelect && !chamber.revealed;
                        const chamberTheme = theme.chambers[chamber.type];
                        const isPointable = canPoint && !chamber.revealed;
                        // Other players currently pointing at this door
                        const pointerIds = Object.keys(pointers).filter(fromId =>
                          isSamePointer(pointers[fromId], { targetPlayerId: player.id, chamberIndex: index })
                        );
                        const isKeyHolderPointing = pointerIds.includes(keyHolder?.id);
                        return (
                          <div
                            key={index}
                            className={[
                              'chamber-card',
                              chamber.revealed ? 'revealed' : 'locked',
                              isSelected ? 'chamber-selected' : '',
                              isClickable ? 'clickable' : '',
                              isPointable && !isClickable ? 'pointable' : '',
                              isKeyHolderPointing ? 'key-pointed' : ''
                            ].join(' ')}
                            style={isKeyHolderPointing ? { '--pointer-color': colorById[keyHolder.id] } : undefined}
                            onPointerEnter={event => {
                              // Touch devices use tapping instead of hovering
                              if (isPointable && event.pointerType === 'mouse') handleDoorEnter(player.id, index);
                            }}
                            onPointerLeave={event => {
                              if (event.pointerType === 'mouse') handleDoorLeave();
                            }}
                            onClick={() => {
                              if (isClickable) {
                                setSelection({ playerId: player.id, chamberIndex: index });
                              } else if (isPointable) {
                                // Tap toggles pointing at this door
                                const door = { targetPlayerId: player.id, chamberIndex: index };
                                setTappedDoor(previous => (isSamePointer(previous, door) ? null : door));
                              }
                            }}
                          >
                            {pointerIds.length > 0 && (
                              <div className="door-pointers">
                                {pointerIds.map(fromId => (
                                  <span
                                    key={fromId}
                                    className={`door-pointer ${fromId === keyHolder?.id ? 'is-key-holder' : ''}`}
                                    style={{ background: colorById[fromId] }}
                                    title={`${nameById[fromId]} is pointing here`}
                                  >
                                    {fromId === keyHolder?.id ? '🗝️' : nameById[fromId]?.charAt(0).toUpperCase()}
                                  </span>
                                ))}
                              </div>
                            )}
                            {chamber.revealed ? (
                              <div className={`chamber-content ${chamber.type}`}>
                                <div className="chamber-icon-large">{chamberTheme.icon}</div>
                                <div className="chamber-label">{chamberTheme.name}</div>
                              </div>
                            ) : (
                              <div className="chamber-locked-view">
                                {/* Only the owner receives the content of unrevealed chambers */}
                                <div className="chamber-icon-large">{chamberTheme ? chamberTheme.icon : theme.lockedIcon}</div>
                                {chamberTheme && <div className="secret-label-small">{chamberTheme.name}</div>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {isOwnCard && !isKeyHolder && (
                      <div className="player-note">Your chambers (others see {theme.lockedIcon})</div>
                    )}
                    {canAct && isPlayerKeyHolder && (
                      <div className="player-note warning">Key holder's own chambers can't be opened</div>
                    )}
                    {player.chambers.length > 0 && unrevealedCount === 0 && (
                      <div className="player-note">All revealed</div>
                    )}
                  </div>
                );
              })}
            </div>

            {canAct && selection && (
              <div className="action-panel-center">
                <div className="selection-summary">
                  <p>
                    Opening chamber {selection.chamberIndex + 1} of <strong>{selectedPlayer?.name}</strong>
                  </p>
                </div>
                <button onClick={openChamber} className="btn btn-large btn-primary">
                  🗝️ Open Selected Chamber
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Progress sidebar */}
        <div className="progress-sidebar">
          <div className="round-indicator-compact">
            <div className="round-label">Round</div>
            <div className="round-number">
              {game.round + 1}/{game.roundCount}
            </div>
            <div className="round-dots">
              {Array.from({ length: game.roundCount }, (_, index) => (
                <div key={index} className={`round-dot ${index <= game.round ? 'active' : ''}`}></div>
              ))}
            </div>
          </div>

          <div className="progress-section-compact">
            <h3>Progress</h3>
            {CHAMBER_TYPES.map(type => (
              <div key={type} className={`progress-item-compact ${type}`}>
                <div className="progress-header-compact">
                  <span className="icon">{theme.chambers[type].icon}</span>
                  <span className="label">{theme.chambers[type].name}</span>
                </div>
                <div className="progress-bar-compact">
                  <div
                    className={`progress-fill ${type}-fill`}
                    style={{ width: `${(game.found[type] / game.total[type]) * 100}%` }}
                  ></div>
                </div>
                <div className="progress-count">
                  {game.found[type]} / {game.total[type]}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Game;

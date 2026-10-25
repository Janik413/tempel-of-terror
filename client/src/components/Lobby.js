import React from 'react';
import ThemePicker from './ThemePicker';
import { getRoleRange, formatRange, CHAMBER_CARDS } from '../themes';

function Lobby({ state, theme, onStartGame, onThemeChange, onLeave, error }) {
  const isHost = state.me.id === state.hostId;
  const currentCount = state.players.length;
  const targetCount = state.targetPlayerCount;
  const allConnected = state.players.every(player => player.connected);
  const canStart = currentCount >= 3 && currentCount <= 10 && allConnected;
  const atTarget = targetCount && currentCount === targetCount;

  // Setup preview is based on the current player count (minimum 3 for the preview)
  const previewCount = Math.max(3, currentCount);
  const distribution = CHAMBER_CARDS[previewCount];
  const roleRange = getRoleRange(previewCount);

  return (
    <div className="lobby-screen">
      <div className="temple-bg"></div>
      <div className="lobby-content">
        <div className="lobby-header">
          <h1>
            {theme.titleIcon} {theme.title}
          </h1>
          <div className="room-code-display">
            <span className="label">Room Code:</span>
            <span className="code">{state.code}</span>
          </div>
        </div>

        <div className="lobby-main">
          <div className="players-section">
            <h2>
              Players ({currentCount}/10)
              {targetCount && ` - Target: ${targetCount}`}
            </h2>
            <div className="player-list">
              {state.players.map(player => (
                <div key={player.id} className={`player-item ${player.connected ? '' : 'offline'}`}>
                  <span className="player-name">
                    {player.name}
                    {player.id === state.hostId && ' 👑'}
                    {player.id === state.me.id && ' (You)'}
                    {state.accountsEnabled && !player.accountId && <span className="guest-tag"> guest</span>}
                    {!player.connected && ' – offline'}
                  </span>
                </div>
              ))}
            </div>

            <div className="player-count-notice">
              {currentCount < 3 && <p className="warning">⚠️ Need at least 3 players to start</p>}
              {currentCount >= 3 && !allConnected && (
                <p className="warning">⚠️ Waiting for offline players to reconnect...</p>
              )}
              {currentCount >= 3 && allConnected && targetCount && !atTarget && currentCount < targetCount && (
                <p className="info">
                  Waiting for {targetCount - currentCount} more player{targetCount - currentCount !== 1 ? 's' : ''}...
                </p>
              )}
              {currentCount >= 3 && allConnected && (atTarget || !targetCount || currentCount > targetCount) && (
                <p className="success">✅ Ready to start!</p>
              )}
            </div>
          </div>

          <div className="game-setup-info">
            <h3>Game Setup</h3>

            {isHost ? (
              <ThemePicker value={state.theme} onChange={onThemeChange} />
            ) : (
              <p className="theme-current">
                Theme: {theme.pickerIcon} <strong>{theme.label}</strong> (chosen by host)
              </p>
            )}

            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Current Players</span>
                <span className="info-value">{currentCount}</span>
              </div>
              <div className="info-item adventurer-color">
                <span className="info-label">{theme.roles.adventurer.plural}</span>
                <span className="info-value">{formatRange(roleRange.adventurers)}</span>
              </div>
              <div className="info-item hexe-color">
                <span className="info-label">{theme.roles.hexe.plural}</span>
                <span className="info-value">{formatRange(roleRange.hexen)}</span>
              </div>
            </div>
            {roleRange.hexen.min !== roleRange.hexen.max && (
              <p className="role-hint">One role card stays hidden, so nobody knows the exact number.</p>
            )}

            <div className="chamber-distribution">
              <h4>Chambers</h4>
              <div className="chamber-stats">
                {['gold', 'empty', 'trap'].map(type => (
                  <div key={type} className={`chamber-stat ${type}`}>
                    <span className="icon">{theme.chambers[type].icon}</span>
                    <span className="count">{distribution[type]}</span>
                    <span className="type">{theme.chambers[type].name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rules-summary">
              <h4>Quick Rules</h4>
              <ul>
                <li>🎭 Secret roles assigned randomly</li>
                <li>🗝️ Key holder opens a chamber of another player</li>
                <li>
                  {theme.chambers.gold.icon} {theme.roles.adventurer.plural} win if everything{' '}
                  {theme.chambers.gold.icon} is found
                </li>
                <li>
                  {theme.chambers.trap.icon} {theme.roles.hexe.plural} win if all traps trigger
                </li>
                <li>⏰ {theme.roles.hexe.plural} win after 4 rounds otherwise</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="lobby-actions">
          {isHost ? (
            <button
              onClick={onStartGame}
              disabled={!canStart}
              className={`btn btn-large ${canStart ? 'btn-primary' : 'btn-disabled'}`}
            >
              {canStart ? 'Start Game' : 'Waiting for Players...'}
            </button>
          ) : (
            <div className="waiting-message">Waiting for host to start the game...</div>
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

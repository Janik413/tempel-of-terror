import React from 'react';
import ThemePicker from './ThemePicker';

// Result screen: winner, reason and all roles. The host can change the theme and start a rematch.
function GameOver({ state, theme, message, onRestart, onThemeChange, onOpenProfile, onLeave }) {
  const { game, players, me } = state;
  const isHost = me.id === state.hostId;
  const isAdventurerWin = game.winner === 'adventurers';
  const adventurers = players.filter(player => player.role === 'adventurer');
  const hexen = players.filter(player => player.role === 'hexe');
  const myTeam = me.role === 'adventurer' ? 'adventurers' : 'hexen';
  const connectedCount = players.filter(player => player.connected).length;

  const renderRoleList = (list, roleId) =>
    list.length > 0 ? (
      list.map(player => {
        // Players with an account can be clicked to open their statistics
        const canOpenProfile = Boolean(onOpenProfile && player.accountId);
        return (
          <div
            key={player.id}
            className={`role-item ${roleId} ${canOpenProfile ? 'has-profile' : ''}`}
            onClick={canOpenProfile ? () => onOpenProfile(player.accountId) : undefined}
            title={canOpenProfile ? 'Show stats' : 'Guest'}
          >
            {player.name}
            {player.id === me.id && ' (You)'}
            {canOpenProfile ? ' 📊' : ''}
          </div>
        );
      })
    ) : (
      <div className="no-players">Nobody</div>
    );

  return (
    <div className="game-over-screen">
      <div className="temple-bg"></div>
      <div className="game-over-content">
        <div className={`victory-banner ${game.winner}`}>
          <div className="victory-icon">{isAdventurerWin ? theme.roles.adventurer.icon : theme.roles.hexe.icon}</div>
          <h1 className="victory-title">
            {isAdventurerWin ? theme.roles.adventurer.plural : theme.roles.hexe.plural} Win!
          </h1>
          <p className="victory-reason">{theme.reasons[game.reason]}</p>
          <p className="victory-personal">{myTeam === game.winner ? '🎉 Your team won!' : '😢 Your team lost.'}</p>
        </div>

        <div className="final-roles">
          <h2>🎭 All Roles Revealed</h2>
          <p className="roles-subtitle">
            Everyone's secret identity is now shown!
            {state.accountsEnabled && ' Results of logged in players (📊) were saved to their stats.'}
          </p>

          <div className="role-columns">
            <div className="role-column adventurers">
              <h3>
                {theme.roles.adventurer.icon} {theme.roles.adventurer.plural} ({adventurers.length})
              </h3>
              <div className="role-list">{renderRoleList(adventurers, 'adventurer')}</div>
            </div>

            <div className="role-column hexen">
              <h3>
                {theme.roles.hexe.icon} {theme.roles.hexe.plural} ({hexen.length})
              </h3>
              <div className="role-list">{renderRoleList(hexen, 'hexe')}</div>
            </div>
          </div>
        </div>

        <div className="game-over-actions">
          {isHost ? (
            <>
              <ThemePicker value={state.theme} onChange={onThemeChange} />
              <button
                onClick={onRestart}
                className="btn btn-large btn-primary"
                disabled={connectedCount < 3}
              >
                🔄 Play Again (Same Room)
              </button>
              {connectedCount < 3 && <div className="error-message">Need at least 3 connected players</div>}
            </>
          ) : (
            <div className="waiting-for-host">Waiting for host to start a new game...</div>
          )}
          <button onClick={onLeave} className="btn btn-large btn-secondary">
            Leave Room
          </button>
          {message && <div className="error-message">{message}</div>}
        </div>
      </div>
    </div>
  );
}

export default GameOver;

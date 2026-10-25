import React, { useState, useEffect } from 'react';
import { loadProfile, loadLeaderboard, percentage } from '../auth/stats';
import { getTheme } from '../themes';

/**
 * Statistics overlay with two tabs: a player's profile and the leaderboard.
 * Texts follow the active theme (e.g. Elves / Frost Witches at Christmas).
 */
function ProfileModal({ initialTab, userId, currentUserId, theme, onClose }) {
  const [tab, setTab] = useState(initialTab || 'profile');
  const [shownUserId, setShownUserId] = useState(userId || currentUserId);
  const [profileData, setProfileData] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (tab !== 'profile' || !shownUserId) return undefined;
    let isCurrent = true;
    setProfileData(null);
    setError('');
    loadProfile(shownUserId)
      .then(data => isCurrent && setProfileData(data))
      .catch(loadError => isCurrent && setError(loadError.message));
    return () => {
      isCurrent = false;
    };
  }, [tab, shownUserId]);

  useEffect(() => {
    if (tab !== 'leaderboard') return undefined;
    let isCurrent = true;
    setError('');
    loadLeaderboard()
      .then(data => isCurrent && setLeaderboard(data))
      .catch(loadError => isCurrent && setError(loadError.message));
    return () => {
      isCurrent = false;
    };
  }, [tab]);

  const openProfile = id => {
    setShownUserId(id);
    setTab('profile');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal profile-modal" onClick={event => event.stopPropagation()}>
        <div className="profile-tabs">
          <button
            type="button"
            className={`profile-tab ${tab === 'profile' ? 'active' : ''}`}
            onClick={() => setTab('profile')}
            disabled={!shownUserId}
          >
            📊 Stats
          </button>
          <button
            type="button"
            className={`profile-tab ${tab === 'leaderboard' ? 'active' : ''}`}
            onClick={() => setTab('leaderboard')}
          >
            🏆 Leaderboard
          </button>
          <button type="button" className="profile-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {error && <div className="error-message">Could not load data: {error}</div>}

        {tab === 'profile' && !error && (
          profileData ? (
            <ProfileView data={profileData} theme={theme} isMe={shownUserId === currentUserId} />
          ) : (
            <div className="loading-small">Loading...</div>
          )
        )}

        {tab === 'leaderboard' && !error && (
          leaderboard ? (
            <LeaderboardView rows={leaderboard} theme={theme} currentUserId={currentUserId} onOpenProfile={openProfile} />
          ) : (
            <div className="loading-small">Loading...</div>
          )
        )}
      </div>
    </div>
  );
}

function formatPercent(part, total) {
  const value = percentage(part, total);
  return value === null ? '–' : `${value}%`;
}

function StatTile({ label, value, sub }) {
  return (
    <div className="stat-tile">
      <div className="stat-tile-value">{value}</div>
      <div className="stat-tile-label">{label}</div>
      {sub && <div className="stat-tile-sub">{sub}</div>}
    </div>
  );
}

function ProfileView({ data, theme, isMe }) {
  const { profile, stats } = data;
  const { roles, chambers } = theme;

  if (stats.gamesPlayed === 0) {
    return (
      <div className="profile-view">
        <h2 className="profile-name">{profile.username}</h2>
        <p className="profile-empty">
          {isMe ? 'No games yet – finish a game while logged in to see your stats here.' : 'No games yet.'}
        </p>
      </div>
    );
  }

  const streakText =
    stats.currentStreak.count > 0
      ? `${stats.currentStreak.count} ${stats.currentStreak.won ? 'win' : 'loss'}${stats.currentStreak.count === 1 ? '' : stats.currentStreak.won ? 's' : 'es'}`
      : '–';

  return (
    <div className="profile-view">
      <h2 className="profile-name">{profile.username}</h2>
      <p className="profile-since">Playing since {new Date(profile.created_at).toLocaleDateString()}</p>

      <div className="stat-grid">
        <StatTile label="Games" value={stats.gamesPlayed} />
        <StatTile label="Wins" value={stats.wins} sub={formatPercent(stats.wins, stats.gamesPlayed)} />
        <StatTile label="Current streak" value={streakText} />
        <StatTile label="Best win streak" value={stats.bestWinStreak} />
      </div>

      <h3 className="profile-section-title">By role</h3>
      <div className="role-stat-grid">
        <div className="role-stat adventurer">
          <div className="role-stat-title">
            {roles.adventurer.icon} {roles.adventurer.name}
          </div>
          <div className="role-stat-rate">{formatPercent(stats.adventurer.wins, stats.adventurer.games)}</div>
          <div className="role-stat-detail">
            {stats.adventurer.wins} wins / {stats.adventurer.games} games
          </div>
        </div>
        <div className="role-stat hexe">
          <div className="role-stat-title">
            {roles.hexe.icon} {roles.hexe.name}
          </div>
          <div className="role-stat-rate">{formatPercent(stats.hexe.wins, stats.hexe.games)}</div>
          <div className="role-stat-detail">
            {stats.hexe.wins} wins / {stats.hexe.games} games
          </div>
        </div>
      </div>
      <p className="profile-fact">
        {roles.hexe.icon} {roles.hexe.name} in {formatPercent(stats.hexe.games, stats.gamesPlayed)} of all games
      </p>

      <h3 className="profile-section-title">As key holder</h3>
      <div className="stat-grid">
        <StatTile label={`${chambers.gold.icon} ${chambers.gold.name}`} value={stats.opened.gold} />
        <StatTile label={`${chambers.empty.icon} ${chambers.empty.name}`} value={stats.opened.empty} />
        <StatTile label={`${chambers.trap.icon} ${chambers.trap.name}`} value={stats.opened.trap} />
        <StatTile
          label="Hit rate"
          value={formatPercent(stats.opened.gold, stats.opened.total)}
          sub={`${chambers.gold.icon} per door opened`}
        />
      </div>

      <h3 className="profile-section-title">Fun facts</h3>
      <ul className="profile-facts">
        <li>
          🤝 Others opened your doors <strong>{stats.averageOpenedByOthers.toFixed(1)}×</strong> per game on average
        </li>
        {stats.fastestWinRounds && (
          <li>
            ⚡ Fastest win: <strong>round {stats.fastestWinRounds}</strong>
          </li>
        )}
        {stats.favoriteTheme && (
          <li>
            {getTheme(stats.favoriteTheme).pickerIcon} Favorite theme: <strong>{getTheme(stats.favoriteTheme).label}</strong>
          </li>
        )}
      </ul>

      <h3 className="profile-section-title">Recent games</h3>
      <div className="recent-games">
        {stats.recentGames.map((row, index) => {
          const gameTheme = getTheme(row.game.theme);
          return (
            <div key={index} className={`recent-game ${row.won ? 'won' : 'lost'}`}>
              <span className="recent-result">{row.won ? '🏆' : '💀'}</span>
              <span className="recent-role">
                {gameTheme.roles[row.role].icon} {gameTheme.roles[row.role].name}
              </span>
              <span className="recent-detail">
                {row.game.player_count} players · round {row.game.rounds_played}
              </span>
              <span className="recent-date">{new Date(row.game.finished_at).toLocaleDateString()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LeaderboardView({ rows, theme, currentUserId, onOpenProfile }) {
  if (rows.length === 0) return <p className="profile-empty">No finished games yet.</p>;

  return (
    <div className="leaderboard">
      <div className="leaderboard-row leaderboard-head">
        <span>#</span>
        <span>Player</span>
        <span>Wins</span>
        <span>Games</span>
        <span>{theme.roles.adventurer.icon}</span>
        <span>{theme.roles.hexe.icon}</span>
      </div>
      {rows.map((row, index) => (
        <button
          type="button"
          key={row.user_id}
          className={`leaderboard-row ${row.user_id === currentUserId ? 'is-me' : ''}`}
          onClick={() => onOpenProfile(row.user_id)}
        >
          <span>{index + 1}</span>
          <span className="leaderboard-name">{row.username}</span>
          <span>
            {row.wins} <small>({formatPercent(row.wins, row.games_played)})</small>
          </span>
          <span>{row.games_played}</span>
          <span>{formatPercent(row.wins_as_adventurer, row.games_as_adventurer)}</span>
          <span>{formatPercent(row.wins_as_hexe, row.games_as_hexe)}</span>
        </button>
      ))}
      <p className="leaderboard-hint">Columns {theme.roles.adventurer.icon} / {theme.roles.hexe.icon}: win rate per role. Click a player to see their stats.</p>
    </div>
  );
}

export default ProfileModal;

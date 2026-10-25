import React, { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import Lobby from './components/Lobby';
import Game from './components/Game';
import ThemePicker from './components/ThemePicker';
import ThemeDecorations from './components/ThemeDecorations';
import AuthPanel from './components/AuthPanel';
import ProfileModal from './components/ProfileModal';
import { useAuth } from './auth/useAuth';
import { accountsAvailable } from './auth/supabaseClient';
import { getTheme, getRoleRange, formatRange, DEFAULT_THEME, THEME_IDS } from './themes';
import './styles/App.css';

// In production the client is served by the game server itself, in development the server runs on port 3001
const SERVER_URL =
  process.env.REACT_APP_SERVER_URL ||
  (window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin);
const socket = io(SERVER_URL);

const SESSION_KEY = 'toh-session';
const THEME_KEY = 'toh-theme';

// localStorage can throw (private mode, blocked storage), so every access is guarded
function readStorage(key) {
  try {
    return JSON.parse(window.localStorage.getItem(key));
  } catch (error) {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Ignore: the game still works, only reconnecting after a reload does not
  }
}

function App() {
  // Personal snapshot sent by the server, null while not in a room
  const [state, setState] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [targetPlayerCount, setTargetPlayerCount] = useState(5);
  const [localTheme, setLocalTheme] = useState(() => {
    const storedTheme = readStorage(THEME_KEY);
    return THEME_IDS.includes(storedTheme) ? storedTheme : DEFAULT_THEME;
  });
  const [error, setError] = useState('');
  const [isConnected, setIsConnected] = useState(socket.connected);
  // Statistics overlay: { tab: 'profile' | 'leaderboard', userId } or null
  const [profileModal, setProfileModal] = useState(null);

  const auth = useAuth();
  const loggedInName = auth.user?.username;

  // Inside a room the host's theme wins, on the home screen the local choice
  const activeThemeId = state?.theme || localTheme;
  const theme = getTheme(activeThemeId);

  // Apply theme colors to the whole page
  useEffect(() => {
    document.documentElement.dataset.theme = activeThemeId;
    document.title = theme.title;
  }, [activeThemeId, theme.title]);

  useEffect(() => {
    const tryRejoin = () => {
      setIsConnected(true);
      const session = readStorage(SESSION_KEY);
      if (!session) return;
      socket.emit('rejoinRoom', session, response => {
        if (!response.success) {
          writeStorage(SESSION_KEY, null);
          setState(null);
        }
      });
    };

    socket.on('connect', tryRejoin);
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('state', snapshot => setState(snapshot));
    socket.on('sessionReplaced', () => {
      setState(null);
      setError('This game was opened in another tab or window.');
    });

    // The socket may already be connected before this effect runs
    if (socket.connected) tryRejoin();

    return () => {
      socket.off('connect', tryRejoin);
      socket.off('disconnect');
      socket.off('state');
      socket.off('sessionReplaced');
    };
  }, []);

  const handleSessionResponse = response => {
    if (response.success) {
      writeStorage(SESSION_KEY, { roomCode: response.roomCode, token: response.token });
      setError('');
    } else {
      setError(response.error);
    }
  };

  // Logged in players send their login token, the server then uses the account's username
  const createRoom = async () => {
    if (!loggedInName && !playerName.trim()) return setError('Please enter your name');
    const accessToken = await auth.getAccessToken();
    socket.emit(
      'createRoom',
      { name: playerName.trim(), targetPlayerCount, theme: localTheme, accessToken },
      handleSessionResponse
    );
  };

  const joinRoom = async () => {
    if (!loggedInName && !playerName.trim()) return setError('Please enter your name');
    if (!roomCode.trim()) return setError('Please enter room code');
    const accessToken = await auth.getAccessToken();
    socket.emit(
      'joinRoom',
      { roomCode: roomCode.trim().toUpperCase(), name: playerName.trim(), accessToken },
      handleSessionResponse
    );
  };

  const openProfile = useCallback(userId => setProfileModal({ tab: 'profile', userId }), []);

  const startGame = () => {
    socket.emit('startGame', response => {
      if (!response.success) setError(response.error);
      else setError('');
    });
  };

  const changeLocalTheme = themeId => {
    setLocalTheme(themeId);
    writeStorage(THEME_KEY, themeId);
  };

  // Host changes the theme of the room; it also becomes the local default
  const changeRoomTheme = useCallback(themeId => {
    setLocalTheme(themeId);
    writeStorage(THEME_KEY, themeId);
    socket.emit('setTheme', themeId, response => {
      if (!response.success) setError(response.error);
    });
  }, []);

  const leaveRoom = useCallback(() => {
    socket.emit('leaveRoom', () => {
      writeStorage(SESSION_KEY, null);
      setState(null);
      setError('');
    });
  }, []);

  const roleRange = getRoleRange(targetPlayerCount);

  let screen = 'home';
  if (state) screen = state.started ? 'game' : 'lobby';

  return (
    <div className="app">
      <ThemeDecorations theme={theme} />

      {!isConnected && <div className="connection-banner">Connection lost – reconnecting...</div>}

      {screen === 'home' && (
        <div className="home-screen">
          <div className="temple-bg"></div>
          <div className="home-content">
            <h1 className="game-title">
              {theme.titleIcon} {theme.title}
            </h1>
            <p className="game-subtitle">{theme.subtitle}</p>

            <div className="home-card">
              <ThemePicker value={localTheme} onChange={changeLocalTheme} />

              {accountsAvailable && (
                <AuthPanel
                  auth={auth}
                  onShowProfile={() => setProfileModal({ tab: 'profile', userId: auth.user?.id })}
                  onShowLeaderboard={() => setProfileModal({ tab: 'leaderboard', userId: auth.user?.id })}
                />
              )}

              {loggedInName ? (
                <div className="playing-as">
                  Playing as <strong>{loggedInName}</strong>
                </div>
              ) : (
                <input
                  type="text"
                  placeholder={auth.user ? 'Loading username...' : 'Enter your name (guest)'}
                  value={playerName}
                  onChange={event => setPlayerName(event.target.value)}
                  className="input-field"
                  maxLength={20}
                />
              )}

              <div className="player-count-selector">
                <label>How many players?</label>
                <div className="count-buttons">
                  {[3, 4, 5, 6, 7, 8, 9, 10].map(count => (
                    <button
                      key={count}
                      onClick={() => setTargetPlayerCount(count)}
                      className={`count-btn ${targetPlayerCount === count ? 'selected' : ''}`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
                <div className="count-info">
                  <div className="info-row">
                    <span className="label">{theme.roles.adventurer.plural}:</span>
                    <span className="value">{formatRange(roleRange.adventurers)}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">{theme.roles.hexe.plural}:</span>
                    <span className="value">{formatRange(roleRange.hexen)}</span>
                  </div>
                </div>
              </div>

              <button onClick={createRoom} className="btn btn-primary">
                Create New Room
              </button>

              <div className="divider">
                <span>OR</span>
              </div>

              <input
                type="text"
                placeholder="Enter room code"
                value={roomCode}
                onChange={event => setRoomCode(event.target.value.toUpperCase())}
                className="input-field"
                maxLength={6}
              />

              <button onClick={joinRoom} className="btn btn-secondary">
                Join Room
              </button>

              {error && <div className="error-message">{error}</div>}
            </div>

            <div className="game-info">
              <h3>How to Play</h3>
              <ul>
                <li>
                  🎭 <strong>Hidden Roles:</strong> {theme.roles.adventurer.plural} vs {theme.roles.hexe.plural}
                </li>
                <li>
                  🗝️ <strong>Key Holder</strong> opens a chamber of another player
                </li>
                <li>
                  {theme.chambers.gold.icon} <strong>{theme.chambers.gold.name}:</strong> Helps{' '}
                  {theme.roles.adventurer.plural} win
                </li>
                <li>
                  {theme.chambers.trap.icon} <strong>{theme.chambers.trap.name}:</strong> Helps {theme.roles.hexe.plural}{' '}
                  win
                </li>
                <li>
                  {theme.chambers.empty.icon} <strong>{theme.chambers.empty.name}:</strong> Wastes time
                </li>
                <li>
                  🏆 <strong>Win:</strong> Find everything {theme.chambers.gold.icon} OR trigger all traps OR survive 4
                  rounds
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {screen === 'lobby' && (
        <Lobby
          state={state}
          theme={theme}
          onStartGame={startGame}
          onThemeChange={changeRoomTheme}
          onLeave={leaveRoom}
          error={error}
        />
      )}

      {screen === 'game' && (
        <Game
          state={state}
          theme={theme}
          socket={socket}
          onThemeChange={changeRoomTheme}
          onOpenProfile={accountsAvailable ? openProfile : null}
          onLeave={leaveRoom}
        />
      )}

      {profileModal && accountsAvailable && (
        <ProfileModal
          initialTab={profileModal.tab}
          userId={profileModal.userId}
          currentUserId={auth.user?.id}
          theme={theme}
          onClose={() => setProfileModal(null)}
        />
      )}
    </div>
  );
}

export default App;

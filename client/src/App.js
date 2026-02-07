import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Lobby from './components/Lobby';
import Game from './components/Game';
import './styles/App.css';

// Connect to server
// In production, connect to the same host (Render), in development use localhost
const socket = io(process.env.REACT_APP_SERVER_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin));

function App() {
  const [screen, setScreen] = useState('home'); // home, lobby, game
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [targetPlayerCount, setTargetPlayerCount] = useState(5); // New: target player count
  const [room, setRoom] = useState(null);
  const [playerRole, setPlayerRole] = useState(null);
  const [playerChambers, setPlayerChambers] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    // Listen for room updates
    socket.on('roomUpdate', (updatedRoom) => {
      setRoom(updatedRoom);
    });

    // Listen for game start
    socket.on('gameStarted', (data) => {
      setRoom(prevRoom => ({
        ...prevRoom,
        started: true,
        gameState: data.gameState
      }));
      setScreen('game');
    });

    // Listen for role assignment
    socket.on('roleAssigned', (data) => {
      setPlayerRole(data.role);
      setPlayerChambers(data.chambers);
    });

    // Listen for chamber updates (new rounds)
    socket.on('chambersUpdated', (data) => {
      setPlayerChambers(data.chambers);
    });

    return () => {
      socket.off('roomUpdate');
      socket.off('gameStarted');
      socket.off('roleAssigned');
      socket.off('chambersUpdated');
    };
  }, []);

  const createRoom = () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }

    socket.emit('createRoom', playerName.trim(), targetPlayerCount, (response) => {
      if (response.success) {
        setRoom(response.room);
        setRoomCode(response.roomCode);
        setScreen('lobby');
        setError('');
      } else {
        setError(response.error);
      }
    });
  };

  const joinRoom = () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }

    if (!roomCode.trim()) {
      setError('Please enter room code');
      return;
    }

    socket.emit('joinRoom', roomCode.trim().toUpperCase(), playerName.trim(), (response) => {
      if (response.success) {
        setRoom(response.room);
        setScreen('lobby');
        setError('');
      } else {
        setError(response.error);
      }
    });
  };

  const startGame = () => {
    socket.emit('startGame', (response) => {
      if (!response.success) {
        setError(response.error);
      }
    });
  };

  const leaveRoom = () => {
    socket.disconnect();
    socket.connect();
    setScreen('home');
    setRoom(null);
    setRoomCode('');
    setPlayerRole(null);
    setPlayerChambers([]);
    setTargetPlayerCount(5);
  };

  return (
    <div className="app">
      {screen === 'home' && (
        <div className="home-screen">
          <div className="temple-bg"></div>
          <div className="home-content">
            <h1 className="game-title">🏛️ Temple of Horror</h1>
            <p className="game-subtitle">Discover the Gold... or Fall into the Traps!</p>

            <div className="home-card">
              <input
                type="text"
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="input-field"
                maxLength={20}
              />

              {/* Player count selector */}
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
                    <span className="label">Adventurers:</span>
                    <span className="value">{targetPlayerCount - getGuardianCount(targetPlayerCount)}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Guardians:</span>
                    <span className="value">{getGuardianCount(targetPlayerCount)}</span>
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
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
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
                <li>🎭 <strong>Hidden Roles:</strong> Adventurers vs Guardians</li>
                <li>🗝️ <strong>Key Holder</strong> chooses a chamber to open</li>
                <li>💰 <strong>Gold:</strong> Helps Adventurers win</li>
                <li>🔥 <strong>Fire Traps:</strong> Helps Guardians win</li>
                <li>📭 <strong>Empty Rooms:</strong> Waste time</li>
                <li>🏆 <strong>Win:</strong> Find all gold OR trigger all traps OR survive 4 rounds</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {screen === 'lobby' && (
        <Lobby
          room={room}
          socket={socket}
          onStartGame={startGame}
          onLeave={leaveRoom}
          error={error}
        />
      )}

      {screen === 'game' && (
        <Game
          room={room}
          socket={socket}
          playerRole={playerRole}
          playerChambers={playerChambers}
          onLeave={leaveRoom}
        />
      )}
    </div>
  );
}

// Helper function for guardian count
function getGuardianCount(playerCount) {
  const guardianMap = {
    3: 2, 4: 2, 5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 4
  };
  return guardianMap[playerCount] || 2;
}

export default App;

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Game rooms storage
const rooms = new Map();

// Generate random room code
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Get guardian count based on player count (from official rules)
function getGuardianCount(playerCount) {
  const guardianMap = {
    3: 2, 4: 2, 5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 4
  };
  return guardianMap[playerCount] || 2;
}

// Get chamber card distribution (from official rules)
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

// Get cards per player for each round
function getCardsPerRound(round) {
  return 5 - round; // Round 0=5 cards, Round 1=4 cards, Round 2=3 cards, Round 3=2 cards
}

// Assign roles randomly
function assignRoles(playerCount) {
  const guardianCount = getGuardianCount(playerCount);
  const roles = [];
  
  for (let i = 0; i < guardianCount; i++) {
    roles.push('guardian');
  }
  for (let i = 0; i < playerCount - guardianCount; i++) {
    roles.push('adventurer');
  }
  
  // Shuffle roles
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }
  
  return roles;
}

// Create chamber deck
function createChamberDeck(playerCount) {
  const dist = getChamberDistribution(playerCount);
  const deck = [];
  
  for (let i = 0; i < dist.gold; i++) deck.push('gold');
  for (let i = 0; i < dist.empty; i++) deck.push('empty');
  for (let i = 0; i < dist.traps; i++) deck.push('trap');
  
  // Shuffle deck
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  
  return deck;
}

// Distribute chambers to players
function distributeChambers(room, round) {
  const cardsPerPlayer = getCardsPerRound(round);
  
  // Collect unrevealed chambers from all players
  const unrevealedChambers = [];
  room.players.forEach(player => {
    if (player.chambers) {
      player.chambers.forEach(chamber => {
        if (!chamber.revealed) {
          unrevealedChambers.push(chamber.type);
        }
      });
    }
  });
  
  // Shuffle unrevealed chambers
  for (let i = unrevealedChambers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unrevealedChambers[i], unrevealedChambers[j]] = [unrevealedChambers[j], unrevealedChambers[i]];
  }
  
  // Redistribute
  let deckIndex = 0;
  room.players.forEach(player => {
    player.chambers = [];
    for (let i = 0; i < cardsPerPlayer; i++) {
      if (deckIndex < unrevealedChambers.length) {
        player.chambers.push({
          type: unrevealedChambers[deckIndex],
          revealed: false
        });
        deckIndex++;
      }
    }
  });
}

// Initialize new game
function initializeGame(room) {
  const playerCount = room.players.length;
  const roles = assignRoles(playerCount);
  const distribution = getChamberDistribution(playerCount);
  
  room.players.forEach((player, index) => {
    player.role = roles[index];
    player.chambers = [];
  });
  
  // Create and distribute initial chamber cards
  const chamberDeck = createChamberDeck(playerCount);
  const cardsPerPlayer = getCardsPerRound(0);
  let deckIndex = 0;
  
  room.players.forEach(player => {
    player.chambers = [];
    for (let i = 0; i < cardsPerPlayer; i++) {
      if (deckIndex < chamberDeck.length) {
        player.chambers.push({
          type: chamberDeck[deckIndex],
          revealed: false
        });
        deckIndex++;
      }
    }
  });
  
  room.gameState = {
    phase: 'selection', // selection, gameOver
    round: 0, // 0-3 for rounds 1-4
    keyHolderIndex: 0,
    foundGold: 0,
    foundEmpty: 0,
    foundTraps: 0,
    totalGold: distribution.gold,
    totalEmpty: distribution.empty,
    totalTraps: distribution.traps,
    chambersOpenedThisRound: 0,
    chambersToOpenThisRound: playerCount
  };
  
  room.started = true;
}

// Handle socket connections
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Create new room
  socket.on('createRoom', (playerName, targetPlayerCount, callback) => {
    const roomCode = generateRoomCode();
    const room = {
      code: roomCode,
      host: socket.id,
      targetPlayerCount: targetPlayerCount || null,
      players: [{
        id: socket.id,
        name: playerName,
        role: null,
        chambers: []
      }],
      started: false,
      gameState: null
    };
    
    rooms.set(roomCode, room);
    socket.join(roomCode);
    socket.roomCode = roomCode;
    
    callback({ success: true, roomCode, room });
    console.log('Room created:', roomCode, 'Target players:', targetPlayerCount);
  });
  
  // Join existing room
  socket.on('joinRoom', (roomCode, playerName, callback) => {
    const room = rooms.get(roomCode);
    
    if (!room) {
      callback({ success: false, error: 'Room not found' });
      return;
    }
    
    if (room.started) {
      callback({ success: false, error: 'Game already started' });
      return;
    }
    
    if (room.players.length >= 10) {
      callback({ success: false, error: 'Room is full (max 10 players)' });
      return;
    }
    
    if (room.players.some(p => p.name === playerName)) {
      callback({ success: false, error: 'Name already taken' });
      return;
    }
    
    room.players.push({
      id: socket.id,
      name: playerName,
      role: null,
      chambers: []
    });
    
    socket.join(roomCode);
    socket.roomCode = roomCode;
    
    callback({ success: true, room });
    io.to(roomCode).emit('roomUpdate', room);
    console.log('Player joined:', playerName, 'in room:', roomCode);
  });
  
  // Start game
  socket.on('startGame', (callback) => {
    const room = rooms.get(socket.roomCode);
    
    if (!room) {
      callback({ success: false, error: 'Room not found' });
      return;
    }
    
    if (room.host !== socket.id) {
      callback({ success: false, error: 'Only host can start game' });
      return;
    }
    
    if (room.players.length < 3) {
      callback({ success: false, error: 'Need at least 3 players' });
      return;
    }
    
    if (room.players.length > 10) {
      callback({ success: false, error: 'Maximum 10 players allowed' });
      return;
    }
    
    initializeGame(room);
    
    // Send role and chamber information to each player
    room.players.forEach(player => {
      io.to(player.id).emit('roleAssigned', {
        role: player.role,
        chambers: player.chambers
      });
    });
    
    callback({ success: true });
    io.to(socket.roomCode).emit('gameStarted', {
      gameState: room.gameState,
      players: room.players.map(p => ({ 
        id: p.id, 
        name: p.name,
        chamberCount: p.chambers.length
      }))
    });
    console.log('Game started in room:', socket.roomCode);
  });
  
  // Open a chamber
  socket.on('openChamber', (targetPlayerId, chamberIndex, callback) => {
    const room = rooms.get(socket.roomCode);
    
    if (!room || !room.gameState) {
      callback({ success: false, error: 'Invalid game state' });
      return;
    }
    
    const { gameState } = room;
    const keyHolder = room.players[gameState.keyHolderIndex];
    
    if (keyHolder.id !== socket.id) {
      callback({ success: false, error: 'You are not the key holder' });
      return;
    }
    
    if (gameState.phase !== 'selection') {
      callback({ success: false, error: 'Wrong phase' });
      return;
    }
    
    const targetPlayer = room.players.find(p => p.id === targetPlayerId);
    if (!targetPlayer) {
      callback({ success: false, error: 'Player not found' });
      return;
    }
    
    if (chamberIndex < 0 || chamberIndex >= targetPlayer.chambers.length) {
      callback({ success: false, error: 'Invalid chamber index' });
      return;
    }
    
    const chamber = targetPlayer.chambers[chamberIndex];
    if (chamber.revealed) {
      callback({ success: false, error: 'Chamber already opened' });
      return;
    }
    
    // Reveal the chamber
    chamber.revealed = true;
    gameState.chambersOpenedThisRound++;
    
    // Update counts
    if (chamber.type === 'gold') {
      gameState.foundGold++;
    } else if (chamber.type === 'trap') {
      gameState.foundTraps++;
    } else if (chamber.type === 'empty') {
      gameState.foundEmpty++;
    }
    
    // Check win conditions FIRST (before broadcasting)
    let gameOver = false;
    let winner = null;
    let reason = null;
    
    if (gameState.foundGold === gameState.totalGold) {
      // All gold found - Adventurers win
      gameOver = true;
      winner = 'adventurers';
      reason = 'All gold has been found!';
      gameState.phase = 'gameOver';
      gameState.winner = winner;
    } else if (gameState.foundTraps === gameState.totalTraps) {
      // All traps found - Guardians win
      gameOver = true;
      winner = 'guardians';
      reason = 'All fire traps have been triggered!';
      gameState.phase = 'gameOver';
      gameState.winner = winner;
    } else if (gameState.chambersOpenedThisRound >= gameState.chambersToOpenThisRound) {
      // Round ends
      if (gameState.round >= 3) {
        // Game ends after 4 rounds - Guardians win if not all gold found
        gameOver = true;
        winner = 'guardians';
        reason = '4 rounds completed without finding all gold!';
        gameState.phase = 'gameOver';
        gameState.winner = winner;
      } else {
        // Start next round
        gameState.round++;
        gameState.chambersOpenedThisRound = 0;
        gameState.chambersToOpenThisRound = room.players.length;
        
        // Transfer key to the player whose chamber was just opened (for the new round)
        const targetPlayerIndex = room.players.findIndex(p => p.id === targetPlayerId);
        gameState.keyHolderIndex = targetPlayerIndex;
        
        // Redistribute chambers
        distributeChambers(room, gameState.round);
        
        // Send updated chambers to each player
        room.players.forEach(player => {
          io.to(player.id).emit('chambersUpdated', {
            chambers: player.chambers
          });
        });
        
        // Key holder is the player whose chamber was opened
        io.to(socket.roomCode).emit('nextRound', {
          round: gameState.round,
          keyHolder: room.players[gameState.keyHolderIndex].name,
          gameState
        });
      }
    }
    
    // Broadcast the revealed chamber (with updated gameState including phase)
    io.to(socket.roomCode).emit('chamberRevealed', {
      playerName: targetPlayer.name,
      playerId: targetPlayerId,
      chamberIndex,
      chamberType: chamber.type,
      gameState
    });
    
    if (gameOver) {
      // Send game over event
      const gameOverPayload = {
        winner,
        reason,
        players: room.players.map(p => ({
          id: p.id,
          name: p.name,
          role: p.role
        }))
      };
      
      console.log('=== GAME OVER ===');
      console.log('Winner:', winner);
      console.log('Reason:', reason);
      console.log('Players with roles:', gameOverPayload.players);
      
      io.to(socket.roomCode).emit('gameOver', gameOverPayload);
    } else if (!gameOver && gameState.chambersOpenedThisRound < gameState.chambersToOpenThisRound) {
      // Only transfer key if game continues AND round hasn't ended
      const targetPlayerIndex = room.players.findIndex(p => p.id === targetPlayerId);
      gameState.keyHolderIndex = targetPlayerIndex;
      
      io.to(socket.roomCode).emit('keyHolderChanged', {
        keyHolder: room.players[gameState.keyHolderIndex].name,
        keyHolderId: targetPlayerId
      });
    }
    
    callback({ success: true });
  });
  
  // Get current room state
  socket.on('getRoomState', (callback) => {
    const room = rooms.get(socket.roomCode);
    if (room) {
      const player = room.players.find(p => p.id === socket.id);
      callback({
        success: true,
        room,
        playerRole: player?.role,
        playerChambers: player?.chambers
      });
    } else {
      callback({ success: false });
    }
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    if (socket.roomCode) {
      const room = rooms.get(socket.roomCode);
      if (room) {
        room.players = room.players.filter(p => p.id !== socket.id);
        
        if (room.players.length === 0) {
          rooms.delete(socket.roomCode);
          console.log('Room deleted:', socket.roomCode);
        } else {
          // Assign new host if needed
          if (room.host === socket.id) {
            room.host = room.players[0].id;
          }
          
          io.to(socket.roomCode).emit('roomUpdate', room);
        }
      }
    }
  });
});

// Serve React app in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

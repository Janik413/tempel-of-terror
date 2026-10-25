/**
 * Temple of Horror - game server
 *
 * The server is the single source of truth. After every change it sends each
 * player a personal snapshot ("state") that contains only what that player is
 * allowed to know: their own role, the contents of their own chambers and the
 * contents of chambers that have already been revealed. Hidden information of
 * other players never leaves the server.
 *
 * Players are identified by a secret session token (stored in the browser),
 * not by their socket id. This allows reconnecting after a page reload or a
 * short network loss without breaking the running game.
 */

const path = require('path');
// Local secrets (SUPABASE_URL, SUPABASE_SECRET_KEY) from server/.env; on Render they are environment variables
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const http = require('http');
const crypto = require('crypto');
const { Server } = require('socket.io');
const cors = require('cors');
const accounts = require('./accounts');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PORT = process.env.PORT || 3001;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 10;
const ROUND_COUNT = 4;
const MAX_NAME_LENGTH = 20;

// Time the reveal animation needs on the client before the next step happens
const REVEAL_DELAY_MS = 3500;
// A player who drops out of the lobby is removed after this grace period
const LOBBY_DISCONNECT_GRACE_MS = 30 * 1000;
// A room in which nobody is connected anymore is deleted after this time
const EMPTY_ROOM_TTL_MS = 15 * 60 * 1000;

// Pointer events (hovering a door) are only relayed, never stored. Honest clients
// send far less than this; anything above is dropped to protect the server.
const MAX_POINTER_EVENTS_PER_SECOND = 40;

const THEMES = ['halloween', 'christmas'];
const DEFAULT_THEME = 'halloween';

// Role cards per player count (official rules). There are more role cards
// than players for most player counts: the remaining card is put aside unseen,
// so the actual number of guardians is not known for sure.
const ROLE_CARDS = {
  3: { adventurer: 2, hexe: 2 },
  4: { adventurer: 3, hexe: 2 },
  5: { adventurer: 3, hexe: 2 },
  6: { adventurer: 4, hexe: 2 },
  7: { adventurer: 5, hexe: 3 },
  8: { adventurer: 6, hexe: 3 },
  9: { adventurer: 6, hexe: 3 },
  10: { adventurer: 7, hexe: 4 }
};

// Chamber cards per player count (official rules), always 5 cards per player
const CHAMBER_CARDS = {
  3: { gold: 5, empty: 8, trap: 2 },
  4: { gold: 6, empty: 12, trap: 2 },
  5: { gold: 7, empty: 16, trap: 2 },
  6: { gold: 8, empty: 20, trap: 2 },
  7: { gold: 7, empty: 26, trap: 2 },
  8: { gold: 8, empty: 30, trap: 2 },
  9: { gold: 9, empty: 34, trap: 2 },
  10: { gold: 10, empty: 37, trap: 3 }
};

// ---------------------------------------------------------------------------
// HTTP + socket setup
// ---------------------------------------------------------------------------

const app = express();
app.use(cors());
app.use(express.json());

if (IS_PRODUCTION) {
  app.use(express.static(path.join(__dirname, '../client/build')));
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: IS_PRODUCTION ? false : 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// roomCode -> room object
const rooms = new Map();

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function log(message, ...details) {
  console.log(`[${new Date().toISOString()}] ${message}`, ...details);
}

function shuffle(array) {
  // Fisher-Yates shuffle, works in place and returns the array for chaining
  for (let index = array.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [array[index], array[swapIndex]] = [array[swapIndex], array[index]];
  }
  return array;
}

function createRandomId(byteCount = 16) {
  return crypto.randomBytes(byteCount).toString('hex');
}

function generateRoomCode() {
  // 6 characters without easily confused symbols (0/O, 1/I)
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 6 }, () => alphabet[crypto.randomInt(alphabet.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function sanitizeName(rawName) {
  if (typeof rawName !== 'string') return '';
  return rawName.trim().slice(0, MAX_NAME_LENGTH);
}

function sanitizeTheme(rawTheme) {
  return THEMES.includes(rawTheme) ? rawTheme : DEFAULT_THEME;
}

function getCardsPerPlayer(round) {
  // Round 0 -> 5 cards, round 1 -> 4, round 2 -> 3, round 3 -> 2
  return 5 - round;
}

function respond(callback, payload) {
  // Clients may omit the acknowledgement callback; never crash because of it
  if (typeof callback === 'function') callback(payload);
}

// ---------------------------------------------------------------------------
// Game setup
// ---------------------------------------------------------------------------

function dealRoles(playerCount) {
  const cards = ROLE_CARDS[playerCount];
  const roleDeck = shuffle([
    ...Array(cards.adventurer).fill('adventurer'),
    ...Array(cards.hexe).fill('hexe')
  ]);
  // Only as many cards as players are dealt, the rest stays hidden
  return roleDeck.slice(0, playerCount);
}

function dealChambers(players, cardDeck, cardsPerPlayer) {
  let deckIndex = 0;
  players.forEach(player => {
    player.chambers = [];
    for (let cardIndex = 0; cardIndex < cardsPerPlayer && deckIndex < cardDeck.length; cardIndex++) {
      player.chambers.push({ type: cardDeck[deckIndex], revealed: false });
      deckIndex++;
    }
  });
}

function initializeGame(room) {
  const playerCount = room.players.length;
  const chamberCards = CHAMBER_CARDS[playerCount];
  const roles = dealRoles(playerCount);

  room.players.forEach((player, index) => {
    player.role = roles[index];
    player.stats = createEmptyStats();
  });

  const chamberDeck = shuffle([
    ...Array(chamberCards.gold).fill('gold'),
    ...Array(chamberCards.empty).fill('empty'),
    ...Array(chamberCards.trap).fill('trap')
  ]);
  dealChambers(room.players, chamberDeck, getCardsPerPlayer(0));

  room.started = true;
  room.game = {
    phase: 'selection', // selection | roundEnd | ending | gameOver
    round: 0, // 0..3 for rounds 1..4
    // The first key holder is chosen randomly
    keyHolderId: room.players[crypto.randomInt(playerCount)].id,
    found: { gold: 0, empty: 0, trap: 0 },
    total: { ...chamberCards },
    openedThisRound: 0,
    toOpenThisRound: playerCount,
    lastReveal: null, // { seq, playerId, playerName, chamberIndex, type, round }
    revealSeq: 0,
    winner: null, // 'adventurers' | 'hexen'
    reason: null // 'allGold' | 'allTraps' | 'roundsOver'
  };
}

function startNextRound(room) {
  const { game } = room;

  // Collect all unrevealed chambers, shuffle and deal one card less per player
  const remainingCards = shuffle(
    room.players.flatMap(player => player.chambers.filter(chamber => !chamber.revealed).map(chamber => chamber.type))
  );

  game.round++;
  game.openedThisRound = 0;
  game.toOpenThisRound = room.players.length;
  game.phase = 'selection';
  dealChambers(room.players, remainingCards, getCardsPerPlayer(game.round));

  // The key stays with the player whose chamber was opened last
  game.keyHolderId = game.lastReveal.playerId;
}

function finishGame(room) {
  room.game.phase = 'gameOver';
  log(`Game over in room ${room.code}: ${room.game.winner} (${room.game.reason})`);
  // Runs in the background, errors are logged inside
  accounts.saveGameResult(room);
}

// ---------------------------------------------------------------------------
// Snapshots (what each player is allowed to see)
// ---------------------------------------------------------------------------

function buildSnapshot(room, viewer) {
  const game = room.game;
  const isGameOver = game?.phase === 'gameOver';

  return {
    code: room.code,
    theme: room.theme,
    hostId: room.hostId,
    targetPlayerCount: room.targetPlayerCount,
    started: room.started,
    accountsEnabled: accounts.isEnabled(),
    me: {
      id: viewer.id,
      name: viewer.name,
      accountId: viewer.userId,
      role: viewer.role // only the viewer's own role
    },
    players: room.players.map(player => ({
      id: player.id,
      name: player.name,
      accountId: player.userId, // public profile id, null for guests
      connected: player.connected,
      // Roles of others are only revealed at the end of the game
      role: isGameOver ? player.role : undefined,
      chambers: player.chambers.map(chamber => ({
        revealed: chamber.revealed,
        // Content is visible if revealed, if it is the viewer's own card or at the end of the game
        type: chamber.revealed || player.id === viewer.id || isGameOver ? chamber.type : null
      }))
    })),
    game: game
      ? {
          phase: game.phase,
          round: game.round,
          roundCount: ROUND_COUNT,
          keyHolderId: game.keyHolderId,
          found: game.found,
          total: game.total,
          openedThisRound: game.openedThisRound,
          toOpenThisRound: game.toOpenThisRound,
          lastReveal: game.lastReveal,
          winner: game.winner,
          reason: game.reason
        }
      : null
  };
}

function broadcastState(room) {
  room.players.forEach(player => {
    if (player.connected && player.socketId) {
      io.to(player.socketId).emit('state', buildSnapshot(room, player));
    }
  });
}

// ---------------------------------------------------------------------------
// Room maintenance
// ---------------------------------------------------------------------------

function clearPendingTimer(room) {
  if (room.pendingTimer) {
    clearTimeout(room.pendingTimer);
    room.pendingTimer = null;
  }
}

function deleteRoom(room) {
  clearPendingTimer(room);
  room.players.forEach(player => clearTimeout(player.removeTimer));
  clearTimeout(room.cleanupTimer);
  rooms.delete(room.code);
  log(`Room deleted: ${room.code}`);
}

function ensureConnectedHost(room) {
  const host = room.players.find(player => player.id === room.hostId);
  if (host && host.connected) return;

  const newHost = room.players.find(player => player.connected);
  if (newHost) {
    room.hostId = newHost.id;
    log(`Host of room ${room.code} is now ${newHost.name}`);
  }
}

function scheduleCleanupIfEmpty(room) {
  clearTimeout(room.cleanupTimer);
  if (room.players.some(player => player.connected)) return;

  room.cleanupTimer = setTimeout(() => {
    if (!room.players.some(player => player.connected)) deleteRoom(room);
  }, EMPTY_ROOM_TTL_MS);
}

function removePlayerFromLobby(room, playerId) {
  room.players = room.players.filter(player => player.id !== playerId);
  if (room.players.length === 0) {
    deleteRoom(room);
    return;
  }
  ensureConnectedHost(room);
  broadcastState(room);
}

function attachSocket(socket, room, player) {
  clearTimeout(player.removeTimer);
  clearTimeout(room.cleanupTimer);
  player.socketId = socket.id;
  player.connected = true;
  socket.data.roomCode = room.code;
  socket.data.playerId = player.id;
  socket.join(room.code);
}

function createEmptyStats() {
  return { openedGold: 0, openedEmpty: 0, openedTrap: 0, timesOpenedByOthers: 0 };
}

// account is { userId, username } for logged in players, null for guests
function createPlayer(name, account) {
  return {
    id: createRandomId(8), // public id, visible to everybody
    token: createRandomId(16), // secret, only known to this player's browser
    name: account ? account.username : name,
    userId: account ? account.userId : null,
    socketId: null,
    connected: false,
    role: null,
    chambers: [],
    stats: createEmptyStats(), // per game, saved to the account at the end
    removeTimer: null
  };
}

// Returns { room, player } for the socket or null if it is not in a room
function getContext(socket) {
  const room = rooms.get(socket.data.roomCode);
  if (!room) return null;
  const player = room.players.find(entry => entry.id === socket.data.playerId);
  if (!player) return null;
  return { room, player };
}

// ---------------------------------------------------------------------------
// Socket events
// ---------------------------------------------------------------------------

io.on('connection', socket => {
  log(`Socket connected: ${socket.id}`);

  // Create a new room. Payload: { name, targetPlayerCount, theme }
  socket.on('createRoom', async (payload, callback) => {
    const account = await accounts.verifyAccessToken(payload?.accessToken);
    if (!socket.connected) return; // socket left while the token was being checked
    const name = sanitizeName(payload?.name);
    if (!name && !account) return respond(callback, { success: false, error: 'Please enter your name' });

    const targetPlayerCount = Number(payload?.targetPlayerCount);
    const room = {
      code: generateRoomCode(),
      theme: sanitizeTheme(payload?.theme),
      targetPlayerCount: ROLE_CARDS[targetPlayerCount] ? targetPlayerCount : null,
      hostId: null,
      players: [],
      started: false,
      game: null,
      pendingTimer: null,
      cleanupTimer: null
    };
    const player = createPlayer(name, account);
    room.players.push(player);
    room.hostId = player.id;
    rooms.set(room.code, room);

    attachSocket(socket, room, player);
    respond(callback, { success: true, roomCode: room.code, token: player.token });
    broadcastState(room);
    log(`Room created: ${room.code} by ${player.name}${account ? ' (account)' : ''} (theme: ${room.theme})`);
  });

  // Join an existing room that has not started yet. Payload: { roomCode, name }
  socket.on('joinRoom', async (payload, callback) => {
    const account = await accounts.verifyAccessToken(payload?.accessToken);
    if (!socket.connected) return; // socket left while the token was being checked
    const roomCode = String(payload?.roomCode || '').trim().toUpperCase();
    const name = account ? account.username : sanitizeName(payload?.name);
    const room = rooms.get(roomCode);

    if (!name) return respond(callback, { success: false, error: 'Please enter your name' });
    if (!room) return respond(callback, { success: false, error: 'Room not found' });
    if (room.started) return respond(callback, { success: false, error: 'Game already started' });
    if (room.players.length >= MAX_PLAYERS) {
      return respond(callback, { success: false, error: `Room is full (max ${MAX_PLAYERS} players)` });
    }
    if (account && room.players.some(player => player.userId === account.userId)) {
      return respond(callback, { success: false, error: 'Your account is already in this room' });
    }
    if (room.players.some(player => player.name.toLowerCase() === name.toLowerCase())) {
      return respond(callback, { success: false, error: 'Name already taken' });
    }

    const player = createPlayer(name, account);
    room.players.push(player);
    attachSocket(socket, room, player);
    respond(callback, { success: true, roomCode: room.code, token: player.token });
    broadcastState(room);
    log(`Player joined: ${name}${account ? ' (account)' : ''} in room ${room.code}`);
  });

  // Reconnect with a stored session token. Payload: { roomCode, token }
  socket.on('rejoinRoom', (payload, callback) => {
    const room = rooms.get(String(payload?.roomCode || '').toUpperCase());
    const player = room?.players.find(entry => entry.token === payload?.token);
    if (!room || !player) return respond(callback, { success: false, error: 'Session expired' });

    // An older socket of the same player (e.g. a second tab) loses its session
    if (player.socketId && player.socketId !== socket.id) {
      const oldSocket = io.sockets.sockets.get(player.socketId);
      if (oldSocket) {
        oldSocket.data.roomCode = null;
        oldSocket.emit('sessionReplaced');
      }
    }

    attachSocket(socket, room, player);
    ensureConnectedHost(room);
    respond(callback, { success: true, roomCode: room.code });
    broadcastState(room);
    log(`Player reconnected: ${player.name} in room ${room.code}`);
  });

  // Host changes the theme for everybody (lobby and end screen only)
  socket.on('setTheme', (theme, callback) => {
    const context = getContext(socket);
    if (!context) return respond(callback, { success: false, error: 'Not in a room' });
    const { room, player } = context;

    if (room.hostId !== player.id) return respond(callback, { success: false, error: 'Only the host can change the theme' });
    if (!THEMES.includes(theme)) return respond(callback, { success: false, error: 'Unknown theme' });

    room.theme = theme;
    respond(callback, { success: true });
    broadcastState(room);
  });

  // Start the game (host only)
  socket.on('startGame', callback => {
    const context = getContext(socket);
    if (!context) return respond(callback, { success: false, error: 'Room not found' });
    const { room, player } = context;

    if (room.hostId !== player.id) return respond(callback, { success: false, error: 'Only host can start game' });
    if (room.started) return respond(callback, { success: false, error: 'Game already started' });
    if (room.players.length < MIN_PLAYERS) {
      return respond(callback, { success: false, error: `Need at least ${MIN_PLAYERS} players` });
    }
    if (room.players.some(entry => !entry.connected)) {
      return respond(callback, { success: false, error: 'Not all players are connected' });
    }

    initializeGame(room);
    respond(callback, { success: true });
    broadcastState(room);
    log(`Game started in room ${room.code} with ${room.players.length} players`);
  });

  // Open a chamber. Payload: { targetPlayerId, chamberIndex }
  socket.on('openChamber', (payload, callback) => {
    const context = getContext(socket);
    if (!context || !context.room.game) return respond(callback, { success: false, error: 'Invalid game state' });
    const { room, player } = context;
    const { game } = room;

    if (game.phase !== 'selection') return respond(callback, { success: false, error: 'Please wait a moment' });

    const keyHolder = room.players.find(entry => entry.id === game.keyHolderId);
    // The host may act for a key holder who lost the connection, so the game cannot get stuck
    const isActingForOfflineKeyHolder = !keyHolder.connected && room.hostId === player.id;
    if (keyHolder.id !== player.id && !isActingForOfflineKeyHolder) {
      return respond(callback, { success: false, error: 'You are not the key holder' });
    }

    const targetPlayer = room.players.find(entry => entry.id === payload?.targetPlayerId);
    if (!targetPlayer) return respond(callback, { success: false, error: 'Player not found' });
    if (targetPlayer.id === keyHolder.id) {
      return respond(callback, { success: false, error: 'The key holder cannot open own chambers' });
    }

    const chamberIndex = Number(payload?.chamberIndex);
    const chamber = targetPlayer.chambers[chamberIndex];
    if (!Number.isInteger(chamberIndex) || !chamber) return respond(callback, { success: false, error: 'Invalid chamber' });
    if (chamber.revealed) return respond(callback, { success: false, error: 'Chamber already opened' });

    // Reveal the chamber
    chamber.revealed = true;
    game.found[chamber.type]++;

    // Statistics: the key holder gets credited, even if the host acted for them
    const openedStatKey = { gold: 'openedGold', empty: 'openedEmpty', trap: 'openedTrap' }[chamber.type];
    keyHolder.stats[openedStatKey]++;
    targetPlayer.stats.timesOpenedByOthers++;
    game.openedThisRound++;
    game.revealSeq++;
    game.lastReveal = {
      seq: game.revealSeq,
      playerId: targetPlayer.id,
      playerName: targetPlayer.name,
      chamberIndex,
      type: chamber.type,
      round: game.round
    };

    // Determine what happens next
    const isRoundComplete = game.openedThisRound >= game.toOpenThisRound;
    if (game.found.gold >= game.total.gold) {
      game.winner = 'adventurers';
      game.reason = 'allGold';
    } else if (game.found.trap >= game.total.trap) {
      game.winner = 'hexen';
      game.reason = 'allTraps';
    } else if (isRoundComplete && game.round >= ROUND_COUNT - 1) {
      game.winner = 'hexen';
      game.reason = 'roundsOver';
    }

    clearPendingTimer(room);
    if (game.winner) {
      // Lock the board, let the reveal animation play, then show the result
      game.phase = 'ending';
      room.pendingTimer = setTimeout(() => {
        room.pendingTimer = null;
        finishGame(room);
        broadcastState(room);
      }, REVEAL_DELAY_MS);
    } else if (isRoundComplete) {
      // Show the last card of the round before the cards get reshuffled
      game.phase = 'roundEnd';
      room.pendingTimer = setTimeout(() => {
        room.pendingTimer = null;
        startNextRound(room);
        broadcastState(room);
        log(`Room ${room.code}: round ${game.round + 1} started`);
      }, REVEAL_DELAY_MS);
    } else {
      // The opened player receives the key
      game.keyHolderId = targetPlayer.id;
    }

    respond(callback, { success: true });
    broadcastState(room);
  });

  // A player points at a door (hover / tap). Payload: { targetPlayerId, chamberIndex } or null to clear
  socket.on('pointChamber', payload => {
    const context = getContext(socket);
    if (!context || !context.room.game) return;
    const { room, player } = context;
    if (room.game.phase !== 'selection') return;

    // Simple rate limit per player (sliding one second window)
    const now = Date.now();
    if (!player.pointerWindowStart || now - player.pointerWindowStart > 1000) {
      player.pointerWindowStart = now;
      player.pointerEventCount = 0;
    }
    player.pointerEventCount++;
    if (player.pointerEventCount > MAX_POINTER_EVENTS_PER_SECOND) return;

    let pointer = null;
    if (payload) {
      const targetPlayer = room.players.find(entry => entry.id === payload.targetPlayerId);
      const chamberIndex = Number(payload.chamberIndex);
      const chamber = targetPlayer?.chambers[chamberIndex];
      // Only unrevealed doors can be pointed at
      if (!Number.isInteger(chamberIndex) || !chamber || chamber.revealed) return;
      pointer = { targetPlayerId: targetPlayer.id, chamberIndex };
    }

    socket.to(room.code).emit('pointer', { fromId: player.id, pointer });
  });

  // Start a new game in the same room (host only)
  socket.on('restartGame', callback => {
    const context = getContext(socket);
    if (!context) return respond(callback, { success: false, error: 'Room not found' });
    const { room, player } = context;

    if (room.hostId !== player.id) return respond(callback, { success: false, error: 'Only host can restart game' });
    if (room.game?.phase !== 'gameOver') return respond(callback, { success: false, error: 'Game is still running' });

    // Players who left for good are dropped before the rematch
    room.players = room.players.filter(entry => entry.connected);
    if (room.players.length < MIN_PLAYERS) {
      return respond(callback, { success: false, error: `Need at least ${MIN_PLAYERS} connected players` });
    }

    clearPendingTimer(room);
    initializeGame(room);
    respond(callback, { success: true });
    broadcastState(room);
    log(`Game restarted in room ${room.code}`);
  });

  // Leave the room on purpose
  socket.on('leaveRoom', callback => {
    const context = getContext(socket);
    respond(callback, { success: true });
    if (!context) return;
    const { room, player } = context;

    socket.leave(room.code);
    socket.data.roomCode = null;

    if (!room.started) {
      removePlayerFromLobby(room, player.id);
    } else {
      // During a game the seat is kept so the card count stays correct
      player.connected = false;
      player.socketId = null;
      io.to(room.code).emit('pointer', { fromId: player.id, pointer: null });
      ensureConnectedHost(room);
      scheduleCleanupIfEmpty(room);
      broadcastState(room);
    }
    log(`Player left: ${player.name} from room ${room.code}`);
  });

  socket.on('disconnect', () => {
    log(`Socket disconnected: ${socket.id}`);
    const context = getContext(socket);
    if (!context) return;
    const { room, player } = context;
    if (player.socketId !== socket.id) return; // already replaced by a newer socket

    player.connected = false;
    player.socketId = null;
    // Remove the door marker of the player who left
    io.to(room.code).emit('pointer', { fromId: player.id, pointer: null });

    if (!room.started) {
      // Give the player some time to come back (e.g. page reload)
      player.removeTimer = setTimeout(() => {
        if (!player.connected && rooms.has(room.code) && !room.started) removePlayerFromLobby(room, player.id);
      }, LOBBY_DISCONNECT_GRACE_MS);
    }

    ensureConnectedHost(room);
    scheduleCleanupIfEmpty(room);
    broadcastState(room);
  });
});

// Serve React app in production
if (IS_PRODUCTION) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

server.listen(PORT, () => {
  log(`Server running on port ${PORT}`);
});

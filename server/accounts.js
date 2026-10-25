/**
 * Accounts and statistics (Supabase).
 *
 * The game works without this module being configured: if SUPABASE_URL or
 * SUPABASE_SECRET_KEY is missing, everybody plays as a guest and no results
 * are stored.
 *
 * The secret key bypasses row level security, so it must only ever live on the
 * server (environment variable), never in the client.
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const supabase =
  SUPABASE_URL && SUPABASE_SECRET_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      })
    : null;

function log(message, ...details) {
  console.log(`[${new Date().toISOString()}] [accounts] ${message}`, ...details);
}

if (supabase) {
  log(`Accounts enabled (${SUPABASE_URL})`);
} else {
  log('Accounts disabled: SUPABASE_URL / SUPABASE_SECRET_KEY not set, everybody plays as guest');
}

function isEnabled() {
  return supabase !== null;
}

/**
 * Verifies a login token sent by the browser.
 * Returns { userId, username } for a valid token, otherwise null (guest).
 */
async function verifyAccessToken(accessToken) {
  if (!supabase || typeof accessToken !== 'string' || accessToken.length === 0) return null;

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userData?.user) return null;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userData.user.id)
      .single();
    if (profileError || !profile) {
      log(`No profile for user ${userData.user.id}`, profileError?.message);
      return null;
    }

    return { userId: userData.user.id, username: profile.username };
  } catch (error) {
    log('Token verification failed:', error.message);
    return null;
  }
}

/**
 * Stores a finished game. Only players with an account get a row in game_players.
 * Errors are logged but never break the running game.
 */
async function saveGameResult(room) {
  if (!supabase) return;
  const { game } = room;
  const accountPlayers = room.players.filter(player => player.userId);
  if (accountPlayers.length === 0) return;

  try {
    const { data: gameRow, error: gameError } = await supabase
      .from('games')
      .insert({
        theme: room.theme,
        player_count: room.players.length,
        rounds_played: game.round + 1,
        winner: game.winner,
        reason: game.reason
      })
      .select('id')
      .single();
    if (gameError) throw gameError;

    const winningRole = game.winner === 'adventurers' ? 'adventurer' : 'hexe';
    const playerRows = accountPlayers.map(player => ({
      game_id: gameRow.id,
      user_id: player.userId,
      role: player.role,
      won: player.role === winningRole,
      opened_gold: player.stats.openedGold,
      opened_empty: player.stats.openedEmpty,
      opened_trap: player.stats.openedTrap,
      times_opened_by_others: player.stats.timesOpenedByOthers
    }));

    const { error: playersError } = await supabase.from('game_players').insert(playerRows);
    if (playersError) throw playersError;

    log(`Saved game ${gameRow.id} of room ${room.code} for ${playerRows.length} account(s)`);
  } catch (error) {
    log(`Could not save game of room ${room.code}:`, error.message);
  }
}

module.exports = { isEnabled, verifyAccessToken, saveGameResult };

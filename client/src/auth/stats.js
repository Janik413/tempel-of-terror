import { supabase } from './supabaseClient';

/**
 * Loading and evaluating player statistics.
 * All numbers are computed from the raw game rows of one player, so new
 * statistics only need code here and no database change.
 */

const GAME_ROW_SELECT =
  'role, won, opened_gold, opened_empty, opened_trap, times_opened_by_others, ' +
  'game:games(finished_at, theme, player_count, rounds_played, winner, reason)';

export async function loadProfile(userId) {
  const [{ data: profile, error: profileError }, { data: rows, error: rowsError }] = await Promise.all([
    supabase.from('profiles').select('id, username, created_at').eq('id', userId).single(),
    supabase.from('game_players').select(GAME_ROW_SELECT).eq('user_id', userId)
  ]);
  if (profileError) throw profileError;
  if (rowsError) throw rowsError;
  return { profile, stats: computeStats(rows || []) };
}

export async function loadLeaderboard(limit = 20) {
  const { data, error } = await supabase
    .from('player_stats')
    .select('user_id, username, games_played, wins, games_as_adventurer, wins_as_adventurer, games_as_hexe, wins_as_hexe')
    .gt('games_played', 0)
    .order('wins', { ascending: false })
    .order('games_played', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export function percentage(part, total) {
  return total > 0 ? Math.round((part / total) * 100) : null;
}

function computeStats(rows) {
  // Newest game first
  const games = rows
    .filter(row => row.game)
    .sort((first, second) => new Date(second.game.finished_at) - new Date(first.game.finished_at));

  const asAdventurer = games.filter(row => row.role === 'adventurer');
  const asHexe = games.filter(row => row.role === 'hexe');
  const sum = key => games.reduce((total, row) => total + (row[key] || 0), 0);

  // Current streak (from the newest game backwards)
  let currentStreak = { won: games[0]?.won ?? true, count: 0 };
  for (const row of games) {
    if (row.won !== currentStreak.won) break;
    currentStreak.count++;
  }
  if (games.length === 0) currentStreak = { won: true, count: 0 };

  // Best win streak (chronological pass)
  let bestWinStreak = 0;
  let runningWinStreak = 0;
  [...games].reverse().forEach(row => {
    runningWinStreak = row.won ? runningWinStreak + 1 : 0;
    bestWinStreak = Math.max(bestWinStreak, runningWinStreak);
  });

  // Favorite theme
  const themeCounts = {};
  games.forEach(row => {
    themeCounts[row.game.theme] = (themeCounts[row.game.theme] || 0) + 1;
  });
  const favoriteTheme = Object.keys(themeCounts).sort((first, second) => themeCounts[second] - themeCounts[first])[0] || null;

  // Fastest win (fewest rounds)
  const wins = games.filter(row => row.won);
  const fastestWinRounds = wins.length > 0 ? Math.min(...wins.map(row => row.game.rounds_played)) : null;

  const openedGold = sum('opened_gold');
  const openedEmpty = sum('opened_empty');
  const openedTrap = sum('opened_trap');
  const openedTotal = openedGold + openedEmpty + openedTrap;

  return {
    gamesPlayed: games.length,
    wins: wins.length,
    adventurer: { games: asAdventurer.length, wins: asAdventurer.filter(row => row.won).length },
    hexe: { games: asHexe.length, wins: asHexe.filter(row => row.won).length },
    opened: { gold: openedGold, empty: openedEmpty, trap: openedTrap, total: openedTotal },
    averageOpenedByOthers: games.length > 0 ? sum('times_opened_by_others') / games.length : null,
    currentStreak,
    bestWinStreak,
    favoriteTheme,
    fastestWinRounds,
    recentGames: games.slice(0, 10)
  };
}

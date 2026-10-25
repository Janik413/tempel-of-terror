/**
 * Theme definitions.
 *
 * Every theme changes texts, icons and colors, the rules stay the same.
 * Colors are applied through CSS variables (see [data-theme] blocks in App.css),
 * this file only contains the texts and icons.
 *
 * Internal ids never change:
 *   roles:    'adventurer' | 'hexe'
 *   teams:    'adventurers' | 'hexen'
 *   chambers: 'gold' | 'empty' | 'trap'
 */

export const THEMES = {
  halloween: {
    id: 'halloween',
    label: 'Halloween',
    pickerIcon: '🎃',
    title: 'Temple of Horror',
    titleIcon: '🎃',
    subtitle: 'Discover the gold... or fall into the traps!',
    lockedIcon: '🚪',
    roles: {
      adventurer: { name: 'Adventurer', plural: 'Adventurers', icon: '⚔️' },
      hexe: { name: 'Hexe', plural: 'Hexen', icon: '🧙‍♀️' }
    },
    chambers: {
      gold: { name: 'Gold', revealName: 'Gold!', icon: '💰' },
      empty: { name: 'Empty', revealName: 'Empty Room', icon: '🕸️' },
      trap: { name: 'Trap', revealName: 'Fire Trap!', icon: '🔥' }
    },
    reasons: {
      allGold: 'All gold has been found!',
      allTraps: 'All fire traps have been triggered!',
      roundsOver: '4 rounds are over and the gold is still hidden!'
    },
    emptySubtitle: 'Only cobwebs in here...',
    // Floating decoration particles
    particles: ['🦇', '🕸️', '👻', '🎃', '🦇']
  },

  christmas: {
    id: 'christmas',
    label: 'Christmas',
    pickerIcon: '🎄',
    title: 'Temple of Frost',
    titleIcon: '🎄',
    subtitle: 'Find the presents... or step into the ice traps!',
    lockedIcon: '📦',
    roles: {
      adventurer: { name: 'Elf', plural: 'Elves', icon: '🧝' },
      hexe: { name: 'Frost Witch', plural: 'Frost Witches', icon: '❄️' }
    },
    chambers: {
      gold: { name: 'Present', revealName: 'A Present!', icon: '🎁' },
      empty: { name: 'Empty', revealName: 'Empty Stocking', icon: '🧦' },
      trap: { name: 'Ice Trap', revealName: 'Ice Trap!', icon: '🧊' }
    },
    reasons: {
      allGold: 'All presents have been found!',
      allTraps: 'All ice traps have been triggered!',
      roundsOver: '4 rounds are over and the presents are still hidden!'
    },
    emptySubtitle: 'Nothing but an empty stocking...',
    particles: ['❄️', '❅', '❆', '✨', '❄️']
  }
};

export const THEME_IDS = Object.keys(THEMES);
export const DEFAULT_THEME = 'halloween';

export function getTheme(themeId) {
  return THEMES[themeId] || THEMES[DEFAULT_THEME];
}

// Role cards per player count (official rules). One card more than players
// for most counts, so the exact number of hexen is uncertain.
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

export const CHAMBER_CARDS = {
  3: { gold: 5, empty: 8, trap: 2 },
  4: { gold: 6, empty: 12, trap: 2 },
  5: { gold: 7, empty: 16, trap: 2 },
  6: { gold: 8, empty: 20, trap: 2 },
  7: { gold: 7, empty: 26, trap: 2 },
  8: { gold: 8, empty: 30, trap: 2 },
  9: { gold: 9, empty: 34, trap: 2 },
  10: { gold: 10, empty: 37, trap: 3 }
};

/**
 * Possible role counts for a player count, e.g. 3 players -> hexen 1-2.
 * Returns null for unsupported player counts.
 */
export function getRoleRange(playerCount) {
  const cards = ROLE_CARDS[playerCount];
  if (!cards) return null;
  const surplusCards = cards.adventurer + cards.hexe - playerCount;
  return {
    hexen: { min: Math.max(0, cards.hexe - surplusCards), max: cards.hexe },
    adventurers: { min: Math.max(0, cards.adventurer - surplusCards), max: cards.adventurer }
  };
}

export function formatRange(range) {
  return range.min === range.max ? String(range.min) : `${range.min}–${range.max}`;
}

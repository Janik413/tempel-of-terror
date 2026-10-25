# 🎃 Temple of Horror / 🎄 Temple of Frost

Online multiplayer version of **Tempel des Schreckens** for 3–10 players, with two selectable themes.

## Themes

The host picks the theme when creating the room and can change it in the lobby or on the end screen.
All players always see the host's theme. Only texts, icons and colors change – the rules are identical.

| | 🎃 Halloween | 🎄 Christmas |
|---|---|---|
| Title | Temple of Horror | Temple of Frost |
| Good team | ⚔️ Adventurers | 🧝 Elves |
| Bad team | 🧙‍♀️ Hexen | ❄️ Frost Witches |
| Treasure | 💰 Gold | 🎁 Present |
| Empty | 🕸️ Empty | 🧦 Empty Stocking |
| Trap | 🔥 Fire Trap | 🧊 Ice Trap |
| Decoration | drifting bats & ghosts | falling snow |

New themes can be added in `client/src/themes.js` (texts/icons) and `client/src/styles/App.css`
(`:root[data-theme="..."]` color block) plus the id in `THEMES` in `server/index.js`.

## Rules

1. **Roles:** Role cards are shuffled and one per player is dealt. For most player counts there is one card more
   than players – it stays hidden, so nobody knows the exact number of Hexen.
2. **Chambers:** Every player gets 5 face-down chamber cards and knows only their own.
3. **Turn:** The key holder opens one chamber of **another** player. That player gets the key.
4. **Round end:** After as many openings as there are players, all unopened cards are shuffled and
   dealt again with one card less (5 → 4 → 3 → 2). The last opened player keeps the key.
5. **Win:**
   - Adventurers: all treasure found
   - Hexen: all traps triggered, or 4 rounds over

| Players | Role cards (Adv./Hexen) | Possible Hexen | Treasure | Empty | Traps |
|---------|------------------------|----------------|----------|-------|-------|
| 3  | 2 / 2 | 1–2 | 5  | 8  | 2 |
| 4  | 3 / 2 | 1–2 | 6  | 12 | 2 |
| 5  | 3 / 2 | 1–2 | 7  | 16 | 2 |
| 6  | 4 / 2 | 1–2 | 8  | 20 | 2 |
| 7  | 5 / 3 | 2–3 | 7  | 26 | 2 |
| 8  | 6 / 3 | 2–3 | 8  | 30 | 2 |
| 9  | 6 / 3 | 3   | 9  | 34 | 2 |
| 10 | 7 / 4 | 3–4 | 10 | 37 | 3 |

## Features

- Server is the single source of truth: each player only receives their own role and own chamber contents
  (no cheating via browser dev tools)
- **Reconnect:** page reload or network loss keeps your seat (session token in the browser)
- If the key holder is offline, the host can open a chamber for them so the game never gets stuck
- Lobby players who disconnect are removed after 30 s, empty rooms are deleted after 15 min
- Live door markers: everybody sees which door each player is hovering (tap on phones), the key holder's door glows
- Reveal and round transition animations, progress tracker, rematch in the same room
- Responsive layout for phones

## Accounts & Statistics (optional)

Players can create an account (Supabase) to track their results. Guests can always play along, they just get no stats.

**Tracked per game:** role, win/loss, chambers opened as key holder (treasure / empty / trap),
how often others opened your chambers. **Shown on the profile:** games, wins, win rate, win rate per role,
current and best streak, hit rate as key holder, fastest win, favorite theme, recent games, leaderboard.

**Setup**

1. Run `server/supabase/schema.sql` once in Supabase (SQL Editor).
2. Client: Supabase URL and publishable key are in `client/src/config.js` (public, safe to commit).
3. Server: set the **secret** key as environment variables – never commit it:
   - locally in `server/.env` (git-ignored):
     ```
     SUPABASE_URL=https://fhewqgwcipvgtdlgquuz.supabase.co
     SUPABASE_SECRET_KEY=sb_secret_...
     ```
   - on Render: *Environment* → add `SUPABASE_URL` and `SUPABASE_SECRET_KEY`

Without the server variables the game runs in guest-only mode (log line: `Accounts disabled`).
Results are only written by the server, so nobody can fake their stats from the browser.

## Quick Start

```bash
# install
cd server && npm install
cd ../client && npm install

# terminal 1
cd server && npm start      # http://localhost:3001

# terminal 2
cd client && npm start      # http://localhost:3000
```

To test with several players locally, open additional **private windows** (each browser profile keeps one session).

## Deploy (e.g. Render)

- Build: `cd server && npm install && cd ../client && npm install && npm run build`
- Start: `cd server && npm start`
- Env: `NODE_ENV=production`

In production the server also serves the React build, so only one service is needed.

## Project Structure

```
server/index.js                  game server (rules, rooms, snapshots, reconnect)
server/accounts.js               Supabase: token check, saving results
server/supabase/schema.sql       database tables, statistics view, security rules
client/src/App.js                connection, session handling, home screen
client/src/themes.js             theme texts/icons + role/chamber tables
client/src/config.js             public Supabase URL / publishable key
client/src/auth/                 login hook, Supabase client, statistics calculation
client/src/components/
  Lobby.js                       waiting room, theme selection (host)
  Game.js                        board, key holder actions, animations
  GameOver.js                    result, roles, rematch
  ChamberReveal.js               reveal animation
  RoundTransition.js             round animation
  ThemePicker.js                 theme toggle
  ThemeDecorations.js            snow / bats background
  AuthPanel.js                   login / registration
  ProfileModal.js                statistics + leaderboard
client/src/styles/App.css        styles, theme colors as CSS variables
```

## Technical Details

React 18 · Node.js 20+ + Express · Socket.io · Supabase (auth + Postgres) · plain CSS

## License

For private, non-commercial use only.

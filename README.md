# 🏛️ Temple of Horror - CORRECT RULES VERSION

A fully functional online multiplayer implementation of **Temple of Horror (Tempel des Schreckens)** with the correct official game rules!

## 🎮 Game Overview

In Temple of Horror, players explore a mysterious temple searching for gold treasures. But beware - some players are secret **Guardians** trying to protect the temple by leading others into fire traps!

### Key Features

✅ **3-10 Players** - Flexible player count with dynamic role distribution
✅ **Hidden Roles** - Adventurers vs Guardians
✅ **Chamber Cards** - Each player has secret chambers containing Gold, Empty rooms, or Fire Traps
✅ **Key Holder Mechanic** - One player chooses which chamber to open each turn
✅ **Progress Tracker** - See exactly how many treasures/traps/empty rooms have been found
✅ **4 Rounds** - Decreasing cards each round (5→4→3→2)
✅ **Multiple Win Conditions** - Find all gold, trigger all traps, or survive 4 rounds

## 🎯 How to Play

### Setup

1. **Roles are Assigned:**
   - Each player gets a secret role (Adventurer or Guardian)
   - Number of Guardians varies by player count (see table below)

2. **Chamber Cards Distributed:**
   - Each player receives 5 face-down chamber cards
   - Chambers contain: Gold 💰, Empty rooms 📭, or Fire Traps 🔥
   - Players know what's in their own chambers (secret!)

3. **First Key Holder Chosen:**
   - One player starts with the key 🗝️

### Gameplay

**Each Turn:**

1. **Key Holder** chooses ANY player (including themselves)
2. **Key Holder** selects which chamber to open
3. **Chamber is revealed** to all players
4. **The player whose chamber was opened** becomes the next Key Holder

**Discussion & Bluffing:**
- Players can (and should!) lie about what's in their chambers
- Adventurers want gold to be found
- Guardians want to waste time or trigger traps
- Trust no one! 🎭

**Round Ends:**
- After opening [player count] chambers, the round ends
- Unrevealed chambers are collected, shuffled, and redistributed
- Each player gets 1 fewer card (Round 1=5, R2=4, R3=3, R4=2)

### Win Conditions

**⚔️ Adventurers Win:**
- All gold is found before the game ends

**🛡️ Guardians Win:**
- All fire traps are triggered, OR
- 4 rounds complete without all gold being found

## 📊 Player & Card Distribution

| Players | Adventurers | Guardians | 💰 Gold | 📭 Empty | 🔥 Traps |
|---------|-------------|-----------|---------|----------|----------|
| 3       | 2           | 2         | 5       | 8        | 2        |
| 4       | 3           | 2         | 6       | 12       | 2        |
| 5       | 3           | 2         | 7       | 16       | 2        |
| 6       | 4           | 2         | 8       | 20       | 2        |
| 7       | 5           | 3         | 7       | 26       | 2        |
| 8       | 6           | 3         | 8       | 30       | 2        |
| 9       | 6           | 3         | 9       | 34       | 2        |
| 10      | 7           | 4         | 10      | 37       | 3        |

## 🚀 Quick Start

### Local Development

1. **Install dependencies:**
   ```bash
   # Server
   cd server
   npm install
   
   # Client (in new terminal)
   cd client
   npm install
   ```

2. **Start the game:**
   ```bash
   # Terminal 1 - Server
   cd server
   npm start
   
   # Terminal 2 - Client
   cd client
   npm start
   ```

3. **Play:**
   - Browser opens automatically at `http://localhost:3000`
   - Create a room and select how many players you want
   - Share the room code with friends
   - Start playing when everyone joins!

### Deploy Online (Free)

**Render (Recommended):**

1. Push code to GitHub
2. Go to https://render.com
3. Create New Web Service
4. Build: `cd server && npm install && cd ../client && npm install && npm run build`
5. Start: `cd server && npm start`
6. Add env: `NODE_ENV=production`
7. Deploy!

See `DEPLOYMENT.md` for detailed instructions.

## 🎨 New Features

### Player Count Selection
- Choose target player count (3-10) when creating a room
- See role distribution before starting
- See how many chambers of each type will be in the game

### Progress Tracker
Real-time progress bars showing:
- 💰 Gold found vs total
- 📭 Empty rooms found vs total
- 🔥 Fire traps found vs total
- Current round (1-4)

### Chamber Interface
- Clear visualization of locked/revealed chambers
- Key holder selects player and chamber
- Other players see their own secret chambers while waiting

## 🎯 Strategy Tips

**For Adventurers:**
- Be honest about gold locations (usually)
- Watch who opens suspicious chambers
- Keep track of revealed information
- Trust players who've shown gold

**For Guardians:**
- Lie about what's in your chambers
- Lead players to empty rooms or traps
- Create confusion and distrust
- Waste time to reach round 4

**For Everyone:**
- The key holder chooses - discuss loudly!
- Remember what chambers have been revealed
- Pay attention to who becomes key holder
- Use voice chat for maximum chaos! 🎙️

## 📁 Project Structure

```
temple-of-horror-correct/
├── server/
│   ├── index.js          # Game server with chamber mechanics
│   └── package.json
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Lobby.js        # Pre-game with player count selection
│   │   │   ├── Game.js         # Main game with chamber selection
│   │   │   └── GameOver.js     # Results screen
│   │   ├── styles/
│   │   │   └── App.css         # Complete styling
│   │   ├── App.js              # Main app component
│   │   └── index.js
│   ├── public/
│   │   └── index.html
│   └── package.json
├── README.md
└── package.json
```

## 🔧 Technical Details

- **Frontend:** React 18
- **Backend:** Node.js + Express
- **Real-time:** Socket.io
- **Styling:** Custom CSS (no frameworks)
- **Players:** 3-10
- **Rounds:** 4 (with decreasing cards)

## 🐛 Troubleshooting

**Can't connect:**
- Make sure both server and client are running
- Check ports 3000 and 3001 are available

**Players can't join:**
- Verify room code is correct (case-sensitive)
- Make sure game hasn't started yet
- Check there are fewer than 10 players

**Game won't start:**
- Need at least 3 players
- Only host (👑) can start

## 🎉 What's Different from the Original Version?

The first version I created was based on "The Resistance/Avalon" mechanics (teams, voting, expeditions). This version has the **correct Temple of Horror rules**:

**OLD (Wrong):**
- ❌ Team-based expeditions
- ❌ Vote on team proposals
- ❌ Play success/sabotage cards
- ❌ 5-8 players only

**NEW (Correct):**
- ✅ Individual chamber cards
- ✅ Key holder selects chambers
- ✅ Direct reveal mechanic
- ✅ 3-10 players
- ✅ 4 rounds with decreasing cards
- ✅ Progress tracker showing discoveries

## 📜 License

For private, non-commercial use only.

---

**Enjoy exploring the Temple! May you find gold... or fall into traps! 🏛️💰🔥**

# Ludo Stars Clone

A clean, modern Ludo game implementation with multiplayer support, inspired by Ludo Stars.

## Features

- **Ludo Star-Style Interface**: Professional mobile game look on desktop
- **4-Player Multiplayer**: Create or join games with friends using a 6-digit room code
- **Individual Player Dice**: Each player has their own visible dice
- **Player Avatars & Names**: All players displayed in corners with avatars
- **Active Player Highlighting**: Golden glow shows whose turn it is
- **Classic Ludo Rules**: 
  - Roll a 6 to bring pieces out of home
  - Capture opponent pieces by landing on them
  - Safe spots protect your pieces
  - First player to get all 4 pieces to the goal wins
- **Beautiful Graphics**: Colorful, modern UI matching Ludo Stars
- **AI Opponents**: Other players are simulated for testing purposes
- **MacBook Optimized**: Perfect sizing for 13" and 15" MacBook screens

## How to Play

### Quick Start
1. Open `index.html` in your web browser
2. Click **"Quick Play"** for instant gameplay with AI opponents
3. Click **"Roll Dice"** or click the dice itself
4. Click on highlighted pieces (golden ring) to move them
5. Roll a **6** to bring pieces out from base

### Multiplayer
1. Choose to **Create Game** or **Join Game**
2. If creating: Share the 6-digit room code with friends
3. If joining: Enter the room code provided by your friend
4. Wait for 4 players to join, then start the game
5. Roll the dice and click on your pieces to move them

### Controls
- **Roll Dice**: Click the "Roll Dice" button OR click the dice directly
- **Move Pieces**: Click on any piece with a golden highlight ring
- **Cursor**: Changes to pointer when hovering over movable pieces

## Game Rules (Ludo Star Style)

- Roll a **6** to enter the board (bring a token from base to starting position)
- Roll the dice and move your tokens according to the number shown
- Landing on an opponent's token sends it back to their base (unless on a safe spot marked with a star)
- Safe spots (stars) prevent capture - multiple tokens can occupy these spaces
- Get all 4 tokens to the home triangle to win
- **Exact roll required** to enter the final home position
- Rolling a 6 gives you another turn

## Technical Details

- Pure HTML5, CSS3, and JavaScript (no dependencies)
- Canvas-based game board rendering
- Simulated multiplayer (can be extended with WebSocket for real multiplayer)
- Responsive and mobile-friendly design

## Running the Game

Simply open `index.html` in any modern web browser. No server or installation required!

For a better experience, you can serve it with a local server:

```bash
# Using Python 3
python3 -m http.server 8000

# Using Node.js (if you have http-server installed)
npx http-server

# Then open http://localhost:8000 in your browser
```

## Future Enhancements

- Real WebSocket-based multiplayer
- Player avatars and customization
- Game statistics and history
- Sound effects and animations
- Mobile app version
# ludo

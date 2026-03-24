# Ludo Game Code Explained - A Complete Guide

## 📚 Table of Contents
1. [Overview - What is this code?](#overview)
2. [Key Concepts You Need to Know](#key-concepts)
3. [Code Section Breakdown](#code-breakdown)
4. [Visual Diagrams](#diagrams)

---

## 🎯 Overview <a name="overview"></a>

This is a **Ludo board game** implemented in JavaScript using the **HTML5 Canvas API**. 

### What is HTML5 Canvas?
The `<canvas>` element is like a digital drawing board in your web browser. You can draw shapes, images, and animations on it using JavaScript.

### No External Libraries!
This code uses **pure JavaScript** - no React, no Phaser, no game engines. Everything is drawn manually using the Canvas API.

### Main Components:
1. **Board** - The 15×15 grid you see
2. **Pieces/Pawns** - The 4 colored tokens per player (16 total)
3. **Dice** - The rolling mechanism
4. **Game Logic** - Rules, movement, captures

---

## 🔑 Key Concepts <a name="key-concepts"></a>

### 1. The Coordinate System

The board is a **15×15 grid**. Think of it like graph paper:

```
     0   1   2   3   4   5   6   7   8   9  10  11  12  13  14  ← X (columns)
   ┌───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┐
 0 │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │
   ├───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┤
 1 │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │
   ├───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┤
...
14 │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │
   └───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┘
↑
Y (rows)
```

- **X** goes from left (0) to right (14)
- **Y** goes from top (0) to bottom (14)
- **Cell (0,0)** is the TOP-LEFT corner
- **Cell (14,14)** is the BOTTOM-RIGHT corner

### 2. Canvas Drawing Basics

```javascript
// Get the drawing context (your "pen")
this.ctx = this.canvas.getContext('2d');

// Draw a rectangle (square tile)
this.ctx.fillStyle = '#E74A3F';  // Set color (red)
this.ctx.fillRect(x, y, width, height);  // Draw filled rectangle

// Draw an outline
this.ctx.strokeStyle = '#444444';  // Set border color
this.ctx.lineWidth = 1;  // Set border thickness
this.ctx.strokeRect(x, y, width, height);  // Draw rectangle outline
```

### 3. Cell Size Calculation

```javascript
this.cellSize = this.canvas.width / this.boardSize;
// If canvas is 700px and board is 15×15:
// cellSize = 700 / 15 = 46.67 pixels per cell
```

To draw a tile at grid position (5, 6):
```javascript
const pixelX = 5 * this.cellSize;  // 5 * 46.67 = 233.33 pixels
const pixelY = 6 * this.cellSize;  // 6 * 46.67 = 280 pixels
this.ctx.fillRect(pixelX, pixelY, this.cellSize, this.cellSize);
```

---

## 📖 Code Section Breakdown <a name="code-breakdown"></a>

### Section 1: Class Setup (Lines 1-55)

```javascript
class LudoGame {
    constructor() {
        // Get the HTML canvas element
        this.canvas = document.getElementById('gameCanvas');
        
        // Get the 2D drawing context (your "pen")
        this.ctx = this.canvas.getContext('2d');
        
        // Game state variables
        this.isHost = false;           // Are you the room creator?
        this.roomCode = null;          // Room code for multiplayer
        this.players = [];             // List of players
        this.currentPlayerIndex = 0;   // Whose turn is it?
        this.diceValue = 1;            // Last dice roll
        this.gameState = 'waiting';    // 'waiting', 'playing', 'ended'
        this.myColor = null;           // Your player color
        
        // Movement state
        this.selectedPiece = null;     // Which piece is selected?
        this.canMove = false;          // Can pieces move right now?
        this.movablePieces = [];       // Which pieces can move?
        
        // Dice mechanics
        this.consecutiveSixes = 0;     // Track sixes for bonus turns
        this.currentRolls = [];        // Current roll options
        this.hasRolled = false;        // Has player rolled yet?
        
        // Turn timer
        this.turnTimer = null;         // Countdown timer
        this.turnTimeRemaining = 30;   // 30 seconds per turn
        
        // Player colors
        this.colors = ['red', 'green', 'yellow', 'blue'];
        this.colorMap = {
            red: '#E74A3F',    // Red hex color
            green: '#1FB85C',  // Green hex color
            yellow: '#E4BB1C', // Yellow hex color
            blue: '#2587D9'    // Blue hex color
        };
        
        // Initialize everything
        this.initializeBoard();      // Set up the board grid
        this.resizeCanvasForDPR();   // Handle high-DPI screens
        this.initializeEventListeners(); // Handle clicks
        this.initializeWebSocket();  // Multiplayer networking
    }
}
```

**What this does:** Sets up all the variables needed for the game. Think of it as preparing your game table before playing.

---

### Section 2: Board Initialization (Lines ~195-320)

```javascript
initializeBoard() {
    // The board is 15×15 grid
    this.boardSize = 15;
    
    // Calculate how big each cell is in pixels
    this.cellSize = this.canvas.width / this.boardSize;
    
    // Define the path each color follows
    this.paths = {
        red: this.generatePath('red'),
        green: this.generatePath('green'),
        yellow: this.generatePath('yellow'),
        blue: this.generatePath('blue')
    };
    
    // Create the 16 pieces (4 per color)
    this.pieces = {
        red: [
            { id: 0, position: -1, inHome: true, inGoal: false, coords: null },
            { id: 1, position: -1, inHome: true, inGoal: false, coords: null },
            { id: 2, position: -1, inHome: true, inGoal: false, coords: null },
            { id: 3, position: -1, inHome: true, inGoal: false, coords: null }
        ],
        // ... same for green, yellow, blue
    };
    
    // Where pieces wait before entering the track (the 4 circles in each corner)
    this.homePositions = {
        blue: [
            { x: 2.25, y: 2.25 },   // Top-left position
            { x: 3.75, y: 2.25 },   // Top-right position
            { x: 2.25, y: 3.75 },   // Bottom-left position
            { x: 3.75, y: 3.75 }    // Bottom-right position
        ],
        // ... same for other colors
    };
}
```

**What this does:** Creates the game board data structure - the paths, pieces, and starting positions.

---

### Section 3: The Path System (Lines ~317-420)

This is the **most important part** for understanding movement!

```javascript
/** 
 * The main loop around the board - 52 cells that ALL pieces follow
 * This goes AROUND the center 3×3 block (the colored triangles)
 */
getMainPathLoop() {
    return [
        { x: 0, y: 7 },  // Cell 0 - blue bridge entry
        { x: 0, y: 6 },  // Cell 1
        { x: 1, y: 6 },  // Cell 2 - BLUE START POSITION
        { x: 2, y: 6 },  // Cell 3
        // ... continues around the board ...
        { x: 8, y: 1 },  // Cell 15 - RED START POSITION
        // ... more cells ...
        { x: 13, y: 8 }, // Cell 28 - GREEN START POSITION
        // ... more cells ...
        { x: 6, y: 13 }, // Cell 41 - YELLOW START POSITION
        // ... continues to end at ...
        { x: 0, y: 8 }   // Cell 51 - last cell before looping
    ];
}

/**
 * Generate a complete path for one color
 * Each color starts at a different point on the main loop
 */
generatePath(color) {
    const mainPath = this.getMainPathLoop();
    
    // Where each color enters the main track
    const startPositions = {
        blue: 2,    // Blue starts at index 2 of mainPath
        red: 15,    // Red starts at index 15
        green: 28,  // Green starts at index 28
        yellow: 41  // Yellow starts at index 41
    };
    
    // Rotate the path so this color's start is first
    const start = startPositions[color];
    const rotatedPath = [
        ...mainPath.slice(start),   // Take cells from start to end
        ...mainPath.slice(0, start) // Then add cells from beginning to start
    ];
    
    // Take 51 cells from the outer track
    // Then add 5 colored home cells leading to the center
    const homePaths = {
        blue: [{ x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }],
        red: [{ x: 7, y: 1 }, { x: 7, y: 2 }, { x: 7, y: 3 }, { x: 7, y: 4 }, { x: 7, y: 5 }],
        green: [{ x: 13, y: 7 }, { x: 12, y: 7 }, { x: 11, y: 7 }, { x: 10, y: 7 }, { x: 9, y: 7 }],
        yellow: [{ x: 7, y: 13 }, { x: 7, y: 12 }, { x: 7, y: 11 }, { x: 7, y: 10 }, { x: 7, y: 9 }]
    };
    
    return [...rotatedPath.slice(0, 51), ...homePaths[color]];
    // Result: 56 positions total (0-55)
    // - Positions 0-50: Outer track (51 cells)
    // - Positions 51-55: Colored home column (5 cells)
}
```

**Visual Path for Blue:**
```
Home Yard → (1,6) START → around board → ... → (0,7) → (1,7) → (2,7) → (3,7) → (4,7) → (5,7) → GOAL!
              ↑                                                              ↑
          Position 0                                                    Position 55
```

---

### Section 4: Drawing the Board (Lines ~680-850)

```javascript
drawBoard() {
    // Clear the entire canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Save current canvas state (before rotation)
    this.ctx.save();
    
    // Rotate the board for player's point of view
    // (so your home is always at the bottom)
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    this.ctx.translate(cx, cy);           // Move origin to center
    this.ctx.rotate(this.povRotationRad); // Rotate
    this.ctx.translate(-cx, -cy);         // Move origin back
    
    // Draw each part of the board
    this.drawHomeAreas();      // The 4 corner colored squares
    this.drawPath();           // The white track cells
    this.drawStartingPositions(); // The colored start cells
    this.drawCenterTriangles(); // The center goal triangles
    this.drawPieces();         // All the pawns
    
    // Restore canvas state (undo rotation)
    this.ctx.restore();
}

/**
 * Draw the white/grey path cells
 */
drawPath() {
    this.pathCellDrawInfo.forEach((info, key) => {
        // Parse the key to get x,y coordinates
        const [xs, ys] = key.split(',');
        const x = Number(xs);
        const y = Number(ys);
        
        // Skip center block (that's triangles, not squares)
        if (this.isCenterBlockCell(x, y)) return;
        
        // Choose color: colored for home columns, grey for neutral track
        const fill = info.kind === 'colored' 
            ? this.colorMap[info.color]  // e.g., '#E74A3F' for red
            : '#ECECEC';                  // Light grey for neutral
        
        // Draw the filled square
        this.ctx.fillStyle = fill;
        this.ctx.fillRect(
            x * this.cellSize,      // Left edge in pixels
            y * this.cellSize,      // Top edge in pixels
            this.cellSize,          // Width in pixels
            this.cellSize           // Height in pixels
        );
        
        // Draw the border
        this.ctx.strokeStyle = '#444444';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(
            x * this.cellSize,
            y * this.cellSize,
            this.cellSize,
            this.cellSize
        );
    });
}

/**
 * Draw the circular pieces/pawns
 */
drawPieces() {
    this.colors.forEach(color => {
        this.pieces[color].forEach((piece, index) => {
            // Get the piece's screen coordinates
            const pos = piece.coords;
            if (!pos) return; // Piece not on board yet
            
            const centerX = pos.x * this.cellSize + this.cellSize / 2;
            const centerY = pos.y * this.cellSize + this.cellSize / 2;
            
            // Draw the piece as a circle
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, this.cellSize * 0.4, 0, Math.PI * 2);
            this.ctx.fillStyle = this.colorMap[color];
            this.ctx.fill();
            
            // Add a white border
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            // Add a shiny highlight
            this.ctx.beginPath();
            this.ctx.arc(centerX - 3, centerY - 3, this.cellSize * 0.15, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            this.ctx.fill();
        });
    });
}
```

**How Drawing Works - Step by Step:**

1. **Clear canvas** - Wipe the drawing board clean
2. **Calculate rotation** - Rotate so your color is at bottom
3. **Draw home areas** - The 4 large colored corners
4. **Draw path** - Each track cell as a square
5. **Draw pieces** - Each pawn as a circle
6. **Restore** - Undo rotation for next frame

---

### Section 5: Piece Movement (Lines ~1000-1300)

```javascript
/**
 * Handle click on the board
 */
handleCanvasClick(e) {
    if (!this.canMove || !this.isHumanLocalTurn()) return;
    
    const { x, y } = this.getCanvasPointFromEvent(e);
    
    // Check if player clicked on a movable piece
    const currentColor = this.players[this.currentPlayerIndex].color;
    const pieces = this.pieces[currentColor];
    
    pieces.forEach((piece, index) => {
        if (!this.movablePieces.includes(index)) return;
        
        // Calculate distance from click to piece
        const dx = x - piece.coords.x;
        const dy = y - piece.coords.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // If clicked on piece (within half a cell)
        if (distance < this.cellSize * 0.4) {
            this.movePiece(currentColor, index);
        }
    });
}

/**
 * Move a piece by the dice value
 */
movePiece(color, pieceIndex) {
    const piece = this.pieces[color][pieceIndex];
    
    if (piece.inHome) {
        // Need a 6 to leave home
        if (this.diceValue === 6) {
            piece.inHome = false;
            piece.position = 0; // Start at first track cell
        }
    } else if (!piece.inGoal) {
        // Move along the path
        piece.position += this.diceValue;
        
        // Check if reached goal
        if (piece.position >= 56) {
            piece.inGoal = true;
            piece.position = 56;
        }
    }
    
    // Update piece's screen coordinates
    this.updatePieceCoords(color, pieceIndex);
    
    // Check for captures (landing on opponent)
    this.checkCaptures(color, pieceIndex);
}

/**
 * Convert piece position to screen coordinates
 */
updatePieceCoords(color, pieceIndex) {
    const piece = this.pieces[color][pieceIndex];
    
    if (piece.inHome) {
        // Use the home yard positions (the 4 circles)
        piece.coords = this.homePositions[color][piece.id];
    } else if (piece.inGoal) {
        // Center triangle - special positioning
        piece.coords = this.getGoalCoords(color, piece.id);
    } else {
        // On the track - use the path
        const path = this.paths[color];
        const cell = path[piece.position];
        piece.coords = { x: cell.x, y: cell.y };
    }
}
```

**Movement Flow:**
```
Player clicks dice → Roll → Get value → Check movable pieces → 
Player clicks piece → movePiece() → Update position → 
updatePieceCoords() → Redraw board
```

---

### Section 6: Highlighting Movable Pieces (Lines ~700-750)

```javascript
/**
 * Draw glow/highlight around pieces that can move
 */
drawPieceHighlights() {
    const currentColor = this.players[this.currentPlayerIndex].color;
    const pieces = this.pieces[currentColor];
    
    this.movablePieces.forEach(index => {
        const piece = pieces[index];
        if (!piece.coords) return;
        
        const centerX = piece.coords.x * this.cellSize + this.cellSize / 2;
        const centerY = piece.coords.y * this.cellSize + this.cellSize / 2;
        
        // Draw a glowing ring around the piece
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, this.cellSize * 0.5, 0, Math.PI * 2);
        this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)'; // Yellow glow
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
    });
}
```

**When pieces get highlighted:**
1. Player rolls dice
2. Game calculates which pieces can move that many steps
3. Those piece indices go into `this.movablePieces` array
4. `drawPieceHighlights()` draws yellow rings around them

---

### Section 7: Dice Rolling (Lines ~1100-1200)

```javascript
async rollDice() {
    if (this.hasRolled) return;
    
    // Request dice roll from backend (for true randomness)
    const response = await fetch(`${this.backendBaseUrl}/roll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            roomCode: this.roomCode,
            entropy: this._lastDiceEntropyMetaForBackend // Mouse movement data
        })
    });
    
    const data = await response.json();
    this.diceValue = data.value;
    this.hasRolled = true;
    
    // Calculate which pieces can move
    this.calculateMovablePieces();
    
    // Redraw to show dice result and highlights
    this.drawBoard();
}
```

---

## 🎨 Visual Diagrams <a name="diagrams"></a>

### Complete Board Layout

```
                    RED HOME (top)
                        ┌───┐
                        │ ▲ │
                    ┌───┼───┼───┐
                    │ ▲ │ ▲ │ ▲ │
                ┌───┼───┼───┼───┼───┐
                │ ▲ │ ▲ │ ▲ │ ▲ │ ▲ │
            ┌───┼───┼───┼───┼───┼───┼───┐
            │   │   │   │ R │   │   │   │
        ┌───┼───┼───┼───┼───┼───┼───┼───┼───┐
        │ B │   │   │   │ R │   │   │   │ R │
    ┌───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┐
    │   │ B │ ● │ ● │ R │ R │ R │   │   │   │   │
┌───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┐
│   │   │ ● │ ● │ R │ R │★│ R │ R │   │   │ G │ G │
├───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┤
│   │   │ ● │ ● │ R │ R │ R │ R │ R │   │   │ G │ G │
└───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┘
    │   │   │   │ Y │ Y │ Y │ Y │ Y │   │   │ G │
    └───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┘
        │   │   │   │ Y │   │   │   │ G │
        └───┼───┼───┼───┼───┼───┼───┘
            │   │   │ G │   │   │
            └───┼───┼───┼───┘
                │ G │ G │
                └───┴───┘
                    │ │
                  GREEN HOME (right)

Legend:
★ = Start position for each color
● = Home yard positions (where pieces wait)
R/Y/G/B = Colored home column cells
```

### Piece Position States

```
┌─────────────────────────────────────────────────────┐
│  inHome: true   → Piece in corner (not on track)   │
│  position: -1                                       │
│  coords: null                                       │
├─────────────────────────────────────────────────────┤
│  inHome: false  → Piece on the track               │
│  position: 0-50 → Which track cell                 │
│  coords: {x, y} → Screen position                  │
├─────────────────────────────────────────────────────┤
│  inGoal: true   → Piece finished in center         │
│  position: 56                                       │
│  coords: {x, y} → Center triangle position         │
└─────────────────────────────────────────────────────┘
```

---

## 🔍 Quick Reference: Key Functions

| Function | What it does | Line Range |
|----------|--------------|------------|
| `constructor()` | Sets up all game variables | 1-55 |
| `initializeBoard()` | Creates board data structure | 195-320 |
| `getMainPathLoop()` | Returns 52-cell outer track | 317-375 |
| `generatePath(color)` | Creates full path for one color | 377-415 |
| `drawBoard()` | Draws entire board | 680-700 |
| `drawPath()` | Draws track cells | 750-780 |
| `drawPieces()` | Draws all pawns | 850-890 |
| `handleCanvasClick()` | Handles player clicks | 550-590 |
| `movePiece()` | Moves a piece | 1000-1030 |
| `updatePieceCoords()` | Updates piece screen position | 1050-1080 |
| `rollDice()` | Rolls the dice | 1100-1130 |

---

## 🎮 How A Turn Works (Step by Step)

```
1. Player's turn starts
   ↓
2. Player clicks dice (or spacebar)
   ↓
3. rollDice() called → fetches random value from backend
   ↓
4. calculateMovablePieces() checks which pieces can move
   ↓
5. drawBoard() redraws everything:
   - Shows dice value
   - Highlights movable pieces with yellow glow
   ↓
6. Player clicks on a highlighted piece
   ↓
7. handleCanvasClick() detects the click
   ↓
8. movePiece() updates piece position
   ↓
9. updatePieceCoords() calculates new screen position
   ↓
10. checkCaptures() sees if opponent was landed on
    ↓
11. drawBoard() shows the moved piece
    ↓
12. Check if turn continues (rolled 6) or ends
    ↓
13. Next player's turn
```

---

## 💡 Tips for Understanding the Code

1. **Start with `drawBoard()`** - This shows you everything that gets drawn
2. **Trace one piece** - Follow a single piece from home to goal
3. **Use console.log()** - Add logs to see values change:
   ```javascript
   console.log('Piece position:', piece.position);
   console.log('Piece coords:', piece.coords);
   ```
4. **Watch the coordinates** - Grid coords (0-14) vs pixel coords (0-700)
5. **Understand the path** - Once you get the path system, everything clicks!

---

## 📝 Common Questions

**Q: Why are there 56 positions but only 52 cells in the main loop?**
- A: 51 outer track cells + 5 colored home cells = 56 total positions

**Q: How does the board rotation work?**
- A: Canvas `rotate()` spins the entire drawing around the center point

**Q: What does `cellSize` do?**
- A: Converts grid coordinates (5, 6) to pixel coordinates (233, 280)

**Q: How do pieces know where to go?**
- A: Each color has its own `path` array. Position 0 = first cell, position 55 = goal

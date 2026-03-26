// ============================================================================
// LUDO GAME - COMPLETELY COMMENTED FOR LEARNING
// ============================================================================
// This is a full Ludo board game implementation using HTML5 Canvas
// No external game libraries - pure JavaScript!
//
// Key concepts:
// - Canvas API: Used to draw shapes (rectangles, circles, triangles)
// - Grid system: 15x15 board where each cell has (x, y) coordinates
// - Game loop: Draw board → Wait for input → Update state → Redraw
// ============================================================================

/**
 * LudoGame - Main game class that contains ALL game logic
 * 
 * Think of this as the "game engine" that manages everything:
 * - Board drawing and rendering
 * - Piece movement and rules
 * - Player turns and dice rolling
 * - Multiplayer networking (optional)
 * - User interface updates
 * 
 * The class follows a state-machine pattern where the game transitions
 * between states like 'waiting', 'playing', and 'ended'.
 */
class LudoGame {
    /**
     * CONSTRUCTOR - Initialization hub
     * 
     * This runs automatically when you create `new LudoGame()`.
     * It sets up ALL variables and initializes the game systems.
     */
    constructor() {
        // === CANVAS SETUP ===
        // Get the HTML <canvas> element where we'll draw the game
        this.canvas = document.getElementById('gameCanvas');

        // Get the 2D drawing context - this is your "pen" for drawing
        // All drawing happens through this.ctx (e.g., this.ctx.fillRect())
        this.ctx = this.canvas.getContext('2d');

        // === DEBUG MODE FOR RANDOMNESS TESTING ===
        this.debugMode = {
            enabled: true,  // Set to true to see all dice rolls
            showAllRolls: true,
            logAllActions: true
        };

        console.log('🎮 Ludo Game v2.0 - DEBUG MODE ENABLED - All dice clickable for testing!');

        // === MULTIPLAYER/ROOM VARIABLES ===
        this.isHost = false;           // Are you the room creator? (true/false)
        this.roomCode = null;          // 6-letter code for friends to join (e.g., "ABC123")
        this.players = [];             // Array of all players in the game
        this.currentPlayerIndex = 0;   // Which player's turn? (0=first, 1=second, etc.)

        // === GAME STATE ===
        this.diceValue = 1;            // Last dice roll (1-6)
        this.gameState = 'waiting';    // Current state: 'waiting', 'playing', 'ended'
        this.myColor = null;           // YOUR player color ('red', 'green', 'yellow', or 'blue')
        this.isRolling = false;        // Flag to prevent multiple simultaneous rolls

        // === PIECE SELECTION & MOVEMENT ===
        this.selectedPiece = null;     // Which piece is currently selected?
        this.canMove = false;          // Can pieces move right now? (true after rolling dice)
        this.movablePieces = [];       // Array of piece indices that can move (e.g., [0, 2])

        // === DICE MECHANICS ===
        this.consecutiveSixes = 0;     // How many 6s rolled in a row (3 sixes = turn lost)
        this.currentRolls = [];        // Current roll options (for special dice mechanics)
        this.hasRolled = false;        // Has player rolled dice this turn?
        this.selectedRoll = null;      // Which roll option was selected
        this.pieceCaptured = false;    // Was a piece captured this turn?
        this.rollsRemaining = 1;       // How many rolls left (bonus rolls from 6s or captures)
        this.lastMoveRoll = null;      // What roll was used for last move
        this._lastRollFromBackend = false; // Did last roll come from server?

        // === TURN TIMER ===
        this.turnTimer = null;         // Countdown timer ID
        this.turnTimeRemaining = 30;   // 30 seconds per turn

        // === BOARD ROTATION (Point of View) ===
        // Rotates board so YOUR color is always at the bottom
        this.povRotationRad = 0;       // Rotation angle in radians (0 = no rotation)

        // === PLAYER COLORS ===
        this.colors = ['red', 'green', 'yellow', 'blue'];  // 4 player colors in clockwise order

        // Hex color codes for drawing - these are the actual colors used
        this.colorMap = {
            red: '#E74A3F',    // Bright red
            green: '#1FB85C',  // Green
            yellow: '#E4BB1C', // Yellow/Gold
            blue: '#2587D9'    // Blue
        };

        // === BACKEND SERVER FOR DICE ROLLS ===
        // This connects to a local server for true random dice rolls
        // Using port 5179 for dice rolls
        this.backendBaseUrl = 'http://localhost:5179';

        // === INITIALIZE THE GAME ===
        this.initializeBoard();      // Create the 15x15 grid and paths
        this.resizeCanvasForDPR();   // Make canvas sharp on high-DPI screens
        this.initializeEventListeners(); // Handle mouse clicks and keyboard
        this.initializeWebSocket();  // Connect to multiplayer server
    }

    /**
     * getCanvasPointFromEvent - Convert mouse click to canvas coordinates
     * 
     * When you click on the canvas, the browser gives coordinates in "CSS pixels"
     * But our canvas might be scaled, so we need to convert to actual canvas pixels
     * 
     * @param {MouseEvent} e - The click event from the mouse
     * @returns {Object} Object with x, y coordinates in canvas space
     */
    getCanvasPointFromEvent(e) {
        // Get the canvas element's position and size on screen
        const rect = this.canvas.getBoundingClientRect();

        // Calculate scale factors - how many canvas pixels per CSS pixel
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        // Get click position relative to canvas, then scale to canvas coordinates
        let x = (e.clientX - rect.left) * scaleX;
        let y = (e.clientY - rect.top) * scaleY;

        // If game is playing and board is rotated for POV...
        if (this.gameState === 'playing' && this.povRotationRad) {
            // Get center of canvas (rotation pivot point)
            const cx = this.canvas.width / 2;
            const cy = this.canvas.height / 2;

            // Calculate distance from center
            const dx = x - cx;
            const dy = y - cy;

            // Rotate the coordinates BACK to match the rotated board
            const cos = Math.cos(-this.povRotationRad);
            const sin = Math.sin(-this.povRotationRad);

            // Apply rotation transformation
            x = dx * cos - dy * sin + cx;
            y = dx * sin + dy * cos + cy;
        }

        return { x, y, rect, scaleX, scaleY };
    }

    /**
     * getPovRotationRad - Get board rotation angle for player's point of view
     * 
     * The board rotates so YOUR color's home area is at the BOTTOM of screen
     * 
     * @returns {number} Rotation angle in radians
     */
    getPovRotationRad() {
        if (!this.myColor) return 0;

        const rotations = {
            blue: -Math.PI / 2,   // Blue at top-left: rotate 90° CCW
            red: Math.PI,          // Red at top-right: rotate 180°
            yellow: 0,             // Yellow at bottom-left: no rotation needed
            green: Math.PI / 2     // Green at bottom-right: rotate 90° CW
        };

        return rotations[this.myColor] || 0;
    }

    /**
     * syncBoardWrapperTilt - Sync board wrapper tilt (DISABLED)
     * 
     * This would tilt the board visually for 3D effect, but it's disabled
     */
    syncBoardWrapperTilt() {
        const wrap = document.querySelector('.board-wrapper');
        if (!wrap) return;
        wrap.classList.remove('board-pov-tilt');
    }

    /**
     * isHumanLocalTurn - Check if it's the human player's turn
     * 
     * Returns true only if:
     * 1. Game is in 'playing' state
     * 2. Current player's color matches YOUR color
     * 
     * @returns {boolean} True if it's your turn and you can move
     */
    isHumanLocalTurn() {
        const p = this.players[this.currentPlayerIndex];
        return !!(this.gameState === 'playing' && p && p.color === this.myColor);
    }

    /**
     * isCenterBlockCell - Check if a cell is in the center 3x3 block
     * 
     * The center (coordinates 6-8) is special - drawn as triangles, not squares
     * 
     * @param {number} x - X coordinate (0-14)
     * @param {number} y - Y coordinate (0-14)
     * @returns {boolean} True if cell is in center 3x3 block
     */
    isCenterBlockCell(x, y) {
        return x >= 6 && x <= 8 && y >= 6 && y <= 8;
    }

    /**
     * resizeCanvasForDPR - Resize canvas for high-DPI (Retina) displays
     * 
     * Modern screens have more physical pixels than CSS pixels.
     * This function makes the canvas sharp on these displays.
     */
    resizeCanvasForDPR() {
        if (typeof window === 'undefined') return;
        if (!this.canvas || !this.ctx) return;
        if (!this.boardSize) return;

        const rect = this.canvas.getBoundingClientRect();
        // For desktop, use a larger minimum size to accommodate the bigger board
        const displaySize = Math.min(rect.width, rect.height, window.innerHeight * 0.85);
        if (!displaySize || displaySize <= 0) return;

        const dpr = Number(window.devicePixelRatio || 1);
        const nextW = Math.round(displaySize * dpr);
        const nextH = Math.round(displaySize * dpr);

        if (this.canvas.width !== nextW || this.canvas.height !== nextH) {
            this.canvas.width = nextW;
            this.canvas.height = nextH;
        }

        // Recalculate cell size - CRUCIAL for all drawing
        this.cellSize = this.canvas.width / this.boardSize;

        // Redraw the board
        if (this.gameState === 'playing') this.drawBoard();
    }

    /**
     * addEntropySample - Add entropy sample for random dice rolls
     * 
     * Entropy = randomness from mouse movements for truly random dice
     * 
     * @param {Object} sample - Data about mouse movement
     */
    addEntropySample(sample) {
        if (!window.ludoEntropyPool) return;
        window.ludoEntropyPool.addSample(sample);
    }

    /**
     * getUiIdsForColor - Get HTML element IDs for a player color
     * 
     * Each player has UI elements with IDs like: nameRed, diceRed, etc.
     * 
     * @param {string} color - Player color ('red', 'green', 'yellow', 'blue')
     * @returns {Object} Object with all the UI element IDs for this color
     */
    getUiIdsForColor(color) {
        const cap = color.charAt(0).toUpperCase() + color.slice(1);
        return {
            nameId: `name${cap}`,
            diceId: `dice${cap}`,
            rollsId: `rolls${cap}`,
            timerId: `timer${cap}`,
            avatarId: `avatar${cap}`
        };
    }

    /**
     * syncSelfHud - Sync self HUD (Heads-Up Display)
     * 
     * Currently empty - HUD is color-based (no separate "self" slot)
     */
    syncSelfHud() {
        // No-op: HUD is color-based
    }

    /**
     * addEntropyFromPointerEvent - Collect entropy from mouse/pointer events
     * 
     * Gathers randomness data: position, time, pressure, velocity
     * 
     * @param {PointerEvent} e - The pointer event
     * @param {HTMLElement} targetEl - The element that was clicked
     */
    addEntropyFromPointerEvent(e, targetEl) {
        if (!window.ludoEntropyPool) return;

        const rect = targetEl.getBoundingClientRect();
        const isCanvas = targetEl === this.canvas;
        const scaleX = isCanvas ? (this.canvas.width / rect.width) : 1;
        const scaleY = isCanvas ? (this.canvas.height / rect.height) : 1;

        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        const t = (typeof performance !== "undefined" ? performance.now() : Date.now());
        const pressure = typeof e.pressure === 'number' && Number.isFinite(e.pressure) ? e.pressure : 0;

        // Calculate velocity
        const pointerKey = typeof e.pointerId === 'number' ? `p${e.pointerId}` : 'mouse';
        this._lastEntropyPointers = this._lastEntropyPointers || new Map();
        const last = this._lastEntropyPointers.get(pointerKey);

        let vx = 0;
        let vy = 0;

        if (last && typeof last.t === 'number') {
            const dt = Math.max(0.001, (t - last.t) / 1000);
            vx = (x - last.x) / dt;
            vy = (y - last.y) / dt;
        }

        this._lastEntropyPointers.set(pointerKey, { x, y, t });
        window.ludoEntropyPool.addSample({ x, y, t, pressure, vx, vy });
    }

    /**
     * initializeBoard - Initialize the game board (MOST IMPORTANT FUNCTION)
     * 
     * Creates:
     * 1. The 15x15 grid
     * 2. The path each color follows
     * 3. The 16 pieces (4 per color)
     * 4. The home positions
     * 5. All drawing information
     */
    initializeBoard() {
        // === BOARD DIMENSIONS ===
        this.boardSize = 15;  // 15x15 grid

        if (!this.canvas.width || !this.canvas.height) {
            this.canvas.width = 900;
            this.canvas.height = 900;
        }

        // Calculate cell size in pixels
        this.cellSize = this.canvas.width / this.boardSize;

        // === DICE FOR EACH PLAYER ===
        this.playerDice = {
            red: 1,
            green: 1,
            yellow: 1,
            blue: 1
        };

        // === HOME BRIDGE ENTRY POINTS ===
        // Where each color enters the main track from their home
        this.homeBridges = {
            blue: { x: 0, y: 7 },
            red: { x: 7, y: 0 },
            green: { x: 14, y: 7 },
            yellow: { x: 7, y: 14 }
        };

        // === GENERATE PATHS FOR EACH COLOR ===
        this.paths = {
            red: this.generatePath('red'),
            green: this.generatePath('green'),
            yellow: this.generatePath('yellow'),
            blue: this.generatePath('blue')
        };

        // === CREATE MAIN PATH INDEX MAP ===
        // Maps grid coordinates (x,y) to position index (0-55)
        this.mainPathCoordToIndex = new Map();
        this.getMainPathLoop().forEach((c, i) => {
            this.mainPathCoordToIndex.set(`${c.x},${c.y}`, i);
        });

        // === CREATE MAIN TRACK CELL SET ===
        this.mainTrackCellSet = new Set();
        this.paths.red.slice(0, 51).forEach((c) => {
            this.mainTrackCellSet.add(`${c.x},${c.y}`);
        });

        // === CREATE PATH CELL DRAWING INFO ===
        this.pathCellDrawInfo = new Map();

        // Add all main path cells as neutral (light grey)
        this.getMainPathLoop().forEach((c) => {
            if (!this.isCenterBlockCell(c.x, c.y)) {
                this.pathCellDrawInfo.set(`${c.x},${c.y}`, { kind: 'neutral' });
            }
        });

        // Add colored home column cells for each player
        this.colors.forEach((color) => {
            const path = this.paths[color];
            for (let i = 51; i < path.length; i++) {
                const c = path[i];
                const k = `${c.x},${c.y}`;
                if (!this.isCenterBlockCell(c.x, c.y)) {
                    this.pathCellDrawInfo.set(k, { kind: 'colored', color });
                }
            }
        });

        // === CREATE THE 16 PIECES ===
        // Each player has 4 pieces, all starting in home
        // Position -1 means "not on track yet"
        this.pieces = {
            red: [
                { id: 0, position: -1, inHome: true, inGoal: false, coords: null },
                { id: 1, position: -1, inHome: true, inGoal: false, coords: null },
                { id: 2, position: -1, inHome: true, inGoal: false, coords: null },
                { id: 3, position: -1, inHome: true, inGoal: false, coords: null }
            ],
            green: [
                { id: 0, position: -1, inHome: true, inGoal: false, coords: null },
                { id: 1, position: -1, inHome: true, inGoal: false, coords: null },
                { id: 2, position: -1, inHome: true, inGoal: false, coords: null },
                { id: 3, position: -1, inHome: true, inGoal: false, coords: null }
            ],
            yellow: [
                { id: 0, position: -1, inHome: true, inGoal: false, coords: null },
                { id: 1, position: -1, inHome: true, inGoal: false, coords: null },
                { id: 2, position: -1, inHome: true, inGoal: false, coords: null },
                { id: 3, position: -1, inHome: true, inGoal: false, coords: null }
            ],
            blue: [
                { id: 0, position: -1, inHome: true, inGoal: false, coords: null },
                { id: 1, position: -1, inHome: true, inGoal: false, coords: null },
                { id: 2, position: -1, inHome: true, inGoal: false, coords: null },
                { id: 3, position: -1, inHome: true, inGoal: false, coords: null }
            ]
        };

        // === HOME YARD POSITIONS ===
        // The 4 circles in each corner where pieces wait
        this.homePositions = {
            blue: [
                { x: 2.25, y: 2.25 },
                { x: 3.75, y: 2.25 },
                { x: 2.25, y: 3.75 },
                { x: 3.75, y: 3.75 }
            ],
            red: [
                { x: 10.25, y: 2.25 },
                { x: 11.75, y: 2.25 },
                { x: 10.25, y: 3.75 },
                { x: 11.75, y: 3.75 }
            ],
            yellow: [
                { x: 2.25, y: 10.25 },
                { x: 3.75, y: 10.25 },
                { x: 2.25, y: 11.75 },
                { x: 3.75, y: 11.75 }
            ],
            green: [
                { x: 10.25, y: 10.25 },
                { x: 11.75, y: 10.25 },
                { x: 10.25, y: 11.75 },
                { x: 11.75, y: 11.75 }
            ]
        };
    }

    /**
     * getMainPathLoop - Get the shared 52-cell outer loop
     * 
     * This path goes AROUND the center 3x3 block, not through it.
     * All colors share this path, starting at different points.
     * 
     * @returns {Array} Array of {x, y} coordinate objects
     */
    getMainPathLoop() {
        return [
            { x: 0, y: 7 },  // 0 - Blue bridge entry
            { x: 0, y: 6 },  // 1
            { x: 1, y: 6 },  // 2 - BLUE START
            { x: 2, y: 6 },  // 3
            { x: 3, y: 6 },  // 4
            { x: 4, y: 6 },  // 5
            { x: 5, y: 6 },  // 6
            { x: 6, y: 5 },  // 7 - Turn up
            { x: 6, y: 4 },  // 8
            { x: 6, y: 3 },  // 9
            { x: 6, y: 2 },  // 10
            { x: 6, y: 1 },  // 11
            { x: 6, y: 0 },  // 12
            { x: 7, y: 0 },  // 13 - Turn right
            { x: 8, y: 0 },  // 14
            { x: 8, y: 1 },  // 15 - RED START
            { x: 8, y: 2 },  // 16
            { x: 8, y: 3 },  // 17
            { x: 8, y: 4 },  // 18
            { x: 8, y: 5 },  // 19
            { x: 9, y: 6 },  // 20 - Turn down
            { x: 10, y: 6 }, // 21
            { x: 11, y: 6 }, // 22
            { x: 12, y: 6 }, // 23
            { x: 13, y: 6 }, // 24
            { x: 14, y: 6 }, // 25
            { x: 14, y: 7 }, // 26 - Green bridge
            { x: 14, y: 8 }, // 27
            { x: 13, y: 8 }, // 28 - GREEN START
            { x: 12, y: 8 }, // 29
            { x: 11, y: 8 }, // 30
            { x: 10, y: 8 }, // 31
            { x: 9, y: 8 },  // 32
            { x: 8, y: 9 },  // 33 - Turn left
            { x: 8, y: 10 }, // 34
            { x: 8, y: 11 }, // 35
            { x: 8, y: 12 }, // 36
            { x: 8, y: 13 }, // 37
            { x: 8, y: 14 }, // 38
            { x: 7, y: 14 }, // 39 - Turn up
            { x: 6, y: 14 }, // 40
            { x: 6, y: 13 }, // 41 - YELLOW START
            { x: 6, y: 12 }, // 42
            { x: 6, y: 11 }, // 43
            { x: 6, y: 10 }, // 44
            { x: 6, y: 9 },  // 45
            { x: 5, y: 8 },  // 46 - Turn left
            { x: 4, y: 8 },  // 47
            { x: 3, y: 8 },  // 48
            { x: 2, y: 8 },  // 49
            { x: 1, y: 8 },  // 50
            { x: 0, y: 8 }   // 51
        ];
    }

    /**
     * generatePath - Generate the complete path for a specific color
     * 
     * Path indexing:
     * - Indices 0-50: Outer loop cells (51 cells)
     * - Indices 51-55: Colored home column (5 cells)
     * - Position 56: Goal (center triangle)
     * 
     * @param {string} color - Player color
     * @returns {Array} Complete path for this color (56 cells)
     */
    generatePath(color) {
        const mainPath = this.getMainPathLoop();

        // Home column paths for each color (5 cells leading to goal)
        const homePaths = {
            blue: [{ x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }],
            red: [{ x: 7, y: 1 }, { x: 7, y: 2 }, { x: 7, y: 3 }, { x: 7, y: 4 }, { x: 7, y: 5 }],
            green: [{ x: 13, y: 7 }, { x: 12, y: 7 }, { x: 11, y: 7 }, { x: 10, y: 7 }, { x: 9, y: 7 }],
            yellow: [{ x: 7, y: 13 }, { x: 7, y: 12 }, { x: 7, y: 11 }, { x: 7, y: 10 }, { x: 7, y: 9 }]
        };

        // Starting positions on the main path for each color
        const startPositions = {
            blue: 2,
            red: 15,
            green: 28,
            yellow: 41
        };

        const start = startPositions[color];
        const rotatedPath = [...mainPath.slice(start), ...mainPath.slice(0, start)];
        
        // Take 51 cells from outer track, then add 5 home cells
        return [...rotatedPath.slice(0, 51), ...homePaths[color]];
    }

    /**
     * initializeEventListeners - Set up user interaction handlers
     * 
     * Connects the game to:
     * 1. Menu buttons
     * 2. Canvas interactions (clicks, pointer events)
     * 3. Window resize
     */
    initializeEventListeners() {
        // Menu button listeners
        // document.getElementById('quickPlayBtn').addEventListener('click', () => this.quickPlay());
        document.getElementById('createGameBtn').addEventListener('click', () => this.createGame());
        document.getElementById('joinGameBtn').addEventListener('click', () => this.showJoinScreen());
        document.getElementById('joinSubmitBtn').addEventListener('click', () => this.joinGame());
        document.getElementById('backToMenuBtn').addEventListener('click', () => this.backToMenu());
        document.getElementById('backFromJoinBtn').addEventListener('click', () => this.showMenuScreen());
        document.getElementById('startGameBtn').addEventListener('click', () => this.startGame());
        document.getElementById('exitGameBtn').addEventListener('click', () => this.exitGame());
        document.getElementById('copyCodeBtn').addEventListener('click', () => this.copyRoomCode());

        // Canvas pointer events for entropy collection
        this.canvas.addEventListener('pointerdown', (e) => {
            this.addEntropyFromPointerEvent(e, this.canvas);
        });
        this.canvas.addEventListener('pointermove', (e) => {
            if (e.buttons) this.addEntropyFromPointerEvent(e, this.canvas);
        });
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleCanvasHover(e));

        // Window resize handler (debounced via rAF)
        let resizeRaf = 0;
        window.addEventListener('resize', () => {
            if (resizeRaf) cancelAnimationFrame(resizeRaf);
            resizeRaf = requestAnimationFrame(() => this.resizeCanvasForDPR());
        });
    }

    /**
     * setupDiceEventListeners - Attach click handlers to dice elements
     * 
     * Each player's dice can be clicked to roll (only during their turn)
     */
    setupDiceEventListeners() {
        // Clear existing event listeners first to prevent multiple rolls
        ['red', 'green', 'yellow', 'blue'].forEach((color) => {
            const { diceId } = this.getUiIdsForColor(color);
            let diceEl = document.getElementById(diceId);
            if (!diceEl) return;

            // Clone the element to remove all event listeners
            const newDiceEl = diceEl.cloneNode(true);
            diceEl.parentNode.replaceChild(newDiceEl, diceEl);
            diceEl = newDiceEl;   // update reference
        });

        // Now add fresh event listeners
        ['red', 'green', 'yellow', 'blue'].forEach((color) => {
            const { diceId } = this.getUiIdsForColor(color);
            const diceEl = document.getElementById(diceId);
            if (!diceEl) return;

            diceEl.addEventListener('pointerdown', (e) => {
                this.addEntropyFromPointerEvent(e, diceEl);
                const rect = diceEl.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const tDown = performance.now();
                const pressure = typeof e.pressure === 'number' && Number.isFinite(e.pressure) ? e.pressure : 0;
                const key = typeof e.pointerId === 'number' ? `p${e.pointerId}` : 'mouse';
                this._dicePressInfo = this._dicePressInfo || {};
                this._dicePressInfo[key] = { x, y, tDown, pressure };
            });

            diceEl.addEventListener('click', (e) => {
                const rect = diceEl.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const tNow = performance.now();
                const pressure = typeof e.pressure === 'number' && Number.isFinite(e.pressure) ? e.pressure : 0;

                const key = typeof e.pointerId === 'number' ? `p${e.pointerId}` : 'mouse';
                const info = this._dicePressInfo && this._dicePressInfo[key];
                const durationMs = info && typeof info.tDown === 'number' ? Math.max(0, tNow - info.tDown) : 0;
                const turnElapsedMs = typeof this.turnStartAt === 'number' ? Math.max(0, tNow - this.turnStartAt) : 0;
                const dtSeconds = Math.max(0.001, durationMs / 1000);
                const vx = info ? (x - info.x) / dtSeconds : 0;
                const vy = info ? (y - info.y) / dtSeconds : 0;

                this.addEntropySample({
                    x, y, t: tNow,
                    pressure: info ? info.pressure : pressure,
                    vx, vy,
                    duration: durationMs,
                    turnElapsedMs
                });

                this._lastDiceEntropyMetaForBackend = {
                    timeMs: tNow,
                    pressure: info ? info.pressure : pressure,
                    vx, vy,
                    durationMs,
                    turnElapsedMs,
                    x, y
                };

                // Allow clicking any dice for randomness testing in debug mode
                // In normal mode, only allow current player's dice
                const isDebugMode = this.debugMode && this.debugMode.enabled;
                const currentColor = this.players[this.currentPlayerIndex]?.color;
                
                if (isDebugMode || color === currentColor) {
                    this.rollDice(color);
                } else {
                    console.log(`Not ${color}'s turn. Current turn: ${currentColor}. Enable debug mode to test all dice.`);
                }
            });
        });
    }

    /**
     * handleCanvasHover - Handle mouse hover over canvas
     * 
     * Changes cursor to pointer when hovering over movable pieces
     */
    handleCanvasHover(e) {
        if (!this.canMove) {
            this.canvas.style.cursor = 'default';
            return;
        }

        const { x, y } = this.getCanvasPointFromEvent(e);
        const currentColor = this.players[this.currentPlayerIndex].color;
        
        // For multiplayer, allow any human player to see hover effects
        const isMultiplayerMode = this.players.length > 1;
        if (!isMultiplayerMode && currentColor !== this.myColor) {
            this.canvas.style.cursor = 'default';
            return;
        }

        const pieces = this.pieces[currentColor];

        let hovering = false;
        pieces.forEach((piece, index) => {
            if (piece.coords && this.movablePieces && this.movablePieces.includes(index)) {
                const dx = x - piece.coords.x;
                const dy = y - piece.coords.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < this.cellSize * 0.4) {
                    hovering = true;
                }
            }
        });

        this.canvas.style.cursor = hovering ? 'pointer' : 'default';
    }

    /**
     * initializeWebSocket - Initialize WebSocket connection
     * 
     * Currently uses mock connection for local play
     */
    initializeWebSocket() {
        // Replace with your actual WebSocket server URL
        this.ws = new WebSocket('ws://localhost:8081');
        this.isConnected = false;

        this.ws.onopen = () => {
            console.log('Connected to game server');
            this.isConnected = true;
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleServerMessage(data);
        };

        this.ws.onclose = () => {
            console.log('Disconnected from game server');
            this.isConnected = false;
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.isConnected = false;
        };
    }

    handleServerMessage(data) {
        console.log('Received server message:', data);
        
        switch (data.type) {
            case 'gameCreated':
                this.handleGameCreated(data);
                break;
            case 'gameJoined':
                this.handleGameJoined(data);
                break;
            case 'playerJoined':
                this.handlePlayerJoined(data);
                break;
            case 'playerLeft':
                this.handlePlayerLeft(data);
                break;
            case 'gameStarted':
                this.handleGameStarted(data);
                break;
            case 'diceRolled':
                this.handleDiceRolled(data);
                break;
            case 'pieceMoved':
                this.handlePieceMoved(data);
                break;
            case 'turnChanged':
                this.handleTurnChanged(data);
                break;
            case 'chatMessage':
                this.handleChatMessage(data);
                break;
            case 'error':
                console.error('Server error:', data.message);
                alert(data.message);
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
    }

    handleGameCreated(data) {
        this.roomCode = data.roomCode;
        this.players = data.players;
        document.getElementById('roomCode').textContent = this.roomCode;
        this.showLobbyScreen();
        this.updateLobby();
    }

    handleGameJoined(data) {
        this.roomCode = data.roomCode;
        this.players = data.players;
        this.showLobbyScreen();
        this.updateLobby();
    }

    handlePlayerJoined(data) {
        this.players = data.players;
        this.updateLobby();
    }

    handlePlayerLeft(data) {
        this.players = data.players;
        this.updateLobby();
    }

    handleGameStarted(data) {
        this.currentPlayerIndex = this.players.findIndex(p => p.color === data.currentTurn);
        this.startGame();
    }

    handleDiceRolled(data) {
        // Update dice display for the rolling player
        const { playerColor, diceValue } = data;
        const diceElement = document.getElementById(`dice${playerColor.charAt(0).toUpperCase() + playerColor.slice(1)}`);
        if (diceElement) {
            diceElement.textContent = diceValue;
            diceElement.classList.add('dice-rolled');
            setTimeout(() => diceElement.classList.remove('dice-rolled'), 500);
        }
        
        // Update turn if it's a multiplayer game
        if (this.roomCode) {
            const playerIndex = this.players.findIndex(p => p.color === playerColor);
            this.currentPlayerIndex = (playerIndex + 1) % this.players.length;
        }
    }

    handlePieceMoved(data) {
        const { playerColor, pieceIndex, newPosition } = data;
        // Update piece position on the board
        this.updatePiecePosition(playerColor, pieceIndex, newPosition);
    }

    handleTurnChanged(data) {
        const { currentPlayer } = data;
        // Update current player index based on the turn change
        this.currentPlayerIndex = this.players.findIndex(p => p.color === currentPlayer);
        if (this.currentPlayerIndex === -1) {
            console.error(`Invalid player color in turnChanged: ${currentPlayer}`);
            return;
        }
        // Update UI to reflect turn change
        this.updateCurrentPlayerDisplay();
        this.drawBoard();
    }

    updatePiecePosition(playerColor, pieceIndex, newPosition) {
        const piece = this.pieces[playerColor][pieceIndex];
        if (!piece) return;
        
        const oldPosition = piece.position;
        const wasInHome = piece.inHome;
        
        // Update piece state based on new position
        if (newPosition === 0 && wasInHome) {
            // Piece leaving home
            piece.inHome = false;
            piece.position = 0;
            this.animatePieceMovement(playerColor, pieceIndex, wasInHome, oldPosition, 0, () => {
                this.afterPieceMove(playerColor);
            });
        } else if (newPosition === 56) {
            // Piece reaching goal
            piece.inGoal = true;
            piece.position = 56;
            this.animatePieceMovement(playerColor, pieceIndex, false, oldPosition, 56, () => {
                this.afterPieceMove(playerColor);
            });
        } else if (newPosition > 0 && newPosition < 56) {
            // Normal movement on track
            piece.position = newPosition;
            this.animatePieceMovement(playerColor, pieceIndex, false, oldPosition, newPosition, () => {
                this.checkCapture(playerColor, piece);
                this.afterPieceMove(playerColor);
            });
        }
    }

    handleChatMessage(data) {
        // Display chat message (you can implement chat UI later)
        console.log(`${data.playerName}: ${data.message}`);
    }

    sendToServer(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.error('Not connected to server');
        }
    }

    /**
     * quickPlay - Start a quick local game
     * 
     * Sets up a single-player game with AI opponents
     */
    quickPlay() {
        this.isHost = true;
        this.roomCode = this.generateRoomCode();
        const chosenColor = document.getElementById('playerColorSelect')?.value || 'blue';
        this.myColor = chosenColor;
        
        const storedName = typeof localStorage !== 'undefined' ? localStorage.getItem('ludoPlayerName') : null;
        const fallbackName = document.getElementById('playerNameInput')?.value?.trim();
        const myName = (fallbackName || storedName || 'You').slice(0, 16);
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('ludoPlayerName', myName);
        }
        
        const order = ['red', 'green', 'yellow', 'blue'];
        const defaultNames = { red: 'Player 1', green: 'Player 2', yellow: 'Player 3', blue: 'Player 4' };
        this.players = order.map(color => ({
            id: `player-${color}`,
            color,
            name: color === this.myColor ? myName : defaultNames[color]
        }));
        this.mockPlayers = [...this.players];

        this.startGame();
    }

    /**
     * createGame - Create a new multiplayer room
     *
     * Player becomes host and waits for others to join
     * If WebSocket is not connected, creates a local game instead
     */
    createGame() {
        const playerName = document.getElementById('playerNameInput')?.value?.trim() || 'Player';
        const playerColor = document.getElementById('playerColorSelect')?.value || 'red';

        this.isHost = true;
        this.myColor = playerColor;

        // If WebSocket is not connected, create a local game
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.log('WebSocket not connected, creating local game...');
            this.createLocalGame(playerName, playerColor);
            return;
        }

        // Send create game request to server
        this.sendToServer({
            type: 'createGame',
            playerName: playerName,
            playerColor: playerColor
        });
    }

    /**
     * createLocalGame - Create a local game (fallback when server is unavailable)
     *
     * @param {string} playerName - The player's name
     * @param {string} playerColor - The player's chosen color
     */
    createLocalGame(playerName, playerColor) {
        this.roomCode = this.generateRoomCode();
        this.myColor = playerColor; // <-- important
        
        // Create players array with human player + 3 AI opponents
        const defaultNames = { red: 'Player 1', green: 'Player 2', yellow: 'Player 3', blue: 'Player 4' };
        this.players = this.colors.map(color => ({
            id: `player-${color}`,
            color,
            name: color === playerColor ? playerName : defaultNames[color]
        }));

        // Update UI
        document.getElementById('roomCode').textContent = this.roomCode;
        this.showLobbyScreen();
        this.updateLobby();
        
        console.log(`Local game created. Room code: ${this.roomCode}, Your color: ${playerColor}`);
    }

    /**
     * simulatePlayerJoin - Simulate a player joining the room
     * 
     * Used for demo/testing purposes
     */
    simulatePlayerJoin(color) {
        const playerNames = { green: 'Player 2', yellow: 'Player 3', blue: 'Player 4' };
        this.mockPlayers.push({ id: `player${this.mockPlayers.length + 1}`, color, name: playerNames[color] });
        this.players = [...this.mockPlayers];
        this.updateLobby();
    }

    /**
     * joinGame - Join an existing room with a code
     */
    joinGame() {
        const code = document.getElementById('roomCodeInput').value.toUpperCase();
        const playerName = document.getElementById('playerNameInput')?.value?.trim() || 'Player';
        const playerColor = document.getElementById('playerColorSelect')?.value || 'blue';

        if (code.length === 6) {
            this.isHost = false;
            this.myColor = playerColor;

            // If WebSocket is not connected, show error
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                alert('Cannot connect to game server. Make sure the host has created a game and the server is running. For local play, use "Create Game" instead.');
                return;
            }

            // Send join game request to server
            this.sendToServer({
                type: 'joinGame',
                roomCode: code,
                playerName: playerName,
                playerColor: playerColor
            });
        } else {
            alert('Please enter a valid 6-digit room code');
        }
    }

    /**
     * updateLobby - Update the lobby UI with current players
     */
    updateLobby() {
        const slots = document.querySelectorAll('.player-slot');
        slots.forEach((slot, index) => {
            const color = this.colors[index];
            const player = this.players.find(p => p.color === color);
            const status = slot.querySelector('.player-status');

            if (player) {
                slot.classList.add('joined');
                status.textContent = player.name;
            } else {
                slot.classList.remove('joined');
                status.textContent = 'Waiting...';
            }
        });

        const startBtn = document.getElementById('startGameBtn');
        if (this.isHost && this.players.length >= 2) {
            startBtn.disabled = false;
        }
    }

    /**
     * positionPlayersByPov - Position player UI elements based on player's POV
     *
     * When a player chooses a color, that color's panel moves to bottom-left.
     * Other panels rotate accordingly around the board.
     * Base layout: Blue=top-left, Red=top-right, Yellow=bottom-left, Green=bottom-right
     */
    positionPlayersByPov() {
        if (!this.myColor) {
            console.log('positionPlayersByPov: myColor not set');
            return;
        }
        console.log('positionPlayersByPov called, myColor:', this.myColor);
        
        // Correct POV positions - YOUR color always at bottom-left
        // Board corners: Blue(top-left), Red(top-right), Yellow(bottom-left), Green(bottom-right)
        const povPositions = {
            blue:   { blue: 'player-bottom-left',  red: 'player-top-left',    green: 'player-top-right',   yellow: 'player-bottom-right' },
            red:    { red: 'player-bottom-left',   green: 'player-top-left',  yellow: 'player-top-right',  blue: 'player-bottom-right' },
            yellow: { yellow: 'player-bottom-left', blue: 'player-top-left',   red: 'player-top-right',    green: 'player-bottom-right' },
            green:  { green: 'player-bottom-left', yellow: 'player-top-left',  blue: 'player-top-right',   red: 'player-bottom-right' }
        };
        
        const positions = povPositions[this.myColor];
        if (!positions) {
            console.error('No positions found for color:', this.myColor);
            return;
        }

        // Remove all positioning classes first
        document.querySelectorAll('.player-info').forEach(el => {
            el.classList.remove('player-top-left', 'player-top-right', 'player-bottom-left', 'player-bottom-right');
        });

        // Apply new class to each color's panel
        Object.entries(positions).forEach(([color, posClass]) => {
            const panel = document.querySelector(`.player-info[data-color="${color}"]`);
            if (panel) {
                panel.classList.add(posClass);
                panel.style.display = 'flex';
                panel.style.visibility = 'visible';
                panel.style.opacity = '1';
                console.log(`Added class ${posClass} to ${color} panel`);
            } else {
                console.error(`Panel not found for ${color}`);
            }
        });
    }

    syncBoardWrapperTilt() {
        const wrap = document.querySelector('.board-wrapper');
        if (!wrap) return;
        wrap.classList.remove('board-pov-tilt');
    }

    /**
     * startGame - Start the game
     * 
     * Transitions from lobby to game screen and initializes gameplay
     */
    startGame() {
        this.gameState = 'playing';
        const myIdx = this.players.findIndex(p => p.color === this.myColor);
        this.currentPlayerIndex = myIdx >= 0 ? myIdx : 0;
        this.rollsRemaining = 1;
        
        // Send game start to server if host
        if (this.isHost && this.roomCode && this.isConnected) {
            this.sendToServer({
                type: 'startGame',
                roomCode: this.roomCode
            });
        }
        
        this.showGameScreen();

        setTimeout(() => {
            this.povRotationRad = this.getPovRotationRad();
            this.syncBoardWrapperTilt();
            this.setupDiceEventListeners();
            this.syncSelfHud();
            
            // Wait extra 50ms for DOM to settle
            setTimeout(() => this.positionPlayersByPov(), 50);

            this.players.forEach(player => {
                const { nameId } = this.getUiIdsForColor(player.color);
                const nameElement = document.getElementById(nameId);
                console.log(`Setting name for ${player.color}, nameId: ${nameId}, element:`, nameElement);
                if (nameElement) {
                    nameElement.textContent = player.name;
                    console.log(`Name set to "${player.name}" for ${player.color}`);
                } else {
                    console.error(`Name element not found for ${player.color}`);
                }
                // Initialize dice with value 1
                this.updateDiceDisplay(1, player.color);
            });

            this.drawBoard();
            this.updateCurrentPlayerDisplay();
        }, 200);
    }

    /**
     * drawBoard - Main drawing function
     * 
     * Clears canvas and redraws entire board:
     * 1. Background
     * 2. Border
     * 3. Apply POV rotation
     * 4. Home areas
     * 5. Center triangle
     * 6. Path tiles
     * 7. Safe spots
     * 8. Starting positions
     * 9. Pieces
     */
    drawBoard() {
        // Clear entire canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw background color
        this.ctx.fillStyle = '#E7D8BB';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw border
        this.ctx.save();
        const border = Math.max(6, this.cellSize * 0.28);
        this.ctx.strokeStyle = '#7A4A2B';
        this.ctx.lineWidth = border;
        this.ctx.strokeRect(border / 2, border / 2, this.canvas.width - border, this.canvas.height - border);
        this.ctx.restore();

        // Apply POV rotation if enabled
        this.ctx.save();
        if (this.gameState === 'playing' && this.povRotationRad) {
            const cx = this.canvas.width / 2;
            const cy = this.canvas.height / 2;
            this.ctx.translate(cx, cy);
            this.ctx.rotate(this.povRotationRad);
            this.ctx.translate(-cx, -cy);
        }

        // Draw all board elements (in order for proper layering)
        this.drawHomeAreas();
        this.drawCenterTriangle();
        this.drawPath();
        this.drawSafeSpots();
        this.drawStartingPositions();
        this.drawPieces();
        
        // Restore context (undo rotation)
        this.ctx.restore();
    }

    /**
     * drawHomeAreas - Draw the 4 corner home areas
     * 
     * Each home area is a 6x6 cell square in a corner
     * Contains 4 circles where pieces wait
     */
    drawHomeAreas() {
        const areas = [
            { color: 'blue', x: 0, y: 0 },     // top-left
            { color: 'red', x: 9, y: 0 },      // top-right
            { color: 'yellow', x: 0, y: 9 },   // bottom-left
            { color: 'green', x: 9, y: 9 }     // bottom-right
        ];

        areas.forEach(area => {
            const baseColor = this.colorMap[area.color];

            // Draw main colored square
            this.ctx.fillStyle = baseColor;
            this.ctx.fillRect(
                area.x * this.cellSize,
                area.y * this.cellSize,
                this.cellSize * 6,
                this.cellSize * 6
            );

            // Draw border
            this.ctx.strokeStyle = 'rgba(0,0,0,0.28)';
            this.ctx.lineWidth = Math.max(1, this.cellSize * 0.05);
            this.ctx.strokeRect(
                area.x * this.cellSize,
                area.y * this.cellSize,
                this.cellSize * 6,
                this.cellSize * 6
            );

            // Draw inner darker square
            const innerPad = this.cellSize * 0.8;
            const innerSize = this.cellSize * 4.4;
            this.ctx.save();
            this.ctx.fillStyle = this.mixHex(baseColor, '#000000', 0.18);
            this.ctx.beginPath();
            this.ctx.roundRect(
                area.x * this.cellSize + innerPad,
                area.y * this.cellSize + innerPad,
                innerSize,
                innerSize,
                this.cellSize * 0.6
            );
            this.ctx.fill();
            this.ctx.restore();

            // Draw 4 circles where pieces wait
            this.homePositions[area.color].forEach(pos => {
                this.ctx.beginPath();
                this.ctx.arc(
                    pos.x * this.cellSize,
                    pos.y * this.cellSize,
                    this.cellSize * 0.28,
                    0,
                    Math.PI * 2
                );
                this.ctx.fillStyle = this.mixHex(baseColor, '#000000', 0.55);
                this.ctx.fill();
            });
        });
    }

    /**
     * drawPath - Draw the path tiles
     * 
     * Draws all cells from pathCellDrawInfo map
     * - Neutral cells: light grey
     * - Colored cells: player's color (home columns)
     */
    drawPath() {
        if (!this.pathCellDrawInfo) return;

        this.pathCellDrawInfo.forEach((info, key) => {
            const [xs, ys] = key.split(',');
            const x = Number(xs);
            const y = Number(ys);

            // Skip center block (drawn as triangles)
            if (this.isCenterBlockCell(x, y)) return;

            const fill = info.kind === 'colored' ? this.colorMap[info.color] : '#ECECEC';
            this.ctx.fillStyle = fill;
            this.ctx.fillRect(
                x * this.cellSize,
                y * this.cellSize,
                this.cellSize,
                this.cellSize
            );
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
     * drawStartingPositions - Draw colored starting squares with arrows
     * 
     * Each color has a marked starting position on the track
     */
    drawStartingPositions() {
        const startPositions = [
            { x: 1, y: 6, color: 'blue', direction: 'right' },
            { x: 8, y: 1, color: 'red', direction: 'down' },
            { x: 13, y: 8, color: 'green', direction: 'left' },
            { x: 6, y: 13, color: 'yellow', direction: 'up' }
        ];

        startPositions.forEach(pos => {
            // Draw colored square
            this.ctx.fillStyle = this.colorMap[pos.color];
            this.ctx.fillRect(
                pos.x * this.cellSize,
                pos.y * this.cellSize,
                this.cellSize,
                this.cellSize
            );

            // Draw border
            this.ctx.strokeStyle = '#444444';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(
                pos.x * this.cellSize,
                pos.y * this.cellSize,
                this.cellSize,
                this.cellSize
            );

            // Draw arrow centered in the tile
            this.drawArrow(
                (pos.x + 0.5) * this.cellSize,
                (pos.y + 0.5) * this.cellSize,
                this.mixHex(this.colorMap[pos.color], '#0B1220', 0.45),
                pos.direction
            );
        });
    }

    /**
     * drawArrow - Draw an arrow glyph
     * 
     * @param {number} x - Center X position
     * @param {number} y - Center Y position
     * @param {string} color - Fill color
     * @param {string} direction - Direction: 'up', 'down', 'left', 'right'
     */
    drawArrow(x, y, color, direction) {
        const size = this.cellSize * 0.3;
        this.ctx.fillStyle = color;
        this.ctx.save();
        this.ctx.translate(x, y);

        // Rotate based on direction
        switch(direction) {
            case 'down': break;
            case 'up': this.ctx.rotate(Math.PI); break;
            case 'left': this.ctx.rotate(-Math.PI / 2); break;
            case 'right': this.ctx.rotate(Math.PI / 2); break;
        }

        // Draw arrow shape
        this.ctx.beginPath();
        this.ctx.moveTo(0, -size * 0.5);
        this.ctx.lineTo(-size * 0.5, size * 0.3);
        this.ctx.lineTo(-size * 0.2, size * 0.3);
        this.ctx.lineTo(-size * 0.2, size * 0.7);
        this.ctx.lineTo(size * 0.2, size * 0.7);
        this.ctx.lineTo(size * 0.2, size * 0.3);
        this.ctx.lineTo(size * 0.5, size * 0.3);
        this.ctx.closePath();
        this.ctx.fill();

        this.ctx.restore();
    }

    /**
     * drawSafeSpots - Draw the 4 safe spots on the board
     * 
     * Safe spots are where pieces cannot be captured
     * Marked with star symbols
     */
    drawSafeSpots() {
        const safeSpots = [
            { x: 2, y: 8 },
            { x: 6, y: 2 },
            { x: 12, y: 6 },
            { x: 8, y: 12 }
        ];

        safeSpots.forEach(spot => {
            // Draw grey background
            this.ctx.fillStyle = '#BFC1C8';
            this.ctx.fillRect(
                spot.x * this.cellSize,
                spot.y * this.cellSize,
                this.cellSize,
                this.cellSize
            );

            // Draw border
            this.ctx.strokeStyle = '#444444';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(
                spot.x * this.cellSize,
                spot.y * this.cellSize,
                this.cellSize,
                this.cellSize
            );

            // Draw star symbol
            this.drawStar(
                (spot.x + 0.5) * this.cellSize,
                (spot.y + 0.5) * this.cellSize,
                this.cellSize * 0.22,
                '#8E9097'
            );
        });
    }

    /**
     * drawStar - Draw a 4-pointed star
     * 
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Star radius
     * @param {string} fillColor - Fill color
     */
    drawStar(cx, cy, radius, fillColor = '#FFFFFF') {
        const spikes = 4;
        const outerRadius = radius;
        const innerRadius = radius * 0.4;

        this.ctx.save();
        this.ctx.translate(cx, cy);
        this.ctx.rotate(-Math.PI / 2);

        this.ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
            const angle = (i * Math.PI) / spikes;
            const r = i % 2 === 0 ? outerRadius : innerRadius;
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;

            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }
        this.ctx.closePath();

        this.ctx.fillStyle = fillColor;
        this.ctx.fill();

        // Draw outline
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = Math.max(1.5, radius * 0.12);
        this.ctx.stroke();

        this.ctx.restore();
    }

    /**
     * hexToRgb - Convert hex color to RGB object
     * 
     * @param {string} hex - Hex color (e.g., '#FF0000')
     * @returns {Object} { r, g, b } values (0-255)
     */
    hexToRgb(hex) {
        const h = (hex || '').trim();
        const normalized = h.startsWith('#') ? h.slice(1) : h;
        if (normalized.length !== 6) return { r: 0, g: 0, b: 0 };
        const r = parseInt(normalized.slice(0, 2), 16);
        const g = parseInt(normalized.slice(2, 4), 16);
        const b = parseInt(normalized.slice(4, 6), 16);
        return { r, g, b };
    }

    /**
     * mixHex - Mix two hex colors with interpolation
     * 
     * @param {string} a - First color
     * @param {string} b - Second color
     * @param {number} t - Interpolation (0=a, 1=b)
     * @returns {string} RGB color string
     */
    mixHex(a, b, t) {
        const A = this.hexToRgb(a);
        const B = this.hexToRgb(b);
        const tt = Math.max(0, Math.min(1, t));
        const r = Math.round(A.r + (B.r - A.r) * tt);
        const g = Math.round(A.g + (B.g - A.g) * tt);
        const b2 = Math.round(A.b + (B.b - A.b) * tt);
        return `rgb(${r}, ${g}, ${b2})`;
    }

    /**
     * drawCenterTriangle - Draw the center goal area
     * 
     * Four colored triangles meeting at center point
     * Each triangle is the goal for its color
     */
    drawCenterTriangle() {
        const s = this.cellSize;
        const x0 = 6 * s;
        const y0 = 6 * s;
        const x1 = 9 * s;
        const y1 = 9 * s;
        const cx = 7.5 * s;
        const cy = 7.5 * s;

        // Helper to draw a triangle from two corners to center
        const tri = (ax, ay, bx, by, fill) => {
            this.ctx.beginPath();
            this.ctx.moveTo(ax, ay);
            this.ctx.lineTo(bx, by);
            this.ctx.lineTo(cx, cy);
            this.ctx.closePath();
            this.ctx.fillStyle = fill;
            this.ctx.fill();
        };

        // Top=red, Right=green, Bottom=yellow, Left=blue
        tri(x0, y0, x1, y0, this.colorMap.red);
        tri(x1, y0, x1, y1, this.colorMap.green);
        tri(x1, y1, x0, y1, this.colorMap.yellow);
        tri(x0, y1, x0, y0, this.colorMap.blue);

        // Draw border and dividing lines
        this.ctx.strokeStyle = '#1a1a1a';
        this.ctx.lineWidth = Math.max(1.5, s * 0.06);
        this.ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
        this.ctx.beginPath();
        this.ctx.moveTo(x0, y0);
        this.ctx.lineTo(cx, cy);
        this.ctx.moveTo(x1, y0);
        this.ctx.lineTo(cx, cy);
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(cx, cy);
        this.ctx.moveTo(x0, y1);
        this.ctx.lineTo(cx, cy);
        this.ctx.stroke();
    }

    /**
     * getGoalPosition - Get canvas coordinates for a goal piece
     * 
     * Pieces in goal are positioned inside their colored triangle
     * 
     * @param {string} color - Player color
     * @param {number} pieceIndex - Piece index (0-3)
     * @returns {Object} { x, y } canvas coordinates
     */
    getGoalPosition(color, pieceIndex) {
        const s = this.cellSize;
        const cx = 7.5 * s;
        const cy = 7.5 * s;

        // Distribute 4 pieces along the median line of the triangle
        const t = 0.25 + pieceIndex * 0.2;

        switch (color) {
            case 'red':
                return {
                    x: (6 + t * (7.5 - 6)) * s,
                    y: (6 + t * (7.5 - 6)) * s
                };
            case 'green':
                return {
                    x: (9 - t * (9 - 7.5)) * s,
                    y: (6 + t * (7.5 - 6)) * s
                };
            case 'yellow':
                return {
                    x: (9 - t * (9 - 7.5)) * s,
                    y: (9 - t * (9 - 7.5)) * s
                };
            case 'blue':
                return {
                    x: (6 + t * (7.5 - 6)) * s,
                    y: (9 - t * (9 - 7.5)) * s
                };
            default:
                return { x: cx, y: cy };
        }
    }

    /**
     * drawCrownGlyph - Draw a crown decoration on pieces
     * 
     * @param {number} x - Center X
     * @param {number} y - Center Y
     * @param {number} size - Size
     */
    drawCrownGlyph(x, y, size) {
        const w = size;
        const h = size * 0.62;
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.beginPath();
        this.ctx.moveTo(-w * 0.46, h * 0.32);
        this.ctx.lineTo(-w * 0.35, -h * 0.14);
        this.ctx.lineTo(-w * 0.12, h * 0.08);
        this.ctx.lineTo(0, -h * 0.24);
        this.ctx.lineTo(w * 0.12, h * 0.08);
        this.ctx.lineTo(w * 0.35, -h * 0.14);
        this.ctx.lineTo(w * 0.46, h * 0.32);
        this.ctx.closePath();
        this.ctx.fillStyle = '#F0B71B';
        this.ctx.fill();
        this.ctx.fillStyle = '#FCE894';
        this.ctx.fillRect(-w * 0.42, h * 0.28, w * 0.84, h * 0.18);
        this.ctx.restore();
    }

    /**
     * getPiecesAtPosition - Get all pieces at a specific position
     * 
     * Used for collision detection and stacking
     * 
     * @param {string} targetColor - Reference color for position
     * @param {number} targetPosition - Position index
     * @returns {Array} Array of pieces at that position
     */
    getPiecesAtPosition(targetColor, targetPosition) {
        const piecesHere = [];
        Object.entries(this.pieces).forEach(([color, pieces]) => {
            pieces.forEach((piece, index) => {
                if (!piece.inHome && !piece.inGoal) {
                    const globalPos = this.getGlobalPosition(color, piece.position);
                    const targetGlobalPos = this.getGlobalPosition(targetColor, targetPosition);
                    if (globalPos !== -1 && globalPos === targetGlobalPos) {
                        piecesHere.push({ color, index, piece });
                    }
                }
            });
        });
        return piecesHere;
    }

    /**
     * drawPieces - Draw all game pieces
     * 
     * Handles:
     * - Home pieces (in corners)
     * - Track pieces (on the path)
     * - Goal pieces (in center triangle)
     * - Stacked pieces (multiple on same cell)
     * - Movable piece highlighting
     */
    drawPieces() {
        const currentColor = this.players[this.currentPlayerIndex]?.color;
        const s = this.cellSize;
        const stackStep = s * 0.1;

        // Group pieces by position for stacking
        const pathGroups = new Map();
        Object.entries(this.pieces).forEach(([color, pieces]) => {
            pieces.forEach((piece, index) => {
                if (piece.inHome) return;
                if (piece.inGoal) return;
                const pathPos = this.paths[color][piece.position];
                const posKey = `${pathPos.x},${pathPos.y}`;
                if (!pathGroups.has(posKey)) pathGroups.set(posKey, []);
                pathGroups.get(posKey).push({ color, index, piece });
            });
        });

        // Calculate stack offset for pieces on same cell
        const stackOffsetFor = (posKey, color, index) => {
            const list = pathGroups.get(posKey) || [];
            const idx = list.findIndex((e) => e.color === color && e.index === index);
            const n = list.length;
            const i = idx >= 0 ? idx : 0;
            const t = i - (n - 1) / 2;
            return { ox: t * stackStep * 0.85, oy: t * stackStep * 0.85 };
        };

        const drawList = [];
        const goalPieces = [];

        // Collect all pieces with their positions
        Object.entries(this.pieces).forEach(([color, pieces]) => {
            pieces.forEach((piece, index) => {
                let x, y;
                let posKey = '';
                let stackIdx = 0;

                if (piece.inHome) {
                    const homePos = this.homePositions[color][index];
                    x = homePos.x * this.cellSize;
                    y = homePos.y * this.cellSize;
                    posKey = `h,${color},${index}`;
                } else if (piece.inGoal) {
                    const goalPos = this.getGoalPosition(color, index);
                    x = goalPos.x;
                    y = goalPos.y;
                    posKey = `goal,${color},${index}`;
                    goalPieces.push({ color, index, piece, x, y });
                } else {
                    const pathPos = this.paths[color][piece.position];
                    posKey = `${pathPos.x},${pathPos.y}`;
                    const { ox, oy } = stackOffsetFor(posKey, color, index);
                    const list = pathGroups.get(posKey) || [];
                    stackIdx = list.findIndex((e) => e.color === color && e.index === index);
                    if (stackIdx < 0) stackIdx = 0;
                    x = (pathPos.x + 0.5) * s + ox;
                    y = (pathPos.y + 0.5) * s + oy;
                }

                piece.coords = { x, y };
                drawList.push({ color, index, piece, x, y, posKey, stackIdx });
            });
        });

        // Sort for consistent draw order
        drawList.sort((a, b) => {
            if (a.posKey !== b.posKey) return String(a.posKey).localeCompare(String(b.posKey));
            return a.stackIdx - b.stackIdx;
        });

        // Draw goal pieces first (behind track pieces)
        goalPieces.forEach(({ color, index, piece, x, y }) => {
            this.drawSinglePiece(piece, color, x, y, false);
        });

        // Draw all other pieces
        drawList.forEach(({ color, index, piece, x, y }) => {
            if (piece.inGoal) return;
            this.drawSinglePiece(piece, color, x, y,
                this.canMove && color === currentColor && this.movablePieces && this.movablePieces.includes(index));
        });
    }

    /**
     * drawSinglePiece - Draw a single game piece
     * 
     * Draws a multi-layered piece with:
     * - Base circle
     * - Inner circles for depth
     * - Color fill
     * - Highlight
     * - Crown glyph
     * - Selection/movable highlight
     * 
     * @param {Object} piece - Piece object
     * @param {string} color - Piece color
     * @param {number} x - Canvas X position
     * @param {number} y - Canvas Y position
     * @param {boolean} isMovable - Whether piece can move (shows gold ring)
     */
    drawSinglePiece(piece, color, x, y, isMovable) {
        const currentColor = this.players[this.currentPlayerIndex]?.color;
        const s = this.cellSize;

        // Draw gold ring if piece can move
        if (isMovable) {
            this.ctx.beginPath();
            this.ctx.arc(x, y, this.cellSize * 0.46, 0, Math.PI * 2);
            this.ctx.strokeStyle = '#FFD700';
            this.ctx.lineWidth = Math.max(3, this.cellSize * 0.18);
            this.ctx.shadowColor = '#FFD700';
            this.ctx.shadowBlur = this.cellSize * 0.25;
            this.ctx.stroke();
            this.ctx.shadowColor = 'transparent';
            this.ctx.shadowBlur = 0;
        }

        const pawnR = this.cellSize * 0.34;
        const baseFill = this.colorMap[color];

        this.ctx.save();
        
        // Draw shadow
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
        this.ctx.shadowBlur = this.cellSize * 0.12;
        this.ctx.shadowOffsetY = this.cellSize * 0.04;

        // Draw base circle (gold)
        this.ctx.beginPath();
        this.ctx.arc(x, y, pawnR, 0, Math.PI * 2);
        this.ctx.fillStyle = '#EBD07B';
        this.ctx.fill();

        // Draw inner circle (light)
        this.ctx.beginPath();
        this.ctx.arc(x, y, pawnR * 0.87, 0, Math.PI * 2);
        this.ctx.fillStyle = '#FFF7D8';
        this.ctx.fill();

        // Draw colored center
        this.ctx.beginPath();
        this.ctx.arc(x, y, pawnR * 0.67, 0, Math.PI * 2);
        this.ctx.fillStyle = baseFill;
        this.ctx.fill();

        // Draw highlight (makes piece look 3D)
        this.ctx.beginPath();
        this.ctx.arc(
            x - pawnR * 0.16,
            y - pawnR * 0.16,
            pawnR * 0.2,
            0,
            Math.PI * 2
        );
        this.ctx.fillStyle = 'rgba(255,255,255,0.38)';
        this.ctx.fill();

        this.ctx.restore();
        
        // Draw crown decoration
        this.drawCrownGlyph(x, y, pawnR * 0.82);

        // Draw green selection ring
        if (this.selectedPiece && this.selectedPiece.color === color && this.selectedPiece.id === piece.id) {
            this.ctx.beginPath();
            this.ctx.arc(x, y, this.cellSize * 0.42, 0, Math.PI * 2);
            this.ctx.strokeStyle = '#00FF00';
            this.ctx.lineWidth = 5;
            this.ctx.stroke();
        }
    }

    /**
     * highlightMovablePieces - Find and highlight pieces that can move
     * 
     * Called after rolling dice to show valid moves
     */
    highlightMovablePieces(color) {
        this.movablePieces = [];
        const pieces = this.pieces[color];

        pieces.forEach((piece, index) => {
            if (this.canPieceUseAnyRoll(piece, color)) {
                this.movablePieces.push(index);
            }
        });

        this.drawBoard();
    }

    /**
     * handleCanvasClick - Handle canvas click for piece selection
     * 
     * Main interaction handler:
     * 1. Check if player can move
     * 2. Check if it's their turn (multiplayer enabled)
     * 3. Find clicked piece
     * 4. Move piece if valid
     */
    handleCanvasClick(e) {
        if (!this.canMove) return;

        const { x, y } = this.getCanvasPointFromEvent(e);

        const currentColor = this.players[this.currentPlayerIndex].color;
        
        // For multiplayer, allow any human player to move their pieces during their turn
        // For single player, only allow the main player
        const isMultiplayerMode = this.players.length > 1;
        if (!isMultiplayerMode && currentColor !== this.myColor) return;

        const pieces = this.pieces[currentColor];

        pieces.forEach((piece, index) => {
            if (piece.coords) {
                const dx = x - piece.coords.x;
                const dy = y - piece.coords.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < this.cellSize * 0.4) {
                    if (this.movablePieces && this.movablePieces.includes(index)) {
                        this.selectAndMovePiece(currentColor, index);
                    }
                }
            }
        });
    }

    /**
     * selectAndMovePiece - Select and move a piece
     * 
     * Handles single-roll moves and multi-roll choices
     * 
     * @param {string} color - Piece color
     * @param {number} pieceIndex - Piece index
     */
    selectAndMovePiece(color, pieceIndex) {
        // Allow any player to move their pieces in multiplayer mode
        const isMultiplayerMode = this.players.length > 1;
        if (!isMultiplayerMode && color !== this.myColor) return;
        
        const piece = this.pieces[color][pieceIndex];
        const validRolls = this.getValidRollsForPiece(piece, color);

        if (validRolls.length === 0) return;

        // If only one roll option, move immediately
        if (validRolls.length === 1) {
            this.movePieceWithRoll(color, pieceIndex, validRolls[0]);
        } else {
            // Show popup to choose which roll to use
            this.showMoveChoice(color, pieceIndex, validRolls);
        }
    }

    /**
     * getValidRollsForPiece - Get valid rolls for a piece
     * 
     * Rules:
     * - Home pieces: only roll 6 works
     * - Goal pieces: no rolls valid
     * - Track pieces: roll must not exceed position 56
     * 
     * @param {Object} piece - Piece object
     * @param {string} color - Piece color
     * @returns {Array} Array of valid roll values
     */
    getValidRollsForPiece(piece, color) {
        return this.currentRolls.filter(roll => {
            if (piece.inHome) return roll === 6;
            if (piece.inGoal) return false;
            const newPos = piece.position + roll;
            return newPos <= 56;
        });
    }

    /**
     * showMoveChoice - Show popup to choose which roll to use
     * 
     * When player has multiple rolls (e.g., rolled 6 then 5),
     * they can choose which roll to use for which piece
     * 
     * @param {string} color - Piece color
     * @param {number} pieceIndex - Piece index
     * @param {Array} validRolls - Array of valid roll values
     */
    showMoveChoice(color, pieceIndex, validRolls) {
        const popup = document.getElementById('moveChoicePopup');
        const buttonsContainer = document.getElementById('moveChoiceButtons');
        const piece = this.pieces[color][pieceIndex];

        if (!piece.coords) return;

        // Position popup near the piece
        const canvasRect = this.canvas.getBoundingClientRect();
        const scaleX = canvasRect.width / this.canvas.width;
        const scaleY = canvasRect.height / this.canvas.height;
        const popupX = canvasRect.left + piece.coords.x * scaleX - 60;
        const popupY = canvasRect.top + piece.coords.y * scaleY - 80;

        popup.style.left = `${popupX}px`;
        popup.style.top = `${popupY}px`;

        // Create buttons for each roll option
        buttonsContainer.innerHTML = '';
        validRolls.forEach(roll => {
            const btn = document.createElement('button');
            btn.className = 'move-choice-btn';
            btn.textContent = roll;
            btn.onclick = () => {
                popup.classList.remove('active');
                this.movePieceWithRoll(color, pieceIndex, roll);
            };
            buttonsContainer.appendChild(btn);
        });

        popup.classList.add('active');
    }

    /**
     * movePieceWithRoll - Move a piece with a specific roll
     * 
     * Handles all movement cases:
     * 1. Leaving home (roll 6)
     * 2. Moving on track
     * 3. Entering goal (position 56)
     * 4. Checking for captures
     * 
     * @param {string} color - Piece color
     * @param {number} pieceIndex - Piece index
     * @param {number} roll - Roll value to use
     */
    movePieceWithRoll(color, pieceIndex, roll) {
        const piece = this.pieces[color][pieceIndex];
        this.pieceCaptured = false;
        this.lastMoveRoll = roll;

        // Remove used roll from current rolls
        const rollIndex = this.currentRolls.indexOf(roll);
        if (rollIndex > -1) {
            this.currentRolls.splice(rollIndex, 1);
        }
        this.updateRollsDisplay(color);

        const oldPosition = piece.position;
        const wasInHome = piece.inHome;

        if (piece.inHome && roll === 6) {
            // Leave home and enter track at position 0
            piece.inHome = false;
            piece.position = 0;
            
            // Send piece movement to server if in multiplayer game
            if (this.roomCode && this.isConnected) {
                this.sendToServer({
                    type: 'movePiece',
                    roomCode: this.roomCode,
                    playerColor: color,
                    pieceIndex: pieceIndex,
                    newPosition: 0
                });
            }
            
            this.animatePieceMovement(color, pieceIndex, wasInHome, oldPosition, 0, () => {
                this.afterPieceMove(color);
            });
        } else if (!piece.inHome && !piece.inGoal) {
            // Move on track
            const newPosition = piece.position + roll;
            const maxPosition = 56;

            if (newPosition === maxPosition) {
                // Reached goal!
                piece.inGoal = true;
                
                // Send piece movement to server if in multiplayer game
                if (this.roomCode && this.isConnected) {
                    this.sendToServer({
                        type: 'movePiece',
                        roomCode: this.roomCode,
                        playerColor: color,
                        pieceIndex: pieceIndex,
                        newPosition: maxPosition
                    });
                }
                
                this.animatePieceMovement(color, pieceIndex, false, oldPosition, maxPosition, () => {
                    piece.position = maxPosition;
                    this.afterPieceMove(color);
                });
            } else if (newPosition < maxPosition) {
                // Normal move on track
                
                // Send piece movement to server if in multiplayer game
                if (this.roomCode && this.isConnected) {
                    this.sendToServer({
                        type: 'movePiece',
                        roomCode: this.roomCode,
                        playerColor: color,
                        pieceIndex: pieceIndex,
                        newPosition: newPosition
                    });
                }
                
                this.animatePieceMovement(color, pieceIndex, false, oldPosition, newPosition, () => {
                    piece.position = newPosition;
                    this.checkCapture(color, piece);
                    this.afterPieceMove(color);
                });
            } else {
                // Roll exceeds goal - can't move
                this.afterPieceMove(color);
            }
        } else {
            // Already in goal or invalid state
            this.afterPieceMove(color);
        }
    }

    /**
     * animatePieceMovement - Animate piece movement step by step
     * 
     * Creates smooth animation by moving one step at a time
     * 
     * @param {string} color - Piece color
     * @param {number} pieceIndex - Piece index
     * @param {boolean} wasInHome - Whether piece was in home
     * @param {number} startPos - Starting position
     * @param {number} endPos - Ending position
     * @param {Function} callback - Function to call after animation
     */
    animatePieceMovement(color, pieceIndex, wasInHome, startPos, endPos, callback) {
        const piece = this.pieces[color][pieceIndex];
        const steps = Math.abs(endPos - startPos);

        if (steps === 0 || wasInHome) {
            this.drawBoard();
            if (callback) callback();
            return;
        }

        let currentStep = 0;

        const animationInterval = setInterval(() => {
            if (currentStep < steps) {
                currentStep++;
                piece.position = startPos + currentStep;
                this.drawBoard();
            } else {
                clearInterval(animationInterval);
                piece.position = endPos;
                this.drawBoard();
                if (callback) callback();
            }
        }, 100);
    }

    /**
     * afterPieceMove - Handle actions after a piece moves
     * 
     * Checks:
     * 1. Win condition
     * 2. Bonus roll (rolled 6 or captured)
     * 3. Remaining rolls
     * 4. Turn end
     */
    afterPieceMove(color) {
        this.canMove = false;
        this.movablePieces = [];
        this.selectedPiece = null;
        this.drawBoard();

        // Check for win
        if (this.checkWin(color)) {
            setTimeout(() => {
                alert(`${this.players[this.currentPlayerIndex].name} wins!`);
                this.exitGame();
            }, 500);
            return;
        }

        const movedWithSix = this.lastMoveRoll === 6;
        const capturedBonus = this.pieceCaptured === true;
        this.pieceCaptured = false;
        this.lastMoveRoll = null;

        const pieces = this.pieces[color];
        const canUseRemainingDice = pieces.some((p) => this.canPieceUseAnyRoll(p, color));

        // If there are remaining rolls, player must use them
        if (this.currentRolls.length > 0) {
            if (canUseRemainingDice) {
                this.hasRolled = true;
                this.canMove = this.isHumanLocalTurn();
                this.highlightMovablePieces(color);
                this.updateCurrentPlayerDisplay();
                this.startTurnTimer();
                // AI automation disabled - only timeout automation remains
                // if (!this.isHumanLocalTurn()) {
                //     setTimeout(() => this.simulateAIMove(), 450);
                // }
                return;
            }
            // Dice left but no legal move - pass
            setTimeout(() => this.endTurn(), 500);
            return;
        }

        // Bonus roll after rolling 6 or capturing
        if (movedWithSix || capturedBonus) {
            this.hasRolled = false;
            this.startTurnTimer();

            // AI automation disabled - only timeout automation remains
            // const currentColor = this.players[this.currentPlayerIndex]?.color;
            // if (currentColor && currentColor !== this.myColor) {
            //     setTimeout(() => this.simulateAITurn(), 250);
            // }
            return;
        }

        // End turn normally
        setTimeout(() => this.endTurn(), 500);
    }

    /**
     * endTurn - End the current player's turn
     * 
     * Resets all turn-related state and moves to next player
     */
    endTurn() {
        this.stopTurnTimer();
        this.currentRolls = [];
        this.hasRolled = false;
        this.consecutiveSixes = 0;
        this.pieceCaptured = false;
        this.lastMoveRoll = null;
        const currentColor = this.players[this.currentPlayerIndex]?.color;
        if (currentColor) {
            this.updateRollsDisplay(currentColor);
        }
        this.nextPlayer();
    }

    /**
     * checkForStack - Check if there are stacked pieces on a tile
     * 
     * A stack forms when:
     * - Multiple pieces of the same color are on the same tile
     * - OR multiple pieces of different colors are on the same tile (after stacking)
     * 
     * @param {string} color - Color of the piece to check
     * @param {number} position - Position of the piece
     * @returns {boolean} True if tile has stacked pieces (safe spot)
     */
    checkForStack(color, position) {
        if (position >= 51 || position === 0) return false;
        
        const pathPos = this.paths[color][position];
        let totalPiecesAtSpot = 0;
        
        Object.entries(this.pieces).forEach(([otherColor, otherPieces]) => {
            otherPieces.forEach(op => {
                if (op.inHome || op.inGoal || op.position >= 51) return;
                const otherPathPos = this.paths[otherColor][op.position];
                if (pathPos.x === otherPathPos.x && pathPos.y === otherPathPos.y) {
                    totalPiecesAtSpot++;
                }
            });
        });
        
        return totalPiecesAtSpot > 1;
    }

    /**
     * checkCapture - Check if a piece captures an opponent
     * 
     * Capture rules:
     * - Can only capture on outer track (positions 0-50)
     * - Cannot capture on safe spots (stars)
     * - Cannot capture on starting positions
     * - Cannot capture if multiple opponent pieces (safe)
     * - Cannot capture if tile is stacked (temporary safe spot)
     * 
     * @param {string} color - Moving piece color
     * @param {Object} piece - Moving piece object
     */
    checkCapture(color, piece) {
        // Can only capture on outer track
        if (piece.position >= 51) return;
        if (piece.position === 0) return;

        const pathPos = this.paths[color][piece.position];
        const safeSpotCoords = [
            { x: 2, y: 8 }, { x: 6, y: 2 }, { x: 12, y: 6 }, { x: 8, y: 12 }
        ];
        const startingSpotCoords = [
            { x: 1, y: 6 }, { x: 8, y: 1 }, { x: 13, y: 8 }, { x: 6, y: 13 }
        ];

        const isSafeSpot = safeSpotCoords.some(s => s.x === pathPos.x && s.y === pathPos.y) ||
                          startingSpotCoords.some(s => s.x === pathPos.x && s.y === pathPos.y);

        if (isSafeSpot) return;

        // Check if this tile is a stack (temporary safe spot)
        if (this.checkForStack(color, piece.position)) return;

        let captured = false;
        Object.entries(this.pieces).forEach(([otherColor, otherPieces]) => {
            if (otherColor === color) return;

            const otherPiecesAtSameSpot = otherPieces.filter(op => {
                if (op.inHome || op.inGoal || op.position >= 51) return false;
                const otherPathPos = this.paths[otherColor][op.position];
                return pathPos.x === otherPathPos.x && pathPos.y === otherPathPos.y;
            });

            // Can't capture if multiple opponent pieces (they protect each other)
            if (otherPiecesAtSameSpot.length > 1) {
                return;
            }

            otherPiecesAtSameSpot.forEach(otherPiece => {
                otherPiece.inHome = true;
                otherPiece.position = -1;
                captured = true;
            });
        });

        if (captured) {
            this.pieceCaptured = true;
        }
    }

    /**
     * getGlobalPosition - Get global position index for collision detection
     * 
     * Converts color-specific position to a global index
     * Used to check if pieces are on the same square
     * 
     * @param {string} color - Piece color
     * @param {number} position - Position on color's path
     * @returns {number} Global position index
     */
    getGlobalPosition(color, position) {
        const coord = this.paths[color][position];
        if (!coord) return -1;
        const k = `${coord.x},${coord.y}`;
        if (position >= 56) {
            const idx = this.mainPathCoordToIndex.get(k);
            if (idx !== undefined) return idx;
            return 10000 + coord.y * 16 + coord.x;
        }
        const startOffsets = { blue: 2, red: 16, green: 30, yellow: 44 };
        return (position + startOffsets[color]) % 56;
    }

    /**
     * checkWin - Check if a player has won
     * 
     * Win condition: all 4 pieces in goal
     * 
     * @param {string} color - Player color
     * @returns {boolean} True if player has won
     */
    checkWin(color) {
        const pieces = this.pieces[color];
        return pieces.every(piece => piece.inGoal);
    }

    // === PROVABLY FAIR DICE ROLLING ===
    // These functions implement cryptographically fair dice rolls
    // using client entropy and SHA-256 hashing

    /**
     * _sha256Bytes - Compute SHA-256 hash of bytes
     * 
     * @param {Uint8Array} bytes - Input bytes
     * @returns {Promise<Uint8Array>} Hash result
     */
    async _sha256Bytes(bytes) {
        const digest = await window.crypto.subtle.digest('SHA-256', bytes);
        return new Uint8Array(digest);
    }

    /**
     * _bytesToHex - Convert bytes to hex string
     * 
     * @param {Uint8Array} bytes - Input bytes
     * @returns {string} Hex string
     */
    _bytesToHex(bytes) {
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * _entropySnapshotToBytes - Convert entropy pool snapshot to bytes
     * 
     * @returns {Uint8Array} Bytes representing entropy state
     */
    _entropySnapshotToBytes() {
        const snap = window.ludoEntropyPool?.getSnapshot?.() || { b0: 0, b1: 0, b2: 0, b3: 0, samples: 0 };
        const out = new Uint8Array(20);
        const view = new DataView(out.buffer);
        view.setUint32(0, snap.b0 >>> 0, false);
        view.setUint32(4, snap.b1 >>> 0, false);
        view.setUint32(8, snap.b2 >>> 0, false);
        view.setUint32(12, snap.b3 >>> 0, false);
        view.setUint32(16, snap.samples >>> 0, false);
        return out;
    }

    /**
     * _mapHashToDie - Map hash bytes to die roll (1-6)
     * 
     * @param {Uint8Array} hashBytes - Hash bytes
     * @param {number} sides - Number of die sides (default 6)
     * @returns {number} Die roll result
     */
    _mapHashToDie(hashBytes, sides = 6) {
        const view = new DataView(hashBytes.buffer, hashBytes.byteOffset, hashBytes.byteLength);
        const u32 = view.getUint32(0, false) >>> 0;
        return (u32 % sides) + 1;
    }

    /**
     * _provablyFairRollDie - Roll die using provably fair algorithm
     * 
     * Process:
     * 1. Generate random server seed
     * 2. Commit to seed (hash it)
     * 3. Combine with client entropy
     * 4. Hash to get result
     * 5. Map to die face
     * 
     * @param {number} sides - Number of sides (default 6)
     * @param {string} rollLabel - Label for logging
     * @returns {Promise<number>} Die roll result
     */
    async _provablyFairRollDie(sides = 6, rollLabel = '') {
        if (!window.crypto?.subtle) {
            return window.ludoRng ? window.ludoRng.rollDie(sides) : Math.floor(Math.random() * sides) + 1;
        }

        const serverSeed = new Uint8Array(32);
        window.crypto.getRandomValues(serverSeed);
        const commitBytes = await this._sha256Bytes(serverSeed);
        const clientSnap = this._entropySnapshotToBytes();

        const rollInput = new Uint8Array(serverSeed.length + clientSnap.length);
        rollInput.set(serverSeed, 0);
        rollInput.set(clientSnap, serverSeed.length);

        const rollHash = await this._sha256Bytes(rollInput);
        const die = this._mapHashToDie(rollHash, sides);

        if (rollLabel) {
            console.log('[ludo.provablyFair]', rollLabel, {
                commit: this._bytesToHex(commitBytes),
                revealSeed: this._bytesToHex(serverSeed),
                die
            });
        } else {
            console.log('[ludo.provablyFair]', {
                commit: this._bytesToHex(commitBytes),
                revealSeed: this._bytesToHex(serverSeed),
                die
            });
        }

        return die;
    }

    /**
     * _backendRollDie - Roll die using backend server ONLY
     *
     * NO fallback - dice rolls MUST come from backend server
     *
     * @param {number} sides - Number of sides
     * @param {string} color - Player color
     * @param {Object} metaOverride - Override entropy metadata
     * @returns {Promise<number>} Die roll result
     */
    async _backendRollDie(sides = 6, color = 'unknown', metaOverride = null) {
        // Backend-only dice rolling - NO fallback
        if (!this.backendBaseUrl) {
            console.error('[ludo.provablyFair] Backend URL not configured. Dice rolls require backend server.');
            throw new Error('Backend server not configured. Dice rolls require backend server at localhost:5179');
        }

        try {
            const entropyBytes = this._entropySnapshotToBytes();
            const entropyHex = this._bytesToHex(entropyBytes);

            const defaultMeta = {
                timeMs: Date.now(),
                pressure: 0,
                vx: 0,
                vy: 0,
                durationMs: 0,
                turnElapsedMs: 0
            };
            const meta = metaOverride || this._lastDiceEntropyMetaForBackend || defaultMeta;

            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const timeoutMs = 5000;

            if (controller) {
                setTimeout(() => controller.abort(), timeoutMs);
            }

            console.log('[ludo.provablyFair] Requesting dice roll from backend:', { sides, color, entropyHex });

            const response = await fetch(`${this.backendBaseUrl}/api/roll`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sides,
                    color,
                    entropyHex,
                    meta
                }),
                signal: controller ? controller.signal : undefined
            });

            if (!response.ok) {
                throw new Error(`Backend responded with ${response.status}`);
            }

            const data = await response.json();
            this._lastRollFromBackend = true;

            // Verify the backend response has expected structure
            if (typeof data.die !== 'number' || data.die < 1 || data.die > sides) {
                throw new Error('Invalid die value from backend');
            }

            console.log('[ludo.provablyFair] Backend roll result:', data.die);
            return data.die;
        } catch (error) {
            console.error('[ludo.provablyFair] Backend roll FAILED - NO FALLBACK:', error.message);
            this._lastRollFromBackend = false;
            // NO FALLBACK - throw error to stop the game
            throw new Error(`Backend dice roll failed: ${error.message}. Please ensure backend server is running at ${this.backendBaseUrl}`);
        }
    }

    /**
     * _aiDiceEntropyMeta - Generate fake entropy metadata for AI rolls
     *
     * Makes AI rolls look like human rolls for consistency
     *
     * @returns {Object} Entropy metadata
     */
    _aiDiceEntropyMeta() {
        const canvasW = this.canvas?.width || 700;
        const canvasH = this.canvas?.height || 700;

        const randU32 = new Uint32Array(6);
        if (window.crypto?.getRandomValues) window.crypto.getRandomValues(randU32);
        else for (let i = 0; i < randU32.length; i++) randU32[i] = Math.floor(Math.random() * 0xFFFFFFFF);

        const x = (randU32[0] / 0xFFFFFFFF) * canvasW;
        const y = (randU32[1] / 0xFFFFFFFF) * canvasH;
        const timeMs = Date.now();

        const pressure = (randU32[2] % 1000) / 1000;
        const vx = ((randU32[3] % 2001) - 1000) / 500;
        const vy = ((randU32[4] % 2001) - 1000) / 500;
        const durationMs = randU32[5] % 1200;
        const turnElapsedMs = Math.floor((typeof this.turnStartAt === 'number' ? (Date.now() - this.turnStartAt) : 0) + (randU32[0] % 25000));

        return { timeMs, pressure, vx, vy, durationMs, turnElapsedMs, x, y };
    }

    /**
     * rollDice - Roll the dice for specified player
     * 
     * Main dice rolling function:
     * 1. Check if player can roll
     * 2. Show rolling animation
     * 3. Get roll result (backend or local)
     * 4. Handle special cases (three 6s, bonus rolls)
     * 5. Enable piece movement
     * 
     * @param {string} playerColor - Color of player rolling the dice (optional)
     */
    rollDice(playerColor = null) {
        // Prevent multiple simultaneous rolls
        if (this.isRolling) {
            console.log('Already rolling, please wait...');
            return;
        }

        // Use provided color or current player's color
        const targetColor = playerColor || this.players[this.currentPlayerIndex]?.color;
        if (!targetColor) return;
        
        // Find the player index for the target color
        const playerIndex = this.players.findIndex(p => p.color === targetColor);
        if (playerIndex === -1) return;
        
        // In debug mode, allow any dice to be rolled for testing
        // In normal mode, only allow rolling during the correct player's turn
        const isDebugMode = this.debugMode && this.debugMode.enabled;
        if (!isDebugMode && playerIndex !== this.currentPlayerIndex) {
            console.log(`Not ${targetColor}'s turn yet. Current turn: ${this.players[this.currentPlayerIndex].color}`);
            return;
        }
        
        if (this.hasRolled) return;
        if (this.currentRolls.length >= 3) return;

        // Set rolling flag to prevent multiple rolls
        this.isRolling = true;

        const { diceId } = this.getUiIdsForColor(targetColor);
        const dice = document.getElementById(diceId);
        if (dice) dice.classList.add('rolling');

        setTimeout(() => {
            (async () => {
                try {
                    this.diceValue = await this._backendRollDie(6, targetColor, this._lastDiceEntropyMetaForBackend);

                    // Debug logging for randomness testing
                    if (this.debugMode.enabled && this.debugMode.showAllRolls) {
                        console.log(`🎲 ${targetColor} rolled: ${this.diceValue} (Backend: ${this._lastRollFromBackend})`);
                        console.log(`   Entropy:`, this._lastDiceEntropyMetaForBackend);
                    }

                    this.updateDiceDisplay(this.diceValue, targetColor);
                    if (dice) dice.classList.remove('rolling');

                    // Send dice roll to server if in multiplayer game
                    if (this.roomCode && this.isConnected) {
                        this.sendToServer({
                            type: 'rollDice',
                            roomCode: this.roomCode,
                            playerColor: targetColor,
                            diceValue: this.diceValue
                        });
                    }

                    this.currentRolls.push(this.diceValue);
                    this.updateRollsDisplay(targetColor);

                    // Handle rolling 6
                    if (this.diceValue === 6) {
                        this.consecutiveSixes++;

                        // Three 6s in a row = turn lost
                        if (this.consecutiveSixes === 3) {
                            alert(`${targetColor} rolled three 6s in a row! Turn is void.`);
                            this.currentRolls = [];
                            this.consecutiveSixes = 0;
                            this.hasRolled = false;
                            this.updateRollsDisplay(targetColor);
                            setTimeout(() => {
                                this.nextPlayer();
                            }, 1000);
                            return;
                        }
                        this.hasRolled = false;
                        const pieces6 = this.pieces[targetColor];
                        const canMoveNow = pieces6.some((piece) => this.canPieceUseAnyRoll(piece, targetColor));
                        if (!canMoveNow) {
                            setTimeout(() => this.endTurn(), 1000);
                            return;
                        }
                        this.canMove = canMoveNow;
                        this.movablePieces = [];
                        if (canMoveNow) this.highlightMovablePieces(targetColor);
                        this.updateCurrentPlayerDisplay();
                        return;
                    }
                    this.consecutiveSixes = 0;

                    this.hasRolled = true;

                    // Check if any piece can move
                    const pieces = this.pieces[targetColor];
                    const canMove = pieces.some(piece => {
                        return this.canPieceUseAnyRoll(piece, targetColor);
                    });

                    if (canMove) {
                        this.canMove = true;
                        this.highlightMovablePieces(targetColor);
                    } else {
                        setTimeout(() => {
                            this.endTurn();
                        }, 1000);
                    }
                    this.updateCurrentPlayerDisplay();
                } finally {
                    // Clear rolling flag
                    this.isRolling = false;
                }
            })();
        }, 500);
    }

    /**
     * canPieceUseAnyRoll - Check if a piece can use any available roll
     * 
     * @param {Object} piece - Piece object
     * @param {string} color - Piece color
     * @returns {boolean} True if piece can move
     */
    canPieceUseAnyRoll(piece, color) {
        return this.currentRolls.some(roll => {
            if (piece.inHome) return roll === 6;
            if (piece.inGoal) return false;
            const newPos = piece.position + roll;
            return newPos <= 56;
        });
    }

    /**
     * updateRollsDisplay - Update the UI display of remaining rolls
     * 
     * @param {string} color - Player color
     */
    updateRollsDisplay(color) {
        const { rollsId } = this.getUiIdsForColor(color);
        const rollsElement = document.getElementById(rollsId);
        if (rollsElement) {
            rollsElement.innerHTML = '';
            this.currentRolls.forEach(roll => {
                const badge = document.createElement('div');
                badge.className = 'roll-badge';
                badge.textContent = roll;
                rollsElement.appendChild(badge);
            });
        }
    }

    /**
     * nextPlayer - Move to the next player's turn
     * 
     * Resets turn state and updates display
     */
    nextPlayer() {
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        this.canMove = false;
        this.movablePieces = [];
        this.selectedPiece = null;
        this.consecutiveSixes = 0;
        this.currentRolls = [];
        this.hasRolled = false;
        this.pieceCaptured = false;
        this.lastMoveRoll = null;
        
        // Send turn change to server in multiplayer
        if (this.roomCode && this.isConnected) {
            this.sendToServer({
                type: 'turnChanged',
                roomCode: this.roomCode,
                currentPlayer: this.players[this.currentPlayerIndex].color
            });
        }
        
        this.updateCurrentPlayerDisplay();
        this.drawBoard();

        // AI automation disabled - other players wait for human interaction
        // if (this.players[this.currentPlayerIndex].color !== this.myColor) {
        //     setTimeout(() => this.simulateAITurn(), 1500);
        // }
    }

    /**
     * updateDiceDisplay - Update the visual dice display
     * 
     * Shows dots in standard dice pattern
     * 
     * @param {number} value - Dice value (1-6)
     * @param {string} color - Player color (or null for all)
     */
    updateDiceDisplay(value, color = null) {
        const dotPositions = {
            1: [4],
            2: [0, 8],
            3: [0, 4, 8],
            4: [0, 2, 6, 8],
            5: [0, 2, 4, 6, 8],
            6: [0, 2, 3, 5, 6, 8]
        };

        if (color) {
            const { diceId } = this.getUiIdsForColor(color);
            const diceEl = document.getElementById(diceId);
            const diceDots = document.querySelector(`#${diceId} .dice-dots-small`);
            
            if (diceDots) {
                // Clear all dots completely
                diceDots.innerHTML = '';
                
                // Create grid container for dots
                diceDots.style.display = 'grid';
                diceDots.style.gridTemplateColumns = 'repeat(3, 1fr)';
                diceDots.style.gridTemplateRows = 'repeat(3, 1fr)';
                diceDots.style.gap = '2px';
                diceDots.style.padding = '8px';
                
                // Create exactly 9 cells
                for (let i = 0; i < 9; i++) {
                    const cell = document.createElement('div');
                    cell.style.width = '10px';
                    cell.style.height = '10px';
                    cell.style.display = 'flex';
                    cell.style.alignItems = 'center';
                    cell.style.justifyContent = 'center';
                    
                    // Only show dots for valid positions
                    if (dotPositions[value] && dotPositions[value].includes(i)) {
                        const dot = document.createElement('div');
                        dot.style.width = '6px';
                        dot.style.height = '6px';
                        dot.style.backgroundColor = '#F4F7FA';
                        dot.style.borderRadius = '50%';
                        dot.style.boxShadow = '0 1px 2px rgba(0,0,0,0.3)';
                        cell.appendChild(dot);
                    }
                    
                    diceDots.appendChild(cell);
                }
                
                this.playerDice[color] = value;
            }
            
            if (diceEl) {
                diceEl.dataset.value = String(value);
                diceEl.dataset.rollSource = this._lastRollFromBackend ? 'backend' : 'fallback';
            }
        } else {
            Object.keys(this.playerDice).forEach(c => {
                this.updateDiceDisplay(this.playerDice[c], c);
            });
        }
    }

    /**
     * simulateAITurn - Simulate AI player's turn
     * 
     * AI behavior:
     * 1. Roll dice
     * 2. Handle 6s (bonus rolls)
     * 3. Move random movable piece
     */
    simulateAITurn() {
        if (!this.players[this.currentPlayerIndex]) return;
        if (this.players[this.currentPlayerIndex].color === this.myColor) return;

        if (this.hasRolled) {
            this.simulateAIMove();
            return;
        }

        if (this.currentRolls.length >= 3) {
            this.simulateAIMove();
            return;
        }

        const currentColor = this.players[this.currentPlayerIndex].color;
        const { diceId } = this.getUiIdsForColor(currentColor);
        const dice = document.getElementById(diceId);
        if (dice) dice.classList.add('rolling');

        setTimeout(() => {
            (async () => {
                const aiMeta = this._aiDiceEntropyMeta();
                this.addEntropySample({
                    x: aiMeta.x,
                    y: aiMeta.y,
                    t: aiMeta.timeMs,
                    pressure: aiMeta.pressure,
                    vx: aiMeta.vx,
                    vy: aiMeta.vy,
                    duration: aiMeta.durationMs,
                    turnElapsedMs: aiMeta.turnElapsedMs
                });
                this.diceValue = await this._backendRollDie(6, currentColor, aiMeta);

                this.updateDiceDisplay(this.diceValue, currentColor);
                if (dice) dice.classList.remove('rolling');

                this.currentRolls.push(this.diceValue);
                this.updateRollsDisplay(currentColor);

                if (this.diceValue === 6) {
                    this.consecutiveSixes++;

                    if (this.consecutiveSixes === 3) {
                        this.currentRolls = [];
                        this.consecutiveSixes = 0;
                        this.hasRolled = false;
                        this.updateRollsDisplay(currentColor);
                        setTimeout(() => {
                            this.nextPlayer();
                        }, 1000);
                        return;
                    }
                    this.hasRolled = false;
                    const pieces6 = this.pieces[currentColor];
                    const canMoveNow = pieces6.some((p) => this.canPieceUseAnyRoll(p, currentColor));
                    this.canMove = canMoveNow && this.isHumanLocalTurn();
                    this.movablePieces = [];
                    if (canMoveNow) {
                        this.highlightMovablePieces(currentColor);
                    }
                    setTimeout(() => this.simulateAITurn(), 450);
                    return;
                }
                this.consecutiveSixes = 0;

                this.hasRolled = true;
                this.canMove = false;
                setTimeout(() => this.simulateAIMove(), 650);
            })();
        }, 500);
    }

    /**
     * simulateAIMove - AI moves a random piece
     * 
     * Simple AI: picks random movable piece and random valid roll
     */
    simulateAIMove() {
        const currentColor = this.players[this.currentPlayerIndex].color;
        const pieces = this.pieces[currentColor];

        const movablePieces = pieces.filter((piece, index) => {
            return this.canPieceUseAnyRoll(piece, currentColor);
        });

        if (movablePieces.length > 0) {
            const pieceIndexChoice = window.ludoRng ? window.ludoRng.rollDie(movablePieces.length) - 1 : Math.floor(Math.random() * movablePieces.length);
            const randomPiece = movablePieces[pieceIndexChoice];
            const pieceIndex = pieces.indexOf(randomPiece);
            const validRolls = this.getValidRollsForPiece(randomPiece, currentColor);
            const rollChoice = window.ludoRng ? window.ludoRng.rollDie(validRolls.length) - 1 : Math.floor(Math.random() * validRolls.length);
            const selectedRoll = validRolls[rollChoice];

            setTimeout(() => {
                this.movePieceWithRoll(currentColor, pieceIndex, selectedRoll);
            }, 500);
        } else {
            setTimeout(() => {
                this.endTurn();
            }, 1000);
        }
    }

    /**
     * updateCurrentPlayerDisplay - Update UI for current player
     * 
     * Highlights current player with avatar glow, shows timer, enables dice
     */
    updateCurrentPlayerDisplay() {
        if (!this.players[this.currentPlayerIndex]) return;

        const currentColor = this.players[this.currentPlayerIndex].color;

        ['red', 'green', 'yellow', 'blue'].forEach(color => {
            const { avatarId, timerId, diceId } = this.getUiIdsForColor(color);
            const avatar = document.getElementById(avatarId);
            const timerElement = document.getElementById(timerId);
            const diceElement = document.getElementById(diceId);

            if (avatar) {
                if (color === currentColor) {
                    avatar.classList.add('active');
                } else {
                    avatar.classList.remove('active');
                }
            }

            if (timerElement) {
                if (color === currentColor) {
                    timerElement.classList.add('active');
                } else {
                    timerElement.classList.remove('active');
                }
            }

            if (diceElement) {
                const isCurrentPlayer = color === currentColor;
                const isMyTurn = color === this.myColor;
                const canRollNow = !this.hasRolled && this.currentRolls.length === 0;

                const clickable = isCurrentPlayer && canRollNow;
                diceElement.style.cursor = clickable ? 'pointer' : 'default';
                diceElement.style.opacity = isCurrentPlayer ? '1' : '0.7';
                diceElement.style.pointerEvents = clickable ? 'auto' : 'none';

                if (isCurrentPlayer && canRollNow) {
                    diceElement.classList.add('current-player-dice');
                } else {
                    diceElement.classList.remove('current-player-dice');
                }
            }
        });

        if (this.canvas && this.gameState === 'playing') {
            this.canvas.style.pointerEvents = this.isHumanLocalTurn() ? 'auto' : 'none';
        }

        this.startTurnTimer();
    }

    /**
     * startTurnTimer - Start the 30-second turn timer
     * 
     * Counts down and auto-plays if time runs out
     */
    startTurnTimer() {
        if (this.turnTimer) {
            clearInterval(this.turnTimer);
            this.turnTimer = null;
        }

        const currentColor = this.players[this.currentPlayerIndex]?.color;
        if (!currentColor) return;
        
        const { timerId } = this.getUiIdsForColor(currentColor);
        const timerElement = document.getElementById(timerId);

        this.turnStartAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        this.turnTimeRemaining = 30;

        if (timerElement) {
            timerElement.classList.add('active');
            timerElement.textContent = String(this.turnTimeRemaining);
        }

        const tick = () => {
            const el = document.getElementById(timerId);
            if (el) el.textContent = String(this.turnTimeRemaining);
        };
        tick();

        this.turnTimer = setInterval(() => {
            this.turnTimeRemaining--;
            tick();

            if (this.turnTimeRemaining <= 0) {
                clearInterval(this.turnTimer);
                this.turnTimer = null;
                // Only auto-play if it's the local player's turn
                if (currentColor === this.myColor) {
                    this.onTurnTimerExpired();
                }
            }
        }, 1000);
    }

    /**
     * onTurnTimerExpired - Handle turn timer expiration
     * 
     * Auto-plays human's turn if they run out of time
     */
    onTurnTimerExpired() {
        const currentColor = this.players[this.currentPlayerIndex]?.color;
        if (!currentColor || currentColor !== this.myColor) return;

        this.autoPlayHumanTurn();
    }

    /**
     * autoPlayHumanTurn - Auto-play when human runs out of time
     * 
     * Priorities:
     * 1. Move if possible
     * 2. Roll if allowed
     * 3. End turn
     */
    autoPlayHumanTurn() {
        const c = this.players[this.currentPlayerIndex]?.color;
        if (!c || c !== this.myColor) {
            this.endTurn();
            return;
        }

        // Enhanced auto-play with advanced strategic AI decision making
        if (this.currentRolls.length > 0) {
            const canAny = this.pieces[c].some((p) => this.canPieceUseAnyRoll(p, c));
            if (canAny && (!this.movablePieces || this.movablePieces.length === 0)) {
                this.hasRolled = true;
                this.canMove = true;
                this.highlightMovablePieces(c);
            }
        }

        if (this.canMove && this.movablePieces && this.movablePieces.length > 0) {
            // Advanced strategic AI decision making
            const gameState = this.analyzeGameState();
            let bestMove = this.findBestStrategicMove(c, gameState);
            
            if (bestMove) {
                this.movePieceWithRoll(c, bestMove.pieceIndex, bestMove.roll);
                return;
            }
        }

        if (!this.hasRolled && this.currentRolls.length === 0) {
            this.rollDice();
            return;
        }

        this.endTurn();
    }

    analyzeGameState() {
        const state = {
            turnCount: this.calculateTurnCount(),
            myProgress: {},
            enemyProgress: {},
            threats: {},
            opportunities: {},
            gamePhase: 'early' // early, mid, late
        };

        // Analyze each player's progress
        this.colors.forEach(color => {
            const pieces = this.pieces[color];
            let totalProgress = 0;
            let piecesAtHome = 0;
            let piecesInGoal = 0;
            let piecesOnMainTrack = 0;
            let avgPosition = 0;

            pieces.forEach(piece => {
                if (piece.inHome) {
                    piecesAtHome++;
                } else if (piece.inGoal) {
                    piecesInGoal++;
                    totalProgress += 56; // Max progress for goal
                } else if (piece.position >= 0) {
                    piecesOnMainTrack++;
                    totalProgress += piece.position;
                    avgPosition += piece.position;
                }
            });

            avgPosition = piecesOnMainTrack > 0 ? avgPosition / piecesOnMainTrack : 0;

            state[color === this.myColor ? 'myProgress' : 'enemyProgress'][color] = {
                totalProgress,
                piecesAtHome,
                piecesInGoal,
                piecesOnMainTrack,
                avgPosition,
                winningProbability: this.calculateWinningProbability(color, totalProgress, piecesInGoal)
            };
        });

        // Determine game phase
        const myTotalProgress = state.myProgress[this.myColor]?.totalProgress || 0;
        if (myTotalProgress < 100) state.gamePhase = 'early';
        else if (myTotalProgress < 200) state.gamePhase = 'mid';
        else state.gamePhase = 'late';

        // Analyze threats and opportunities
        state.threats = this.findThreats();
        state.opportunities = this.findOpportunities();

        return state;
    }

    calculateWinningProbability(color, totalProgress, piecesInGoal) {
        // Simple heuristic based on progress and pieces in goal
        const progressScore = totalProgress / (4 * 56); // Normalized progress
        const goalScore = piecesInGoal / 4; // Pieces in goal
        return (progressScore * 0.7 + goalScore * 0.3);
    }

    findThreats() {
        const threats = {};
        const myColor = this.myColor;
        const myPieces = this.pieces[myColor];

        this.colors.forEach(enemyColor => {
            if (enemyColor === myColor) return;
            
            const enemyPieces = this.pieces[enemyColor];
            threats[enemyColor] = [];

            enemyPieces.forEach((enemyPiece, enemyIndex) => {
                if (enemyPiece.inHome || enemyPiece.inGoal) return;

                // Check if enemy can capture my pieces
                myPieces.forEach((myPiece, myIndex) => {
                    if (myPiece.inHome || myPiece.inGoal) return;

                    for (let roll = 1; roll <= 6; roll++) {
                        if (this.canPieceMoveTo(enemyPiece, enemyColor, myPiece.position, roll)) {
                            threats[enemyColor].push({
                                enemyPiece: enemyIndex,
                                targetPiece: myIndex,
                                roll: roll,
                                priority: this.calculateThreatPriority(myPiece, enemyPiece)
                            });
                        }
                    }
                });
            });
        });

        return threats;
    }

    findOpportunities() {
        const opportunities = {};
        const myColor = this.myColor;
        const myPieces = this.pieces[myColor];

        this.colors.forEach(enemyColor => {
            if (enemyColor === myColor) return;
            
            const enemyPieces = this.pieces[enemyColor];
            opportunities[enemyColor] = [];

            myPieces.forEach((myPiece, myIndex) => {
                if (myPiece.inHome || myPiece.inGoal) return;

                // Check if I can capture enemy pieces
                enemyPieces.forEach((enemyPiece, enemyIndex) => {
                    if (enemyPiece.inHome || enemyPiece.inGoal) return;

                    for (let roll = 1; roll <= 6; roll++) {
                        if (this.canPieceUseRoll(myPiece, myColor, roll) && 
                            this.canPieceMoveTo(myPiece, myColor, enemyPiece.position, roll)) {
                            opportunities[enemyColor].push({
                                myPiece: myIndex,
                                targetPiece: enemyIndex,
                                roll: roll,
                                priority: this.calculateOpportunityPriority(enemyPiece)
                            });
                        }
                    }
                });
            });
        });

        return opportunities;
    }

    calculateThreatPriority(myPiece, enemyPiece) {
        let priority = 10; // Base priority

        // Higher priority if my piece is advanced
        if (myPiece.position > 40) priority += 15;
        else if (myPiece.position > 25) priority += 10;

        // Higher priority if my piece is in home column
        if (myPiece.position >= 51) priority += 20;

        return priority;
    }

    calculateOpportunityPriority(enemyPiece) {
        let priority = 10; // Base priority

        // Higher priority if enemy piece is advanced
        if (enemyPiece.position > 40) priority += 20;
        else if (enemyPiece.position > 25) priority += 15;

        // Higher priority if enemy piece is in home column
        if (enemyPiece.position >= 51) priority += 25;

        return priority;
    }

    findBestStrategicMove(color, gameState) {
        let bestMove = null;
        let bestScore = -Infinity;

        for (const idx of this.movablePieces) {
            const piece = this.pieces[color][idx];
            const validRolls = this.getValidRollsForPiece(piece, color);
            
            for (const roll of validRolls) {
                let score = this.evaluateMove(piece, idx, roll, color, gameState);
                
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = { pieceIndex: idx, roll, score };
                }
            }
        }

        return bestMove;
    }

    evaluateMove(piece, pieceIndex, roll, color, gameState) {
        let score = 0;
        const newPosition = this.calculateNewPosition(piece, color, roll);
        
        // Base score from roll value
        score += roll * 2;

        // Game phase specific strategies
        if (gameState.gamePhase === 'early') {
            // Early game: prioritize getting pieces out
            if (piece.inHome && roll === 6) score += 50;
            // Avoid risky advances early
            if (newPosition > 20 && !this.isPositionSafe(newPosition, color)) score -= 20;
        } else if (gameState.gamePhase === 'mid') {
            // Mid game: balance advancement and safety
            if (piece.inHome && roll === 6) score += 30;
            if (newPosition > 30) score += 15;
            if (this.isPositionSafe(newPosition, color)) score += 10;
        } else {
            // Late game: aggressive advancement to goal
            if (newPosition >= 56) score += 100; // Reaching goal
            else if (newPosition >= 51) score += 40; // Home column
            else if (newPosition > 40) score += 25;
        }

        // Capture opportunities
        const captureOpportunity = this.findCaptureOpportunity(piece, roll, color);
        if (captureOpportunity) {
            score += 30 + captureOpportunity.priority;
        }

        // Threat avoidance
        const threatLevel = this.calculateThreatLevel(newPosition, color);
        score -= threatLevel * 15;

        // Safe position bonus
        if (this.isPositionSafe(newPosition, color)) {
            score += gameState.gamePhase === 'late' ? 5 : 15;
        }

        // Block enemy home column entry
        if (this.blocksEnemyHomeEntry(newPosition, color)) {
            score += 20;
        }

        // Form safe stacks (multiple pieces on same spot)
        if (this.canFormSafeStack(newPosition, color)) {
            score += 12;
        }

        // Winning urgency - if someone is close to winning
        const winningUrgency = this.calculateWinningUrgency(gameState);
        if (winningUrgency > 0.7) {
            // Play more aggressively when someone is about to win
            if (newPosition > 45) score += 30;
            if (captureOpportunity) score += 20;
        }

        return score;
    }

    calculateNewPosition(piece, color, roll) {
        if (piece.inHome) {
            return roll === 6 ? 0 : -1; // Can only leave home with 6
        }
        
        let newPos = piece.position + roll;
        
        // Check if entering home column
        const homeEntryPos = this.getHomeEntryPosition(color);
        if (piece.position < homeEntryPos && newPos >= homeEntryPos) {
            // Calculate position in home column
            const overshoot = newPos - homeEntryPos;
            if (overshoot <= 5) {
                return 51 + overshoot; // Home column positions 51-55
            }
        }
        
        // Check if reaching goal
        if (newPos >= 56) return 56; // Goal
        
        return newPos;
    }

    findCaptureOpportunity(piece, roll, color) {
        const newPosition = this.calculateNewPosition(piece, color, roll);
        if (newPosition < 0 || newPosition >= 56) return null;

        // Check if any enemy piece is at this position
        for (const enemyColor of this.colors) {
            if (enemyColor === color) continue;
            
            const enemyPieces = this.pieces[enemyColor];
            for (let i = 0; i < enemyPieces.length; i++) {
                const enemyPiece = enemyPieces[i];
                if (enemyPiece.position === newPosition && !enemyPiece.inHome && !enemyPiece.inGoal) {
                    return { enemyColor, pieceIndex: i, priority: this.calculateOpportunityPriority(enemyPiece) };
                }
            }
        }
        
        return null;
    }

    calculateThreatLevel(position, color) {
        if (position < 0 || position >= 56) return 0;
        
        let threatLevel = 0;
        
        // Check how many enemy pieces can reach this position
        for (const enemyColor of this.colors) {
            if (enemyColor === color) continue;
            
            const enemyPieces = this.pieces[enemyColor];
            enemyPieces.forEach(enemyPiece => {
                if (enemyPiece.inHome || enemyPiece.inGoal) return;
                
                // Check if enemy can reach this position within 6 moves
                const distance = this.calculateDistance(enemyPiece.position, position, enemyColor);
                if (distance <= 6) {
                    threatLevel += (7 - distance); // Higher threat for closer enemies
                }
            });
        }
        
        return Math.min(threatLevel, 10); // Cap at 10
    }

    isPositionSafe(position, color) {
        // A position is safe if it's a star spot or if we have multiple pieces there
        const starSpots = [0, 8, 13, 21, 26, 34, 39, 47]; // Safe star positions
        if (starSpots.includes(position)) return true;
        
        // Check if we already have pieces at this position
        for (let i = 0; i < this.pieces[color].length; i++) {
            const piece = this.pieces[color][i];
            if (piece.position === position && !piece.inHome && !piece.inGoal) {
                return true; // Safe stack
            }
        }
        
        return false;
    }

    blocksEnemyHomeEntry(position, color) {
        // Check if this position blocks an enemy's home entry
        const enemyHomeEntries = {
            red: 13,
            green: 26,
            yellow: 39,
            blue: 0
        };
        
        for (const [enemyColor, entryPos] of Object.entries(enemyHomeEntries)) {
            if (enemyColor === color) continue;
            if (position === entryPos) return true;
        }
        
        return false;
    }

    canFormSafeStack(newPosition, color) {
        // Check if we can form a stack of 2+ pieces at this position
        let piecesAtPosition = 0;
        for (const piece of this.pieces[color]) {
            if (piece.position === newPosition && !piece.inHome && !piece.inGoal) {
                piecesAtPosition++;
            }
        }
        return piecesAtPosition >= 1;
    }

    calculateWinningUrgency(gameState) {
        let maxProgress = 0;
        
        // Find the player with highest progress
        for (const [color, progress] of Object.entries(gameState.enemyProgress)) {
            maxProgress = Math.max(maxProgress, progress.totalProgress);
        }
        
        for (const [color, progress] of Object.entries(gameState.myProgress)) {
            maxProgress = Math.max(maxProgress, progress.totalProgress);
        }
        
        // High urgency if someone has >200 progress (close to winning)
        return Math.min(maxProgress / 224, 1.0); // Normalize to 0-1
    }

    calculateDistance(fromPos, toPos, color) {
        // Calculate distance along the path for a specific color
        const path = this.paths[color];
        const fromIndex = path.findIndex(p => p.x === this.getCoordinatesFromPosition(fromPos, color).x && 
                                              p.y === this.getCoordinatesFromPosition(fromPos, color).y);
        const toIndex = path.findIndex(p => p.x === this.getCoordinatesFromPosition(toPos, color).x && 
                                            p.y === this.getCoordinatesFromPosition(toPos, color).y);
        
        if (fromIndex === -1 || toIndex === -1) return Infinity;
        
        return (toIndex - fromIndex + path.length) % path.length;
    }

    getCoordinatesFromPosition(position, color) {
        if (position < 0 || position >= 56) return { x: -1, y: -1 };
        return this.paths[color][position] || { x: -1, y: -1 };
    }

    getHomeEntryPosition(color) {
        const entries = { red: 13, green: 26, yellow: 39, blue: 0 };
        return entries[color];
    }

    calculateTurnCount() {
        // Simple estimation of turn count based on game state
        let totalMoves = 0;
        this.colors.forEach(color => {
            this.pieces[color].forEach(piece => {
                if (!piece.inHome) totalMoves++;
            });
        });
        return totalMoves;
    }

    /**
     * stopTurnTimer - Stop the turn timer
     */
    stopTurnTimer() {
        if (this.turnTimer) {
            clearInterval(this.turnTimer);
            this.turnTimer = null;
        }
        const currentColor = this.players[this.currentPlayerIndex]?.color;
        if (currentColor) {
            const { timerId } = this.getUiIdsForColor(currentColor);
            const timerElement = document.getElementById(timerId);
            if (timerElement) timerElement.classList.remove('active');
        }
    }

    /**
     * generateRoomCode - Generate a random 6-character room code
     * 
     * @returns {string} Room code (e.g., "ABC123")
     */
    generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            const idx = window.ludoRng ? window.ludoRng.rollDie(chars.length) - 1 : Math.floor(Math.random() * chars.length);
            code += chars.charAt(idx);
        }
        return code;
    }

    /**
     * copyRoomCode - Copy room code to clipboard
     */
    copyRoomCode() {
        navigator.clipboard.writeText(this.roomCode);
        const btn = document.getElementById('copyCodeBtn');
        btn.textContent = 'Copied!';
        setTimeout(() => {
            btn.textContent = 'Copy';
        }, 2000);
    }

    /**
     * showMenuScreen - Show the main menu screen
     */
    showMenuScreen() {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('menu-screen').classList.add('active');
    }

    /**
     * showLobbyScreen - Show the lobby screen
     */
    showLobbyScreen() {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('lobby-screen').classList.add('active');
    }

    /**
     * showJoinScreen - Show the join game screen
     */
    showJoinScreen() {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('join-screen').classList.add('active');
    }

    /**
     * showGameScreen - Show the game screen
     */
    showGameScreen() {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('game-screen').classList.add('active');
    }

    /**
     * backToMenu - Return to main menu
     */
    backToMenu() {
        this.players = [];
        this.mockPlayers = [];
        this.showMenuScreen();
    }

    /**
     * exitGame - Exit the game
     */
    exitGame() {
        this.gameState = 'waiting';
        if (this.canvas) this.canvas.style.pointerEvents = '';
        this.syncBoardWrapperTilt();
        this.showMenuScreen();
    }
}

// === GAME INSTANCE ===
// Create the single game instance
const game = new LudoGame();

// === DEBUG HELPERS ===
// Quick dice distribution test for the provably-fair dice.
// Usage in console: `window.ludoFairTest(200)`
window.ludoFairTest = async (count = 120) => {
    const counts = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < count; i++) {
        const die = await game._provablyFairRollDie(6, 'test');
        counts[die - 1]++;
    }
    console.log('[ludoFairTest]', { count, counts });
    return { count, counts };
};

// Debug helpers (enabled only with `?debug=1` in URL)
if (typeof window !== 'undefined' && typeof location !== 'undefined' && location.search.includes('debug=1')) {
    window.ludoDebug = {
        forceTurn(color) {
            const idx = game.players.findIndex(p => p.color === color);
            if (idx < 0) throw new Error(`Unknown player color: ${color}`);
            game.currentPlayerIndex = idx;
            game.currentRolls = [];
            game.hasRolled = false;
            game.consecutiveSixes = 0;
            game.canMove = false;
            game.movablePieces = [];
            game.updateRollsDisplay(color);
            game.updateCurrentPlayerDisplay();
            game.drawBoard();
        },
        forceRoll(value) {
            const currentColor = game.players[game.currentPlayerIndex]?.color;
            if (!currentColor) throw new Error('No current player');
            game.diceValue = value;
            game.currentRolls = [value];
            game.hasRolled = true;
            game.updateDiceDisplay(value, currentColor);
            game.updateRollsDisplay(currentColor);
            const pieces = game.pieces[currentColor];
            const canMove = pieces.some(piece => game.canPieceUseAnyRoll(piece, currentColor));
            game.canMove = canMove;
            if (canMove) game.highlightMovablePieces(currentColor);
            game.drawBoard();
        }
    };
    console.log('[ludoDebug] enabled. Try window.ludoDebug.forceTurn("blue"); window.ludoDebug.forceRoll(6);');

    const panel = document.getElementById('debugPanel');
    if (panel) {
        panel.classList.add('active');

        const turnSelect = document.getElementById('debugTurnSelect');
        const rollSelect = document.getElementById('debugRollSelect');
        const statusEl = document.getElementById('debugStatus');

        const renderStatus = () => {
            const current = game.players[game.currentPlayerIndex]?.color;
            const me = game.myColor;
            const pieces = me ? game.pieces[me] : [];
            const briefPieces = pieces.map(p => ({
                id: p.id,
                inHome: p.inHome,
                inGoal: p.inGoal,
                pos: p.position
            }));
            const movable = (game.movablePieces || []).slice();
            const rolls = (game.currentRolls || []).slice();
            const lines = [
                `myColor: ${me}`,
                `currentPlayer: ${current}`,
                `diceValue: ${game.diceValue}`,
                `hasRolled: ${game.hasRolled}`,
                `canMove: ${game.canMove}`,
                `currentRolls: ${JSON.stringify(rolls)}`,
                `movablePieces: ${JSON.stringify(movable)}`,
                `pieces[myColor]: ${JSON.stringify(briefPieces)}`
            ];
            if (statusEl) statusEl.textContent = lines.join('\n');
        };

        const bindBtn = (id, fn) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('click', () => {
                try {
                    fn();
                } finally {
                    renderStatus();
                }
            });
        };

        bindBtn('debugForceTurnBtn', () => {
            const c = turnSelect?.value || 'red';
            window.ludoDebug.forceTurn(c);
        });
        bindBtn('debugForceRollBtn', () => {
            const v = Number(rollSelect?.value || 6);
            window.ludoDebug.forceRoll(v);
        });
        bindBtn('debugMoveFirstBtn', () => {
            const currentColor = game.players[game.currentPlayerIndex]?.color;
            if (!currentColor) return;
            if (!game.canMove || !Array.isArray(game.movablePieces) || game.movablePieces.length === 0) return;
            const idx = game.movablePieces[0];
            game.selectAndMovePiece(currentColor, idx);
        });
        bindBtn('debugResetBtn', () => {
            location.reload();
        });

        setInterval(renderStatus, 300);
        renderStatus();
    }
}

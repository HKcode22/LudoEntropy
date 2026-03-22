class LudoGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.isHost = false;
        this.roomCode = null;
        this.players = [];
        this.currentPlayerIndex = 0;
        this.diceValue = 1;
        this.gameState = 'waiting';
        this.myColor = null;
        this.selectedPiece = null;
        this.canMove = false;
        this.movablePieces = [];
        this.consecutiveSixes = 0;
        this.currentRolls = [];
        this.hasRolled = false;
        this.selectedRoll = null;
        this.pieceCaptured = false;
        this.rollsRemaining = 1;
        this.lastMoveRoll = null;
        this.turnTimer = null;
        this.turnTimeRemaining = 30;
        this._lastRollFromBackend = false;
        /** Rotate board so `myColor`'s home sits toward the bottom (POV). */
        this.povRotationRad = 0;
        
        this.colors = ['red', 'green', 'yellow', 'blue'];
        this.colorMap = {
            red: '#E74A3F',
            green: '#1FB85C',
            yellow: '#E4BB1C',
            blue: '#2587D9'
        };

        // Local prototype backend for dice randomness.
        // Run: `node backend/server.js` on http://localhost:5178
        // Prefer the local backend during development so dice rolls are driven by the server RNG.
        // This should work even when opening via `file://` (hostname may be empty).
        this.backendBaseUrl = (() => {
            if (typeof window === 'undefined' || !window.location) return '';
            const hostname = String(window.location.hostname || '');
            const isLocal =
                hostname === 'localhost' ||
                hostname === '127.0.0.1' ||
                hostname === '' ||
                hostname.endsWith('.local');
            return isLocal ? 'http://localhost:5178' : '';
        })();
        
        this.initializeBoard();
        this.resizeCanvasForDPR();
        this.initializeEventListeners();
        this.initializeWebSocket();
    }

    // Convert DOM pointer coordinates (CSS pixels) to canvas coordinates.
    // This is required because the canvas is visually scaled via CSS.
    getCanvasPointFromEvent(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        let x = (e.clientX - rect.left) * scaleX;
        let y = (e.clientY - rect.top) * scaleY;
        if (this.gameState === 'playing' && this.povRotationRad) {
            const cx = this.canvas.width / 2;
            const cy = this.canvas.height / 2;
            const dx = x - cx;
            const dy = y - cy;
            const cos = Math.cos(-this.povRotationRad);
            const sin = Math.sin(-this.povRotationRad);
            x = dx * cos - dy * sin + cx;
            y = dx * sin + dy * cos + cy;
        }
        return { x, y, rect, scaleX, scaleY };
    }

    /**
     * Rotate the board so your home area sits at the bottom of the screen.
     * Home areas on the board: blue=top-left(0,0), red=top-right(9,0),
     * yellow=bottom-left(0,9), green=bottom-right(9,9)
     */
    getPovRotationRad() {
        if (!this.myColor) return 0;
        // To bring each home to the bottom, we rotate around the center (7.5, 7.5)
        // blue (top-left): rotate -90° (CCW) -> moves to bottom-left
        // red (top-right): rotate 180° -> moves to bottom-right
        // yellow (bottom-left): rotate 0° -> stays at bottom-left
        // green (bottom-right): rotate 90° (CW) -> moves to bottom-right
        const rotations = {
            blue: -Math.PI / 2,   // -90° CCW
            red: Math.PI,          // 180°
            yellow: 0,             // 0° (no rotation)
            green: Math.PI / 2     // 90° CW
        };
        return rotations[this.myColor] || 0;
    }

    syncBoardWrapperTilt() {
        const wrap = document.querySelector('.board-wrapper');
        if (!wrap) return;
        // Disable tilt to prevent clipping - board is shown flat
        wrap.classList.remove('board-pov-tilt');
    }

    /** Only the human may act on the canvas during their turn (not when AI opponents play). */
    isHumanLocalTurn() {
        const p = this.players[this.currentPlayerIndex];
        return !!(this.gameState === 'playing' && p && p.color === this.myColor);
    }

    /** 3×3 center block (cells 6–8): drawn as triangles only, not as 9 path squares. */
    isCenterBlockCell(x, y) {
        return x >= 6 && x <= 8 && y >= 6 && y <= 8;
    }

    resizeCanvasForDPR() {
        if (typeof window === 'undefined') return;
        if (!this.canvas || !this.ctx) return;
        if (!this.boardSize) return;

        const rect = this.canvas.getBoundingClientRect();
        const displaySize = Math.min(rect.width, rect.height);
        if (!displaySize || displaySize <= 0) return;

        const dpr = Number(window.devicePixelRatio || 1);
        // Use the CSS display size directly, scaled by DPR for sharpness
        const nextW = Math.round(displaySize * dpr);
        const nextH = Math.round(displaySize * dpr);

        if (this.canvas.width !== nextW || this.canvas.height !== nextH) {
            this.canvas.width = nextW;
            this.canvas.height = nextH;
        }
        // Always update cellSize to match current canvas dimensions
        this.cellSize = this.canvas.width / this.boardSize;
        // Redraw immediately so pointer hitboxes + grid lines match.
        if (this.gameState === 'playing') this.drawBoard();
    }

    addEntropySample(sample) {
        if (!window.ludoEntropyPool) return;
        window.ludoEntropyPool.addSample(sample);
    }

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

    syncSelfHud() {
        // No-op: HUD is color-based (no separate "self" slot).
    }

    addEntropyFromPointerEvent(e, targetEl) {
        if (!window.ludoEntropyPool) return;

        const rect = targetEl.getBoundingClientRect();
        // If the target is the game canvas, normalize to canvas coordinates.
        const isCanvas = targetEl === this.canvas;
        const scaleX = isCanvas ? (this.canvas.width / rect.width) : 1;
        const scaleY = isCanvas ? (this.canvas.height / rect.height) : 1;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        const t = (typeof performance !== "undefined" ? performance.now() : Date.now());

        const pressure =
            typeof e.pressure === 'number' && Number.isFinite(e.pressure) ? e.pressure : 0;

        // Velocity estimate (per pointerId when available)
        const pointerKey = (typeof e.pointerId === 'number' ? `p${e.pointerId}` : 'mouse');
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

    initializeBoard() {
        this.boardSize = 15;
        // Ensure canvas has proper dimensions before calculating cellSize
        if (!this.canvas.width || !this.canvas.height) {
            this.canvas.width = 700;
            this.canvas.height = 700;
        }
        this.cellSize = this.canvas.width / this.boardSize;

        this.playerDice = {
            red: 1,
            green: 1,
            yellow: 1,
            blue: 1
        };
        
        // Orthogonal step from outer index 55 onto the colored home column (shared main-track cell).
        this.homeBridges = {
            blue: { x: 0, y: 7 },
            red: { x: 7, y: 0 },
            green: { x: 14, y: 7 },
            yellow: { x: 7, y: 14 }
        };
        this.paths = {
            red: this.generatePath('red'),
            green: this.generatePath('green'),
            yellow: this.generatePath('yellow'),
            blue: this.generatePath('blue')
        };
        // Map main-loop cell → index 0..55 (for bridge / collision on shared track cells).
        this.mainPathCoordToIndex = new Map();
        this.getMainPathLoop().forEach((c, i) => {
            this.mainPathCoordToIndex.set(`${c.x},${c.y}`, i);
        });
        // Cells that are part of the 51-step outer loop (used to draw track squares in the 3×3 center cross).
        this.mainTrackCellSet = new Set();
        this.paths.red.slice(0, 51).forEach((c) => {
            this.mainTrackCellSet.add(`${c.x},${c.y}`);
        });

        // One draw pass per grid cell (avoids double-stroked / "extra" tiles from overlapping loops).
        this.pathCellDrawInfo = new Map();
        this.getMainPathLoop().forEach((c) => {
            this.pathCellDrawInfo.set(`${c.x},${c.y}`, { kind: 'neutral' });
        });
        this.colors.forEach((color) => {
            const path = this.paths[color];
            // Path is now 56 cells: 51 outer track + 5 home column
            // Home column starts at index 51
            for (let i = 51; i < path.length; i++) {
                const c = path[i];
                const k = `${c.x},${c.y}`;
                this.pathCellDrawInfo.set(k, { kind: 'colored', color });
            }
        });

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
        
        // Home "yards" positions used for rendering + clickable piece hitboxes.
        // (These must match the internal path indexing logic.)
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

    /** Shared 56-cell outer loop (before any color's home column). 
     * This path goes AROUND the center 3x3 block, not through it.
     */
    getMainPathLoop() {
        return [
            { x: 0, y: 7 },  // 0 - blue bridge entry
            { x: 0, y: 6 },  // 1
            { x: 1, y: 6 },  // 2 - blue start
            { x: 2, y: 6 },  // 3
            { x: 3, y: 6 },  // 4
            { x: 4, y: 6 },  // 5
            { x: 5, y: 6 },  // 6
            { x: 6, y: 6 },  // 7 - GO AROUND: top-left corner of center
            { x: 6, y: 5 },  // 8
            { x: 6, y: 4 },  // 9
            { x: 6, y: 3 },  // 10
            { x: 6, y: 2 },  // 11
            { x: 6, y: 1 },  // 12
            { x: 6, y: 0 },  // 13
            { x: 7, y: 0 },  // 14
            { x: 8, y: 0 },  // 15
            { x: 8, y: 1 },  // 16 - red start
            { x: 8, y: 2 },  // 17
            { x: 8, y: 3 },  // 18
            { x: 8, y: 4 },  // 19
            { x: 8, y: 5 },  // 20
            { x: 8, y: 6 },  // 21 - GO AROUND: top-right corner of center
            { x: 9, y: 6 },  // 22
            { x: 10, y: 6 }, // 23
            { x: 11, y: 6 }, // 24
            { x: 12, y: 6 }, // 25
            { x: 13, y: 6 }, // 26
            { x: 14, y: 6 }, // 27
            { x: 14, y: 7 }, // 28 - green bridge entry
            { x: 14, y: 8 }, // 29
            { x: 13, y: 8 }, // 30
            { x: 12, y: 8 }, // 31
            { x: 11, y: 8 }, // 32
            { x: 10, y: 8 }, // 33
            { x: 9, y: 8 },  // 34
            { x: 8, y: 8 },  // 35 - GO AROUND: bottom-right corner of center
            { x: 8, y: 9 },  // 36
            { x: 8, y: 10 }, // 37
            { x: 8, y: 11 }, // 38
            { x: 8, y: 12 }, // 39
            { x: 8, y: 13 }, // 40
            { x: 8, y: 14 }, // 41
            { x: 7, y: 14 }, // 42
            { x: 6, y: 14 }, // 43
            { x: 6, y: 13 }, // 44 - yellow start
            { x: 6, y: 12 }, // 45
            { x: 6, y: 11 }, // 46
            { x: 6, y: 10 }, // 47
            { x: 6, y: 9 },  // 48
            { x: 6, y: 8 },  // 49 - GO AROUND: bottom-left corner of center
            { x: 5, y: 8 },  // 50
            { x: 4, y: 8 },  // 51
            { x: 3, y: 8 },  // 52
            { x: 2, y: 8 },  // 53
            { x: 1, y: 8 },  // 54
            { x: 0, y: 8 }   // 55
        ];
    }

    generatePath(color) {
        // Path indexing model:
        // - 51 outer-loop cells before entering home column (indices 0..50)
        // - 5 colored home tiles (51..55)
        // - Position 56 is the goal (center triangle)
        // Total 57 positions (0..56)
        const mainPath = this.getMainPathLoop();

        const homePaths = {
            // Goal triangles match screenshot:
            // left=blue, top=red, right=green, bottom=yellow
            // These are the 5 home column squares leading to center
            blue: [{ x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }],
            red: [{ x: 7, y: 1 }, { x: 7, y: 2 }, { x: 7, y: 3 }, { x: 7, y: 4 }, { x: 7, y: 5 }],
            green: [{ x: 13, y: 7 }, { x: 12, y: 7 }, { x: 11, y: 7 }, { x: 10, y: 7 }, { x: 9, y: 7 }],
            yellow: [{ x: 7, y: 13 }, { x: 7, y: 12 }, { x: 7, y: 11 }, { x: 7, y: 10 }, { x: 7, y: 9 }]
        };

        const startPositions = {
            // Start cells match screenshot stars:
            // blue start = (1,6) -> mainPath index 2
            // red start = (8,1) -> mainPath index 16
            // green start = (13,8) -> mainPath index 30
            // yellow start = (6,13) -> mainPath index 44
            blue: 2,
            red: 16,
            green: 30,
            yellow: 44
        };

        const start = startPositions[color];
        const rotatedPath = [...mainPath.slice(start), ...mainPath.slice(0, start)];
        // Take only 51 cells from outer track (not 56), then add 5 home cells
        // This removes the "bridge" cell that was causing the extra tile issue
        return [...rotatedPath.slice(0, 51), ...homePaths[color]];
    }

    initializeEventListeners() {
        document.getElementById('quickPlayBtn').addEventListener('click', () => this.quickPlay());
        document.getElementById('createGameBtn').addEventListener('click', () => this.createGame());
        document.getElementById('joinGameBtn').addEventListener('click', () => this.showJoinScreen());
        document.getElementById('joinSubmitBtn').addEventListener('click', () => this.joinGame());
        document.getElementById('backToMenuBtn').addEventListener('click', () => this.backToMenu());
        document.getElementById('backFromJoinBtn').addEventListener('click', () => this.showMenuScreen());
        document.getElementById('startGameBtn').addEventListener('click', () => this.startGame());
        document.getElementById('exitGameBtn').addEventListener('click', () => this.exitGame());
        document.getElementById('copyCodeBtn').addEventListener('click', () => this.copyRoomCode());
        
        // Pointer-based entropy: position, time, pressure, velocity
        this.canvas.addEventListener('pointerdown', (e) => {
            this.addEntropyFromPointerEvent(e, this.canvas);
        });
        this.canvas.addEventListener('pointermove', (e) => {
            // light sampling on movement; high frequency but cheap
            if (e.buttons) this.addEntropyFromPointerEvent(e, this.canvas);
        });
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleCanvasHover(e));

        // Keep the canvas crisp when viewport size / DPR changes.
        // Debounced via rAF to avoid excessive redraws.
        let resizeRaf = 0;
        window.addEventListener('resize', () => {
            if (resizeRaf) cancelAnimationFrame(resizeRaf);
            resizeRaf = requestAnimationFrame(() => this.resizeCanvasForDPR());
        });
    }

    setupDiceEventListeners() {
        // Attach listeners to all dice (only `myColor` can actually roll).
        ['red', 'green', 'yellow', 'blue'].forEach((color) => {
            const { diceId } = this.getUiIdsForColor(color);
            const diceEl = document.getElementById(diceId);
            if (!diceEl) return;

            diceEl.addEventListener('pointerdown', (e) => {
                this.addEntropyFromPointerEvent(e, diceEl);
                const rect = diceEl.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const tDown = (typeof performance !== "undefined" ? performance.now() : Date.now());
                const pressure =
                    typeof e.pressure === 'number' && Number.isFinite(e.pressure) ? e.pressure : 0;
                const key = typeof e.pointerId === 'number' ? `p${e.pointerId}` : 'mouse';
                this._dicePressInfo = this._dicePressInfo || {};
                this._dicePressInfo[key] = { x, y, tDown, pressure };
            });

            diceEl.addEventListener('click', (e) => {
                const rect = diceEl.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const tNow = (typeof performance !== "undefined" ? performance.now() : Date.now());
                const pressure =
                    typeof e.pressure === 'number' && Number.isFinite(e.pressure) ? e.pressure : 0;

                const key = typeof e.pointerId === 'number' ? `p${e.pointerId}` : 'mouse';
                const info = this._dicePressInfo && this._dicePressInfo[key];
                const durationMs = info && typeof info.tDown === 'number' ? Math.max(0, tNow - info.tDown) : 0;
                const turnElapsedMs = typeof this.turnStartAt === 'number' ? Math.max(0, tNow - this.turnStartAt) : 0;
                const dtSeconds = Math.max(0.001, durationMs / 1000);
                const vx = info ? (x - info.x) / dtSeconds : 0;
                const vy = info ? (y - info.y) / dtSeconds : 0;

                this.addEntropySample({
                    x,
                    y,
                    t: tNow,
                    pressure: info ? info.pressure : pressure,
                    vx,
                    vy,
                    duration: durationMs,
                    turnElapsedMs
                });

                // Used by backend RNG to incorporate click factors (time, pressure, speed).
                this._lastDiceEntropyMetaForBackend = {
                    timeMs: tNow,
                    pressure: info ? info.pressure : pressure,
                    vx,
                    vy,
                    durationMs,
                    turnElapsedMs,
                    x,
                    y
                };

                if (color !== this.myColor) return;
                this.rollDice();
            });
        });
    }

    handleCanvasHover(e) {
        if (!this.canMove || !this.isHumanLocalTurn()) {
            this.canvas.style.cursor = 'default';
            return;
        }

        const { x, y } = this.getCanvasPointFromEvent(e);
        
        const currentColor = this.players[this.currentPlayerIndex].color;
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

    initializeWebSocket() {
        this.mockPlayers = [];
        this.isConnected = true;
    }

    quickPlay() {
        this.isHost = true;
        this.roomCode = this.generateRoomCode();
        const chosenColor = document.getElementById('playerColorSelect')?.value || 'blue';
        this.myColor = chosenColor;
        const storedName = (typeof localStorage !== 'undefined' ? localStorage.getItem('ludoPlayerName') : null);
        const fallbackName = document.getElementById('playerNameInput')?.value?.trim();
        const myName = (fallbackName || storedName || 'You').slice(0, 16);
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('ludoPlayerName', myName);
        }
        const order = ['red', 'green', 'yellow', 'blue']; // clockwise
        const defaultNames = { red: 'Player 1', green: 'Player 2', yellow: 'Player 3', blue: 'Player 4' };
        this.players = order.map(color => ({
            id: `player-${color}`,
            color,
            name: color === this.myColor ? myName : defaultNames[color]
        }));
        this.mockPlayers = [...this.players];
        
        this.startGame();
    }

    createGame() {
        this.isHost = true;
        this.roomCode = this.generateRoomCode();
        this.myColor = 'red';
        this.players = [{ id: 'player1', color: 'red', name: 'You' }];
        this.mockPlayers = [...this.players];
        
        document.getElementById('roomCode').textContent = this.roomCode;
        this.showLobbyScreen();
        this.updateLobby();
        
        setTimeout(() => this.simulatePlayerJoin('green'), 2000);
        setTimeout(() => this.simulatePlayerJoin('yellow'), 4000);
        setTimeout(() => this.simulatePlayerJoin('blue'), 6000);
    }

    simulatePlayerJoin(color) {
        const playerNames = { green: 'Player 2', yellow: 'Player 3', blue: 'Player 4' };
        this.mockPlayers.push({ id: `player${this.mockPlayers.length + 1}`, color, name: playerNames[color] });
        this.players = [...this.mockPlayers];
        this.updateLobby();
    }

    joinGame() {
        const code = document.getElementById('roomCodeInput').value.toUpperCase();
        if (code.length === 6) {
            this.roomCode = code;
            this.isHost = false;
            
            const availableColors = ['red', 'green', 'yellow', 'blue'];
            const colorIndex = window.ludoRng ? window.ludoRng.rollDie(availableColors.length) - 1 : Math.floor(Math.random() * availableColors.length);
            this.myColor = availableColors[colorIndex];
            
            this.players = [
                { id: 'player1', color: 'red', name: 'Player 1' },
                { id: 'player2', color: this.myColor, name: 'You' }
            ];
            
            document.getElementById('roomCode').textContent = this.roomCode;
            this.showLobbyScreen();
            this.updateLobby();
        }
    }

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
        if (this.isHost && this.players.length === 4) {
            startBtn.disabled = false;
        }
    }

    startGame() {
        this.gameState = 'playing';
        // Quick Play / POV: the chosen player color should start immediately.
        // (Dice clickability + movement logic already enforce `color === this.myColor`.)
        const myIdx = this.players.findIndex(p => p.color === this.myColor);
        this.currentPlayerIndex = myIdx >= 0 ? myIdx : 0;
        this.rollsRemaining = 1;
        this.showGameScreen();
        
        setTimeout(() => {
            this.povRotationRad = this.getPovRotationRad();
            this.syncBoardWrapperTilt();
            this.setupDiceEventListeners();
            this.syncSelfHud();
            
            this.players.forEach(player => {
                const { nameId } = this.getUiIdsForColor(player.color);
                const nameElement = document.getElementById(nameId);
                if (nameElement) {
                    nameElement.textContent = player.name;
                }
                this.updateDiceDisplay(1, player.color);
            });
            
            this.drawBoard();
            this.updateCurrentPlayerDisplay();
        }, 100);
    }

    drawBoard() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = '#E7D8BB';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

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

        this.drawHomeAreas();
        this.drawPath();
        this.drawSafeSpots();
        this.drawStartingPositions();
        this.drawCenterTriangle();
        this.drawPieces();
        this.ctx.restore();
    }

    drawHomeAreas() {
        const areas = [
            // Match screenshot orientation:
            // top-left = blue, top-right = red, bottom-left = yellow, bottom-right = green
            { color: 'blue', x: 0, y: 0 },
            { color: 'red', x: 9, y: 0 },
            { color: 'yellow', x: 0, y: 9 },
            { color: 'green', x: 9, y: 9 }
        ];

        areas.forEach(area => {
            const baseColor = this.colorMap[area.color];

            this.ctx.fillStyle = baseColor;
            this.ctx.fillRect(
                area.x * this.cellSize,
                area.y * this.cellSize,
                this.cellSize * 6,
                this.cellSize * 6
            );

            this.ctx.strokeStyle = 'rgba(0,0,0,0.28)';
            this.ctx.lineWidth = Math.max(1, this.cellSize * 0.05);
            this.ctx.strokeRect(
                area.x * this.cellSize,
                area.y * this.cellSize,
                this.cellSize * 6,
                this.cellSize * 6
            );

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

    drawPath() {
        if (!this.pathCellDrawInfo) return;
        
        this.pathCellDrawInfo.forEach((info, key) => {
            const [xs, ys] = key.split(',');
            const x = Number(xs);
            const y = Number(ys);
            
            // Skip cells that are part of the center triangle area (3x3 block)
            // This prevents square outlines from appearing inside the triangles
            if (x >= 6 && x <= 8 && y >= 6 && y <= 8) {
                return;
            }
            
            const fill =
                info.kind === 'colored' ? this.colorMap[info.color] : '#ECECEC';
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

    drawStartingPositions() {
        const startPositions = [
            { x: 1, y: 6, color: 'blue', direction: 'right' },
            { x: 8, y: 1, color: 'red', direction: 'down' },
            { x: 13, y: 8, color: 'green', direction: 'left' },
            { x: 6, y: 13, color: 'yellow', direction: 'up' }
        ];

        startPositions.forEach(pos => {
            this.ctx.fillStyle = this.colorMap[pos.color];
            this.ctx.fillRect(
                pos.x * this.cellSize,
                pos.y * this.cellSize,
                this.cellSize,
                this.cellSize
            );

            this.ctx.strokeStyle = '#444444';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(
                pos.x * this.cellSize,
                pos.y * this.cellSize,
                this.cellSize,
                this.cellSize
            );

            // Draw arrow centered in the tile.
            this.drawArrow(
                (pos.x + 0.5) * this.cellSize,
                (pos.y + 0.5) * this.cellSize,
                this.mixHex(this.colorMap[pos.color], '#0B1220', 0.45),
                pos.direction
            );
        });
    }

    drawArrow(x, y, color, direction) {
        const size = this.cellSize * 0.3;
        this.ctx.fillStyle = color;
        this.ctx.save();
        this.ctx.translate(x, y);
        
        switch(direction) {
            case 'down':
                break;
            case 'up':
                this.ctx.rotate(Math.PI);
                break;
            case 'left':
                this.ctx.rotate(-Math.PI / 2);
                break;
            case 'right':
                this.ctx.rotate(Math.PI / 2);
                break;
        }
        
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

    drawSafeSpots() {
        const safeSpots = [
            { x: 2, y: 8 },
            { x: 6, y: 2 },
            { x: 12, y: 6 },
            { x: 8, y: 12 }
        ];

        safeSpots.forEach(spot => {
            this.ctx.fillStyle = '#BFC1C8';
            this.ctx.fillRect(
                spot.x * this.cellSize,
                spot.y * this.cellSize,
                this.cellSize,
                this.cellSize
            );

            this.ctx.strokeStyle = '#444444';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(
                spot.x * this.cellSize,
                spot.y * this.cellSize,
                this.cellSize,
                this.cellSize
            );

            this.drawStar(
                (spot.x + 0.5) * this.cellSize,
                (spot.y + 0.5) * this.cellSize,
                this.cellSize * 0.22,
                '#8E9097'
            );
        });
    }

    drawStar(cx, cy, radius, fillColor = '#FFFFFF') {
        // Ludo Star-style safe spots are 4-pointed.
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

        // Crisp outline for the safe-zone star.
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = Math.max(1.5, radius * 0.12);
        this.ctx.stroke();
        
        this.ctx.restore();
    }

    hexToRgb(hex) {
        const h = (hex || '').trim();
        const normalized = h.startsWith('#') ? h.slice(1) : h;
        if (normalized.length !== 6) return { r: 0, g: 0, b: 0 };
        const r = parseInt(normalized.slice(0, 2), 16);
        const g = parseInt(normalized.slice(2, 4), 16);
        const b = parseInt(normalized.slice(4, 6), 16);
        return { r, g, b };
    }

    mixHex(a, b, t) {
        // Linear interpolation between two hex colors (t=0 => a, t=1 => b).
        const A = this.hexToRgb(a);
        const B = this.hexToRgb(b);
        const tt = Math.max(0, Math.min(1, t));
        const r = Math.round(A.r + (B.r - A.r) * tt);
        const g = Math.round(A.g + (B.g - A.g) * tt);
        const b2 = Math.round(A.b + (B.b - A.b) * tt);
        return `rgb(${r}, ${g}, ${b2})`;
    }

    drawCenterTriangle() {
        const s = this.cellSize;
        const x0 = 6 * s;
        const y0 = 6 * s;
        const x1 = 9 * s;
        const y1 = 9 * s;
        const cx = 7.5 * s;
        const cy = 7.5 * s;

        // Do not paint a solid 3×3 rectangle here — it would hide the gray cross track tiles drawn in drawPath().
        const tri = (ax, ay, bx, by, fill) => {
            this.ctx.beginPath();
            this.ctx.moveTo(ax, ay);
            this.ctx.lineTo(bx, by);
            this.ctx.lineTo(cx, cy);
            this.ctx.closePath();
            this.ctx.fillStyle = fill;
            this.ctx.fill();
        };

        // Top=red, Right=green, Bottom=yellow, Left=blue (matches classic Ludo center)
        tri(x0, y0, x1, y0, this.colorMap.red);
        tri(x1, y0, x1, y1, this.colorMap.green);
        tri(x1, y1, x0, y1, this.colorMap.yellow);
        tri(x0, y1, x0, y0, this.colorMap.blue);

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

    /** Get canvas coordinates for a goal piece inside its colored triangle */
    getGoalPosition(color, pieceIndex) {
        const s = this.cellSize;
        const cx = 7.5 * s;   // center of the board
        const cy = 7.5 * s;

        // Distribute 4 pieces along the median line of the triangle
        // t = 0.25, 0.45, 0.65, 0.85 gives four distinct points inside the triangle
        const t = 0.25 + pieceIndex * 0.2;

        switch (color) {
            case 'red':   // top triangle
                return {
                    x: (6 + t * (7.5 - 6)) * s,
                    y: (6 + t * (7.5 - 6)) * s
                };
            case 'green': // right triangle
                return {
                    x: (9 - t * (9 - 7.5)) * s,
                    y: (6 + t * (7.5 - 6)) * s
                };
            case 'yellow': // bottom triangle
                return {
                    x: (9 - t * (9 - 7.5)) * s,
                    y: (9 - t * (9 - 7.5)) * s
                };
            case 'blue':  // left triangle
                return {
                    x: (6 + t * (7.5 - 6)) * s,
                    y: (9 - t * (9 - 7.5)) * s
                };
            default:
                return { x: cx, y: cy };
        }
    }

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

    drawPieces() {
        const currentColor = this.players[this.currentPlayerIndex]?.color;
        const s = this.cellSize;
        const stackStep = s * 0.1;

        const pathGroups = new Map();
        Object.entries(this.pieces).forEach(([color, pieces]) => {
            pieces.forEach((piece, index) => {
                if (piece.inHome) return;
                // Skip goal pieces (position 56) - they're handled separately
                if (piece.position === 56) return;
                const pathPos = this.paths[color][piece.position];
                const posKey = `${pathPos.x},${pathPos.y}`;
                if (!pathGroups.has(posKey)) pathGroups.set(posKey, []);
                pathGroups.get(posKey).push({ color, index, piece });
            });
        });

        const stackOffsetFor = (posKey, color, index) => {
            const list = pathGroups.get(posKey) || [];
            const idx = list.findIndex((e) => e.color === color && e.index === index);
            const n = list.length;
            const i = idx >= 0 ? idx : 0;
            const t = i - (n - 1) / 2;
            return { ox: t * stackStep * 0.85, oy: t * stackStep * 0.85 };
        };

        const drawList = [];
        const goalPieces = [];  // Collect goal pieces separately
        
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
                } else if (piece.position === 56) {
                    // Goal piece - draw inside the center triangle
                    const goalPos = this.getGoalPosition(color, index);
                    x = goalPos.x;
                    y = goalPos.y;
                    posKey = `goal,${color},${index}`;
                    goalPieces.push({ color, index, piece, x, y });
                } else {
                    // On-track pieces use the real path grid squares
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

        drawList.sort((a, b) => {
            if (a.posKey !== b.posKey) return String(a.posKey).localeCompare(String(b.posKey));
            return a.stackIdx - b.stackIdx;
        });

        // Draw goal pieces first (so they appear behind track pieces if overlapping)
        goalPieces.forEach(({ color, index, piece, x, y }) => {
            this.drawSinglePiece(piece, color, x, y, false);
        });

        // Draw all other pieces
        drawList.forEach(({ color, index, piece, x, y }) => {
            if (piece.position === 56) return;  // Already drawn
            this.drawSinglePiece(piece, color, x, y, 
                this.canMove && color === currentColor && this.movablePieces && this.movablePieces.includes(index));
        });
    }

    drawSinglePiece(piece, color, x, y, isMovable) {
        const currentColor = this.players[this.currentPlayerIndex]?.color;
        const s = this.cellSize;

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
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
        this.ctx.shadowBlur = this.cellSize * 0.12;
        this.ctx.shadowOffsetY = this.cellSize * 0.04;

        this.ctx.beginPath();
        this.ctx.arc(x, y, pawnR, 0, Math.PI * 2);
        this.ctx.fillStyle = '#EBD07B';
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.arc(x, y, pawnR * 0.87, 0, Math.PI * 2);
        this.ctx.fillStyle = '#FFF7D8';
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.arc(x, y, pawnR * 0.67, 0, Math.PI * 2);
        this.ctx.fillStyle = baseFill;
        this.ctx.fill();

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
        this.drawCrownGlyph(x, y, pawnR * 0.82);

        if (this.selectedPiece && this.selectedPiece.color === color && this.selectedPiece.id === piece.id) {
            this.ctx.beginPath();
            this.ctx.arc(x, y, this.cellSize * 0.42, 0, Math.PI * 2);
            this.ctx.strokeStyle = '#00FF00';
            this.ctx.lineWidth = 5;
            this.ctx.stroke();
        }
    }

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

    handleCanvasClick(e) {
        if (!this.canMove || !this.isHumanLocalTurn()) return;

        const { x, y } = this.getCanvasPointFromEvent(e);
        
        const currentColor = this.players[this.currentPlayerIndex].color;
        if (currentColor !== this.myColor) return;

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

    selectAndMovePiece(color, pieceIndex) {
        if (color !== this.myColor || !this.isHumanLocalTurn()) return;
        const piece = this.pieces[color][pieceIndex];
        const validRolls = this.getValidRollsForPiece(piece, color);
        
        if (validRolls.length === 0) return;
        
        if (validRolls.length === 1) {
            this.movePieceWithRoll(color, pieceIndex, validRolls[0]);
        } else {
            this.showMoveChoice(color, pieceIndex, validRolls);
        }
    }

    getValidRollsForPiece(piece, color) {
        return this.currentRolls.filter(roll => {
            if (piece.inHome) return roll === 6;
            if (piece.inGoal) return false;
            const newPos = piece.position + roll;
            // Path indices are 0..56 (51 outer + 5 home tiles)
            return newPos <= 56;
        });
    }

    showMoveChoice(color, pieceIndex, validRolls) {
        const popup = document.getElementById('moveChoicePopup');
        const buttonsContainer = document.getElementById('moveChoiceButtons');
        const piece = this.pieces[color][pieceIndex];
        
        if (!piece.coords) return;
        
        // piece.coords are in canvas coordinates; convert to CSS pixels for positioning the popup.
        const canvasRect = this.canvas.getBoundingClientRect();
        const scaleX = canvasRect.width / this.canvas.width;
        const scaleY = canvasRect.height / this.canvas.height;
        const popupX = canvasRect.left + piece.coords.x * scaleX - 60;
        const popupY = canvasRect.top + piece.coords.y * scaleY - 80;
        
        popup.style.left = `${popupX}px`;
        popup.style.top = `${popupY}px`;
        
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

    movePieceWithRoll(color, pieceIndex, roll) {
        const piece = this.pieces[color][pieceIndex];
        this.pieceCaptured = false;
        this.lastMoveRoll = roll;

        const rollIndex = this.currentRolls.indexOf(roll);
        if (rollIndex > -1) {
            this.currentRolls.splice(rollIndex, 1);
        }
        this.updateRollsDisplay(color);

        const oldPosition = piece.position;
        const wasInHome = piece.inHome;

        if (piece.inHome && roll === 6) {
            piece.inHome = false;
            piece.position = 0;
            this.animatePieceMovement(color, pieceIndex, wasInHome, oldPosition, 0, () => {
                this.afterPieceMove(color);
            });
        } else if (!piece.inHome && !piece.inGoal) {
            const newPosition = piece.position + roll;
            const maxPosition = 56;  // Updated: 51 outer + 5 home = 56

            if (newPosition === maxPosition) {
                piece.inGoal = true;
                this.animatePieceMovement(color, pieceIndex, false, oldPosition, maxPosition, () => {
                    piece.position = maxPosition;
                    this.afterPieceMove(color);
                });
            } else if (newPosition < maxPosition) {
                this.animatePieceMovement(color, pieceIndex, false, oldPosition, newPosition, () => {
                    piece.position = newPosition;
                    this.checkCapture(color, piece);
                    this.afterPieceMove(color);
                });
            } else {
                this.afterPieceMove(color);
            }
        } else {
            this.afterPieceMove(color);
        }
    }
    
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
    
    afterPieceMove(color) {
        this.canMove = false;
        this.movablePieces = [];
        this.selectedPiece = null;
        this.drawBoard();
        
        if (this.checkWin(color)) {
            setTimeout(() => {
                alert(`${this.players[this.currentPlayerIndex].name} wins!`);
                this.exitGame();
            }, 500);
            return;
        }

        // If we still have dice results in hand (e.g. rolled 6 then 5 → [6,5]),
        // the player must use ALL remaining rolls for moves before rolling again.
        // (Previously, moving with the 6 triggered "bonus roll" and returned early, blocking the 5.)
        const movedWithSix = this.lastMoveRoll === 6;
        const capturedBonus = this.pieceCaptured === true;
        this.pieceCaptured = false;
        this.lastMoveRoll = null;

        const pieces = this.pieces[color];
        const canUseRemainingDice = pieces.some((p) => this.canPieceUseAnyRoll(p, color));

        if (this.currentRolls.length > 0) {
            if (canUseRemainingDice) {
                this.hasRolled = true;
                this.canMove = this.isHumanLocalTurn();
                this.highlightMovablePieces(color);
                this.updateCurrentPlayerDisplay();
                this.startTurnTimer();
                if (!this.isHumanLocalTurn()) {
                    setTimeout(() => this.simulateAIMove(), 450);
                }
                return;
            }
            // Dice left but no legal move — pass.
            setTimeout(() => this.endTurn(), 500);
            return;
        }

        // No dice left: bonus roll only after moving with a 6 or after a capture.
        if (movedWithSix || capturedBonus) {
            this.hasRolled = false;
            this.startTurnTimer();

            const currentColor = this.players[this.currentPlayerIndex]?.color;
            if (currentColor && currentColor !== this.myColor) {
                setTimeout(() => this.simulateAITurn(), 250);
            }
            return;
        }

        setTimeout(() => this.endTurn(), 500);
    }

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

    checkCapture(color, piece) {
        // Can only capture on outer track (positions 0-50), not in home column (51-55) or goal (56)
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

        let captured = false;
        Object.entries(this.pieces).forEach(([otherColor, otherPieces]) => {
            if (otherColor === color) return;

            const otherPiecesAtSameSpot = otherPieces.filter(op => {
                if (op.inHome || op.inGoal || op.position >= 51) return false;
                const otherPathPos = this.paths[otherColor][op.position];
                return pathPos.x === otherPathPos.x && pathPos.y === otherPathPos.y;
            });

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

    checkWin(color) {
        const pieces = this.pieces[color];
        return pieces.every(piece => piece.inGoal);
    }

    // Provably-fair style (client-side, offline prototype):
    // - Generate a "serverSeed" (random)
    // - Compute commit = SHA-256(serverSeed) before rolling
    // - Read current client entropy snapshot
    // - Compute rollHash = SHA-256(serverSeed || clientEntropySnapshot)
    // - Map rollHash -> die face
    // - Reveal serverSeed after we show the result
    async _sha256Bytes(bytes) {
        const digest = await window.crypto.subtle.digest('SHA-256', bytes);
        return new Uint8Array(digest);
    }

    _bytesToHex(bytes) {
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    _entropySnapshotToBytes() {
        const snap = window.ludoEntropyPool?.getSnapshot?.() || { b0: 0, b1: 0, b2: 0, b3: 0, samples: 0 };
        const out = new Uint8Array(20); // 4xUint32 + sampleCount Uint32
        const view = new DataView(out.buffer);
        view.setUint32(0, snap.b0 >>> 0, false);
        view.setUint32(4, snap.b1 >>> 0, false);
        view.setUint32(8, snap.b2 >>> 0, false);
        view.setUint32(12, snap.b3 >>> 0, false);
        view.setUint32(16, snap.samples >>> 0, false);
        return out;
    }

    _mapHashToDie(hashBytes, sides = 6) {
        // Use 32 bits from the hash, modulo to get 1..sides.
        // For sides=6, modulo bias is negligible, and this is a fast prototype.
        const view = new DataView(hashBytes.buffer, hashBytes.byteOffset, hashBytes.byteLength);
        const u32 = view.getUint32(0, false) >>> 0;
        return (u32 % sides) + 1;
    }

    async _provablyFairRollDie(sides = 6, rollLabel = '') {
        if (!window.crypto?.subtle) {
            // Fallback: keep gameplay working.
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

        // "Reveal"
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

    async _backendRollDie(sides = 6, color = 'unknown', metaOverride = null) {
        // If backend isn't configured (or offline), fall back to local provably-fair prototype.
        if (!this.backendBaseUrl) {
            this._lastRollFromBackend = false;
            return this._provablyFairRollDie(sides, `backendFallback:${color}`);
        }

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
        const timeoutMs = 2500;
        let timeoutId = null;
        if (controller) {
            timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        }

        try {
            const resp = await fetch(`${this.backendBaseUrl}/api/roll`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sides,
                    color,
                    entropyHex,
                    meta
                }),
                signal: controller ? controller.signal : undefined
            });

            if (!resp.ok) throw new Error(`backend roll failed: ${resp.status}`);
            const data = await resp.json();
            if (!data || typeof data.die !== 'number') throw new Error('backend roll missing die');
            this._lastRollFromBackend = true;
            return data.die;
        } catch (err) {
            console.warn('[ludo.backendRollDie] error; falling back', err);
            this._lastRollFromBackend = false;
            return this._provablyFairRollDie(sides, `backendFallback:${color}`);
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
    }

    _aiDiceEntropyMeta() {
        // AI still uses backend randomness, but we synthesize plausible "human" factors
        // so time/pressure/speed are part of the hash input.
        const canvasW = this.canvas?.width || 700;
        const canvasH = this.canvas?.height || 700;

        const randU32 = new Uint32Array(6);
        if (window.crypto?.getRandomValues) window.crypto.getRandomValues(randU32);
        else for (let i = 0; i < randU32.length; i++) randU32[i] = Math.floor(Math.random() * 0xFFFFFFFF);

        const x = (randU32[0] / 0xFFFFFFFF) * canvasW;
        const y = (randU32[1] / 0xFFFFFFFF) * canvasH;
        const timeMs = Date.now();

        const pressure = (randU32[2] % 1000) / 1000; // 0..0.999
        const vx = ((randU32[3] % 2001) - 1000) / 500; // roughly -2..2 px/ms scaled
        const vy = ((randU32[4] % 2001) - 1000) / 500;
        const durationMs = randU32[5] % 1200; // 0..1200ms
        const turnElapsedMs = Math.floor((typeof this.turnStartAt === 'number' ? (Date.now() - this.turnStartAt) : 0) + (randU32[0] % 25000));

        return { timeMs, pressure, vx, vy, durationMs, turnElapsedMs, x, y };
    }

    rollDice() {
        if (!this.players[this.currentPlayerIndex]) return;
        if (this.players[this.currentPlayerIndex].color !== this.myColor) return;
        // Roll -> then you must move once (unless no moves). Bonus rolls happen after moving.
        if (this.hasRolled) return;
        if (this.currentRolls.length >= 3) return;
        
        const currentColor = this.players[this.currentPlayerIndex].color;
        const { diceId } = this.getUiIdsForColor(currentColor);
        const dice = document.getElementById(diceId);
        if (dice) dice.classList.add('rolling');
        
        setTimeout(() => {
            (async () => {
                this.diceValue = await this._backendRollDie(6, currentColor, this._lastDiceEntropyMetaForBackend);

                this.updateDiceDisplay(this.diceValue, currentColor);
                if (dice) dice.classList.remove('rolling');
                
                this.currentRolls.push(this.diceValue);
                this.updateRollsDisplay(currentColor);
                
                if (this.diceValue === 6) {
                    this.consecutiveSixes++;
                    
                    if (this.consecutiveSixes === 3) {
                        alert('Three 6s in a row! Your turn is void.');
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
                    const canMoveNow = pieces6.some((piece) => this.canPieceUseAnyRoll(piece, currentColor));
                    this.canMove = canMoveNow;
                    this.movablePieces = [];
                    if (canMoveNow) {
                        this.highlightMovablePieces(currentColor);
                    }
                    this.updateCurrentPlayerDisplay();
                    return;
                }
                this.consecutiveSixes = 0;

                this.hasRolled = true;
                
                const pieces = this.pieces[currentColor];
                const canMove = pieces.some(piece => {
                    return this.canPieceUseAnyRoll(piece, currentColor);
                });
                
                if (canMove) {
                    this.canMove = true;
                    this.highlightMovablePieces(currentColor);
                } else {
                    setTimeout(() => {
                        this.endTurn();
                    }, 1000);
                }
                this.updateCurrentPlayerDisplay();
            })();
        }, 500);
    }

    canPieceUseAnyRoll(piece, color) {
        return this.currentRolls.some(roll => {
            if (piece.inHome) return roll === 6;
            if (piece.inGoal) return false;
            const newPos = piece.position + roll;
            return newPos <= 56;  // Updated max position
        });
    }

    updateRollsDisplay(color) {
        const { rollsId } = this.getUiIdsForColor(color);
        const rollsElement = document.getElementById(rollsId);
        if (rollsElement) {
            rollsElement.innerHTML = '';
            // Display each remaining roll as a badge
            this.currentRolls.forEach(roll => {
                const badge = document.createElement('div');
                badge.className = 'roll-badge';
                badge.textContent = roll;
                rollsElement.appendChild(badge);
            });
        }
    }

    nextPlayer() {
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        this.canMove = false;
        this.movablePieces = [];
        this.selectedPiece = null;
        this.consecutiveSixes = 0;
        this.currentRolls = [];  // Clear all remaining rolls when turn ends
        this.hasRolled = false;
        this.pieceCaptured = false;
        this.lastMoveRoll = null;
        this.updateCurrentPlayerDisplay();
        this.drawBoard();

        if (this.players[this.currentPlayerIndex].color !== this.myColor) {
            setTimeout(() => this.simulateAITurn(), 1500);
        }
    }

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
                diceDots.innerHTML = '';
                const positions = dotPositions[value] || [4];
                for (let i = 0; i < 9; i++) {
                    const dotDiv = document.createElement('div');
                    if (positions.includes(i)) {
                        dotDiv.className = 'dot-small';
                    }
                    diceDots.appendChild(dotDiv);
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
                // Feed some AI entropy so the shared entropy pool keeps moving.
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
                const canRollNow = this.hasRolled === false;
                const clickable =
                    (color === this.myColor) && (color === currentColor) && canRollNow;
                diceElement.style.cursor = clickable ? 'pointer' : 'default';
                diceElement.style.opacity = clickable ? '1' : '0.92';
                diceElement.style.pointerEvents = clickable ? 'auto' : 'none';
            }
        });

        if (this.canvas && this.gameState === 'playing') {
            this.canvas.style.pointerEvents = this.isHumanLocalTurn() ? 'auto' : 'none';
        }
        
        this.startTurnTimer();
    }
    
    startTurnTimer() {
        if (this.turnTimer) {
            clearInterval(this.turnTimer);
            this.turnTimer = null;
        }

        const currentColor = this.players[this.currentPlayerIndex].color;
        const { timerId } = this.getUiIdsForColor(currentColor);
        const timerElement = document.getElementById(timerId);

        if (currentColor !== this.myColor) {
            if (timerElement) timerElement.textContent = '—';
            return;
        }

        // Used for entropy: "how far into the 30s turn did the player press the dice?"
        this.turnStartAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        
        this.turnTimeRemaining = 30;
        
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
                this.onTurnTimerExpired();
            }
        }, 1000);
    }

    /** When the 30s clock hits 0: auto-play for human, or pass turn. */
    onTurnTimerExpired() {
        const currentColor = this.players[this.currentPlayerIndex]?.color;
        if (!currentColor || currentColor !== this.myColor) return;

        this.autoPlayHumanTurn();
    }

    /**
     * Human ran out of time: prefer moving if possible, else roll if allowed, else end turn.
     */
    autoPlayHumanTurn() {
        const c = this.players[this.currentPlayerIndex]?.color;
        if (!c || c !== this.myColor) {
            this.endTurn();
            return;
        }

        // If we still have rolled values in hand, we must move before rolling again.
        if (this.currentRolls.length > 0) {
            const canAny = this.pieces[c].some((p) => this.canPieceUseAnyRoll(p, c));
            if (canAny && (!this.movablePieces || this.movablePieces.length === 0)) {
                this.hasRolled = true;
                this.canMove = true;
                this.highlightMovablePieces(c);
            }
        }

        if (this.canMove && this.movablePieces && this.movablePieces.length > 0) {
            const idx = this.movablePieces[0];
            const piece = this.pieces[c][idx];
            const validRolls = this.getValidRollsForPiece(piece, c);
            if (validRolls.length === 0) {
                this.endTurn();
                return;
            }
            const roll = validRolls[0];
            this.movePieceWithRoll(c, idx, roll);
            return;
        }

        if (!this.hasRolled && this.currentRolls.length === 0) {
            this.rollDice();
            return;
        }

        this.endTurn();
    }
    
    stopTurnTimer() {
        if (this.turnTimer) {
            clearInterval(this.turnTimer);
            this.turnTimer = null;
        }
    }

    generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            const idx = window.ludoRng ? window.ludoRng.rollDie(chars.length) - 1 : Math.floor(Math.random() * chars.length);
            code += chars.charAt(idx);
        }
        return code;
    }

    copyRoomCode() {
        navigator.clipboard.writeText(this.roomCode);
        const btn = document.getElementById('copyCodeBtn');
        btn.textContent = 'Copied!';
        setTimeout(() => {
            btn.textContent = 'Copy';
        }, 2000);
    }

    showMenuScreen() {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('menu-screen').classList.add('active');
    }

    showLobbyScreen() {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('lobby-screen').classList.add('active');
    }

    showJoinScreen() {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('join-screen').classList.add('active');
    }

    showGameScreen() {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('game-screen').classList.add('active');
    }

    backToMenu() {
        this.players = [];
        this.mockPlayers = [];
        this.showMenuScreen();
    }

    exitGame() {
        this.gameState = 'waiting';
        if (this.canvas) this.canvas.style.pointerEvents = '';
        this.syncBoardWrapperTilt();
        this.showMenuScreen();
    }
}

const game = new LudoGame();

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

// Debug helpers (enabled only with `?debug=1` in URL).
// These are for deterministic testing of move/click flows without relying on randomness.
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
            // Quick reset by reloading the page to clear state.
            location.reload();
        });

        // Keep status fresh while animations/timers tick.
        setInterval(renderStatus, 300);
        renderStatus();
    }
}

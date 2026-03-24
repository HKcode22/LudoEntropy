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
        this.turnTimer = null;
        this.turnTimeRemaining = 30;
        
        this.colors = ['red', 'green', 'yellow', 'blue'];
        this.colorMap = {
            red: '#E74C3C',
            green: '#2ECC71',
            yellow: '#F39C12',
            blue: '#3498DB'
        };
        
        this.initializeBoard();
        this.initializeEventListeners();
        this.initializeWebSocket();
    }

    initializeBoard() {
        this.boardSize = 15;
        this.cellSize = this.canvas.width / this.boardSize;
        
        this.playerDice = {
            red: 1,
            green: 1,
            yellow: 1,
            blue: 1
        };
        
        this.paths = {
            red: this.generatePath('red'),
            green: this.generatePath('green'),
            yellow: this.generatePath('yellow'),
            blue: this.generatePath('blue')
        };
        
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
        
        this.homePositions = {
            red: [
                { x: 2.25, y: 2.25 },
                { x: 3.75, y: 2.25 },
                { x: 2.25, y: 3.75 },
                { x: 3.75, y: 3.75 }
            ],
            green: [
                { x: 10.25, y: 2.25 },
                { x: 11.75, y: 2.25 },
                { x: 10.25, y: 3.75 },
                { x: 11.75, y: 3.75 }
            ],
            yellow: [
                { x: 10.25, y: 10.25 },
                { x: 11.75, y: 10.25 },
                { x: 10.25, y: 11.75 },
                { x: 11.75, y: 11.75 }
            ],
            blue: [
                { x: 2.25, y: 10.25 },
                { x: 3.75, y: 10.25 },
                { x: 2.25, y: 11.75 },
                { x: 3.75, y: 11.75 }
            ]
        };
    }

    generatePath(color) {
        const mainPath = [
            { x: 0, y: 7 },
            { x: 0, y: 6 },
            { x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 },
            { x: 6, y: 6 },
            { x: 6, y: 5 }, { x: 6, y: 4 }, { x: 6, y: 3 }, { x: 6, y: 2 }, { x: 6, y: 1 },
            { x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 },
            { x: 8, y: 1 }, { x: 8, y: 2 }, { x: 8, y: 3 }, { x: 8, y: 4 }, { x: 8, y: 5 },
            { x: 8, y: 6 },
            { x: 9, y: 6 }, { x: 10, y: 6 }, { x: 11, y: 6 }, { x: 12, y: 6 }, { x: 13, y: 6 },
            { x: 14, y: 6 }, { x: 14, y: 7 },
            { x: 14, y: 8 },
            { x: 13, y: 8 }, { x: 12, y: 8 }, { x: 11, y: 8 }, { x: 10, y: 8 }, { x: 9, y: 8 },
            { x: 8, y: 8 },
            { x: 8, y: 9 }, { x: 8, y: 10 }, { x: 8, y: 11 }, { x: 8, y: 12 }, { x: 8, y: 13 },
            { x: 8, y: 14 }, { x: 7, y: 14 }, { x: 6, y: 14 },
            { x: 6, y: 13 }, { x: 6, y: 12 }, { x: 6, y: 11 }, { x: 6, y: 10 }, { x: 6, y: 9 },
            { x: 6, y: 8 },
            { x: 5, y: 8 }, { x: 4, y: 8 }, { x: 3, y: 8 }, { x: 2, y: 8 }, { x: 1, y: 8 }, { x: 0, y: 8 }
        ];

        const homePaths = {
            red: [{ x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }],
            green: [{ x: 7, y: 1 }, { x: 7, y: 2 }, { x: 7, y: 3 }, { x: 7, y: 4 }, { x: 7, y: 5 }],
            yellow: [{ x: 13, y: 7 }, { x: 12, y: 7 }, { x: 11, y: 7 }, { x: 10, y: 7 }, { x: 9, y: 7 }],
            blue: [{ x: 7, y: 13 }, { x: 7, y: 12 }, { x: 7, y: 11 }, { x: 7, y: 10 }, { x: 7, y: 9 }]
        };

        const startPositions = {
            red: 2,
            green: 16,
            yellow: 30,
            blue: 44
        };

        const start = startPositions[color];
        const rotatedPath = [...mainPath.slice(start), ...mainPath.slice(0, start)];
        
        return [...rotatedPath, ...homePaths[color]];
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
        
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleCanvasHover(e));
    }

    setupDiceEventListeners() {
        ['red', 'green', 'yellow', 'blue'].forEach(color => {
            const diceId = `dice${color.charAt(0).toUpperCase() + color.slice(1)}`;
            const diceElement = document.getElementById(diceId);
            if (diceElement) {
                diceElement.addEventListener('click', () => this.rollDice());
            }
        });
    }

    handleCanvasHover(e) {
        if (!this.canMove) {
            this.canvas.style.cursor = 'default';
            return;
        }
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
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
        this.myColor = 'blue';
        this.players = [
            { id: 'player1', color: 'blue', name: 'You' },
            { id: 'player2', color: 'red', name: 'Player 2' },
            { id: 'player3', color: 'green', name: 'Player 3' },
            { id: 'player4', color: 'yellow', name: 'Player 4' }
        ];
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
            this.myColor = availableColors[Math.floor(Math.random() * availableColors.length)];
            
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
        this.currentPlayerIndex = 0;
        this.showGameScreen();
        
        setTimeout(() => {
            this.setupDiceEventListeners();
            
            this.players.forEach(player => {
                const nameId = `name${player.color.charAt(0).toUpperCase() + player.color.slice(1)}`;
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
        
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawHomeAreas();
        this.drawPath();
        this.drawSafeSpots();
        this.drawStartingPositions();
        this.drawCenterTriangle();
        this.drawPieces();
    }

    drawHomeAreas() {
        const areas = [
            { color: 'red', x: 0, y: 0 },
            { color: 'green', x: 9, y: 0 },
            { color: 'yellow', x: 9, y: 9 },
            { color: 'blue', x: 0, y: 9 }
        ];

        areas.forEach(area => {
            this.ctx.fillStyle = this.colorMap[area.color];
            this.ctx.fillRect(
                area.x * this.cellSize,
                area.y * this.cellSize,
                6 * this.cellSize,
                6 * this.cellSize
            );
            
            this.ctx.strokeStyle = '#FFFFFF';
            this.ctx.lineWidth = 6;
            this.ctx.strokeRect(
                area.x * this.cellSize,
                area.y * this.cellSize,
                6 * this.cellSize,
                6 * this.cellSize
            );
            
            const innerSize = 4 * this.cellSize;
            const innerOffset = 1 * this.cellSize;
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.fillRect(
                area.x * this.cellSize + innerOffset,
                area.y * this.cellSize + innerOffset,
                innerSize,
                innerSize
            );
            
            this.homePositions[area.color].forEach(pos => {
                this.ctx.beginPath();
                this.ctx.arc(
                    pos.x * this.cellSize,
                    pos.y * this.cellSize,
                    this.cellSize * 0.55,
                    0,
                    Math.PI * 2
                );
                this.ctx.fillStyle = this.colorMap[area.color];
                this.ctx.fill();
                this.ctx.strokeStyle = '#FFFFFF';
                this.ctx.lineWidth = 4;
                this.ctx.stroke();
                
                this.ctx.beginPath();
                this.ctx.arc(
                    pos.x * this.cellSize,
                    pos.y * this.cellSize,
                    this.cellSize * 0.3,
                    0,
                    Math.PI * 2
                );
                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.fill();
            });
        });
    }

    drawPath() {
        const allPaths = [...this.paths.red.slice(0, 56)];
        
        allPaths.forEach((cell, index) => {
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.fillRect(
                cell.x * this.cellSize,
                cell.y * this.cellSize,
                this.cellSize,
                this.cellSize
            );
            
            this.ctx.strokeStyle = '#E0E0E0';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(
                cell.x * this.cellSize,
                cell.y * this.cellSize,
                this.cellSize,
                this.cellSize
            );
        });
        
        Object.entries(this.paths).forEach(([color, path]) => {
            const homePath = path.slice(56);
            homePath.forEach((cell, index) => {
                this.ctx.fillStyle = this.colorMap[color];
                this.ctx.fillRect(
                    cell.x * this.cellSize,
                    cell.y * this.cellSize,
                    this.cellSize,
                    this.cellSize
                );
                
                this.ctx.strokeStyle = '#E0E0E0';
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(
                    cell.x * this.cellSize,
                    cell.y * this.cellSize,
                    this.cellSize,
                    this.cellSize
                );
            });
        });
    }

    drawStartingPositions() {
        const startPositions = [
            { x: 1, y: 6, color: 'red', hasStar: true },
            { x: 8, y: 1, color: 'green', hasStar: true },
            { x: 13, y: 8, color: 'yellow', hasStar: true },
            { x: 6, y: 13, color: 'blue', hasStar: true }
        ];

        startPositions.forEach(pos => {
            this.ctx.fillStyle = this.colorMap[pos.color];
            this.ctx.fillRect(
                pos.x * this.cellSize,
                pos.y * this.cellSize,
                this.cellSize,
                this.cellSize
            );
            
            if (pos.hasStar) {
                this.drawStar(
                    (pos.x + 0.5) * this.cellSize,
                    (pos.y + 0.5) * this.cellSize,
                    this.cellSize * 0.3,
                    '#FFFFFF'
                );
            }
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
            this.ctx.fillStyle = '#9E9E9E';
            this.ctx.fillRect(
                spot.x * this.cellSize,
                spot.y * this.cellSize,
                this.cellSize,
                this.cellSize
            );
            
            this.drawStar(
                (spot.x + 0.5) * this.cellSize,
                (spot.y + 0.5) * this.cellSize,
                this.cellSize * 0.3,
                '#FFFFFF'
            );
        });
    }

    drawStar(cx, cy, radius, fillColor = '#FFFFFF') {
        const spikes = 5;
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
        
        this.ctx.restore();
    }

    drawCenterTriangle() {
        const cx = 7.5 * this.cellSize;
        const cy = 7.5 * this.cellSize;
        const triSize = this.cellSize * 1.0;
        
        this.ctx.fillStyle = this.colorMap.green;
        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy);
        this.ctx.lineTo(cx - triSize, cy - triSize);
        this.ctx.lineTo(cx + triSize, cy - triSize);
        this.ctx.closePath();
        this.ctx.fill();
        
        this.ctx.fillStyle = this.colorMap.yellow;
        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy);
        this.ctx.lineTo(cx + triSize, cy - triSize);
        this.ctx.lineTo(cx + triSize, cy + triSize);
        this.ctx.closePath();
        this.ctx.fill();
        
        this.ctx.fillStyle = this.colorMap.blue;
        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy);
        this.ctx.lineTo(cx + triSize, cy + triSize);
        this.ctx.lineTo(cx - triSize, cy + triSize);
        this.ctx.closePath();
        this.ctx.fill();
        
        this.ctx.fillStyle = this.colorMap.red;
        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy);
        this.ctx.lineTo(cx - triSize, cy + triSize);
        this.ctx.lineTo(cx - triSize, cy - triSize);
        this.ctx.closePath();
        this.ctx.fill();
    }

    getPiecesAtPosition(targetColor, targetPosition) {
        const piecesHere = [];
        Object.entries(this.pieces).forEach(([color, pieces]) => {
            pieces.forEach((piece, index) => {
                if (!piece.inHome && !piece.inGoal) {
                    const globalPos = this.getGlobalPosition(color, piece.position);
                    const targetGlobalPos = this.getGlobalPosition(targetColor, targetPosition);
                    if (globalPos === targetGlobalPos && piece.position < 56) {
                        piecesHere.push({ color, index, piece });
                    }
                }
            });
        });
        return piecesHere;
    }

    drawPieces() {
        const currentColor = this.players[this.currentPlayerIndex]?.color;
        const drawnPositions = new Map();
        
        Object.entries(this.pieces).forEach(([color, pieces]) => {
            pieces.forEach((piece, index) => {
                let x, y, stackOffset = 0;
                
                if (piece.inHome) {
                    const homePos = this.homePositions[color][index];
                    x = homePos.x * this.cellSize;
                    y = homePos.y * this.cellSize;
                } else if (piece.inGoal) {
                    const offsets = [
                        { dx: -0.3, dy: -0.2 },
                        { dx: 0.3, dy: -0.2 },
                        { dx: -0.3, dy: 0.2 },
                        { dx: 0.3, dy: 0.2 }
                    ];
                    x = 7.5 * this.cellSize + offsets[index].dx * this.cellSize;
                    y = 7.5 * this.cellSize + offsets[index].dy * this.cellSize;
                } else {
                    const pathPos = this.paths[color][piece.position];
                    const posKey = `${pathPos.x},${pathPos.y}`;
                    
                    if (drawnPositions.has(posKey)) {
                        stackOffset = drawnPositions.get(posKey) * 5;
                        drawnPositions.set(posKey, drawnPositions.get(posKey) + 1);
                    } else {
                        drawnPositions.set(posKey, 1);
                    }
                    
                    x = (pathPos.x + 0.5) * this.cellSize;
                    y = (pathPos.y + 0.5) * this.cellSize - stackOffset;
                }
                
                piece.coords = { x, y };
                
                const isMovable = this.canMove && color === currentColor && 
                                 this.movablePieces && this.movablePieces.includes(index);
                
                if (isMovable) {
                    this.ctx.beginPath();
                    this.ctx.arc(x, y, this.cellSize * 0.42, 0, Math.PI * 2);
                    this.ctx.strokeStyle = '#FFD700';
                    this.ctx.lineWidth = 4;
                    this.ctx.stroke();
                }
                
                this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
                this.ctx.shadowBlur = 8;
                this.ctx.shadowOffsetX = 2;
                this.ctx.shadowOffsetY = 2;
                
                this.ctx.beginPath();
                this.ctx.arc(x, y, this.cellSize * 0.32, 0, Math.PI * 2);
                this.ctx.fillStyle = this.colorMap[color];
                this.ctx.fill();
                
                this.ctx.shadowColor = 'transparent';
                this.ctx.shadowBlur = 0;
                this.ctx.shadowOffsetX = 0;
                this.ctx.shadowOffsetY = 0;
                
                this.ctx.strokeStyle = '#FFFFFF';
                this.ctx.lineWidth = 3;
                this.ctx.stroke();
                
                this.ctx.beginPath();
                this.ctx.arc(x, y, this.cellSize * 0.15, 0, Math.PI * 2);
                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.globalAlpha = 0.5;
                this.ctx.fill();
                this.ctx.globalAlpha = 1;
                
                if (this.selectedPiece && this.selectedPiece.color === color && this.selectedPiece.id === piece.id) {
                    this.ctx.beginPath();
                    this.ctx.arc(x, y, this.cellSize * 0.38, 0, Math.PI * 2);
                    this.ctx.strokeStyle = '#00FF00';
                    this.ctx.lineWidth = 5;
                    this.ctx.stroke();
                }
            });
        });
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
        if (!this.canMove) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const currentColor = this.players[this.currentPlayerIndex].color;
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
            return newPos <= 61;
        });
    }

    showMoveChoice(color, pieceIndex, validRolls) {
        const popup = document.getElementById('moveChoicePopup');
        const buttonsContainer = document.getElementById('moveChoiceButtons');
        const piece = this.pieces[color][pieceIndex];
        
        if (!piece.coords) return;
        
        const canvasRect = this.canvas.getBoundingClientRect();
        const popupX = canvasRect.left + piece.coords.x - 60;
        const popupY = canvasRect.top + piece.coords.y - 80;
        
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
            const maxPosition = 61;
            
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
        
        if (this.pieceCaptured) {
            this.hasRolled = false;
            this.pieceCaptured = false;
            setTimeout(() => {
                this.updateCurrentPlayerDisplay();
            }, 500);
            return;
        }
        
        if (this.currentRolls.length > 0) {
            const pieces = this.pieces[color];
            const canMove = pieces.some(p => this.canPieceUseAnyRoll(p, color));
            
            if (canMove) {
                this.canMove = true;
                this.highlightMovablePieces(color);
            } else {
                setTimeout(() => {
                    this.endTurn();
                }, 500);
            }
        } else {
            setTimeout(() => {
                this.endTurn();
            }, 500);
        }
    }

    endTurn() {
        this.stopTurnTimer();
        this.currentRolls = [];
        this.hasRolled = false;
        this.consecutiveSixes = 0;
        this.pieceCaptured = false;
        const currentColor = this.players[this.currentPlayerIndex]?.color;
        if (currentColor) {
            this.updateRollsDisplay(currentColor);
        }
        this.nextPlayer();
    }

    checkCapture(color, piece) {
        if (piece.position >= 56) return;
        
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
                if (op.inHome || op.inGoal || op.position >= 56) return false;
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
        if (position >= 56) return -1;
        
        const startOffsets = { red: 2, green: 16, yellow: 30, blue: 44 };
        return (position + startOffsets[color]) % 56;
    }

    checkWin(color) {
        const pieces = this.pieces[color];
        return pieces.every(piece => piece.inGoal);
    }

    rollDice() {
        if (!this.players[this.currentPlayerIndex]) return;
        if (this.players[this.currentPlayerIndex].color !== this.myColor) return;
        
        if (this.hasRolled && this.diceValue !== 6) return;
        
        if (this.currentRolls.length >= 3) return;
        
        const currentColor = this.players[this.currentPlayerIndex].color;
        const diceId = `dice${currentColor.charAt(0).toUpperCase() + currentColor.slice(1)}`;
        const dice = document.getElementById(diceId);
        if (!dice) return;
        
        dice.classList.add('rolling');
        
        setTimeout(() => {
            this.diceValue = Math.floor(Math.random() * 6) + 1;
            this.updateDiceDisplay(this.diceValue, currentColor);
            dice.classList.remove('rolling');
            
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
            } else {
                this.hasRolled = true;
                this.consecutiveSixes = 0;
            }
            
            const pieces = this.pieces[currentColor];
            const canMove = pieces.some(piece => {
                return this.canPieceUseAnyRoll(piece, currentColor);
            });
            
            if (canMove) {
                this.canMove = true;
                this.highlightMovablePieces(currentColor);
            } else if (!this.currentRolls.includes(6) || this.hasRolled) {
                setTimeout(() => {
                    this.endTurn();
                }, 1000);
            }
        }, 500);
    }

    canPieceUseAnyRoll(piece, color) {
        return this.currentRolls.some(roll => {
            if (piece.inHome) return roll === 6;
            if (piece.inGoal) return false;
            const newPos = piece.position + roll;
            return newPos <= 61;
        });
    }

    updateRollsDisplay(color) {
        const rollsId = `rolls${color.charAt(0).toUpperCase() + color.slice(1)}`;
        const rollsElement = document.getElementById(rollsId);
        if (rollsElement) {
            rollsElement.innerHTML = this.currentRolls.map(roll => 
                `<span class="roll-badge">${roll}</span>`
            ).join('');
        }
    }

    nextPlayer() {
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        this.canMove = false;
        this.movablePieces = [];
        this.selectedPiece = null;
        this.consecutiveSixes = 0;
        this.currentRolls = [];
        this.hasRolled = false;
        this.pieceCaptured = false;
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
            const diceId = `dice${color.charAt(0).toUpperCase() + color.slice(1)}`;
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
        } else {
            Object.keys(this.playerDice).forEach(c => {
                this.updateDiceDisplay(this.playerDice[c], c);
            });
        }
    }

    simulateAITurn() {
        if (!this.players[this.currentPlayerIndex]) return;
        if (this.players[this.currentPlayerIndex].color === this.myColor) return;
        
        if (this.hasRolled && this.diceValue !== 6) {
            this.simulateAIMove();
            return;
        }
        
        if (this.currentRolls.length >= 3) {
            this.simulateAIMove();
            return;
        }
        
        const currentColor = this.players[this.currentPlayerIndex].color;
        const diceId = `dice${currentColor.charAt(0).toUpperCase() + currentColor.slice(1)}`;
        const dice = document.getElementById(diceId);
        
        if (!dice) {
            console.error(`Dice element not found: ${diceId}`);
            return;
        }
        
        dice.classList.add('rolling');
        
        setTimeout(() => {
            this.diceValue = Math.floor(Math.random() * 6) + 1;
            this.updateDiceDisplay(this.diceValue, currentColor);
            dice.classList.remove('rolling');
            
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
                setTimeout(() => this.simulateAITurn(), 1000);
            } else {
                this.hasRolled = true;
                this.consecutiveSixes = 0;
                setTimeout(() => this.simulateAIMove(), 1000);
            }
        }, 500);
    }

    simulateAIMove() {
        const currentColor = this.players[this.currentPlayerIndex].color;
        const pieces = this.pieces[currentColor];
        
        const movablePieces = pieces.filter((piece, index) => {
            return this.canPieceUseAnyRoll(piece, currentColor);
        });
        
        if (movablePieces.length > 0) {
            const randomPiece = movablePieces[Math.floor(Math.random() * movablePieces.length)];
            const pieceIndex = pieces.indexOf(randomPiece);
            const validRolls = this.getValidRollsForPiece(randomPiece, currentColor);
            const selectedRoll = validRolls[Math.floor(Math.random() * validRolls.length)];
            
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
            const avatarClass = `${color}-avatar`;
            const avatar = document.querySelector(`.${avatarClass}`);
            const timerElement = document.getElementById(`timer${color.charAt(0).toUpperCase() + color.slice(1)}`);
            
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
        });
        
        this.startTurnTimer();
    }
    
    startTurnTimer() {
        if (this.turnTimer) {
            clearInterval(this.turnTimer);
        }
        
        this.turnTimeRemaining = 30;
        const currentColor = this.players[this.currentPlayerIndex].color;
        const timerElement = document.getElementById(`timer${currentColor.charAt(0).toUpperCase() + currentColor.slice(1)}`);
        
        if (timerElement) {
            timerElement.textContent = this.turnTimeRemaining;
        }
        
        this.turnTimer = setInterval(() => {
            this.turnTimeRemaining--;
            
            if (timerElement) {
                timerElement.textContent = this.turnTimeRemaining;
            }
            
            if (this.turnTimeRemaining <= 0) {
                clearInterval(this.turnTimer);
                this.endTurn();
            }
        }, 1000);
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
            code += chars.charAt(Math.floor(Math.random() * chars.length));
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
        this.showMenuScreen();
    }
}

const game = new LudoGame();

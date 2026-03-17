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
                { x: 1.5, y: 1.5 },
                { x: 4.5, y: 1.5 },
                { x: 1.5, y: 4.5 },
                { x: 4.5, y: 4.5 }
            ],
            green: [
                { x: 9.5, y: 1.5 },
                { x: 12.5, y: 1.5 },
                { x: 9.5, y: 4.5 },
                { x: 12.5, y: 4.5 }
            ],
            yellow: [
                { x: 9.5, y: 9.5 },
                { x: 12.5, y: 9.5 },
                { x: 9.5, y: 12.5 },
                { x: 12.5, y: 12.5 }
            ],
            blue: [
                { x: 1.5, y: 9.5 },
                { x: 4.5, y: 9.5 },
                { x: 1.5, y: 12.5 },
                { x: 4.5, y: 12.5 }
            ]
        };
    }

    generatePath(color) {
        const mainPath = [
            { x: 6, y: 1 }, { x: 6, y: 2 }, { x: 6, y: 3 }, { x: 6, y: 4 }, { x: 6, y: 5 },
            { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 3, y: 6 }, { x: 2, y: 6 }, { x: 1, y: 6 }, { x: 0, y: 6 },
            { x: 0, y: 7 }, { x: 0, y: 8 },
            { x: 1, y: 8 }, { x: 2, y: 8 }, { x: 3, y: 8 }, { x: 4, y: 8 }, { x: 5, y: 8 },
            { x: 6, y: 9 }, { x: 6, y: 10 }, { x: 6, y: 11 }, { x: 6, y: 12 }, { x: 6, y: 13 }, { x: 6, y: 14 },
            { x: 7, y: 14 }, { x: 8, y: 14 },
            { x: 8, y: 13 }, { x: 8, y: 12 }, { x: 8, y: 11 }, { x: 8, y: 10 }, { x: 8, y: 9 },
            { x: 9, y: 8 }, { x: 10, y: 8 }, { x: 11, y: 8 }, { x: 12, y: 8 }, { x: 13, y: 8 }, { x: 14, y: 8 },
            { x: 14, y: 7 }, { x: 14, y: 6 },
            { x: 13, y: 6 }, { x: 12, y: 6 }, { x: 11, y: 6 }, { x: 10, y: 6 }, { x: 9, y: 6 },
            { x: 8, y: 5 }, { x: 8, y: 4 }, { x: 8, y: 3 }, { x: 8, y: 2 }, { x: 8, y: 1 }, { x: 8, y: 0 },
            { x: 7, y: 0 }, { x: 6, y: 0 }
        ];

        const homePaths = {
            red: [{ x: 7, y: 1 }, { x: 7, y: 2 }, { x: 7, y: 3 }, { x: 7, y: 4 }, { x: 7, y: 5 }, { x: 7, y: 6 }],
            green: [{ x: 13, y: 7 }, { x: 12, y: 7 }, { x: 11, y: 7 }, { x: 10, y: 7 }, { x: 9, y: 7 }, { x: 8, y: 7 }],
            yellow: [{ x: 7, y: 13 }, { x: 7, y: 12 }, { x: 7, y: 11 }, { x: 7, y: 10 }, { x: 7, y: 9 }, { x: 7, y: 8 }],
            blue: [{ x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }, { x: 6, y: 7 }]
        };

        const startPositions = {
            red: 0,
            green: 13,
            yellow: 26,
            blue: 39
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
        this.myColor = 'yellow';
        this.players = [
            { id: 'player1', color: 'yellow', name: 'You' },
            { id: 'player2', color: 'blue', name: 'Player 2' },
            { id: 'player3', color: 'red', name: 'Player 3' },
            { id: 'player4', color: 'green', name: 'Player 4' }
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
        this.drawStartingPositions();
        this.drawSafeSpots();
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
                    this.cellSize * 0.65,
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
                    this.cellSize * 0.35,
                    0,
                    Math.PI * 2
                );
                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.fill();
            });
        });
    }

    drawPath() {
        const allPaths = [...this.paths.red.slice(0, 52)];
        
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
            const homePath = path.slice(52);
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
            { x: 6, y: 1, color: 'red' },
            { x: 13, y: 6, color: 'green' },
            { x: 8, y: 13, color: 'yellow' },
            { x: 1, y: 8, color: 'blue' }
        ];

        startPositions.forEach(pos => {
            this.drawArrow(
                (pos.x + 0.5) * this.cellSize,
                (pos.y + 0.5) * this.cellSize,
                this.colorMap[pos.color]
            );
        });
    }

    drawArrow(x, y, color) {
        const size = this.cellSize * 0.4;
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y - size);
        this.ctx.lineTo(x - size * 0.6, y + size * 0.3);
        this.ctx.lineTo(x - size * 0.3, y + size * 0.3);
        this.ctx.lineTo(x - size * 0.3, y + size);
        this.ctx.lineTo(x + size * 0.3, y + size);
        this.ctx.lineTo(x + size * 0.3, y + size * 0.3);
        this.ctx.lineTo(x + size * 0.6, y + size * 0.3);
        this.ctx.closePath();
        this.ctx.fill();
    }

    drawSafeSpots() {
        const safeSpots = [
            { x: 6, y: 2, color: 'red' },
            { x: 2, y: 6, color: 'red' },
            { x: 12, y: 6, color: 'green' },
            { x: 8, y: 2, color: 'green' },
            { x: 8, y: 12, color: 'yellow' },
            { x: 12, y: 8, color: 'yellow' },
            { x: 2, y: 8, color: 'blue' },
            { x: 6, y: 12, color: 'blue' }
        ];

        safeSpots.forEach(spot => {
            this.drawStar(
                (spot.x + 0.5) * this.cellSize,
                (spot.y + 0.5) * this.cellSize,
                this.cellSize * 0.35,
                spot.color
            );
        });
    }

    drawStar(cx, cy, radius, color) {
        const spikes = 4;
        const outerRadius = radius;
        const innerRadius = radius * 0.4;
        
        this.ctx.save();
        this.ctx.translate(cx, cy);
        this.ctx.rotate(Math.PI / 4);
        
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
        
        this.ctx.fillStyle = this.colorMap[color];
        this.ctx.fill();
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        this.ctx.restore();
    }

    drawCenterTriangle() {
        const center = 7.5 * this.cellSize;
        const size = this.cellSize * 1.2;
        
        this.ctx.fillStyle = '#E74C3C';
        this.ctx.beginPath();
        this.ctx.moveTo(center, center - size);
        this.ctx.lineTo(center - size * 0.866, center + size * 0.5);
        this.ctx.lineTo(center + size * 0.866, center + size * 0.5);
        this.ctx.closePath();
        this.ctx.fill();
        
        this.ctx.fillStyle = '#27AE60';
        this.ctx.beginPath();
        this.ctx.moveTo(center + size * 0.866, center + size * 0.5);
        this.ctx.lineTo(center, center - size);
        this.ctx.lineTo(center, center + size);
        this.ctx.closePath();
        this.ctx.fill();
        
        this.ctx.fillStyle = '#F1C40F';
        this.ctx.beginPath();
        this.ctx.moveTo(center, center + size);
        this.ctx.lineTo(center + size * 0.866, center + size * 0.5);
        this.ctx.lineTo(center - size * 0.866, center + size * 0.5);
        this.ctx.closePath();
        this.ctx.fill();
        
        this.ctx.fillStyle = '#3498DB';
        this.ctx.beginPath();
        this.ctx.moveTo(center - size * 0.866, center + size * 0.5);
        this.ctx.lineTo(center, center + size);
        this.ctx.lineTo(center, center - size);
        this.ctx.closePath();
        this.ctx.fill();
        
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.moveTo(center, center - size);
        this.ctx.lineTo(center - size * 0.866, center + size * 0.5);
        this.ctx.lineTo(center + size * 0.866, center + size * 0.5);
        this.ctx.closePath();
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.moveTo(center, center - size);
        this.ctx.lineTo(center, center + size);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(center - size * 0.866, center + size * 0.5);
        this.ctx.lineTo(center + size * 0.866, center + size * 0.5);
        this.ctx.stroke();
    }

    drawPieces() {
        const currentColor = this.players[this.currentPlayerIndex]?.color;
        
        Object.entries(this.pieces).forEach(([color, pieces]) => {
            pieces.forEach((piece, index) => {
                let x, y;
                
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
                    x = (pathPos.x + 0.5) * this.cellSize;
                    y = (pathPos.y + 0.5) * this.cellSize;
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
            let canMove = false;
            if (piece.inHome && this.diceValue === 6) {
                canMove = true;
            } else if (!piece.inHome && !piece.inGoal) {
                const newPos = piece.position + this.diceValue;
                if (newPos <= 57) {
                    canMove = true;
                }
            }
            
            if (canMove) {
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
        
        if (piece.inHome && this.diceValue === 6) {
            piece.inHome = false;
            piece.position = 0;
            this.canMove = false;
            this.movablePieces = [];
            this.selectedPiece = null;
            this.drawBoard();
            
            setTimeout(() => {
                this.updateCurrentPlayerDisplay();
            }, 500);
        } else if (!piece.inHome && !piece.inGoal) {
            const newPosition = piece.position + this.diceValue;
            const maxPosition = 57;
            
            if (newPosition === maxPosition) {
                piece.inGoal = true;
                piece.position = maxPosition;
                
                this.canMove = false;
                this.movablePieces = [];
                this.selectedPiece = null;
                this.drawBoard();
                
                if (this.checkWin(color)) {
                    setTimeout(() => {
                        alert(`${this.players[this.currentPlayerIndex].name} wins!`);
                        this.exitGame();
                    }, 500);
                } else if (this.diceValue === 6) {
                    setTimeout(() => {
                        this.updateCurrentPlayerDisplay();
                    }, 500);
                } else {
                    setTimeout(() => {
                        this.nextPlayer();
                    }, 500);
                }
            } else if (newPosition < maxPosition) {
                piece.position = newPosition;
                
                this.checkCapture(color, piece);
                
                this.canMove = false;
                this.movablePieces = [];
                this.selectedPiece = null;
                this.drawBoard();
                
                if (this.diceValue === 6) {
                    setTimeout(() => {
                        this.updateCurrentPlayerDisplay();
                    }, 500);
                } else if (!this.checkWin(color)) {
                    setTimeout(() => {
                        this.nextPlayer();
                    }, 500);
                }
            }
        }
    }

    checkCapture(color, piece) {
        if (piece.position >= 52) return;
        
        const safePositions = [0, 8, 13, 21, 26, 34, 39, 47];
        if (safePositions.includes(piece.position)) return;
        
        Object.entries(this.pieces).forEach(([otherColor, otherPieces]) => {
            if (otherColor === color) return;
            
            otherPieces.forEach(otherPiece => {
                if (!otherPiece.inHome && !otherPiece.inGoal) {
                    const myGlobalPos = this.getGlobalPosition(color, piece.position);
                    const otherGlobalPos = this.getGlobalPosition(otherColor, otherPiece.position);
                    
                    if (myGlobalPos === otherGlobalPos && otherPiece.position < 52) {
                        otherPiece.inHome = true;
                        otherPiece.position = -1;
                    }
                }
            });
        });
    }

    getGlobalPosition(color, position) {
        if (position >= 52) return -1;
        
        const startOffsets = { red: 0, green: 13, yellow: 26, blue: 39 };
        return (position + startOffsets[color]) % 52;
    }

    checkWin(color) {
        const pieces = this.pieces[color];
        return pieces.every(piece => piece.inGoal);
    }

    rollDice() {
        if (!this.players[this.currentPlayerIndex]) return;
        if (this.players[this.currentPlayerIndex].color !== this.myColor) return;
        
        const currentColor = this.players[this.currentPlayerIndex].color;
        const diceId = `dice${currentColor.charAt(0).toUpperCase() + currentColor.slice(1)}`;
        const dice = document.getElementById(diceId);
        if (!dice) return;
        
        dice.classList.add('rolling');
        
        setTimeout(() => {
            this.diceValue = Math.floor(Math.random() * 6) + 1;
            this.updateDiceDisplay(this.diceValue, currentColor);
            dice.classList.remove('rolling');
            
            const pieces = this.pieces[currentColor];
            
            const canMove = pieces.some(piece => {
                if (piece.inHome) return this.diceValue === 6;
                if (piece.inGoal) return false;
                const newPos = piece.position + this.diceValue;
                return newPos <= 57;
            });
            
            if (canMove) {
                this.canMove = true;
                this.highlightMovablePieces(currentColor);
            } else {
                setTimeout(() => {
                    if (this.diceValue !== 6) {
                        this.nextPlayer();
                    }
                }, 1000);
            }
        }, 500);
    }

    nextPlayer() {
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        this.canMove = false;
        this.movablePieces = [];
        this.selectedPiece = null;
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
            
            setTimeout(() => {
                const pieces = this.pieces[currentColor];
                
                const movablePieces = pieces.filter((piece, index) => {
                    if (piece.inHome) return this.diceValue === 6;
                    if (piece.inGoal) return false;
                    const newPos = piece.position + this.diceValue;
                    return newPos <= 57;
                });
                
                if (movablePieces.length > 0) {
                    const randomPiece = movablePieces[Math.floor(Math.random() * movablePieces.length)];
                    const pieceIndex = pieces.indexOf(randomPiece);
                    this.selectAndMovePiece(currentColor, pieceIndex);
                } else {
                    if (this.diceValue !== 6) {
                        setTimeout(() => this.nextPlayer(), 1000);
                    } else {
                        setTimeout(() => this.simulateAITurn(), 1000);
                    }
                }
            }, 500);
        }, 500);
    }

    updateCurrentPlayerDisplay() {
        if (!this.players[this.currentPlayerIndex]) return;
        
        const currentColor = this.players[this.currentPlayerIndex].color;
        
        ['red', 'green', 'yellow', 'blue'].forEach(color => {
            const avatarClass = `${color}-avatar`;
            const avatar = document.querySelector(`.${avatarClass}`);
            if (avatar) {
                if (color === currentColor) {
                    avatar.classList.add('active');
                } else {
                    avatar.classList.remove('active');
                }
            }
        });
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

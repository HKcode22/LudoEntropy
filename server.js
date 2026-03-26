const WebSocket = require('ws');
const http = require('http');

// Create HTTP server for WebSocket upgrade
const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Store room data
const rooms = {};

// Generate random room code
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Broadcast message to all players in a room
function broadcastToRoom(roomCode, message, excludeWs = null) {
    const room = rooms[roomCode];
    if (!room) return;
    
    room.players.forEach(player => {
        if (player.ws !== excludeWs && player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(JSON.stringify(message));
        }
    });
}

// Handle WebSocket connections
wss.on('connection', (ws) => {
    console.log('New client connected');
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            console.log('Received message:', message);
            
            switch (message.type) {
                case 'createGame':
                    handleCreateGame(ws, message);
                    break;
                case 'joinGame':
                    handleJoinGame(ws, message);
                    break;
                case 'rollDice':
                    handleRollDice(ws, message);
                    break;
                case 'movePiece':
                    handleMovePiece(ws, message);
                    break;
                case 'startGame':
                    handleStartGame(ws, message);
                    break;
                case 'chat':
                    handleChat(ws, message);
                    break;
                default:
                    console.log('Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });
    
    ws.on('close', () => {
        console.log('Client disconnected');
        handleDisconnect(ws);
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

function handleCreateGame(ws, message) {
    const roomCode = generateRoomCode();
    const playerName = message.playerName || 'Player';
    const playerColor = message.playerColor || 'red';
    
    // Create new room
    rooms[roomCode] = {
        players: [],
        gameState: 'waiting',
        currentTurn: playerColor,
        roomCode: roomCode
    };
    
    // Add host player
    rooms[roomCode].players.push({
        ws: ws,
        name: playerName,
        color: playerColor,
        isHost: true
    });
    
    // Send room code to host
    ws.send(JSON.stringify({
        type: 'gameCreated',
        roomCode: roomCode,
        players: rooms[roomCode].players.map(p => ({
            name: p.name,
            color: p.color,
            isHost: p.isHost
        }))
    }));
    
    console.log(`Room ${roomCode} created by ${playerName} (${playerColor})`);
}

function handleJoinGame(ws, message) {
    const { roomCode, playerName, playerColor } = message;
    const room = rooms[roomCode];
    
    if (!room) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Room not found'
        }));
        return;
    }
    
    if (room.players.length >= 4) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Room is full'
        }));
        return;
    }
    
    // Check if color is already taken
    if (room.players.some(p => p.color === playerColor)) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Color already taken'
        }));
        return;
    }
    
    // Add new player
    room.players.push({
        ws: ws,
        name: playerName,
        color: playerColor,
        isHost: false
    });
    
    // Send success to joining player
    ws.send(JSON.stringify({
        type: 'gameJoined',
        roomCode: roomCode,
        players: room.players.map(p => ({
            name: p.name,
            color: p.color,
            isHost: p.isHost
        }))
    }));
    
    // Notify all players about the new player
    broadcastToRoom(roomCode, {
        type: 'playerJoined',
        player: {
            name: playerName,
            color: playerColor,
            isHost: false
        },
        players: room.players.map(p => ({
            name: p.name,
            color: p.color,
            isHost: p.isHost
        }))
    });
    
    console.log(`${playerName} (${playerColor}) joined room ${roomCode}`);
}

function handleRollDice(ws, message) {
    const { roomCode, playerColor, diceValue } = message;
    const room = rooms[roomCode];
    
    if (!room) return;
    
    // Broadcast dice roll to all players
    broadcastToRoom(roomCode, {
        type: 'diceRolled',
        playerColor: playerColor,
        diceValue: diceValue
    });
}

function handleMovePiece(ws, message) {
    const { roomCode, playerColor, pieceIndex, newPosition } = message;
    const room = rooms[roomCode];
    
    if (!room) return;
    
    // Broadcast move to all players
    broadcastToRoom(roomCode, {
        type: 'pieceMoved',
        playerColor: playerColor,
        pieceIndex: pieceIndex,
        newPosition: newPosition
    });
}

function handleStartGame(ws, message) {
    const { roomCode } = message;
    const room = rooms[roomCode];
    
    if (!room) return;
    
    // Only host can start game
    const player = room.players.find(p => p.ws === ws);
    if (!player || !player.isHost) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Only host can start game'
        }));
        return;
    }
    
    room.gameState = 'playing';
    
    // Broadcast game start to all players
    broadcastToRoom(roomCode, {
        type: 'gameStarted',
        currentTurn: room.currentTurn
    });
    
    console.log(`Game started in room ${roomCode}`);
}

function handleChat(ws, message) {
    const { roomCode, playerName, chatMessage } = message;
    const room = rooms[roomCode];
    
    if (!room) return;
    
    // Broadcast chat message to all players
    broadcastToRoom(roomCode, {
        type: 'chatMessage',
        playerName: playerName,
        message: chatMessage,
        timestamp: Date.now()
    });
}

function handleDisconnect(ws) {
    // Find and remove player from all rooms
    for (const roomCode in rooms) {
        const room = rooms[roomCode];
        const playerIndex = room.players.findIndex(p => p.ws === ws);
        
        if (playerIndex !== -1) {
            const disconnectedPlayer = room.players[playerIndex];
            room.players.splice(playerIndex, 1);
            
            // Notify other players
            broadcastToRoom(roomCode, {
                type: 'playerLeft',
                player: {
                    name: disconnectedPlayer.name,
                    color: disconnectedPlayer.color
                },
                players: room.players.map(p => ({
                    name: p.name,
                    color: p.color,
                    isHost: p.isHost
                }))
            });
            
            // If room is empty, delete it
            if (room.players.length === 0) {
                delete rooms[roomCode];
                console.log(`Room ${roomCode} deleted (empty)`);
            }
            
            break;
        }
    }
}

// Start server
const PORT = process.env.PORT || 8081;
server.listen(PORT, () => {
    console.log(`Ludo WebSocket server running on port ${PORT}`);
    console.log(`WebSocket endpoint: ws://localhost:${PORT}`);
});

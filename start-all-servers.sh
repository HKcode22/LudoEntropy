#!/bin/bash

echo "🎮 Starting Ludo Game Servers..."
echo "================================"

# Kill any existing servers
echo "🔄 Stopping existing servers..."
pkill -f "node server.js" 2>/dev/null
pkill -f "python3 -m http.server" 2>/dev/null
sleep 1

# Start backend dice server
echo "🎲 Starting dice server on port 5179..."
cd /Users/hk/Downloads/ludo/backend
node server.js &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# Start WebSocket server
echo "🔗 Starting WebSocket server on port 8081..."
cd /Users/hk/Downloads/ludo
node server.js &
WS_PID=$!
echo "   WebSocket PID: $WS_PID"

# Start HTTP server for frontend
echo "🌐 Starting HTTP server on port 3000..."
cd /Users/hk/Downloads/ludo
python3 -m http.server 3000 &
HTTP_PID=$!
echo "   HTTP PID: $HTTP_PID"

# Wait for servers to start
sleep 3

echo ""
echo "✅ All servers started!"
echo "================================"
echo "🎲 Dice Server: http://localhost:5179"
echo "🔗 WebSocket: ws://localhost:8081"
echo "🌐 Game URL: http://localhost:3000"
echo "================================"
echo ""
echo "💡 To stop all servers, run:"
echo "   pkill -f 'node server.js'"
echo "   pkill -f 'python3 -m http.server'"
echo ""
echo "📝 Server PIDs saved to /tmp/ludo_servers.pid"
echo "$BACKEND_PID" > /tmp/ludo_servers.pid
echo "$WS_PID" >> /tmp/ludo_servers.pid
echo "$HTTP_PID" >> /tmp/ludo_servers.pid

# Keep script running
wait

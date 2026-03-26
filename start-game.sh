#!/bin/bash

echo "🎮 Starting Ludo Game Environment"
echo "================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed. Please install npm first."
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the backend server in the background
echo "🎲 Starting dice backend server on port 5178..."
node backend/server.js &
BACKEND_PID=$!

# Wait a moment for the backend to start
sleep 2

# Check if backend started successfully
if curl -s http://localhost:5178 > /dev/null; then
    echo "✅ Backend server is running on http://localhost:5178"
else
    echo "⚠️  Backend server might not be responding, but continuing..."
fi

# Start the frontend server
echo "🌐 Starting frontend server on port 8080..."
echo "🎯 Open your browser and go to: http://localhost:8080"
echo ""
echo "🛑 To stop the game, press Ctrl+C"
echo ""

# Function to cleanup background processes
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
        echo "✅ Backend server stopped"
    fi
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start the frontend (this will block)
npm run serve

# Cleanup when frontend exits
cleanup

#!/bin/bash
echo "Starting Ludo Dice Backend Server on port 5178..."
cd "$(dirname "$0")"
node backend/server.js
echo "Backend server stopped."

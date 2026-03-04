#!/bin/bash

# Teacher Schedule Viewer - Startup Script
# ICAN Academy

echo "Starting Teacher Schedule Viewer..."
echo ""

cd "$(dirname "$0")"

# Check if server node_modules exists
if [ ! -d "server/node_modules" ]; then
  echo "Installing server dependencies..."
  cd server
  npm install
  cd ..
  echo ""
fi

# Check if client node_modules exists
if [ ! -d "client/node_modules" ]; then
  echo "Installing client dependencies..."
  cd client
  npm install
  cd ..
  echo ""
fi

# Build client if dist doesn't exist or source is newer
if [ ! -d "client/dist" ] || [ "client/src" -nt "client/dist" ]; then
  echo "Building client..."
  cd client
  npx vite build
  cd ..
  echo ""
fi

# Kill any existing process on our port
lsof -ti :5001 | xargs kill 2>/dev/null
sleep 1

# Start the server (serves both API and built client)
echo "Starting server on port 5001..."
cd server
node src/server.js &
SERVER_PID=$!
cd ..

sleep 2

echo ""
echo "Teacher Schedule Viewer is running!"
echo "Local:  http://localhost:5001"
echo "Public: https://teacher.icanacademy.work"
echo "To stop: Press Ctrl+C"
echo ""

# Handle Ctrl+C
trap "echo 'Stopping...'; kill $SERVER_PID 2>/dev/null; exit 0" SIGINT SIGTERM

# Keep script running
wait $SERVER_PID

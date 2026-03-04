#!/bin/bash
cd "$(dirname "$0")"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   ICAN Teacher Schedule Viewer${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Cleanup background processes on exit
cleanup() {
  echo ""
  echo -e "${RED}Shutting down...${NC}"
  kill $SERVER_PID 2>/dev/null
  kill $CLIENT_PID 2>/dev/null
  exit 0
}
trap cleanup SIGINT SIGTERM

# Install dependencies if needed
if [ ! -d "server/node_modules" ]; then
  echo -e "${GREEN}Installing server dependencies...${NC}"
  (cd server && npm install)
fi

if [ ! -d "client/node_modules" ]; then
  echo -e "${GREEN}Installing client dependencies...${NC}"
  (cd client && npm install)
fi

# Start server
echo -e "${GREEN}Starting server on port 5001...${NC}"
(cd server && npm run dev) &
SERVER_PID=$!

# Brief pause to let server initialize
sleep 2

# Start client
echo -e "${GREEN}Starting client on port 5173...${NC}"
(cd client && npm run dev) &
CLIENT_PID=$!

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "  Server:  ${GREEN}http://localhost:5001${NC}"
echo -e "  Client:  ${GREEN}http://localhost:5173${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "  Press ${RED}Ctrl+C${NC} to stop both"
echo ""

wait

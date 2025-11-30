#!/bin/bash

# Start server with automatic restart on failure
while true; do
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting server on port 3001..."
  PORT=3001 node server.js
  EXIT_CODE=$?
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Server exited with code $EXIT_CODE. Restarting in 2 seconds..."
  sleep 2
done

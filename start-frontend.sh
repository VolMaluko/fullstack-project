#!/bin/bash

# Start Next.js dev with automatic restart on failure
while true; do
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting Next.js dev..."
  npm run dev
  EXIT_CODE=$?
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Next.js exited with code $EXIT_CODE. Restarting in 2 seconds..."
  sleep 2
done

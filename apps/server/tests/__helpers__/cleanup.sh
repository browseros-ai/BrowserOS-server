#!/usr/bin/env bash

# Cleanup script for BrowserOS test resources
# Kills any running test processes and removes orphaned temp directories

set -e

echo "Cleaning up BrowserOS test resources..."

# Test ports (from setup.ts defaults)
CDP_PORT=${CDP_PORT:-9005}
HTTP_MCP_PORT=${HTTP_MCP_PORT:-9105}
EXTENSION_PORT=${EXTENSION_PORT:-9305}

for port in $CDP_PORT $HTTP_MCP_PORT $EXTENSION_PORT; do
  pid=$(lsof -ti :$port 2>/dev/null || true)
  if [ -n "$pid" ]; then
    echo "  Killing process on port $port (PID: $pid)"
    kill -9 $pid 2>/dev/null || true
  fi
done

# Clean up orphaned temp directories (created by browser.ts)
# Uses $TMPDIR which matches Node's os.tmpdir()
TEMP_DIR="${TMPDIR:-/tmp}"
temp_dirs=$(find "$TEMP_DIR" -maxdepth 1 -name "browseros-test-*" -type d 2>/dev/null | wc -l | tr -d ' ')

if [ "$temp_dirs" -gt 0 ]; then
  echo "  Removing $temp_dirs orphaned temp directories"
  find "$TEMP_DIR" -maxdepth 1 -name "browseros-test-*" -type d -exec rm -rf {} + 2>/dev/null || true
fi

echo "Cleanup complete"

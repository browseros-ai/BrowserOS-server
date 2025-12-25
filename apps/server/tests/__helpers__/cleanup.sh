#!/usr/bin/env bash

# Cleanup script for BrowserOS test resources
# Kills any running BrowserOS test processes and removes orphaned temp directories

set -e

echo "🧹 Cleaning up BrowserOS test resources..."
echo ""

# Kill BrowserOS and Server processes on test ports
# Default test ports:
#   9005 - BrowserOS CDP (test)
#   9105 - MCP HTTP Server (test)
#   9205 - Agent WebSocket (test)
#   9305 - Controller Extension WebSocket (test)
# Also cleanup legacy/dev ports:
#   9000-9004 - Old test ports
#   9100, 9200 - Old server ports

# Read ports from environment or use defaults
CDP_PORT=${CDP_PORT:-9005}
HTTP_MCP_PORT=${HTTP_MCP_PORT:-9105}
AGENT_PORT=${AGENT_PORT:-9205}
EXTENSION_PORT=${EXTENSION_PORT:-9305}

for port in 9000 9001 9002 9003 9004 9100 9200 $CDP_PORT $HTTP_MCP_PORT $AGENT_PORT $EXTENSION_PORT; do
  pid=$(lsof -ti :$port 2>/dev/null || true)
  if [ -n "$pid" ]; then
    echo "  Killing process on port $port (PID: $pid)..."
    kill -9 $pid 2>/dev/null || true
  fi
done

# Clean up orphaned temp directories
echo ""
echo "  Cleaning up orphaned temp directories..."
temp_dirs=$(find /var/folders -name "browseros-test-*" -type d 2>/dev/null | wc -l | tr -d ' ')

if [ "$temp_dirs" -gt 0 ]; then
  echo "  Found $temp_dirs orphaned temp directories"

  # Ask for confirmation if many directories
  if [ "$temp_dirs" -gt 50 ]; then
    read -p "  Remove all $temp_dirs directories? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo "  Aborted."
      exit 0
    fi
  fi

  find /var/folders -name "browseros-test-*" -type d -exec rm -rf {} + 2>/dev/null || true
  echo "  ✅ Removed $temp_dirs orphaned temp directories"
else
  echo "  ✅ No orphaned temp directories found"
fi

echo ""
echo "✅ Cleanup complete!"

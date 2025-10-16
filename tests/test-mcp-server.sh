#!/usr/bin/env bash
#
# Test script for MCP Server
#
# Usage: ./scripts/test-mcp-server.sh [port]
#

MCP_PORT="${1:-9223}"

echo "Testing MCP server at http://127.0.0.1:${MCP_PORT}"
echo ""

# 1. List tools
echo "1. List tools:"
curl -s -X POST http://127.0.0.1:${MCP_PORT}/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }' | jq -r '.result.tools[] | "  - \(.name)"'
echo ""

# # 2. Navigate to amazon.com (old tool name)
# echo "2. Navigate to amazon.com (old tool name):"
# curl -s -X POST http://127.0.0.1:${MCP_PORT}/mcp \
#   -H "Content-Type: application/json" \
#   -H "Accept: application/json, text/event-stream" \
#   -d '{
#     "jsonrpc": "2.0",
#     "id": 2,
#     "method": "tools/call",
#     "params": {
#       "name": "navigate_page",
#       "arguments": {
#         "url": "https://amazon.com"
#       }
#     }
#   }' | jq
# echo ""

# 3. Navigate to amazon.com (new tool name)
echo "3. Navigate to amazon.com (new tool name - browser_navigate):"
curl -s -X POST http://127.0.0.1:${MCP_PORT}/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "browser_navigate",
      "arguments": {
        "url": "https://amazon.com"
      }
    }
  }' | jq
echo ""

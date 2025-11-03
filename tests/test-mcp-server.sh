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

# 2. Get active tab
echo "2. Get active tab:"
curl -s -X POST http://127.0.0.1:${MCP_PORT}/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "browser_get_active_tab",
      "arguments": {}
    }
  }' | jq
echo ""

# 3. List tabs
echo "3. List tabs:"
TABS_RESPONSE=$(curl -s -X POST http://127.0.0.1:${MCP_PORT}/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "browser_list_tabs",
      "arguments": {}
    }
  }')
echo "$TABS_RESPONSE" | jq
FIRST_TAB_ID=$(echo "$TABS_RESPONSE" | jq -r '.result.content[0].text' | grep -oE 'Tab ID: [0-9]+' | head -1 | grep -oE '[0-9]+')
echo ""

# 4. Navigate to amazon.com
echo "4. Navigate to amazon.com (browser_navigate):"
curl -s -X POST http://127.0.0.1:${MCP_PORT}/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
      "name": "browser_navigate",
      "arguments": {
        "url": "https://amazon.com"
      }
    }
  }' | jq
echo ""

# 5. Get load status
echo "5. Get load status:"
curl -s -X POST http://127.0.0.1:${MCP_PORT}/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 5,
    "method": "tools/call",
    "params": {
      "name": "browser_get_load_status",
      "arguments": {}
    }
  }' | jq
echo ""

# 6. Open tab
echo "6. Open tab (google.com):"
curl -s -X POST http://127.0.0.1:${MCP_PORT}/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 6,
    "method": "tools/call",
    "params": {
      "name": "browser_open_tab",
      "arguments": {
        "url": "https://google.com"
      }
    }
  }' | jq
echo ""

# 7. Get page content
echo "7. Get page content:"
curl -s -X POST http://127.0.0.1:${MCP_PORT}/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 7,
    "method": "tools/call",
    "params": {
      "name": "browser_get_page_content",
      "arguments": {}
    }
  }' | jq -r '.result.content[0].text' | head -50
echo ""

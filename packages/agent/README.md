# BrowserOS Agent Server

A high-performance WebSocket server for Claude AI agents with browser automation capabilities via MCP (Model Context Protocol).

## What is this?

Multi-agent server that handles concurrent Claude AI sessions with full Chrome DevTools integration. Built on Bun for ultra-fast performance with standalone binary deployment.

**Key Features:**

- 🤖 Multi-agent WebSocket server
- 🌐 Browser automation (26 Chrome DevTools tools)
- ⚡ Built with Bun runtime
- 📦 Single executable binary deployment

## Setup

### Prerequisites

- **Bun** >= 1.0.0 ([Install](https://bun.sh))
- **Node.js** >= 18.0.0 (for MCP servers)
- **Anthropic API Key** ([Get one](https://console.anthropic.com/settings/keys))

### Installation

```bash
# Clone and install
cd browseros-server/packages/agent
bun install

# Configure environment
cp .env.example .env
# Edit .env and add: ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
```

### Environment Variables

Create a `.env` file:

```bash
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx  # Required
PORT=3000                               # Optional
MAX_SESSIONS=5                          # Optional
SESSION_IDLE_TIMEOUT_MS=90000          # Optional (90s)
EVENT_GAP_TIMEOUT_MS=60000             # Optional (60s)
```

## Building

### Local Development

```bash
# Development with hot reload
bun run dev

# Production mode
bun run start
```

Server starts on `ws://localhost:3000`

### Build Binaries

```bash
# Build for current platform
bun run build
# Output: ./browseros-agent-server

# Build for all platforms
bun run build:all
# Output:
#   ./dist/browseros-agent-server-linux
#   ./dist/browseros-agent-server-macos
#   ./dist/browseros-agent-server-windows.exe
```

### Run Binary

```bash
# Binary automatically loads .env file
./browseros-agent-server
```

## Testing

### Unit Tests

```bash
# Run all unit tests
bun test

# Alternative command
bun run test:unit
```

Tests 4 core modules with 20 unit tests:

- `BaseAgent.test.ts` - Agent base class
- `EventFormatter.test.ts` - Event formatting
- `SessionManager.test.ts` - Session management
- `Logger.test.ts` - Logger singleton

### API Key Test

```bash
# Validate your Anthropic API key
bun run test:api
```

Expected output:

```
✅ API key is valid
✅ Model: claude-sonnet-4
```

### Browser Automation Test

```bash
# Test Chrome DevTools integration
bun run test:browser
```

Tests browser navigation, screenshots, and tool execution.

### Integration Tests

```bash
# Test single client connection
bun run test:client

# Test multiple concurrent clients
bun run test:multi
```

## Quick Verification

```bash
# 1. Test API key
bun run test:api

# 2. Run unit tests
bun test

# 3. Start server
bun run dev

# 4. Check health endpoint
curl http://localhost:3000/health
```

## Usage Example

```typescript
import {WebSocket} from 'ws';

const ws = new WebSocket('ws://localhost:3000');

ws.on('open', () => {
  ws.send(
    JSON.stringify({
      type: 'message',
      content: 'Navigate to example.com and take a screenshot',
    }),
  );
});

ws.on('message', data => {
  const event = JSON.parse(data.toString());
  console.log(event.type, event.content);
});
```

## Event Types

Events streamed to clients:

- `connection` - Connection confirmed
- `init` - Agent initialized
- `response` - Agent text response
- `tool_use` - Tool execution
- `tool_result` - Tool result
- `completion` - Task completed
- `error` - Error occurred

## Troubleshooting

**Port in use:**

```bash
lsof -ti:3000 | xargs kill -9
```

**API key invalid:**

- Verify key starts with `sk-ant-api03-`
- No quotes in `.env` file
- Check at https://console.anthropic.com/settings/keys

**MCP server fails:**

```bash
# Test Chrome DevTools MCP manually
npx -y chrome-devtools-mcp@latest --help
```

**Chrome not found:**

- macOS: `brew install --cask google-chrome`
- Ubuntu: `sudo apt-get install chromium-browser`

## License

MIT

---

**Built with [Bun](https://bun.sh)** ⚡

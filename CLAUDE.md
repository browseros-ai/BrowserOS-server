# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**BrowserOS MCP Server** - A Model Context Protocol (MCP) server that exposes Chrome DevTools capabilities to AI coding assistants. This is a **BrowserOS-specific fork** with a different architecture than the upstream chrome-devtools-mcp.

**Key Difference from Upstream:**

- **Upstream**: CLI tool that spawns Chrome via STDIO transport (for Claude Desktop, etc.)
- **This Fork**: HTTP server that connects to externally-managed Chrome via CDP for BrowserOS integration

## Architecture

### Entry Point & Execution Flow

```
src/index.ts (Bun entry point)
    ↓
src/main.ts (Server initialization)
    ├─ parseArguments() → --cdp-port, --mcp-port (args.ts)
    ├─ ensureBrowserConnected() → Puppeteer CDP connection (browser.ts)
    ├─ McpContext.from() → Shared context for all clients
    └─ createHTTPServer() → HTTP + SSE transport (http-server.ts)
        ├─ GET /mcp → New SSEServerTransport + McpServer instance
        ├─ POST /mcp?sessionId=X → Route to session's transport
        └─ Session Map → Isolated per-client McpServer instances
```

### Critical Design Decisions

1. **Connect-Only CDP** (src/browser.ts)
   - NEVER launches Chrome (removed all `puppeteer.launch()` code)
   - ALWAYS connects to existing CDP endpoint via `puppeteer.connect()`
   - BrowserOS C++ manages browser lifecycle

2. **HTTP + SSE Transport** (src/http-server.ts)
   - Uses MCP SDK's `SSEServerTransport` (not custom implementation)
   - One SSEServerTransport + McpServer per client session
   - Sessions stored in Map, cleaned up on disconnect

3. **Multi-Client Architecture**
   - Each client → dedicated McpServer instance
   - All clients → shared browser context (global `context` in main.ts)
   - Global `toolMutex` → serializes tool execution (prevents conflicts)

4. **Performance Tools Disabled**
   - Lines 27-28 in main.ts: `// import * as performanceTools from './tools/performance.js';`
   - Reason: chrome-devtools-frontend has broken imports (missing locales.js)
   - 23/26 tools available (3 performance tools commented out)

## Development Commands

### Running the Server

```bash
# Development (direct TypeScript execution via Bun)
bun src/index.ts --cdp-port=9347 --mcp-port=9223

# With debug logging
DEBUG=mcp:* bun src/index.ts --cdp-port=9347 --mcp-port=9223

# Using npm scripts
bun run start          # Same as above (with default ports in args)
bun run start-debug    # With DEBUG env var
```

### Testing

```bash
# Run all tests (Bun test runner)
bun test

# Note: performance.test.skip.ts and parse.test.skip.ts are disabled
# (same chrome-devtools-frontend issue)
```

### Type Checking & Formatting

```bash
# TypeScript type checking (no compilation)
bun run typecheck    # tsc --noEmit

# Format code
bun run format       # eslint + prettier
bun run check-format # Check without fixing
```

### Binary Compilation

```bash
# Linux (BrowserOS target)
bun run build:binary

# macOS (development)
bun run build:binary:macos

# Windows
bun run build:binary:windows

# Output: ./browseros-mcp executable
```

### Cleanup

```bash
bun run clean  # Remove build/ and binaries
```

## Code Structure

### Core Files

- **src/index.ts** - Entry point with Bun runtime check
- **src/main.ts** - Server initialization, tool registration, shutdown handlers
- **src/args.ts** - Simple 2-argument parser (--cdp-port, --mcp-port)
- **src/browser.ts** - Puppeteer CDP connection (connect-only, no launch)
- **src/http-server.ts** - HTTP server with SSE transport + session management
- **src/McpContext.ts** - Browser context wrapper (shared across clients)
- **src/McpResponse.ts** - Response handling utilities
- **src/Mutex.ts** - Tool execution mutex (global lock)

### Tools Directory (src/tools/)

Each file exports one or more `ToolDefinition` objects:

- **console.ts** - Console logs retrieval (1 tool)
- **emulation.ts** - Network/CPU throttling (2 tools)
- **input.ts** - Click, hover, fill, drag, upload (6 tools)
- **network.ts** - Network request inspection (2 tools)
- **pages.ts** - Page navigation, creation, selection (8 tools)
- **screenshot.ts** - Screenshot capture (1 tool)
- **script.ts** - JavaScript execution (1 tool)
- **snapshot.ts** - DOM snapshots (2 tools)
- **performance.ts** - DISABLED (3 tools - see "Known Issues")

### Tool Registration Pattern

Tools are registered in `main.ts` via:

```typescript
function createServerWithTools(): McpServer {
  const server = new McpServer({...});

  for (const tool of tools) {
    server.registerTool(tool.name, {...}, async (params) => {
      const guard = await toolMutex.acquire();  // Global lock
      try {
        const response = new McpResponse();
        await tool.handler({params}, response, context);  // Shared context
        return await response.handle(tool.name, context);
      } finally {
        guard.dispose();
      }
    });
  }

  return server;
}
```

## Error Handling & Exit Codes

| Exit Code | Meaning                               | Location               |
| --------- | ------------------------------------- | ---------------------- |
| 0         | Clean shutdown (SIGINT/SIGTERM)       | main.ts:163-175        |
| 1         | Invalid arguments (missing/bad ports) | args.ts                |
| 2         | CDP connection failed                 | main.ts:62-66          |
| 3         | HTTP port binding failed              | http-server.ts:110-117 |

**Fail-Fast Philosophy**: Server exits immediately on startup errors. BrowserOS C++ handles restarts.

## Known Issues

### chrome-devtools-frontend Dependency

**Problem**: Package has broken imports (`locales.js`, `codemirror.next.js` missing)

**Impact**:

- Performance tools disabled (main.ts:27-28, 76-77)
- 2 test files skipped (performance.test.skip.ts, parse.test.skip.ts)

**Workaround**: Tools commented out, not removed. Can re-enable if dependency fixed.

## BrowserOS C++ Integration

**Expected C++ Spawn Command:**

```cpp
// Development
spawn("bun", "src/index.ts", "--cdp-port=9347", "--mcp-port=9223");

// Production (compiled binary)
spawn("./browseros-mcp", "--cdp-port=9347", "--mcp-port=9223");
```

**Expected Server Output:**

```
Starting BrowserOS MCP Server v0.0.1
Connected to CDP at http://127.0.0.1:9347
MCP Server ready at http://127.0.0.1:9223/mcp
```

## Adding New Tools

1. Create tool definition in `src/tools/<category>.ts`
2. Export as `ToolDefinition` object with `defineTool()`
3. Import in `src/main.ts` (e.g., `import * as newTools from './tools/new.js'`)
4. Add to `tools` array (line ~70)
5. Tool automatically registered in `createServerWithTools()`

**Do NOT:**

- Modify `registerTool()` logic (shared across all tools)
- Remove `toolMutex` (prevents concurrent tool execution)
- Change `context` from shared to per-session (intentionally global)

## Scripts (Node-based, not Bun)

These use Node because they may depend on Node-specific APIs:

- `bun run prepare` - Pre-commit hooks setup (uses Node)
- `bun run docs:generate` - Temporarily disabled (needs updating for Bun architecture)
- `bun run sync-server-json-version` - Sync package.json version (uses Node)

Use `node --experimental-strip-types` for TypeScript scripts.

## Important Constraints

1. **Never add browser launch logic** - This fork only connects to existing CDP
2. **Never remove the global toolMutex** - Prevents race conditions in browser operations
3. **Never change shared context to per-session** - All clients share one browser instance
4. **Never re-enable performance tools without fixing chrome-devtools-frontend imports**
5. **Always use Bun for development/testing** - Final binary is Bun-compiled

## Testing Against Real Browser

```bash
# Terminal 1: Start Chrome with remote debugging
google-chrome --remote-debugging-port=9222

# Terminal 2: Start server
bun src/index.ts --cdp-port=9222 --mcp-port=9223

# Terminal 3: Test with MCP client or curl
curl http://localhost:9223/mcp  # Should establish SSE connection
```

## Bun Preferences

Default to using Bun instead of Node.js:

- Use `bun <file>` instead of `node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun install` instead of `npm install`
- Use `bun run <script>` instead of `npm run <script>`
- Bun automatically loads .env (no dotenv needed)

## Documentation

- **README.md** - User-facing documentation (not fully updated for BrowserOS fork)
- **IMPLEMENTATION.md** - Detailed transformation design doc (all 7 phases)
- **docs/tool-reference.md** - Tool documentation (upstream, needs updating)
- **This file (CLAUDE.md)** - Developer guidance for Claude Code

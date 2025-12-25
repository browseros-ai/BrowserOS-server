# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Coding guidelines

- Write minimal code comments. Only add comments for non-obvious logic, complex algorithms, or critical warnings. Skip comments for self-explanatory code, obvious function names, and simple operations.
- Logger messages should not include `[prefix]` tags (e.g., `[Config]`, `[HTTP Server]`). Source tracking automatically adds file:line:function in development mode.
- Avoid magic constants scattered in the codebase. Use `@browseros/shared` for all shared configuration:
  - `@browseros/shared/ports` - Port numbers (DEFAULT_PORTS, TEST_PORTS)
  - `@browseros/shared/timeouts` - Timeout values (TIMEOUTS)
  - `@browseros/shared/limits` - Rate limits, pagination, content limits (RATE_LIMITS, AGENT_LIMITS, etc.)
  - `@browseros/shared/urls` - External service URLs (EXTERNAL_URLS)
  - `@browseros/shared/paths` - File system paths (PATHS)

## Project Overview

**BrowserOS Server** - The automation engine inside BrowserOS. This MCP server powers the built-in AI agent and lets external tools like `claude-code` or `gemini-cli` control the browser. Starts automatically when BrowserOS launches.

## Bun Preferences

Default to using Bun instead of Node.js:

- Use `bun <file>` instead of `node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun install` instead of `npm install`
- Use `bun run <script>` instead of `npm run <script>`
- Bun automatically loads .env (no dotenv needed)

## Common Commands

```bash
# Start server (development)
bun run start                    # Loads .env.dev automatically

# Testing
bun run test                     # Run controller-based and common tests
bun run test:cdp                 # Run CDP-based tests (requires CDP connection)
bun run test:controller          # Run controller-based tests only
bun run test:integration         # Run integration tests
bun run test:all                 # Run all tests

# Run a single test file
bun --env-file=.env.dev test apps/server/tests/path/to/file.test.ts

# Linting
bun run lint                     # Check with Biome
bun run lint:fix                 # Auto-fix with Biome

# Type checking
bun run typecheck                # TypeScript build check

# Build
bun run dev:server               # Build server for development
bun run dev:ext                  # Build extension for development
bun run dist:server              # Build server for production (all targets)
bun run dist:ext                 # Build extension for production
```

## Architecture

This is a monorepo with three packages in `apps/`:

### Server (`apps/server`)
The main MCP server that exposes browser automation tools via HTTP/SSE.

**Entry point:** `apps/server/src/index.ts` → `apps/server/src/main.ts`

**Key components:**
- `src/tools/` - MCP tool definitions, split into:
  - `cdp-based/` - Tools using Chrome DevTools Protocol (network, console, emulation, input, etc.)
  - `controller-based/` - Tools using the browser extension (navigation, clicks, screenshots, tabs, history, bookmarks)
- `src/controller-server/` - WebSocket server that bridges to the browser extension
  - `ControllerBridge` handles WebSocket connections with extension clients
  - `ControllerContext` wraps the bridge for tool handlers
- `src/common/` - Shared utilities (McpContext, PageCollector, browser connection, identity, db)
- `src/agent/` - AI agent functionality (Gemini adapter, rate limiting, session management)
- `src/http/` - Hono HTTP server with MCP, health, and provider routes

**Tool types:**
- CDP tools require a direct CDP connection (`--cdp-port`)
- Controller tools work via the browser extension over WebSocket

### Shared (`apps/shared`)
Shared constants and configuration used by both server and extension. Avoids magic numbers.

**Exports:** `@browseros/shared/ports`, `@browseros/shared/timeouts`, `@browseros/shared/limits`, `@browseros/shared/urls`, `@browseros/shared/paths`

### Controller Extension (`apps/controller-ext`)
Chrome extension that receives commands from the server via WebSocket.

**Entry point:** `src/background/index.ts` → `BrowserOSController`

**Structure:**
- `src/actions/` - Action handlers organized by domain (browser/, tab/, bookmark/, history/)
- `src/adapters/` - Chrome API adapters (TabAdapter, BookmarkAdapter, HistoryAdapter)
- `src/websocket/` - WebSocket client that connects to the server

### Communication Flow

```
AI Agent/MCP Client → HTTP Server (Hono) → Tool Handler
                                              ↓
                        CDP (direct) ←── or ──→ WebSocket → Extension → Chrome APIs
```

## Test Organization

Tests are in `apps/server/tests/`:
- `tools/cdp-based/` - Tests requiring CDP connection (browser must be running)
- `tools/controller-based/` - Tests using mocked controller context
- `common/` - Unit tests for common utilities
- `__helpers__/` - Test utilities and fixtures

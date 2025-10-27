# BrowserOS MCP Server

A unified server that provides browser automation tools via Model Context Protocol (MCP) and direct Agent access. Built as a monorepo with shared tools and single binary output.

## Architecture

```
browseros-server/
├── packages/
│   ├── common/     # Shared utilities (context, mutex, browser connection)
│   ├── tools/      # Browser automation tools (CDP + controller-based)
│   ├── mcp/        # MCP HTTP server implementation
│   ├── agent/      # Agent WebSocket server with Claude SDK
│   └── server/     # Unified entry point with shared WebSocketManager
```

### Unified Server Architecture

```
┌─────────────────────────────────────────┐
│         Unified Server Process          │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │   WebSocketManager (Port 9224)    │ │  ← Shared by all
│  │   Browser Extension Connection    │ │
│  └───────────────┬───────────────────┘ │
│                  │                      │
│        ┌─────────┴─────────┐           │
│        │                   │           │
│  ┌─────▼──────┐    ┌──────▼──────┐    │
│  │ HTTP MCP   │    │   Agent     │    │
│  │ (Port 9223)│    │ (Port 3000) │    │
│  │            │    │             │    │
│  │ External   │    │ Claude SDK  │    │
│  │ MCP        │    │ In-process  │    │
│  │ Clients    │    │ SDK MCP     │    │
│  └────────────┘    └─────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) v1.0.0 or newer
- [Chrome](https://www.google.com/chrome/) stable version
- macOS, Linux, or Windows

### Installation

```bash
# Clone the repository
git clone https://github.com/browseros-ai/BrowserOS-server.git
cd BrowserOS-server

# Install dependencies
bun install

# Run tests
bun test:all

# Start the server
bun start
```

## Development

### Common Commands

| Command                | Description                     |
| ---------------------- | ------------------------------- |
| `bun start`            | Start the server (port 9223)    |
| `bun test:all`         | Run all tests across packages   |
| `bun test:common`      | Test common package             |
| `bun test:tools`       | Test tools package              |
| `bun test:mcp`         | Test MCP package                |
| `bun test:server`      | Test server package             |
| `bun run build:binary` | Compile to single binary        |
| `bun run format`       | Format code (ESLint + Prettier) |
| `bun run check-format` | Check code formatting           |
| `bun run clean`        | Clean build artifacts           |

### Running with Chrome

The server needs Chrome to run. Set the executable path if Chrome is not in the default location:

```bash
PUPPETEER_EXECUTABLE_PATH="/path/to/chrome" bun start
```

### Building

#### Server Binary

Development builds (single platform):

```bash
bun run dev:server           # Current platform
bun run dev:server:linux     # Linux x64
bun run dev:server:macos     # macOS ARM64
bun run dev:server:windows   # Windows x64

# Output: dist/server/browseros-server
```

Production builds (all platforms):

```bash
bun run dist:server

# Output: dist/server/
#   - browseros-server-linux-x64
#   - browseros-server-linux-arm64
#   - browseros-server-darwin-x64
#   - browseros-server-darwin-arm64
#   - browseros-server-windows-x64.exe
```

#### Extension

Development build (with source maps):

```bash
bun run dev:ext

# Output: dist/ext/
#   - background.js (unminified)
#   - background.js.map
#   - manifest.json
```

Production build (minified):

```bash
bun run dist:ext

# Output: dist/ext/
#   - background.js (minified)
#   - manifest.json
```

## Package Structure

### `@browseros/common`

Shared utilities used by all packages:

- `McpContext` - Browser context management
- `Mutex` - Tool execution synchronization
- Browser connection management
- Logging utilities

### `@browseros/tools`

Browser automation tools (26 total):

- Pure functions, no server logic
- Zod schemas for validation
- Response formatters
- Direct CDP integration

### `@browseros/mcp`

MCP protocol implementation:

- HTTP server with SSE transport
- Tool registration with MCP SDK
- Handles JSON-RPC protocol

### `@browseros/agent`

Agent WebSocket server with Claude SDK integration:

- Multi-session WebSocket server for concurrent agents
- Direct tool execution via shared WebSocketManager (no HTTP overhead)
- Claude SDK integration with in-process MCP
- Automatic session management and cleanup

### `@browseros/server`

Unified server orchestrating all components:

- Starts HTTP MCP server and Agent WebSocket server
- Single WebSocketManager shared by both MCP and Agent
- CLI argument parsing with enable/disable flags
- Graceful shutdown and resource cleanup

## Testing

Tests use Puppeteer with a real Chrome browser. All tests are in `packages/*/tests/`:

```bash
# Run all tests
bun test:all

# Run with coverage
bun test --coverage

# Run specific package tests
bun test packages/tools

# Run specific test file
bun test packages/tools/tests/tools/pages.test.ts
```

### Test Coverage

Current coverage across 16 test files with 26 tests passing.

## Tools Reference

The server provides 26 browser automation tools:

<!-- BEGIN AUTO GENERATED TOOLS -->

- **Input automation** (7 tools)
  - [`click`](docs/tool-reference.md#click)
  - [`drag`](docs/tool-reference.md#drag)
  - [`fill`](docs/tool-reference.md#fill)
  - [`fill_form`](docs/tool-reference.md#fill_form)
  - [`handle_dialog`](docs/tool-reference.md#handle_dialog)
  - [`hover`](docs/tool-reference.md#hover)
  - [`upload_file`](docs/tool-reference.md#upload_file)
- **Navigation automation** (7 tools)
  - [`close_page`](docs/tool-reference.md#close_page)
  - [`list_pages`](docs/tool-reference.md#list_pages)
  - [`navigate_page`](docs/tool-reference.md#navigate_page)
  - [`navigate_page_history`](docs/tool-reference.md#navigate_page_history)
  - [`new_page`](docs/tool-reference.md#new_page)
  - [`select_page`](docs/tool-reference.md#select_page)
  - [`wait_for`](docs/tool-reference.md#wait_for)
- **Emulation** (3 tools)
  - [`emulate_cpu`](docs/tool-reference.md#emulate_cpu)
  - [`emulate_network`](docs/tool-reference.md#emulate_network)
  - [`resize_page`](docs/tool-reference.md#resize_page)
- **Performance** (3 tools)
  - [`performance_analyze_insight`](docs/tool-reference.md#performance_analyze_insight)
  - [`performance_start_trace`](docs/tool-reference.md#performance_start_trace)
  - [`performance_stop_trace`](docs/tool-reference.md#performance_stop_trace)
- **Network** (2 tools)
  - [`get_network_request`](docs/tool-reference.md#get_network_request)
  - [`list_network_requests`](docs/tool-reference.md#list_network_requests)
- **Debugging** (4 tools)
  - [`evaluate_script`](docs/tool-reference.md#evaluate_script)
  - [`list_console_messages`](docs/tool-reference.md#list_console_messages)
  - [`take_screenshot`](docs/tool-reference.md#take_screenshot)
  - [`take_snapshot`](docs/tool-reference.md#take_snapshot)

<!-- END AUTO GENERATED TOOLS -->

## Server Configuration

### Command Line Arguments

```bash
# Default startup (MCP + Agent on default ports)
bun start

# Connect to existing Chrome instance (optional)
bun start --cdp-port=9222

# Specify server ports
bun start --http-mcp-port=9223 --agent-port=3000 --extension-port=9224

# Disable MCP HTTP server (Agent-only mode)
bun start --disable-mcp-server

# Disable Agent server (MCP-only mode)
bun start --disable-agent-server

# Full example
bun start --cdp-port=9222 --http-mcp-port=9223 --agent-port=3000 --extension-port=9224
```

### Agent Testing

```
node packages/agent/scripts/tests/test-client.ts
```

### Environment Variables

**Required for Agent:**

- `ANTHROPIC_API_KEY` - Anthropic API key for Claude SDK (required for agent functionality)

**Agent Configuration:**

- `MAX_SESSIONS` - Maximum concurrent agent sessions (default: 5)
- `SESSION_IDLE_TIMEOUT_MS` - Session idle timeout in milliseconds (default: 90000)
- `EVENT_GAP_TIMEOUT_MS` - Max time between agent events in milliseconds (default: 60000)

**Optional:**

- `PUPPETEER_EXECUTABLE_PATH` - Path to Chrome executable
- `DEBUG=mcp:*` - Enable debug logging
- `LOG_LEVEL` - Logging level (debug, info, warn, error)
- `NODE_ENV` - Environment (development, production)

## Architecture Benefits

- **Unified Process**: MCP and Agent run in single server process
- **Shared WebSocket**: Single WebSocketManager for extension connection
- **Zero Overhead**: Agent uses in-process SDK MCP (direct function calls)
- **Single Binary**: Everything compiles to one executable
- **Shared Tools**: Both MCP and Agent use same tool implementations
- **No Duplication**: One source of truth for browser automation
- **Type Safety**: Full TypeScript with Zod validation
- **Modular**: Each package has single responsibility

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

## License

AGPL-3.0 or later

## Troubleshooting

See [docs/troubleshooting.md](./docs/troubleshooting.md) for common issues.

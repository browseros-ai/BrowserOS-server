# BrowserOS Unified Server - Monorepo Structure Design

## Overview

This document outlines the monorepo structure for the unified BrowserOS server that combines MCP and Agent functionality into a single binary with multiple endpoints.

## Folder Structure

```
browseros-server/                         # Root monorepo
├── package.json                        # Root package with workspaces
├── bun.lockb
├── tsconfig.json                       # Base TypeScript config
├── tsconfig.build.json                 # Build-specific config
├── .eslintrc.json
├── .prettierrc
├── README.md
├── IMPLEMENTATION.md
├── CLAUDE.md
│
├── packages/                           # Monorepo packages
│   ├── common/                        # Shared common functionality
│   │   ├── package.json               # { "name": "@browseros/common" }
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts               # Re-exports all common modules
│   │   │   ├── browser.ts             # CDP connection management
│   │   │   ├── McpContext.ts          # Browser context wrapper
│   │   │   ├── Mutex.ts               # Tool execution mutex
│   │   │   ├── logger.ts              # Shared logging utilities
│   │   │   ├── polyfill.ts            # Shared polyfills
│   │   │   └── utils/
│   │   │       ├── util.ts            # Version reading, etc.
│   │   │       └── types.ts           # Shared TypeScript types
│   │   └── tests/
│   │       ├── browser.test.ts
│   │       ├── McpContext.test.ts
│   │       └── Mutex.test.ts
│   │
│   ├── tools/                         # Browser tools package
│   │   ├── package.json               # { "name": "@browseros/tools" }
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts               # Export all tools
│   │   │   ├── ToolDefinition.ts      # Tool interface/types
│   │   │   ├── McpResponse.ts         # Response handling
│   │   │   ├── PageCollector.ts       # Page collection utilities
│   │   │   ├── formatters/            # Output formatters
│   │   │   │   ├── index.ts
│   │   │   │   ├── consoleFormatter.ts
│   │   │   │   ├── networkFormatter.ts
│   │   │   │   └── snapshotFormatter.ts
│   │   │   ├── trace-processing/      # Trace analysis
│   │   │   │   └── parse.ts
│   │   │   └── tools/                 # Tool implementations
│   │   │       ├── index.ts           # Aggregates all tools
│   │   │       ├── console.ts
│   │   │       ├── emulation.ts
│   │   │       ├── input.ts
│   │   │       ├── network.ts
│   │   │       ├── pages.ts
│   │   │       ├── performance.ts
│   │   │       ├── screenshot.ts
│   │   │       ├── script.ts
│   │   │       └── snapshot.ts
│   │   └── tests/
│   │       ├── tools/
│   │       │   └── *.test.ts
│   │       └── formatters/
│   │           └── *.test.ts
│   │
│   ├── mcp/                           # MCP server implementation
│   │   ├── package.json               # { "name": "@browseros/mcp" }
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts               # MCP server exports
│   │   │   ├── server.ts              # HTTP + SSE transport
│   │   │   └── registry.ts            # Tool registration for MCP
│   │   └── tests/
│   │       └── server.test.ts
│   │
│   ├── agent/                         # Agent server implementation
│   │   ├── package.json               # { "name": "@browseros/agent" }
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts               # Agent server exports
│   │   │   ├── server.ts              # WebSocket server setup
│   │   │   ├── AgentLoop.ts           # Claude SDK agent loop
│   │   │   ├── AgentContext.ts        # Agent session management
│   │   │   ├── AgentToolset.ts        # Direct tool registration
│   │   │   ├── types.ts               # Agent-specific types
│   │   │   └── handlers/              # WebSocket message handlers
│   │   │       ├── chat.ts            # Chat message handling
│   │   │       ├── control.ts         # Control commands
│   │   │       └── session.ts         # Session management
│   │   └── tests/
│   │       └── AgentLoop.test.ts
│   │
│   └── server/                        # Main unified server application
│       ├── package.json               # { "name": "@browseros/server" }
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts               # Bun entry point (runtime check)
│       │   ├── main.ts                # Server initialization & orchestration
│       │   ├── args.ts                # CLI argument parsing
│       │   ├── config.ts              # Unified configuration
│       │   └── shutdown.ts            # Graceful shutdown handling
│       └── tests/
│           └── integration.test.ts
│
├── scripts/                           # Build & development scripts
│   ├── build-binary.ts                # Binary compilation script
│   ├── dev.ts                         # Development server runner
│   ├── prepare.ts                     # Pre-commit hooks
│   └── sync-versions.ts              # Version synchronization
│
├── docs/                              # Documentation
│   ├── design/                        # Design documents
│   │   ├── monorepo-structure.md     # This document
│   │   └── architecture.md           # System architecture
│   ├── api/                          # API documentation
│   │   ├── mcp-api.md
│   │   └── agent-api.md
│   └── tool-reference.md             # Tool documentation
│
└── dist/                              # Compiled binaries (git-ignored)
    ├── browseros-server-linux-x64
    ├── browseros-server-linux-arm64
    ├── browseros-server-darwin-x64
    ├── browseros-server-darwin-arm64
    └── browseros-server-windows-x64.exe
```

## Binary Build Strategy

### Single Binary from Monorepo

The monorepo structure compiles down to a **single binary** that contains all functionality. Here's how:

#### 1. Entry Point Chain

```
packages/server/src/index.ts (Bun entry)
    └── packages/server/src/main.ts (orchestrator)
        ├── @browseros/mcp
        ├── @browseros/agent
        └── @browseros/common
```

#### 2. Build Process

**Root `package.json` scripts:**

```json
{
  "scripts": {
    "build:binary": "bun run scripts/build-binary.ts",
    "dist": "bun run clean && bun run build:binary:all",
    "build:binary:all": "bun run build:binary:linux && bun run build:binary:macos && bun run build:binary:windows",
    "build:binary:linux": "bun build --compile packages/server/src/index.ts --outfile dist/browseros-server-linux-x64 --minify --sourcemap --target=bun-linux-x64-modern",
    "build:binary:macos": "bun build --compile packages/server/src/index.ts --outfile dist/browseros-server-darwin-arm64 --minify --sourcemap --target=bun-darwin-arm64",
    "build:binary:windows": "bun build --compile packages/server/src/index.ts --outfile dist/browseros-server-windows-x64.exe --minify --sourcemap --target=bun-windows-x64-modern"
  }
}
```

**Key Points:**

- Single entry point: `packages/server/src/index.ts`
- Bun's `--compile` flag bundles all dependencies from all workspace packages
- Output: One binary per platform in `dist/`
- The binary name changes from `browseros-mcp` to `browseros-server` (reflecting unified functionality)

#### 3. Runtime Behavior

The single binary serves multiple endpoints:

```
browseros-server --cdp-port=9222 --http-port=9223 --agent-port=9445

Endpoints:
  http://127.0.0.1:9223/health  (health check)
  http://127.0.0.1:9223/mcp      (MCP via SSE/HTTP)
  ws://127.0.0.1:9445/agent     (Agent via WebSocket)
```

#### 4. Workspace Dependencies Resolution

During compilation, Bun automatically:

1. Resolves all `@browseros/*` workspace dependencies
2. Bundles them into the final binary
3. Tree-shakes unused code
4. Applies minification

Example dependency chain for compilation:

```
@browseros/server
├── @browseros/mcp
│   ├── @browseros/tools
│   │   └── @browseros/common
│   └── @browseros/common
├── @browseros/agent
│   ├── @browseros/tools
│   │   └── @browseros/common
│   └── @browseros/common
└── @browseros/common
```

All get bundled into one binary!

## Package Structure Details

### Common Package (`@browseros/common`)

Shared utilities used by all other packages:

- Browser/CDP connection management
- Shared context and mutex
- Logging infrastructure
- Common types and utilities

### Tools Package (`@browseros/tools`)

All browser automation tools:

- Tool definitions and schemas
- Tool handlers
- Response formatters
- No server logic (pure functions)

### MCP Server Package (`@browseros/mcp`)

MCP protocol implementation:

- HTTP server with SSE transport
- MCP tool registration
- Protocol handling

### Agent Server Package (`@browseros/agent`)

Agent loop implementation:

- WebSocket server
- Claude SDK integration
- Direct tool execution (no MCP overhead)
- Session management

### Server Package (`@browseros/server`)

Main application orchestrator:

- CLI entry point
- Starts both MCP and Agent servers
- Manages shared resources
- Handles shutdown

## Migration Path

### Phase 1: Create Workspace Structure

1. Create `packages/` directory structure
2. Set up root `package.json` with workspaces
3. Configure TypeScript project references

### Phase 2: Extract Common Package

1. Move shared utilities to `@browseros/common`
2. Update imports in existing code
3. Test common package independently

### Phase 3: Extract Tools Package

1. Move all tools to `@browseros/tools`
2. Move formatters and response handling
3. Update tool imports

### Phase 4: Create MCP Server Package

1. Move `server/mcp.ts` to new package
2. Refactor to use extracted packages
3. Test MCP functionality

### Phase 5: Add Agent Server Package

1. Implement WebSocket server
2. Add Claude SDK integration
3. Wire up direct tool execution

### Phase 6: Unify in Server Package

1. Create unified entry point
2. Start both servers from main.ts
3. Test unified binary

### Phase 7: Update Build Scripts

1. Update binary compilation scripts
2. Test multi-platform builds
3. Update CI/CD pipelines

## Benefits

1. **Modularity**: Each package has a single, clear responsibility
2. **Testability**: Packages can be tested in isolation
3. **Type Safety**: TypeScript project references ensure type consistency
4. **Code Sharing**: Both servers use the same tools without duplication
5. **Single Binary**: Despite monorepo structure, still ships as one binary
6. **Incremental Development**: Can develop and test packages independently
7. **Future Flexibility**: Could split into multiple binaries if needed later

## Considerations

1. **Workspace Management**: Use Bun workspaces for optimal performance
2. **Version Synchronization**: Keep all packages at same version for simplicity
3. **Build Optimization**: Bun's compiler handles tree-shaking and bundling
4. **Development Experience**: Hot reload works across workspace packages
5. **Testing Strategy**: Both unit tests per package and integration tests in server package

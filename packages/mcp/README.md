# @browseros/mcp

Model Context Protocol (MCP) server implementation for BrowserOS.

## Overview

This package provides a thin, clean layer that:

1. Imports tools from `@browseros/tools`
2. Sets up HTTP/SSE transport for MCP protocol
3. Handles tool registration with MCP SDK
4. Manages request/response flow

## Architecture

```
packages/mcp/
├── src/
│   ├── index.ts     # Package exports
│   └── server.ts    # MCP server implementation
```

## Design Principles (KISS)

### 1. **Single Responsibility**

This package ONLY handles MCP protocol concerns:

- Tool registration with MCP SDK
- HTTP transport setup
- Request/response handling

### 2. **Clean Dependencies**

```
@browseros/mcp
    ├── @browseros/tools    # Tool definitions
    ├── @browseros/common   # Context and mutex
    └── @modelcontextprotocol/sdk  # MCP SDK
```

### 3. **No Business Logic**

- Tools live in `@browseros/tools`
- Context management in `@browseros/common`
- This package is just protocol glue

## Usage

```typescript
import {createHttpMcpServer} from '@browseros/mcp';
import {allCdpTools} from '@browseros/tools';
import {McpContext, Mutex} from '@browseros/common';

const server = createHttpMcpServer({
  port: 9223,
  version: '0.0.1',
  tools: allCdpTools,
  context,
  toolMutex: new Mutex(),
  logger: console.log,
  mcpServerEnabled: true,
});
```

## Key Functions

### `createHttpMcpServer(config)`

Creates HTTP server with MCP endpoint at `/mcp` and health check at `/health`.

### `shutdownMcpServer(server, logger)`

Gracefully shuts down the server.

## Protocol Details

- **Transport**: HTTP with StreamableHTTPServerTransport
- **Format**: JSON-RPC 2.0
- **Endpoints**:
  - `/health` - Health check (always available)
  - `/mcp` - MCP protocol endpoint

## Error Handling

- Port already in use: Exit code 3
- Internal server errors: JSON-RPC error response
- Tool execution errors: Wrapped in MCP error format

## Why This Design?

1. **Separation of Concerns**: MCP protocol handling is separate from tools
2. **Reusability**: Tools can be used without MCP (e.g., by Agent server)
3. **Simplicity**: Minimal code, just protocol translation
4. **Testability**: Can test protocol handling separately from tool logic

# @browseros/tools

Browser automation tools package for BrowserOS unified server.

## Architecture

This package provides a clean, modular architecture for browser automation tools:

```
packages/tools/
├── src/
│   ├── index.ts              # Main exports
│   ├── types/                # Type definitions
│   │   ├── Context.ts        # Browser context interface
│   │   ├── Response.ts       # Response builder interface
│   │   ├── ToolCategories.ts # Tool categorization
│   │   └── ToolDefinition.ts # Core tool structure
│   ├── definitions/          # Tool implementations
│   │   ├── console.ts        # Console tools
│   │   ├── emulation.ts      # Network/CPU emulation
│   │   ├── input.ts          # User input simulation
│   │   ├── network.ts        # Network request tools
│   │   ├── pages.ts          # Page management
│   │   ├── screenshot.ts     # Screenshot capture
│   │   ├── script.ts         # JavaScript execution
│   │   └── snapshot.ts       # DOM snapshots
│   ├── response/             # Response handling
│   │   └── McpResponse.ts    # MCP response builder
│   ├── formatters/           # Output formatters
│   │   ├── consoleFormatter.ts
│   │   ├── networkFormatter.ts
│   │   └── snapshotFormatter.ts
│   └── utils/                # Utility functions
│       └── pagination.ts     # Result pagination
```

## Design Principles

### 1. **Clean Separation of Concerns**

- **Types**: Pure interfaces and type definitions
- **Definitions**: Tool implementations using those types
- **Response**: Response building and formatting logic
- **Formatters**: Output formatting utilities
- **Utils**: Shared utility functions

### 2. **Dependency Inversion**

- Tools depend on abstract interfaces (`Context`, `Response`), not concrete implementations
- The actual `McpContext` implementation lives in `@browseros/common`
- Tools are unaware of transport layer (MCP, Agent, etc.)

### 3. **Simple, Elegant Exports**

```typescript
// Import all tools
import {allCdpTools} from '@browseros/tools';

// Import specific category
import {pages} from '@browseros/tools';

// Import types
import {ToolDefinition, Context, Response} from '@browseros/tools';

// Import response handler
import {McpResponse} from '@browseros/tools';
```

### 4. **Modular Tool Registration**

Each tool is self-contained with:

- Name and description
- Category and metadata
- Zod schema for validation
- Handler implementation

### 5. **Type Safety Throughout**

- Zod schemas validate input parameters
- TypeScript interfaces ensure type safety
- Generic types maintain type consistency

## Usage

### For MCP Server

```typescript
import {allCdpTools, McpResponse} from '@browseros/tools';
import {McpContext} from '@browseros/common';

// Register tools with MCP server
for (const tool of allCdpTools) {
  server.registerTool(tool.name, tool.schema, async params => {
    const response = new McpResponse();
    await tool.handler({params}, response, context);
    return response.handle(tool.name, context);
  });
}
```

### For Agent Server (Direct Usage)

```typescript
import { allCdpTools } from '@browseros/tools';
import { McpContext } from '@browseros/common';

// Direct tool execution without MCP protocol
async executeTool(toolName: string, params: any) {
  const tool = allCdpTools.find(t => t.name === toolName);
  const response = new McpResponse();
  await tool.handler({ params }, response, this.context);
  return response.handle(tool.name, this.context);
}
```

## Tool Categories

- **Input Automation**: Click, type, drag, upload files
- **Navigation Automation**: Navigate, manage pages, handle dialogs
- **Emulation**: Network conditions, CPU throttling, viewport
- **Network**: Inspect requests, responses, headers
- **Debugging**: Console logs, DOM snapshots
- **Performance**: Traces, metrics (currently disabled)

## Adding New Tools

1. Create tool definition in `src/definitions/<category>.ts`
2. Use `defineTool()` helper for type safety
3. Export from category file
4. Tool automatically included in `allCdpTools`

Example:

```typescript
export const myTool = defineTool({
  name: 'my_tool',
  description: 'Does something useful',
  annotations: {
    category: ToolCategories.DEBUGGING,
    readOnlyHint: true,
  },
  schema: {
    param: z.string().describe('A parameter'),
  },
  handler: async (request, response, context) => {
    // Implementation
    response.appendResponseLine('Result');
  },
});
```

## Key Benefits

1. **Framework Agnostic**: Tools can be used by any server implementation
2. **Protocol Independent**: Not tied to MCP, can be used directly
3. **Testable**: Each tool can be tested in isolation
4. **Maintainable**: Clear structure makes it easy to find and modify tools
5. **Extensible**: Easy to add new tools or tool categories
6. **Type Safe**: Full TypeScript support with runtime validation

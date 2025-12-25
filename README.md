# BrowserOS Server

The automation engine inside [BrowserOS](https://github.com/browseros-ai/BrowserOS). This MCP server powers the built-in AI agent and lets external tools like `claude-code` or `gemini-cli` control your browser.

## How It Works

When BrowserOS launches, this server starts automatically in the background. The built-in agent UI connects to it, giving you a sidepanel where you can chat with AI and automate browser tasks.

```
BrowserOS launches
       ↓
MCP Server starts (this repo)
       ↓
Agent extension connects
       ↓
You can chat and automate tasks
```

You can also connect external MCP clients to control BrowserOS from your terminal or other AI tools.

## Architecture

The server exposes browser automation tools through two channels:

- **Controller tools** - High-level commands via a Chrome extension (navigation, clicks, screenshots, tabs, history, bookmarks)
- **CDP tools** - Low-level access via Chrome DevTools Protocol (network inspection, console logs, emulation)

```
apps/
├── server/          # MCP server (HTTP + WebSocket)
└── controller-ext/  # Chrome extension for browser control
```

## For Developers

```bash
# Install dependencies
bun install

# Start the server (for local development)
bun run start

# Run tests
bun run test              # Unit tests
bun run test:cdp          # CDP tests (needs browser running)
bun run test:all          # Everything

# Lint and type check
bun run lint
bun run typecheck

# Build for production
bun run dist:server       # All platforms
bun run dist:ext          # Extension
```

## Using with External MCP Clients

Once BrowserOS is running, you can connect any MCP client to `http://127.0.0.1:<port>/mcp`. See [our docs](https://docs.browseros.com/browseros-mcp/how-to-guide) for setup with `claude-code` and `gemini-cli`.

## Related Repos

- [BrowserOS](https://github.com/browseros-ai/BrowserOS) - The Chromium fork (main product)
- BrowserOS Agent - The built-in sidepanel extension for chatting with AI

## License

AGPL-3.0-or-later

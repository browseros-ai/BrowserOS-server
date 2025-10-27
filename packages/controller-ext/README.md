# BrowserOS Controller

WebSocket-based Chrome Extension that exposes browser automation APIs for remote control.

**⚠️ IMPORTANT:** This extension ONLY works in **BrowserOS Chrome**, not regular Chrome!

---

## 🚀 Quick Start

### 1. Build the Extension

```bash
npm install
npm run build
```

### 2. Load Extension in BrowserOS Chrome

1. Open BrowserOS Chrome
2. Go to `chrome://extensions/`
3. Enable **"Developer mode"** (top-right toggle)
4. Click **"Load unpacked"**
5. Select the `dist/` folder
6. Verify extension is loaded (you should see "BrowserOS Controller")

### 3. Test the Extension

```bash
npm test
```

This starts an interactive test client. You should see:

```
🚀 Starting BrowserOS Controller Test Client
──────────────────────────────────────────────────────────

WebSocket Server Started
Listening on: ws://localhost:9224/controller
Waiting for extension to connect...

✅ Extension connected!

Running Diagnostic Test
============================================================

📤 Sending: checkBrowserOS
   Request ID: test-1729012345678

📨 Response: test-1729012345678
   Status: ✅ SUCCESS
   Data: {
     "available": true,
     "apis": [
       "captureScreenshot",
       "clear",
       "click",
       ...
     ]
   }
```

**If you see "available": true**, you're all set! 🎉

**If you see "available": false**, you're not using BrowserOS Chrome.

---

## ⚙️ Configuration

The extension can be configured using environment variables. This is optional - sensible defaults are provided.

### Environment Variables

Create a `.env` file in the project root to customize configuration:

```bash
# Copy the example file
cp .env.example .env

# Edit .env with your values
```

### Available Configuration Options

#### WebSocket Configuration

```bash
WEBSOCKET_PROTOCOL=ws          # ws or wss (default: ws)
WEBSOCKET_HOST=localhost        # Server host (default: localhost)
WEBSOCKET_PORT=9224            # Server port (default: 9224)
WEBSOCKET_PATH=/controller     # Server path (default: /controller)
```

#### Connection Settings

```bash
WEBSOCKET_RECONNECT_DELAY=1000              # Initial reconnect delay in ms (default: 1000)
WEBSOCKET_MAX_RECONNECT_DELAY=30000         # Max reconnect delay in ms (default: 30000)
WEBSOCKET_RECONNECT_MULTIPLIER=1.5          # Exponential backoff multiplier (default: 1.5)
WEBSOCKET_MAX_RECONNECT_ATTEMPTS=0          # Max reconnect attempts, 0 = infinite (default: 0)
WEBSOCKET_HEARTBEAT_INTERVAL=30000          # Heartbeat interval in ms (default: 30000)
WEBSOCKET_HEARTBEAT_TIMEOUT=5000            # Heartbeat timeout in ms (default: 5000)
WEBSOCKET_CONNECTION_TIMEOUT=10000          # Connection timeout in ms (default: 10000)
WEBSOCKET_REQUEST_TIMEOUT=30000             # Request timeout in ms (default: 30000)
```

#### Concurrency Settings

```bash
CONCURRENCY_MAX_CONCURRENT=100     # Max concurrent requests (default: 100)
CONCURRENCY_MAX_QUEUE_SIZE=1000    # Max queued requests (default: 1000)
```

#### Logging Settings

```bash
LOGGING_ENABLED=true                       # Enable/disable logging (default: true)
LOGGING_LEVEL=info                         # Log level: debug, info, warn, error (default: info)
LOGGING_PREFIX=[BrowserOS Controller]      # Log message prefix (default: [BrowserOS Controller])
```

### Example: Custom Port Configuration

If you want to use a different port (e.g., 8080):

```bash
# .env
WEBSOCKET_PORT=8080
```

Then rebuild the extension:

```bash
npm run build
```

The extension will now connect to `ws://localhost:8080/controller` instead of the default port 9224.

---

## 📖 Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for complete system documentation including:

- High-level architecture diagram
- Request flow (step-by-step)
- Component details
- All 14 registered actions
- WebSocket protocol specification
- Debugging guide

---

## 🧪 Testing

The test client (`npm test`) provides an interactive menu:

```
Available Commands:

  Tab Actions:
  1. getActiveTab       - Get currently active tab
  2. getTabs            - Get all tabs

  Browser Actions:
  3. getInteractiveSnapshot  - Get page elements (requires tabId)
  4. click              - Click element (requires tabId, nodeId)
  5. inputText          - Type text (requires tabId, nodeId, text)
  6. captureScreenshot  - Take screenshot (requires tabId)

  Diagnostic:
  d. checkBrowserOS     - Check if chrome.browserOS is available

  Other:
  h. Show this menu
  q. Quit
```

### Example Usage:

1. Type `1` → Get active tab
2. Type `d` → Run diagnostic
3. Type `q` → Quit

---

## 🔧 Development

### Build Commands

```bash
npm run build      # Production build
npm run build:dev  # Development build (with source maps)
npm run watch      # Watch mode for development
```

### Debug Extension

1. Go to `chrome://extensions/`
2. Click **"Inspect views service worker"** under "BrowserOS Controller"
3. Service worker console shows all logs

**Check extension status:**

```javascript
__browserosController.getStats();
```

**Expected output:**

```javascript
{
  connection: "connected",
  requests: { inFlight: 0, avgDuration: 0, errorRate: 0, totalRequests: 0 },
  concurrency: { inFlight: 0, queued: 0, utilization: 0 },
  validator: { activeIds: 0 },
  responseQueue: { size: 0 }
}
```

**Check registered actions:**
Look for this log on extension load:

```
Registered 14 action(s): checkBrowserOS, getActiveTab, getTabs, ...
```

---

## 📋 Available Actions

| Action                   | Input                             | Output                          | Description                            |
| ------------------------ | --------------------------------- | ------------------------------- | -------------------------------------- |
| `checkBrowserOS`         | `{}`                              | `{available, apis}`             | Check if chrome.browserOS is available |
| `getActiveTab`           | `{}`                              | `{tabId, url, title, windowId}` | Get currently active tab               |
| `getTabs`                | `{}`                              | `{tabs[]}`                      | Get all open tabs                      |
| `getInteractiveSnapshot` | `{tabId, options?}`               | `InteractiveSnapshot`           | Get all interactive elements on page   |
| `click`                  | `{tabId, nodeId}`                 | `{success}`                     | Click element by nodeId                |
| `inputText`              | `{tabId, nodeId, text}`           | `{success}`                     | Type text into element                 |
| `clear`                  | `{tabId, nodeId}`                 | `{success}`                     | Clear text from element                |
| `scrollToNode`           | `{tabId, nodeId}`                 | `{scrolled}`                    | Scroll element into view               |
| `captureScreenshot`      | `{tabId, size?, showHighlights?}` | `{dataUrl}`                     | Take screenshot                        |
| `sendKeys`               | `{tabId, keys}`                   | `{success}`                     | Send keyboard keys                     |
| `getPageLoadStatus`      | `{tabId}`                         | `PageLoadStatus`                | Get page load status                   |
| `getSnapshot`            | `{tabId, type, options?}`         | `Snapshot`                      | Get text/links snapshot                |
| `clickCoordinates`       | `{tabId, x, y}`                   | `{success}`                     | Click at coordinates                   |
| `typeAtCoordinates`      | `{tabId, x, y, text}`             | `{success}`                     | Type at coordinates                    |

---

## 🔌 WebSocket Protocol

**Endpoint:** `ws://localhost:9224/controller`

**Request Format:**

```json
{
  "id": "unique-request-id",
  "action": "click",
  "payload": {
    "tabId": 12345,
    "nodeId": 42
  }
}
```

**Response Format:**

```json
{
  "id": "unique-request-id",
  "ok": true,
  "data": {
    "success": true
  }
}
```

**Error Response:**

```json
{
  "id": "unique-request-id",
  "ok": false,
  "error": "Element not found: nodeId 42"
}
```

---

## ⚠️ Common Issues

### Issue 1: "chrome.browserOS is undefined"

**Symptoms:**

- Diagnostic shows `"available": false`
- All browser actions fail

**Cause:** Not using BrowserOS Chrome

**Solution:**

- Download and use BrowserOS Chrome (not regular Chrome)
- Verify at `chrome://version` - should show "BrowserOS" in the name

---

### Issue 2: "Port 9224 is already in use"

**Symptoms:**

```
❌ Fatal Error: Port 9224 is already in use!
```

**Solution:**

```bash
lsof -ti:9224 | xargs kill -9
npm test
```

---

### Issue 3: Extension Not Connecting

**Symptoms:**

- Test client shows "Waiting for extension to connect..." forever
- Service worker console shows "Connection timeout"

**Checklist:**

1. ✅ Test server running (`npm test`)
2. ✅ Extension loaded in BrowserOS Chrome
3. ✅ Extension enabled (chrome://extensions/)
4. ✅ Service worker active (not suspended)

**Solution:**

1. Reload extension: chrome://extensions/ → "Reload" button
2. Restart test server: Ctrl+C, then `npm test`

---

### Issue 4: "Unknown action"

**Symptoms:**

```
Error: Unknown action: "click". Available actions: getActiveTab, getTabs, ...
```

**Cause:** Action not registered (extension didn't reload properly)

**Solution:**

1. Toggle extension OFF and ON at chrome://extensions/
2. Check service worker console for: `Registered 14 action(s): ...`

---

## 📁 Project Structure

```
browseros-controller/
├── README.md              # This file
├── ARCHITECTURE.md        # Complete architecture documentation
├── .env.example           # Environment variable template
├── manifest.json          # Extension manifest
├── package.json           # Node dependencies
├── webpack.config.js      # Build configuration
│
├── src/                   # Source code
│   ├── background/        # Service worker entry point
│   ├── actions/           # Action handlers
│   │   ├── bookmark/      # Bookmark management actions
│   │   ├── browser/       # Browser interaction actions
│   │   ├── diagnostics/   # Diagnostic actions
│   │   ├── history/       # History management actions
│   │   └── tab/           # Tab management actions
│   ├── adapters/          # Chrome API wrappers
│   ├── config/            # Configuration management
│   │   ├── constants.ts   # Application constants
│   │   └── environment.ts # Environment variable handling
│   ├── websocket/         # WebSocket client
│   ├── utils/             # Utilities
│   ├── protocol/          # Protocol types
│   └── types/             # TypeScript definitions
│
├── tests/                 # Test files
│   ├── test-simple.js     # Interactive test client
│   └── test-auto.js       # Automated test client
│
└── dist/                  # Built extension (generated)
    ├── background.js
    └── manifest.json
```

---

## 🔗 Related Projects

- **BrowserOS-agent**: AI agent that uses this controller for browser automation
- **BrowserOS Chrome**: Custom Chrome build with `chrome.browserOS` APIs

---

## 📄 License

MIT

---

## 🆘 Support

For issues or questions:

1. Check [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed documentation
2. Review the "Common Issues" section above
3. Check service worker console for detailed error logs
4. Verify you're using BrowserOS Chrome (run diagnostic test)

---

**Happy automating! 🚀**

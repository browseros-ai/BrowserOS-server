# Rate Limiter Design

## What We're Building

A rate limiter that restricts users to **3 conversations per day** when using the default BrowserOS LLM provider (`provider === 'browseros'`). Users with their own API key have unlimited usage.

---

## Design

### Module Structure

```
packages/common/src/
├── db/
│   ├── index.ts              # Database singleton, getDb()
│   └── schema.ts             # Table definitions

packages/agent/src/
├── rate-limit/
│   ├── index.ts              # RateLimiter class
│   └── errors.ts             # RateLimitError
└── http/
    └── HttpServer.ts         # Integration point
```

### Storage

Bun SQLite at `${executionDir}/browseros.db`.

// NTN -- add client_id to the table as well

```sql
CREATE TABLE IF NOT EXISTS conversation_history (
  id TEXT PRIMARY KEY,
  install_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  initial_query TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_custom_key INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_install_date
ON conversation_history(install_id, created_at);
```

### Rate Limit Check

```sql
SELECT COUNT(*) as count
FROM conversation_history
WHERE install_id = ?
  AND is_custom_key = 0
  AND date(created_at) = date('now', 'localtime')
```

If `count >= 3`, throw `RateLimitError` (HTTP 429).

### Flow

```
POST /chat
    │
    ▼
validateRequest()
    │
    ▼
┌─────────────────────────────────┐
│ provider === 'browseros'?       │
│                                 │
│   NO  → Skip rate limiting      │
│   YES → Check daily count       │
│         count >= 3? → 429       │
└─────────────────────────────────┘
    │
    ▼
stream() → agent.execute()
    │
    ▼ (on success)
┌─────────────────────────────────┐
│ Record conversation             │
│ INSERT OR IGNORE into           │
│ conversation_history            │
└─────────────────────────────────┘
```

**Key:** Record AFTER successful response, not before. Failed LLM calls don't consume quota.

### Integration (HttpServer.ts)

```typescript
// After validateRequest, before stream()
if (request.provider === AIProvider.BROWSEROS) {
  await rateLimiter.check(installId);
}

// Inside stream(), after successful agent.execute()
if (request.provider === AIProvider.BROWSEROS) {
  rateLimiter.record({
    conversationId: request.conversationId,
    installId,
    provider: request.provider,
    initialQuery: request.message,
  });
}
```

### RateLimiter Class

```typescript
// packages/agent/src/rate-limit/index.ts
export class RateLimiter {
  constructor(private db: Database) {}

  check(installId: string): void {
    const count = this.getTodayCount(installId);
    if (count >= DAILY_LIMIT) {
      throw new RateLimitError(...);
    }
  }

  record(params: { conversationId, installId, provider, initialQuery }): void {
    // INSERT OR IGNORE (handles duplicate conversationIds)
  }

  private getTodayCount(installId: string): number { ... }
}
```

### Database Singleton (packages/common)

```typescript
// packages/common/src/db/index.ts
import {Database} from 'bun:sqlite';

let db: Database | null = null;

export function initializeDb(dbPath: string): Database {
  if (!db) {
    db = new Database(dbPath);
    db.exec('PRAGMA journal_mode = WAL');
    initSchema(db);
  }
  return db;
}

export function getDb(): Database {
  if (!db) throw new Error('Database not initialized');
  return db;
}
```

### Error Response

```json
{
  "error": {
    "name": "RateLimitError",
    "message": "Daily limit reached (3/3). Add your own API key for unlimited usage.",
    "code": "RATE_LIMIT_EXCEEDED",
    "statusCode": 429
  }
}
```

### Config Changes

**HttpServerConfig** (packages/agent/src/http/types.ts):

```typescript
export interface HttpServerConfig {
  // ... existing fields
  installId: string; // Required
  dbPath: string; // Required
}
```

**main.ts** passes these from server config.

---

## Edge Cases

| Case                | Behavior                             |
| ------------------- | ------------------------------------ |
| No installId        | Server fails to start (required)     |
| DB unavailable      | Log error, allow request (fail open) |
| Same conversationId | INSERT OR IGNORE (only first counts) |
| Clock manipulation  | Acceptable risk                      |

---

## Future

- Sync conversation_history to cloud
- Configurable limits via config file
- Usage dashboard in UI

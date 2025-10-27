#!/usr/bin/env bun

/**
 * Simple WebSocket Test Client
 * Logs all sent and received packets in readable format
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const WS_URL = process.env.WS_URL || 'ws://localhost:9200';
const TEST_QUERY = 'Open amazon.com and order Sensodyne toothpaste 🪥';
const CLIENT_TIMEOUT = parseInt(process.env.CLIENT_TIMEOUT || '0'); // 0 = no timeout

// ============================================================================
// ANSI COLORS
// ============================================================================

const Colors = {
  GREEN: '\x1b[32m',
  BLUE: '\x1b[34m',
  YELLOW: '\x1b[33m',
  RED: '\x1b[31m',
  CYAN: '\x1b[36m',
  MAGENTA: '\x1b[35m',
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m',
};

// ============================================================================
// LOGGING FUNCTIONS
// ============================================================================

function timestamp(): string {
  return new Date().toISOString().split('T')[1].slice(0, 12);
}

function logHeader(text: string) {
  console.log(`\n${Colors.CYAN}${'='.repeat(70)}${Colors.RESET}`);
  console.log(`${Colors.CYAN}${Colors.BOLD}${text}${Colors.RESET}`);
  console.log(`${Colors.CYAN}${'='.repeat(70)}${Colors.RESET}\n`);
}

function logSent(data: any) {
  console.log(`${Colors.YELLOW}[${timestamp()}] 📤 SENT →${Colors.RESET}`);
  console.log(
    `${Colors.YELLOW}${JSON.stringify(data, null, 2)}${Colors.RESET}`,
  );
  console.log();
}

function logReceived(data: any) {
  const eventType = data.type || 'unknown';

  // Color code by event type
  let color = Colors.RESET;
  let icon = '📥';

  switch (eventType) {
    case 'connection':
      color = Colors.GREEN;
      icon = '✅';
      break;
    case 'init':
      color = Colors.BLUE;
      icon = '🔧';
      break;
    case 'response':
      color = Colors.BLUE;
      icon = '💬';
      break;
    case 'tool_use':
      color = Colors.YELLOW;
      icon = '🔨';
      break;
    case 'tool_result':
      color = Colors.CYAN;
      icon = '📊';
      break;
    case 'completion':
      color = Colors.GREEN;
      icon = '✅';
      break;
    case 'error':
      color = Colors.RED;
      icon = '❌';
      break;
  }

  console.log(
    `${color}[${timestamp()}] ${icon} RECEIVED ← [${eventType.toUpperCase()}]${Colors.RESET}`,
  );
  console.log(`${color}${JSON.stringify(data, null, 2)}${Colors.RESET}`);
  console.log();
}

function logInfo(message: string) {
  console.log(`${Colors.CYAN}[${timestamp()}] ℹ️  ${message}${Colors.RESET}`);
}

function logSuccess(message: string) {
  console.log(`${Colors.GREEN}[${timestamp()}] ✅ ${message}${Colors.RESET}`);
}

function logError(message: string) {
  console.log(`${Colors.RED}[${timestamp()}] ❌ ${message}${Colors.RESET}`);
}

// ============================================================================
// WEBSOCKET CLIENT
// ============================================================================

async function testClient(): Promise<boolean> {
  logHeader('WEBSOCKET TEST CLIENT');
  logInfo(`Connecting to: ${WS_URL}`);
  logInfo(`Query: "${TEST_QUERY}"`);
  console.log();

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);

    let eventsReceived = 0;
    let completionReceived = false;
    let sessionId: string | null = null;
    let testTimeout: Timer | null = null;

    // Set timeout for the entire test (if configured)
    if (CLIENT_TIMEOUT > 0) {
      testTimeout = setTimeout(() => {
        logError(`Test timeout after ${CLIENT_TIMEOUT / 1000} seconds`);
        ws.close();
        resolve(false);
      }, CLIENT_TIMEOUT);
    } else {
      logInfo(
        'Client timeout disabled - will wait indefinitely for server response',
      );
    }

    ws.onopen = () => {
      logSuccess('WebSocket connection established');
      logInfo('Waiting for connection event...');
    };

    ws.onmessage = event => {
      try {
        const data = JSON.parse(event.data);
        logReceived(data);
        eventsReceived++;

        switch (data.type) {
          case 'connection':
            sessionId = data.data?.sessionId;
            if (sessionId) {
              logInfo(`Session ID: ${sessionId.substring(0, 16)}...`);
            }

            // Send test query
            logInfo('Sending test query...');
            console.log();

            const clientMessage = {
              type: 'message',
              content: TEST_QUERY,
            };

            ws.send(JSON.stringify(clientMessage));
            logSent(clientMessage);
            logInfo('Streaming agent events...');
            console.log();
            break;

          case 'completion':
            completionReceived = true;
            logSuccess('Agent task completed!');

            // Close connection after short delay
            setTimeout(() => {
              logInfo('Closing connection...');
              ws.close();
            }, 500);
            break;

          case 'error':
            logError(`Agent error: ${data.error}`);
            ws.close();
            break;
        }
      } catch (error) {
        logError(
          `Failed to parse message: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    };

    ws.onclose = event => {
      if (testTimeout) clearTimeout(testTimeout);
      logSuccess(`Connection closed (code: ${event.code})`);

      // Print summary
      logHeader('TEST SUMMARY');
      console.log(
        `  Session ID:         ${sessionId ? sessionId.substring(0, 32) + '...' : 'N/A'}`,
      );
      console.log(`  Events Received:    ${eventsReceived}`);
      console.log(
        `  Completion:         ${completionReceived ? '✅ YES' : '❌ NO'}`,
      );
      console.log(
        `  Status:             ${completionReceived ? '✅ PASS' : '❌ FAIL'}`,
      );
      console.log();

      resolve(completionReceived);
    };

    ws.onerror = error => {
      if (testTimeout) clearTimeout(testTimeout);
      logError('WebSocket error occurred');
      resolve(false);
    };
  });
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  try {
    const success = await testClient();

    if (success) {
      console.log(
        `${Colors.GREEN}${Colors.BOLD}✅ TEST PASSED${Colors.RESET}\n`,
      );
      process.exit(0);
    } else {
      console.log(`${Colors.RED}${Colors.BOLD}❌ TEST FAILED${Colors.RESET}\n`);
      process.exit(1);
    }
  } catch (error) {
    logError(
      `Fatal error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  logInfo('Test interrupted by user');
  process.exit(130);
});

// Run the test
main();

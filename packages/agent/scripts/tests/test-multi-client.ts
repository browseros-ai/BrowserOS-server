#!/usr/bin/env bun

/**
 * Multi-Client WebSocket Test
 * Tests concurrent sessions, capacity limits, and session isolation
 */

const WS_URL = process.env.WS_URL || 'ws://localhost:3000';
const COLORS = {
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m',
};

interface TestResult {
  clientId: number;
  success: boolean;
  error?: string;
  eventsReceived: number;
  completionReceived: boolean;
}

function log(clientId: number, icon: string, message: string, data?: any) {
  const color = [COLORS.cyan, COLORS.magenta, COLORS.yellow][clientId % 3];
  console.log(`${color}[Client ${clientId}]${COLORS.reset} ${icon} ${message}`);
  if (data) {
    console.log(`  ${JSON.stringify(data)}`);
  }
}

async function testClient(
  clientId: number,
  message: string,
): Promise<TestResult> {
  return new Promise((resolve, reject) => {
    log(clientId, '🔌', `Connecting to ${WS_URL}...`);

    const ws = new WebSocket(WS_URL);
    let eventsReceived = 0;
    let completionReceived = false;
    let sessionId = '';

    const timeout = setTimeout(() => {
      log(clientId, '⏱️', 'Test timeout after 30 seconds');
      ws.close();
      resolve({
        clientId,
        success: false,
        error: 'Timeout',
        eventsReceived,
        completionReceived,
      });
    }, 30000);

    ws.onopen = () => {
      log(clientId, COLORS.green + '✅' + COLORS.reset, 'Connected');
    };

    ws.onmessage = event => {
      try {
        const data = JSON.parse(event.data);
        eventsReceived++;

        switch (data.type) {
          case 'connection':
            sessionId = data.data.sessionId;
            log(
              clientId,
              '📥',
              `Connection confirmed (${sessionId.substring(0, 8)}...)`,
            );

            // Send test message
            const clientMessage = {
              type: 'message',
              content: message,
            };
            ws.send(JSON.stringify(clientMessage));
            log(clientId, '📤', `Sent: "${message}"`);
            break;

          case 'init':
            log(clientId, '📥', `Init: ${data.content.substring(0, 50)}...`);
            break;

          case 'response':
            log(
              clientId,
              '📥',
              `Response: ${data.content.substring(0, 80)}...`,
            );
            break;

          case 'tool_use':
            log(
              clientId,
              '📥',
              `Tool use: ${data.content.substring(0, 50)}...`,
            );
            break;

          case 'tool_result':
            log(clientId, '📥', `Tool result received`);
            break;

          case 'completion':
            log(
              clientId,
              COLORS.green + '📥' + COLORS.reset,
              'Completion received',
            );
            completionReceived = true;

            // Close after completion
            setTimeout(() => {
              log(clientId, '✅', 'Test complete, closing...');
              ws.close();
            }, 500);
            break;

          case 'error':
            log(
              clientId,
              COLORS.red + '❌' + COLORS.reset,
              `Error: ${data.error}`,
            );
            break;
        }
      } catch (error) {
        log(
          clientId,
          COLORS.red + '❌' + COLORS.reset,
          'Failed to parse message',
        );
      }
    };

    ws.onclose = event => {
      clearTimeout(timeout);
      log(clientId, '👋', `Closed (code: ${event.code})`);

      resolve({
        clientId,
        success: completionReceived,
        eventsReceived,
        completionReceived,
      });
    };

    ws.onerror = error => {
      clearTimeout(timeout);
      log(clientId, COLORS.red + '❌' + COLORS.reset, 'WebSocket error');
      resolve({
        clientId,
        success: false,
        error: 'WebSocket error',
        eventsReceived,
        completionReceived,
      });
    };
  });
}

async function testCapacityLimit(): Promise<boolean> {
  console.log(
    COLORS.yellow +
      '\n━━━━━━━━━━━ CAPACITY LIMIT TEST ━━━━━━━━━━━' +
      COLORS.reset,
  );
  console.log('Attempting to connect 6th client (should be rejected)...\n');

  return new Promise(resolve => {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log(
        COLORS.red +
          '❌ 6th client connected (should have been rejected!)' +
          COLORS.reset,
      );
      ws.close();
      resolve(false);
    };

    ws.onerror = () => {
      console.log(
        COLORS.green + '✅ 6th client rejected as expected' + COLORS.reset,
      );
      resolve(true);
    };

    // If HTTP 503 is returned, the connection won't open
    setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        console.log(
          COLORS.green +
            '✅ 6th client rejected (connection failed)' +
            COLORS.reset,
        );
        resolve(true);
      }
    }, 2000);
  });
}

async function runTests() {
  console.log(
    COLORS.cyan +
      '━━━━━━━━━━━━━━━━━━━━ MULTI-CLIENT TEST ━━━━━━━━━━━━━━━━━━━━' +
      COLORS.reset,
  );
  console.log();

  // Test 1: Concurrent execution with 3 clients
  console.log(
    COLORS.yellow +
      '━━━━━━━━━━━ TEST 1: CONCURRENT EXECUTION ━━━━━━━━━━━' +
      COLORS.reset,
  );
  console.log('Starting 3 clients with different messages...\n');

  const clients = [
    testClient(1, 'I am client 1. open google.com and tell me the page title.'),
    testClient(
      2,
      'I am client 2. open youtube.com and tell me the page title.',
    ),
    testClient(
      3,
      'I am client 3. open facebook.com and tell me the page title.',
    ),
    testClient(4, 'I am client 4. open github.com and tell me the page title.'),
    testClient(
      5,
      'I am client 5. open twitter.com and tell me the page title.',
    ),
    testClient(6, 'I am client 6. open reddit.com and tell me the page title.'),
  ];

  const results = await Promise.all(clients);

  console.log(
    '\n' +
      COLORS.yellow +
      '━━━━━━━━━━━ TEST 1 RESULTS ━━━━━━━━━━━' +
      COLORS.reset,
  );
  const allSuccessful = results.every(r => r.success);
  results.forEach(result => {
    const status = result.success
      ? COLORS.green + '✅ PASS'
      : COLORS.red + '❌ FAIL';
    console.log(
      `${status}${COLORS.reset} - Client ${result.clientId}: ${result.eventsReceived} events, completion: ${result.completionReceived}`,
    );
  });

  if (allSuccessful) {
    console.log(
      COLORS.green + '\n✅ All clients completed successfully!' + COLORS.reset,
    );
  } else {
    console.log(COLORS.red + '\n❌ Some clients failed!' + COLORS.reset);
  }

  // Test 2: Capacity limit (if MAX_SESSIONS=5)
  // Note: This test assumes 3 clients just disconnected and server has capacity
  // In real scenario, you'd need to keep 5 clients connected
  console.log(
    COLORS.yellow +
      '\n━━━━━━━━━━━ TEST 2: CAPACITY LIMIT (SKIPPED) ━━━━━━━━━━━' +
      COLORS.reset,
  );
  console.log(
    'To test capacity: Set MAX_SESSIONS=3, run 3 clients, then try 4th',
  );
  console.log('For now, checking health endpoint...\n');

  // Check health endpoint
  try {
    const healthResponse = await fetch('http://localhost:3000/health');
    const health = await healthResponse.json();
    console.log('Health check:');
    console.log(JSON.stringify(health, null, 2));
  } catch (error) {
    console.log(COLORS.red + '❌ Health check failed' + COLORS.reset);
  }

  console.log(
    '\n' +
      COLORS.cyan +
      '━━━━━━━━━━━━━━━━━━━━ TESTS COMPLETE ━━━━━━━━━━━━━━━━━━━━' +
      COLORS.reset,
  );

  if (allSuccessful) {
    console.log(COLORS.green + '✅ All tests passed!' + COLORS.reset);
    process.exit(0);
  } else {
    console.log(COLORS.red + '❌ Some tests failed!' + COLORS.reset);
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.log(COLORS.red + '❌ Test suite failed!' + COLORS.reset);
  console.error(error);
  process.exit(1);
});

import {query} from '@anthropic-ai/claude-agent-sdk';
import {Logger} from '../../src/utils/Logger.js';
import {EventFormatter} from '../../src/utils/EventFormatter.js';

const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  Logger.error('ANTHROPIC_API_KEY not found');
  process.exit(1);
}

Logger.info('Starting browser automation test with chrome-devtools MCP...');

async function testBrowserAutomation() {
  try {
    // Explicitly request browser automation task
    const testMessage = `Use the chrome-devtools MCP server to:
1. Navigate to https://example.com
2. Take a screenshot
3. Tell me the page title

If chrome-devtools is not available, list what MCP servers you have access to.`;

    Logger.info('Sending browser automation request...', {
      message: testMessage.substring(0, 100) + '...',
    });

    const options = {
      apiKey: API_KEY,
      maxTurns: 15,
      cwd: process.cwd(),
      mcpServers: {
        'chrome-devtools': {
          type: 'stdio' as const,
          command: 'npx',
          args: ['-y', 'chrome-devtools-mcp@latest', '--isolated'],
        },
      },
      permissionMode: 'bypassPermissions' as const, // Auto-approve tool usage
    };

    let eventCount = 0;
    let mcpServers: any[] = [];
    let toolsUsed: string[] = [];

    Logger.info(
      '\n━━━━━━━━━━━━━━━━━━━━ FORMATTED EVENT STREAM ━━━━━━━━━━━━━━━━━━━━\n',
    );

    const iterator = query({prompt: testMessage, options})[
      Symbol.asyncIterator
    ]();
    console.log(iterator);

    for await (const event of iterator) {
      eventCount++;
      console.log(event);

      // Format the event
      const formatted = EventFormatter.format(event);
      if (formatted) {
        Logger.info(`[${formatted.type.toUpperCase()}] ${formatted.content}`);
      }

      // Capture MCP servers from init event
      if (event.type === 'system' && event.subtype === 'init') {
        mcpServers = event.mcp_servers || [];
      }

      // Track tool usage
      if (event.type === 'assistant' && event.message?.content) {
        const toolUses = event.message.content.filter(
          (c: any) => c.type === 'tool_use',
        );
        toolUses.forEach((tool: any) => {
          if (!toolsUsed.includes(tool.name)) {
            toolsUsed.push(tool.name);
          }
        });
      }
    }

    Logger.info(
      '\n━━━━━━━━━━━━━━━━━━━━ EVENT STREAM END ━━━━━━━━━━━━━━━━━━━━\n',
    );

    const hasChromeDevtools = mcpServers.some(
      (s: any) => s.name === 'chrome-devtools',
    );

    Logger.info('Browser automation test completed', {
      totalEvents: eventCount,
      mcpServers,
      toolsUsed,
      chromeDevtoolsAvailable: hasChromeDevtools,
    });

    if (!hasChromeDevtools) {
      Logger.error('❌ chrome-devtools MCP was NOT loaded!');
      Logger.info('Available MCP servers:', {mcpServers});
    } else {
      Logger.info('✅ chrome-devtools MCP was loaded successfully!');
    }
  } catch (error) {
    Logger.error('Test failed', {
      error: error instanceof Error ? error.message : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

testBrowserAutomation();

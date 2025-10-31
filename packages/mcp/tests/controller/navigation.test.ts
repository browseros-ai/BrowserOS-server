/**
 * @license
 * Copyright 2025 BrowserOS
 */
import assert from 'node:assert';
import {describe, it} from 'bun:test';

import {withMcpServer} from '@browseros/common/tests/utils';

describe('MCP Controller Navigation Tools', () => {
  it(
    'browser_navigate navigates to URL',
    async () => {
      await withMcpServer(async client => {
        console.log('Navigating to https://example.com...');
        const result = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'https://example.com',
          },
        });

        assert.ok(result.content, 'Should return content');
        assert.ok(!result.isError, 'Should not error');
      });
    },
    30000,
  );

  it(
    'browser_navigate handles data URLs',
    async () => {
      await withMcpServer(async client => {
        const result = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<h1>Test Page</h1>',
          },
        });

        assert.ok(result.content, 'Should return content');
        assert.ok(!result.isError, 'Should not error');
      });
    },
    30000,
  );
});

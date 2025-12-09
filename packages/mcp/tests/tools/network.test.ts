/**
 * @license
 * Copyright 2025 BrowserOS
 */
import assert from 'node:assert';

import {withMcpServer} from '@browseros/common/tests/utils';
import {describe, it} from 'bun:test';

describe('MCP Network Tools', () => {
  it('tests that list_network_requests returns network data', async () => {
    await withMcpServer(async client => {
      const result = await client.callTool({
        name: 'list_network_requests',
        arguments: {},
      });

      assert.ok(result.content, 'Should return content');
      assert.ok(!result.isError, 'Should not error');
    });
  }, 30000);
});

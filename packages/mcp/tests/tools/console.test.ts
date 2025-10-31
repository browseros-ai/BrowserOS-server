/**
 * @license
 * Copyright 2025 BrowserOS
 */
import assert from 'node:assert';
import {describe, it} from 'bun:test';

import {withMcpServer} from '@browseros/common/tests/utils';

describe('MCP Console Tools', () => {
  it(
    'list_console_messages returns console data',
    async () => {
      await withMcpServer(async client => {
        const result = await client.callTool({
          name: 'list_console_messages',
          arguments: {},
        });

        assert.ok(result.content, 'Should return content');
        assert.ok(!result.isError, 'Should not error');
      });
    },
    30000,
  );
});

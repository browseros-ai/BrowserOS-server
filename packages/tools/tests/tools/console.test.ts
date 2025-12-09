/**
 * @license
 * Copyright 2025 BrowserOS
 */
import assert from 'node:assert';

import {withBrowser} from '@browseros/common/tests/utils';
import {describe, it} from 'bun:test';

import {consoleTool} from '../../src/cdp-based/console.js';

describe('console', () => {
  it('list_console_messages - list messages', async () => {
    await withBrowser(async (response, context) => {
      await consoleTool.handler({params: {}}, response, context);
      assert.ok(response.includeConsoleData);
    });
  });
});

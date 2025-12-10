/**
 * @license
 * Copyright 2025 BrowserOS
 */
import assert from 'node:assert';

import {withBrowser} from '@browseros/common/tests/utils';
import {describe, it} from 'bun:test';

import {
  getNetworkRequest,
  listNetworkRequests,
} from '../../src/cdp-based/network.js';

describe('network', () => {
  it('network_list_requests - list requests', async () => {
    await withBrowser(async (response, context) => {
      await listNetworkRequests.handler({params: {}}, response, context);
      assert.ok(response.includeNetworkRequests);
      assert.strictEqual(response.networkRequestsPageIdx, undefined);
    });
  });

  it('network_get_request - attaches request', async () => {
    await withBrowser(async (response, context) => {
      const page = await context.getSelectedPage();
      await page.goto('data:text/html,<div>Hello MCP</div>');
      await getNetworkRequest.handler(
        {params: {url: 'data:text/html,<div>Hello MCP</div>'}},
        response,
        context,
      );
      assert.equal(
        response.attachedNetworkRequestUrl,
        'data:text/html,<div>Hello MCP</div>',
      );
    });
  });

  it('network_get_request - should not add the request list', async () => {
    await withBrowser(async (response, context) => {
      const page = await context.getSelectedPage();
      await page.goto('data:text/html,<div>Hello MCP</div>');
      await getNetworkRequest.handler(
        {params: {url: 'data:text/html,<div>Hello MCP</div>'}},
        response,
        context,
      );
      assert(!response.includeNetworkRequests);
    });
  });
});

/**
 * @license
 * Copyright 2025 BrowserOS
 */
import assert from 'node:assert';

import {withBrowser} from '@browseros/common/tests/utils';
import {describe, it} from 'bun:test';

import {emulateCpu, emulateNetwork} from '../../src/cdp-based/emulation.js';

describe('emulation', () => {
  it('network - emulates network throttling when the throttling option is valid ', async () => {
    await withBrowser(async (response, context) => {
      await emulateNetwork.handler(
        {
          params: {
            throttlingOption: 'Slow 3G',
          },
        },
        response,
        context,
      );

      assert.strictEqual(context.getNetworkConditions(), 'Slow 3G');
    });
  });

  it('network - disables network emulation', async () => {
    await withBrowser(async (response, context) => {
      await emulateNetwork.handler(
        {
          params: {
            throttlingOption: 'No emulation',
          },
        },
        response,
        context,
      );

      assert.strictEqual(context.getNetworkConditions(), null);
    });
  });

  it('network - does not set throttling when the network throttling is not one of the predefined options', async () => {
    await withBrowser(async (response, context) => {
      await emulateNetwork.handler(
        {
          params: {
            throttlingOption: 'Slow 11G',
          },
        },
        response,
        context,
      );

      assert.strictEqual(context.getNetworkConditions(), null);
    });
  });

  it('network - report correctly for the currently selected page', async () => {
    await withBrowser(async (response, context) => {
      await context.newPage();
      await emulateNetwork.handler(
        {
          params: {
            throttlingOption: 'Slow 3G',
          },
        },
        response,
        context,
      );

      assert.strictEqual(context.getNetworkConditions(), 'Slow 3G');

      context.setSelectedPageIdx(0);

      assert.strictEqual(context.getNetworkConditions(), null);
    });
  });

  it('cpu - emulates cpu throttling when the rate is valid (1-20x)', async () => {
    await withBrowser(async (response, context) => {
      await emulateCpu.handler(
        {
          params: {
            throttlingRate: 4,
          },
        },
        response,
        context,
      );

      assert.strictEqual(context.getCpuThrottlingRate(), 4);
    });
  });

  it('cpu - disables cpu throttling', async () => {
    await withBrowser(async (response, context) => {
      context.setCpuThrottlingRate(4);
      await emulateCpu.handler(
        {
          params: {
            throttlingRate: 1,
          },
        },
        response,
        context,
      );

      assert.strictEqual(context.getCpuThrottlingRate(), 1);
    });
  });

  it('cpu - report correctly for the currently selected page', async () => {
    await withBrowser(async (response, context) => {
      await context.newPage();
      await emulateCpu.handler(
        {
          params: {
            throttlingRate: 4,
          },
        },
        response,
        context,
      );

      assert.strictEqual(context.getCpuThrottlingRate(), 4);

      context.setSelectedPageIdx(0);

      assert.strictEqual(context.getCpuThrottlingRate(), 1);
    });
  });
});

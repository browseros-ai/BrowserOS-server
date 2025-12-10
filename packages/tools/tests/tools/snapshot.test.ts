/**
 * @license
 * Copyright 2025 BrowserOS
 */
import assert from 'node:assert';

import {html, withBrowser} from '@browseros/common/tests/utils';
import {describe, it} from 'bun:test';

import {takeSnapshot, waitFor} from '../../src/cdp-based/snapshot.js';

describe('snapshot', () => {
  it('browser_snapshot - includes a snapshot', async () => {
    await withBrowser(async (response, context) => {
      await takeSnapshot.handler({params: {}}, response, context);
      assert.ok(response.includeSnapshot);
    });
  });
  it('browser_wait_for - should work', async () => {
    await withBrowser(async (response, context) => {
      const page = await context.getSelectedPage();

      await page.setContent(
        html`<main><span>Hello</span><span> </span><div>World</div></main>`,
      );
      await waitFor.handler(
        {
          params: {
            text: 'Hello',
          },
        },
        response,
        context,
      );

      assert.equal(
        response.responseLines[0],
        'Element with text "Hello" found.',
      );
      assert.ok(response.includeSnapshot);
    });
  });
  it('browser_wait_for - should work with element that show up later', async () => {
    await withBrowser(async (response, context) => {
      const page = context.getSelectedPage();

      const handlePromise = waitFor.handler(
        {
          params: {
            text: 'Hello World',
          },
        },
        response,
        context,
      );

      await page.setContent(
        html`<main><span>Hello</span><span> </span><div>World</div></main>`,
      );

      await handlePromise;

      assert.equal(
        response.responseLines[0],
        'Element with text "Hello World" found.',
      );
      assert.ok(response.includeSnapshot);
    });
  });
  it('browser_wait_for - should work with aria elements', async () => {
    await withBrowser(async (response, context) => {
      const page = context.getSelectedPage();

      await page.setContent(html`<main><h1>Header</h1><div>Text</div></main>`);

      await waitFor.handler(
        {
          params: {
            text: 'Header',
          },
        },
        response,
        context,
      );

      assert.equal(
        response.responseLines[0],
        'Element with text "Header" found.',
      );
      assert.ok(response.includeSnapshot);
    });
  });

  it('browser_wait_for - should work with iframe content', async () => {
    await withBrowser(async (response, context) => {
      const page = await context.getSelectedPage();

      await page.setContent(
        html`<h1>Top level</h1> <iframe srcdoc="<p>Hello iframe</p>"></iframe>`,
      );

      await waitFor.handler(
        {
          params: {
            text: 'Hello iframe',
          },
        },
        response,
        context,
      );

      assert.equal(
        response.responseLines[0],
        'Element with text "Hello iframe" found.',
      );
      assert.ok(response.includeSnapshot);
    });
  });
});

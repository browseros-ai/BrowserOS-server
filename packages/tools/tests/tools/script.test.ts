/**
 * @license
 * Copyright 2025 BrowserOS
 */
import assert from 'node:assert';

import {html, withBrowser} from '@browseros/common/tests/utils';
import {describe, it} from 'bun:test';

import {evaluateScript} from '../../src/cdp-based/script.js';

describe('script', () => {
  it('browser_evaluate_script - evaluates', async () => {
    await withBrowser(async (response, context) => {
      await evaluateScript.handler(
        {params: {function: String(() => 2 * 5)}},
        response,
        context,
      );
      const lineEvaluation = response.responseLines.at(2)!;
      assert.strictEqual(JSON.parse(lineEvaluation), 10);
    });
  });
  it('browser_evaluate_script - runs in selected page', async () => {
    await withBrowser(async (response, context) => {
      await evaluateScript.handler(
        {params: {function: String(() => document.title)}},
        response,
        context,
      );

      let lineEvaluation = response.responseLines.at(2)!;
      assert.strictEqual(JSON.parse(lineEvaluation), '');

      const page = await context.newPage();
      await page.setContent(`
        <head>
          <title>New Page</title>
        </head>
      `);

      response.resetResponseLineForTesting();
      await evaluateScript.handler(
        {params: {function: String(() => document.title)}},
        response,
        context,
      );

      lineEvaluation = response.responseLines.at(2)!;
      assert.strictEqual(JSON.parse(lineEvaluation), 'New Page');
    });
  });

  it('browser_evaluate_script - work for complex objects', async () => {
    await withBrowser(async (response, context) => {
      const page = context.getSelectedPage();

      await page.setContent(html`<script src="./scripts.js"></script> `);

      await evaluateScript.handler(
        {
          params: {
            function: String(() => {
              const scripts = Array.from(
                document.head.querySelectorAll('script'),
              ).map(s => ({src: s.src, async: s.async, defer: s.defer}));

              return {scripts};
            }),
          },
        },
        response,
        context,
      );
      const lineEvaluation = response.responseLines.at(2)!;
      assert.deepEqual(JSON.parse(lineEvaluation), {
        scripts: [],
      });
    });
  });

  it('browser_evaluate_script - work for async functions', async () => {
    await withBrowser(async (response, context) => {
      const page = context.getSelectedPage();

      await page.setContent(html`<script src="./scripts.js"></script> `);

      await evaluateScript.handler(
        {
          params: {
            function: String(async () => {
              await new Promise(res => setTimeout(res, 0));
              return 'Works';
            }),
          },
        },
        response,
        context,
      );
      const lineEvaluation = response.responseLines.at(2)!;
      assert.strictEqual(JSON.parse(lineEvaluation), 'Works');
    });
  });

  it('browser_evaluate_script - work with one argument', async () => {
    await withBrowser(async (response, context) => {
      const page = context.getSelectedPage();

      await page.setContent(html`<button id="test">test</button>`);

      await context.createTextSnapshot();

      await evaluateScript.handler(
        {
          params: {
            function: String(async (el: Element) => {
              return el.id;
            }),
            args: [{uid: '1_1'}],
          },
        },
        response,
        context,
      );
      const lineEvaluation = response.responseLines.at(2)!;
      assert.strictEqual(JSON.parse(lineEvaluation), 'test');
    });
  });

  it('browser_evaluate_script - work with multiple args', async () => {
    await withBrowser(async (response, context) => {
      const page = context.getSelectedPage();

      await page.setContent(html`<button id="test">test</button>`);

      await context.createTextSnapshot();

      await evaluateScript.handler(
        {
          params: {
            function: String((container: Element, child: Element) => {
              return container.contains(child);
            }),
            args: [{uid: '1_0'}, {uid: '1_1'}],
          },
        },
        response,
        context,
      );
      const lineEvaluation = response.responseLines.at(2)!;
      assert.strictEqual(JSON.parse(lineEvaluation), true);
    });
  });
});

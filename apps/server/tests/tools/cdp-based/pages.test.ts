/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { describe, it } from 'bun:test'
import assert from 'node:assert'
import type { Dialog } from 'puppeteer-core'

import {
  closePage,
  handleDialog,
  listPages,
  navigatePage,
  navigatePageHistory,
  newPage,
  resizePage,
  selectPage,
} from '../../../src/tools/cdp-based/pages.js'

import { withBrowser } from '../../__helpers__/utils.js'

describe('pages', () => {
  it('list_pages - list pages', async () => {
    await withBrowser(async (response, context) => {
      await listPages.handler({ params: {} }, response, context)
      assert.ok(response.includePages)
    })
  })

  it('browser_new_page - create a page', async () => {
    await withBrowser(async (response, context) => {
      assert.strictEqual(context.getSelectedPageIdx(), 0)
      await newPage.handler(
        { params: { url: 'about:blank' } },
        response,
        context,
      )
      assert.strictEqual(context.getSelectedPageIdx(), 1)
      assert.ok(response.includePages)
    })
  })

  it('browser_close_page - closes a page', async () => {
    await withBrowser(async (response, context) => {
      const page = await context.newPage()
      assert.strictEqual(context.getSelectedPageIdx(), 1)
      assert.strictEqual(context.getPageByIdx(1), page)
      await closePage.handler({ params: { pageIdx: 1 } }, response, context)
      assert.ok(page.isClosed())
      assert.ok(response.includePages)
    })
  })

  it('browser_close_page - cannot close the last page', async () => {
    await withBrowser(async (response, context) => {
      const page = context.getSelectedPage()
      await closePage.handler({ params: { pageIdx: 0 } }, response, context)
      assert.deepStrictEqual(
        response.responseLines[0],
        `The last open page cannot be closed. It is fine to keep it open.`,
      )
      assert.ok(response.includePages)
      assert.ok(!page.isClosed())
    })
  })

  it('browser_select_page - selects a page', async () => {
    await withBrowser(async (response, context) => {
      await context.newPage()
      assert.strictEqual(context.getSelectedPageIdx(), 1)
      await selectPage.handler({ params: { pageIdx: 0 } }, response, context)
      assert.strictEqual(context.getSelectedPageIdx(), 0)
      assert.ok(response.includePages)
    })
  })

  it('browser_navigate_page - navigates to correct page', async () => {
    await withBrowser(async (response, context) => {
      await navigatePage.handler(
        { params: { url: 'data:text/html,<div>Hello MCP</div>' } },
        response,
        context,
      )
      const page = context.getSelectedPage()
      assert.equal(
        await page.evaluate(() => document.querySelector('div')?.textContent),
        'Hello MCP',
      )
      assert.ok(response.includePages)
    })
  })

  it('browser_navigate_page - throws an error if the page was closed not by the MCP server', async () => {
    await withBrowser(async (response, context) => {
      const page = await context.newPage()
      assert.strictEqual(context.getSelectedPageIdx(), 1)
      assert.strictEqual(context.getPageByIdx(1), page)

      await page.close()

      try {
        await navigatePage.handler(
          { params: { url: 'data:text/html,<div>Hello MCP</div>' } },
          response,
          context,
        )
        assert.fail('should not reach here')
      } catch (err) {
        assert.strictEqual(
          (err as Error).message,
          'The selected page has been closed. Call list_pages to see open pages.',
        )
      }
    })
  })

  it('browser_navigate_page_history - go back', async () => {
    await withBrowser(async (response, context) => {
      const page = context.getSelectedPage()
      await page.goto('data:text/html,<div>Hello MCP</div>')
      await navigatePageHistory.handler(
        { params: { navigate: 'back' } },
        response,
        context,
      )

      assert.equal(
        await page.evaluate(() => document.location.href),
        'about:blank',
      )
      assert.ok(response.includePages)
    })
  })

  it('browser_navigate_page_history - go forward', async () => {
    await withBrowser(async (response, context) => {
      const page = context.getSelectedPage()
      await page.goto('data:text/html,<div>Hello MCP</div>')
      await page.goBack()
      await navigatePageHistory.handler(
        { params: { navigate: 'forward' } },
        response,
        context,
      )

      assert.equal(
        await page.evaluate(() => document.querySelector('div')?.textContent),
        'Hello MCP',
      )
      assert.ok(response.includePages)
    })
  })

  it('browser_navigate_page_history - go forward with error', async () => {
    await withBrowser(async (response, context) => {
      await navigatePageHistory.handler(
        { params: { navigate: 'forward' } },
        response,
        context,
      )

      assert.equal(
        response.responseLines.at(0),
        'Unable to navigate forward in currently selected page.',
      )
      assert.ok(response.includePages)
    })
  })

  it('browser_navigate_page_history - go back with error', async () => {
    await withBrowser(async (response, context) => {
      await navigatePageHistory.handler(
        { params: { navigate: 'back' } },
        response,
        context,
      )

      assert.equal(
        response.responseLines.at(0),
        'Unable to navigate back in currently selected page.',
      )
      assert.ok(response.includePages)
    })
  })

  // Skip: BrowserOS doesn't support Browser.setContentsSize CDP command yet
  // TODO: Implement Browser.setContentsSize in BrowserOS or use alternative (viewport resize)
  it.skip('browser_resize - create a page', async () => {
    await withBrowser(async (response, context) => {
      assert.strictEqual(context.getSelectedPageIdx(), 0)
      const page = context.getSelectedPage()
      const resizePromise = page.evaluate(() => {
        return new Promise((resolve) => {
          window.addEventListener('resize', resolve, { once: true })
        })
      })
      await resizePage.handler(
        { params: { width: 700, height: 500 } },
        response,
        context,
      )
      await resizePromise
      const dimensions = await page.evaluate(() => {
        return [window.innerWidth, window.innerHeight]
      })
      assert.deepStrictEqual(dimensions, [700, 500])
    })
  })

  it('dialogs - can accept dialogs', async () => {
    await withBrowser(async (response, context) => {
      const page = context.getSelectedPage()
      const dialogPromise = new Promise<void>((resolve) => {
        page.on('dialog', () => {
          resolve()
        })
      })
      page.evaluate(() => {
        alert('test')
      })
      await dialogPromise
      await handleDialog.handler(
        {
          params: {
            action: 'accept',
          },
        },
        response,
        context,
      )
      assert.strictEqual(context.getDialog(), undefined)
      assert.strictEqual(
        response.responseLines[0],
        'Successfully accepted the dialog',
      )
    })
  })

  it('dialogs - can dismiss dialogs', async () => {
    await withBrowser(async (response, context) => {
      const page = context.getSelectedPage()
      const dialogPromise = new Promise<void>((resolve) => {
        page.on('dialog', () => {
          resolve()
        })
      })
      page.evaluate(() => {
        alert('test')
      })
      await dialogPromise
      await handleDialog.handler(
        {
          params: {
            action: 'dismiss',
          },
        },
        response,
        context,
      )
      assert.strictEqual(context.getDialog(), undefined)
      assert.strictEqual(
        response.responseLines[0],
        'Successfully dismissed the dialog',
      )
    })
  })

  it('dialogs - can dismiss already dismissed dialog dialogs', async () => {
    await withBrowser(async (response, context) => {
      const page = context.getSelectedPage()
      const dialogPromise = new Promise<Dialog>((resolve) => {
        page.on('dialog', (dialog) => {
          resolve(dialog)
        })
      })
      page.evaluate(() => {
        alert('test')
      })
      const dialog = await dialogPromise
      await dialog.dismiss()
      await handleDialog.handler(
        {
          params: {
            action: 'dismiss',
          },
        },
        response,
        context,
      )
      assert.strictEqual(context.getDialog(), undefined)
      assert.strictEqual(
        response.responseLines[0],
        'Successfully dismissed the dialog',
      )
    })
  })
})

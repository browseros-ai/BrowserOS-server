/**
 * @license
 * Copyright 2025 BrowserOS
 */
import { execSync } from 'node:child_process'

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { Mutex } from 'async-mutex'
import type { Browser } from 'puppeteer'
import puppeteer from 'puppeteer'
import type { HTTPRequest, HTTPResponse } from 'puppeteer-core'

import { logger } from '../../src/common/logger.js'
import { McpContext } from '../../src/common/McpContext.js'
import { McpResponse } from '../../src/tools/response/McpResponse.js'

import { ensureBrowserOS } from './browseros.js'
import { ensureServer } from './mcpServer.js'

const browserMutex = new Mutex()
let cachedBrowser: Browser | undefined

export async function killProcessOnPort(port: number): Promise<void> {
  try {
    console.log(`Finding process on port ${port}...`)

    const pids = execSync(`lsof -ti :${port}`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()

    if (pids) {
      const pidList = pids.replace(/\n/g, ', ')
      console.log(`Terminating process(es) ${pidList} on port ${port}...`)

      try {
        execSync(`kill -15 ${pids.replace(/\n/g, ' ')}`, {
          stdio: 'ignore',
        })
        await new Promise((resolve) => setTimeout(resolve, 500))
      } catch {
        execSync(`kill -9 ${pids.replace(/\n/g, ' ')}`, {
          stdio: 'ignore',
        })
      }

      console.log(`Terminated process on port ${port}`)
    }
  } catch {
    console.log(`No process found on port ${port}`)
  }

  console.log('Waiting 1 second for port to be released...')
  await new Promise((resolve) => setTimeout(resolve, 1000))
}

/**
 * Test helper that provides an isolated browser context for each test.
 *
 * Lifecycle:
 * - First test: Starts BrowserOS (10-15s)
 * - Subsequent tests: Reuses existing browser (fast)
 * - After suite exits: BrowserOS stays running (ready for next run)
 *
 * Cleanup:
 * - Run `bun run test:cleanup` when you need to kill BrowserOS
 */
export async function withBrowser(
  cb: (response: McpResponse, context: McpContext) => Promise<void>,
  _options: { debug?: boolean } = {}
): Promise<void> {
  return await browserMutex.runExclusive(async () => {
    const { cdpPort } = await ensureBrowserOS()

    if (!cachedBrowser || !cachedBrowser.connected) {
      cachedBrowser = await puppeteer.connect({
        browserURL: `http://127.0.0.1:${cdpPort}`,
      })
    }

    // Close all existing pages first
    const existingPages = await cachedBrowser.pages()
    for (const page of existingPages) {
      try {
        if (!page.isClosed()) {
          await page.close()
        }
      } catch {
        // Ignore errors when closing pages that are already closed
      }
    }

    // Create a fresh new page
    await cachedBrowser.newPage()

    const response = new McpResponse()
    const context = await McpContext.from(cachedBrowser, logger)

    await cb(response, context)
  })
}

export function getMockRequest(
  options: {
    method?: string
    response?: HTTPResponse
    failure?: HTTPRequest['failure']
    resourceType?: string
    hasPostData?: boolean
    postData?: string
    fetchPostData?: Promise<string>
  } = {}
): HTTPRequest {
  return {
    url() {
      return 'http://example.com'
    },
    method() {
      return options.method ?? 'GET'
    },
    fetchPostData() {
      return options.fetchPostData ?? Promise.reject()
    },
    hasPostData() {
      return options.hasPostData ?? false
    },
    postData() {
      return options.postData
    },
    response() {
      return options.response ?? null
    },
    failure() {
      return options.failure?.() ?? null
    },
    resourceType() {
      return options.resourceType ?? 'document'
    },
    headers(): Record<string, string> {
      return {
        'content-size': '10',
      }
    },
    redirectChain(): HTTPRequest[] {
      return []
    },
  } as HTTPRequest
}

export function getMockResponse(
  options: {
    status?: number
  } = {}
): HTTPResponse {
  return {
    status() {
      return options.status ?? 200
    },
  } as HTTPResponse
}

export function html(
  strings: TemplateStringsArray,
  ...values: unknown[]
): string {
  const bodyContent = strings.reduce((acc, str, i) => {
    return acc + str + (values[i] || '')
  }, '')

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My test page</title>
  </head>
  <body>
    ${bodyContent}
  </body>
</html>`
}

const mcpMutex = new Mutex()

/**
 * Test helper that provides an MCP client connected to the BrowserOS server.
 *
 * Lifecycle:
 * - First test: Starts BrowserOS + Server (~15-20s)
 * - Subsequent tests: Reuses existing server (fast)
 * - After suite exits: Server stays running (ready for next run)
 *
 * Cleanup:
 * - Run `bun run test:cleanup` when you need to kill server
 */
export async function withMcpServer(
  cb: (client: Client) => Promise<void>
): Promise<void> {
  return await mcpMutex.runExclusive(async () => {
    const config = await ensureServer()

    const client = new Client({
      name: 'browseros-test-client',
      version: '1.0.0',
    })

    const serverUrl = new URL(`http://127.0.0.1:${config.httpMcpPort}/mcp`)
    const transport = new StreamableHTTPClientTransport(serverUrl)

    try {
      await client.connect(transport)
      await cb(client)
    } finally {
      await transport.close()
    }
  })
}

export interface McpContentItem {
  type: 'text' | 'image'
  text?: string
  data?: string
  mimeType?: string
}

export interface TypedCallToolResult {
  content: McpContentItem[]
  isError?: boolean
}

export function asToolResult(result: CallToolResult): TypedCallToolResult {
  return result as unknown as TypedCallToolResult
}

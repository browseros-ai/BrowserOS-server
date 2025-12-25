/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { describe, it } from 'bun:test'
import assert from 'node:assert'

import { withMcpServer } from '../../__helpers__/utils.js'

describe('MCP Console Tools', () => {
  it('tests that list_console_messages returns console data', async () => {
    await withMcpServer(async (client) => {
      const result = await client.callTool({
        name: 'list_console_messages',
        arguments: {},
      })

      assert.ok(result.content, 'Should return content')
      assert.ok(!result.isError, 'Should not error')
    })
  }, 30000)
})

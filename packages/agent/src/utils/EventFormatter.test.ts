/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { describe, it, expect, vi } from 'vitest'
import { EventFormatter, FormattedEvent } from './EventFormatter.js'

describe('EventFormatter-unit-test', () => {
  // Unit Test 1 - System event formatting
  it('tests that system init events format correctly', () => {
    const event = {
      type: 'system',
      subtype: 'init',
      mcp_servers: [{ name: 'chrome-devtools' }],
      tools: [{ name: 'tool1' }, { name: 'tool2' }]
    }

    const result = EventFormatter.format(event)

    // Verify method returns FormattedEvent
    expect(result).toBeInstanceOf(FormattedEvent)
    expect(result?.type).toBe('init')
    expect(result?.content).toContain('chrome-devtools')
    expect(result?.content).toContain('2 tools')
  })

  // Unit Test 2 - Tool use formatting with method calls
  it('tests that tool use events format and call helper methods', () => {
    const event = {
      type: 'assistant',
      message: {
        content: [
          {
            type: 'tool_use',
            name: 'mcp__chrome-devtools__navigate_page',
            input: { url: 'https://example.com' }
          }
        ]
      }
    }

    // Spy on private methods to verify they're called
    const cleanToolNameSpy = vi.spyOn(EventFormatter as any, 'cleanToolName')
    const formatToolArgsSpy = vi.spyOn(EventFormatter as any, 'formatToolArgs')

    const result = EventFormatter.format(event)

    // Verify private methods were called
    expect(cleanToolNameSpy).toHaveBeenCalledWith('mcp__chrome-devtools__navigate_page')
    expect(formatToolArgsSpy).toHaveBeenCalledWith({ url: 'https://example.com' })

    // Verify result structure
    expect(result).toBeInstanceOf(FormattedEvent)
    expect(result?.type).toBe('tool_use')
    expect(result?.content).toContain('Navigate Page')
    expect(result?.content).toContain('https://example.com')

    // Cleanup
    cleanToolNameSpy.mockRestore()
    formatToolArgsSpy.mockRestore()
  })

  // Unit Test 3 - Result event with error handling
  it('tests that different result event subtypes handle correctly', () => {
    // Test error_max_turns
    const errorEvent = {
      type: 'result',
      subtype: 'error_max_turns',
      is_error: true,
      num_turns: 100
    }

    const errorResult = EventFormatter.format(errorEvent)
    expect(errorResult?.type).toBe('error')
    expect(errorResult?.content).toContain('Max turns')
    expect(errorResult?.metadata?.turnCount).toBe(100)

    // Test success
    const successEvent = {
      type: 'result',
      subtype: 'success',
      is_error: false,
      num_turns: 5,
      result: 'Task completed successfully'
    }

    const successResult = EventFormatter.format(successEvent)
    expect(successResult?.type).toBe('completion')
    expect(successResult?.content).toContain('completed successfully')
    expect(successResult?.metadata?.isError).toBe(false)
  })

  // Unit Test 4 - Tool name cleaning verification
  it('tests that tool names clean and format correctly', () => {
    // Access private method to test it directly
    const cleanToolName = (EventFormatter as any).cleanToolName

    expect(cleanToolName('mcp__chrome-devtools__navigate_page')).toBe('Navigate Page')
    expect(cleanToolName('take_screenshot')).toBe('Take Screenshot')
    expect(cleanToolName('simple_tool')).toBe('Simple Tool')
  })
})

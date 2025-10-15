/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Logger } from './Logger.js'

describe('Logger-unit-test', () => {
  let consoleLogSpy: any
  let consoleWarnSpy: any
  let consoleErrorSpy: any

  beforeEach(() => {
    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    // Restore console methods
    consoleLogSpy.mockRestore()
    consoleWarnSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  // Unit Test 1 - Singleton instance verification
  it('tests that same singleton instance returns', () => {
    const instance1 = Logger.getInstance()
    const instance2 = Logger.getInstance()

    // Verify same instance is returned
    expect(instance1).toBe(instance2)
    expect(instance1).toBeInstanceOf(Logger)
  })

  // Unit Test 2 - Info logging calls console.log
  it('tests that console.log calls for info messages', () => {
    Logger.info('Test message')

    // Verify console.log was called
    expect(consoleLogSpy).toHaveBeenCalledTimes(1)

    // Verify message format
    const loggedMessage = consoleLogSpy.mock.calls[0][0]
    expect(loggedMessage).toContain('[INFO]')
    expect(loggedMessage).toContain('Test message')
  })

  // Unit Test 3 - Different log levels call correct console methods
  it('tests that log levels route to correct console methods', () => {
    Logger.error('Error message')
    Logger.warn('Warning message')
    Logger.debug('Debug message')

    // Verify correct console methods were called
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1)
    expect(consoleLogSpy).toHaveBeenCalledTimes(1) // debug uses console.log

    // Verify message content
    expect(consoleErrorSpy.mock.calls[0][0]).toContain('[ERROR]')
    expect(consoleWarnSpy.mock.calls[0][0]).toContain('[WARN]')
    expect(consoleLogSpy.mock.calls[0][0]).toContain('[DEBUG]')
  })

  // Unit Test 4 - Metadata formatting
  it('tests that metadata formats as JSON in log output', () => {
    const metadata = { sessionId: 'test-123', count: 42 }
    Logger.info('Test with metadata', metadata)

    // Verify metadata is included
    const loggedMessage = consoleLogSpy.mock.calls[0][0]
    expect(loggedMessage).toContain('Test with metadata')
    expect(loggedMessage).toContain(JSON.stringify(metadata))
  })

  // Unit Test 5 - Message format structure
  it('tests that messages format with timestamp and level', () => {
    Logger.info('Formatted message')

    const loggedMessage = consoleLogSpy.mock.calls[0][0]

    // Verify format contains required components
    expect(loggedMessage).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/) // ISO timestamp
    expect(loggedMessage).toContain('[INFO]')
    expect(loggedMessage).toContain('Formatted message')
  })
})

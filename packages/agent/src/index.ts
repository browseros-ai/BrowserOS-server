#!/usr/bin/env bun

/**
 * @license
 * Copyright 2025 BrowserOS
 */

// Public API exports for integration with main server
export { createServer as createAgentServer } from './websocket/server.js'
export { ServerConfigSchema as AgentServerConfigSchema } from './websocket/server.js'
export type { ServerConfig as AgentServerConfig } from './websocket/server.js'
export type { WebSocketManager } from '@browseros/controller-server'

import { createServer, ServerConfigSchema, type ServerConfig } from './websocket/server.js'
import { WebSocketManager } from '@browseros/controller-server'
import { Logger } from './utils/Logger.js'

/**
 * Utility function to start agent server in standalone mode
 * Creates its own WebSocketManager for extension connection
 *
 * @returns Server instance and cleanup function
 */
export async function startStandaloneAgentServer() {
  Logger.info('🚀 BrowserOS Agent Server - Standalone Mode')
  Logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // Load configuration from environment
  const rawConfig = {
    port: parseInt(process.env.AGENT_PORT || '3000'),
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    cwd: process.cwd(),
    maxSessions: parseInt(process.env.MAX_SESSIONS || '5'),
    idleTimeoutMs: parseInt(process.env.SESSION_IDLE_TIMEOUT_MS || '90000'), // 1.5 minutes default (after agent completion)
    eventGapTimeoutMs: parseInt(process.env.EVENT_GAP_TIMEOUT_MS || '60000') // 1 minute default (between events)
  }

  // Validate configuration with Zod
  const result = ServerConfigSchema.safeParse(rawConfig)

  if (!result.success) {
    Logger.error('❌ Invalid server configuration:')
    result.error.issues.forEach((err) => {
      Logger.error(`   ${err.path.join('.')}: ${err.message}`)
    })
    process.exit(1)
  }

  const config = result.data

  Logger.info('✅ Configuration loaded', {
    port: config.port,
    cwd: config.cwd,
    maxSessions: config.maxSessions,
    idleTimeoutMs: config.idleTimeoutMs,
    eventGapTimeoutMs: config.eventGapTimeoutMs
  })

  // Create WebSocketManager for standalone mode
  const controllerPort = parseInt(process.env.WS_PORT || '9224')
  Logger.info('🔧 Creating WebSocketManager for extension connection', { port: controllerPort })
  const wsManager = new WebSocketManager(controllerPort, (msg) => Logger.debug(msg))

  // Create and start agent server
  const server = createServer(config, wsManager)

  Logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  Logger.info('✅ Server is ready to accept connections')

  // Return server instance and cleanup function
  return {
    server,
    wsManager,
    async shutdown() {
      Logger.info('🛑 Shutting down server...')
      server.stop()
      Logger.info('🔌 Closing WebSocketManager...')
      await wsManager.close()
      Logger.info('✅ Server stopped')
    }
  }
}

/**
 * Main entry point for BrowserOS Agent Server (Standalone mode)
 * Only runs when this file is executed directly
 *
 * NOTE: For production, use the unified server in @browseros/server
 * This standalone mode is for development and testing only
 */
async function main() {
  const { shutdown } = await startStandaloneAgentServer()

  // Register signal handlers
  process.on('SIGINT', async () => {
    await shutdown()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    await shutdown()
    process.exit(0)
  })

  // Error handlers
  process.on('uncaughtException', (error) => {
    Logger.error('❌ Uncaught exception', {
      error: error.message,
      stack: error.stack
    })
    process.exit(1)
  })

  process.on('unhandledRejection', (reason, promise) => {
    Logger.error('❌ Unhandled rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
      promise: promise.toString()
    })
  })

  Logger.info('   Press Ctrl+C to stop')
}

// Only run main() if this file is executed directly (not imported)
// In Bun/Node ESM, check if this is the main module
if (import.meta.main) {
  // Run the server
  main().catch((error) => {
    Logger.error('❌ Fatal error during startup', {
      error: error.message,
      stack: error.stack
    })
    process.exit(1)
  })
}

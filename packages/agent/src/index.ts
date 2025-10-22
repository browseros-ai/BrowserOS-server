#!/usr/bin/env bun

/**
 * @license
 * Copyright 2025 BrowserOS
 */

// Public API exports for integration with main server
export { createServer as createAgentServer } from './websocket/server.js'
export { ServerConfigSchema as AgentServerConfigSchema } from './websocket/server.js'
export type { ServerConfig as AgentServerConfig } from './websocket/server.js'
export type { ControllerBridge } from '@browseros/controller-server'

import { createServer, ServerConfigSchema, type ServerConfig } from './websocket/server.js'
import { ControllerBridge } from '@browseros/controller-server'
import { logger } from '@browseros/common'

/**
 * Utility function to start agent server in standalone mode
 * Creates its own ControllerBridge for extension connection
 *
 * @returns Server instance and cleanup function
 */
export async function startStandaloneAgentServer() {
  logger.info('🚀 BrowserOS Agent Server - Standalone Mode')
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

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
    logger.error('❌ Invalid server configuration:')
    result.error.issues.forEach((err) => {
      logger.error(`   ${err.path.join('.')}: ${err.message}`)
    })
    process.exit(1)
  }

  const config = result.data

  logger.info('✅ Configuration loaded', {
    port: config.port,
    cwd: config.cwd,
    maxSessions: config.maxSessions,
    idleTimeoutMs: config.idleTimeoutMs,
    eventGapTimeoutMs: config.eventGapTimeoutMs
  })

  // Create ControllerBridge for standalone mode
  const controllerPort = parseInt(process.env.WS_PORT || '9224')
  logger.info('🔧 Creating ControllerBridge for extension connection', { port: controllerPort })
  const controllerBridge = new ControllerBridge(controllerPort, logger)

  // Create and start agent server
  const server = createServer(config, controllerBridge)

  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  logger.info('✅ Server is ready to accept connections')

  // Return server instance and cleanup function
  return {
    server,
    controllerBridge,
    async shutdown() {
      logger.info('🛑 Shutting down server...')
      server.stop()
      logger.info('🔌 Closing ControllerBridge...')
      await controllerBridge.close()
      logger.info('✅ Server stopped')
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
    logger.error('❌ Uncaught exception', {
      error: error.message,
      stack: error.stack
    })
    process.exit(1)
  })

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('❌ Unhandled rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
      promise: promise.toString()
    })
  })

  logger.info('   Press Ctrl+C to stop')
}

// Only run main() if this file is executed directly (not imported)
// In Bun/Node ESM, check if this is the main module
if (import.meta.main) {
  // Run the server
  main().catch((error) => {
    logger.error('❌ Fatal error during startup', {
      error: error.message,
      stack: error.stack
    })
    process.exit(1)
  })
}

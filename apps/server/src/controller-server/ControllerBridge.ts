/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { TIMEOUTS } from '@browseros/shared/timeouts'
import type { WebSocket } from 'ws'
import { WebSocketServer } from 'ws'
import type { Logger } from '../common/index.js'
import { Sentry } from '../common/sentry/instrument.js'

interface ControllerRequest {
  id: string
  action: string
  payload: unknown
}

interface ControllerResponse {
  id: string
  ok: boolean
  data?: unknown
  error?: string
}

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
}

export class ControllerBridge {
  private wss: WebSocketServer
  private clients = new Map<string, WebSocket>()
  private primaryClientId: string | null = null
  private requestCounter = 0
  private pendingRequests = new Map<string, PendingRequest>()
  private logger: Logger
  // Window ownership: maps windowId to clientId for multi-profile routing
  private windowOwnership = new Map<number, string>()

  constructor(port: number, logger: Logger) {
    this.logger = logger

    this.wss = new WebSocketServer({
      port,
      host: '127.0.0.1',
    })

    this.wss.on('listening', () => {
      this.logger.info(`WebSocket server listening on ws://127.0.0.1:${port}`)
    })

    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = this.registerClient(ws)
      this.logger.info('Extension connected', { clientId })

      ws.on('message', (data: Buffer) => {
        try {
          const message = data.toString()
          const parsed = JSON.parse(message)

          // Handle ping/pong for heartbeat
          if (parsed.type === 'ping') {
            this.logger.debug('Received ping, sending pong', { clientId })
            ws.send(JSON.stringify({ type: 'pong' }))
            return
          }
          if (parsed.type === 'focused') {
            this.handleFocusEvent(clientId, parsed.windowId)
            return
          }
          // Handle window registration messages
          if (parsed.type === 'register_windows') {
            this.handleRegisterWindows(clientId, parsed.windowIds)
            return
          }
          if (parsed.type === 'window_created') {
            this.handleWindowCreated(clientId, parsed.windowId)
            return
          }
          if (parsed.type === 'window_removed') {
            this.handleWindowRemoved(clientId, parsed.windowId)
            return
          }

          this.logger.debug('Received message from controller client', {
            clientId,
            message,
          })
          const response = parsed as ControllerResponse
          this.handleResponse(response)
        } catch (error) {
          this.logger.error(`Error parsing message from ${clientId}: ${error}`)
        }
      })

      ws.on('close', () => {
        this.logger.info('Extension disconnected', { clientId })
        this.handleClientDisconnect(clientId)
      })

      ws.on('error', (error: Error) => {
        this.logger.error(`WebSocket error for ${clientId}: ${error.message}`)
      })
    })

    this.wss.on('error', (error: Error) => {
      Sentry.captureException(error)
      this.logger.error(`WebSocket server error: ${error.message}`)
    })
  }

  isConnected(): boolean {
    return this.primaryClientId !== null
  }

  async sendRequest(
    action: string,
    payload: unknown,
    timeoutMs: number = TIMEOUTS.CONTROLLER_BRIDGE,
  ): Promise<unknown> {
    if (!this.isConnected()) {
      throw new Error('BrowserOS helper service not connected')
    }

    // Route by windowId if available, otherwise use primary client
    const payloadObj = payload as Record<string, unknown> | null
    const windowId = payloadObj?.windowId as number | undefined

    let targetClientId = this.primaryClientId
    if (windowId !== undefined) {
      const ownerClientId = this.windowOwnership.get(windowId)
      if (ownerClientId && this.clients.has(ownerClientId)) {
        targetClientId = ownerClientId
        this.logger.debug('Routing request by windowId', {
          windowId,
          targetClientId,
        })
      } else {
        this.logger.warn('No owner found for windowId, using primary', {
          windowId,
          primaryClientId: this.primaryClientId,
        })
      }
    }

    const client = targetClientId ? this.clients.get(targetClientId) : null
    if (!client) {
      throw new Error('BrowserOS helper service not connected')
    }

    const id = `${Date.now()}-${++this.requestCounter}`

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`Request ${action} timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      this.pendingRequests.set(id, { resolve, reject, timeout })

      const request: ControllerRequest = { id, action, payload }
      try {
        const message = JSON.stringify(request)
        this.logger.debug(`Sending request to ${targetClientId}: ${message}`)
        client.send(message)
      } catch (error) {
        clearTimeout(timeout)
        this.pendingRequests.delete(id)
        reject(error)
      }
    })
  }

  private handleResponse(response: ControllerResponse): void {
    const pending = this.pendingRequests.get(response.id)

    if (!pending) {
      this.logger.warn(
        `Received response for unknown request ID: ${response.id}`,
      )
      return
    }

    clearTimeout(pending.timeout)
    this.pendingRequests.delete(response.id)

    if (response.ok) {
      pending.resolve(response.data)
    } else {
      pending.reject(new Error(response.error || 'Unknown error'))
    }
  }

  async close(): Promise<void> {
    return new Promise((resolve) => {
      for (const [id, pending] of this.pendingRequests.entries()) {
        clearTimeout(pending.timeout)
        pending.reject(new Error('ControllerBridge closing'))
        this.pendingRequests.delete(id)
      }

      for (const ws of this.clients.values()) {
        try {
          ws.close()
        } catch {
          // ignore
        }
      }
      this.clients.clear()
      this.primaryClientId = null

      this.wss.close(() => {
        this.logger.info('WebSocket server closed')
        resolve()
      })
    })
  }

  private registerClient(ws: WebSocket): string {
    const clientId = `client-${Date.now()}-${Math.floor(Math.random() * 1000000)}`
    this.clients.set(clientId, ws)

    if (!this.primaryClientId) {
      this.primaryClientId = clientId
      this.logger.info('Primary controller assigned', { clientId })
    } else {
      this.logger.info('Controller connected in standby mode', {
        clientId,
        primaryClientId: this.primaryClientId,
      })
    }

    return clientId
  }

  private handleClientDisconnect(clientId: string): void {
    const wasPrimary = this.primaryClientId === clientId
    this.clients.delete(clientId)

    // Clean up window ownership for disconnected client
    for (const [windowId, owner] of this.windowOwnership.entries()) {
      if (owner === clientId) {
        this.windowOwnership.delete(windowId)
      }
    }
    this.logger.debug('Cleaned up window ownership for disconnected client', {
      clientId,
    })

    if (wasPrimary) {
      this.primaryClientId = null

      for (const [id, pending] of this.pendingRequests.entries()) {
        clearTimeout(pending.timeout)
        pending.reject(new Error('Primary connection closed'))
        this.pendingRequests.delete(id)
      }

      this.promoteNextPrimary()
    }
  }

  private promoteNextPrimary(): void {
    const nextEntry = this.clients.keys().next()
    if (nextEntry.done) {
      this.logger.warn('No controller connections available to promote')
      return
    }

    this.primaryClientId = nextEntry.value
    this.logger.info('Promoted controller to primary', {
      clientId: this.primaryClientId,
    })
  }

  private handleFocusEvent(clientId: string, windowId?: number): void {
    // Also register window ownership on focus (confirms ownership)
    if (windowId !== undefined) {
      this.windowOwnership.set(windowId, clientId)
    }

    if (this.primaryClientId === clientId) {
      this.logger.debug('Focus event from current primary', {
        clientId,
        windowId,
      })
      return
    }

    const previousPrimary = this.primaryClientId
    this.primaryClientId = clientId
    this.logger.info('Primary controller reassigned due to focus event', {
      clientId,
      previousPrimary,
      windowId,
    })
  }

  private handleRegisterWindows(clientId: string, windowIds: number[]): void {
    if (!Array.isArray(windowIds)) {
      this.logger.warn('Invalid register_windows message', { clientId })
      return
    }

    for (const windowId of windowIds) {
      this.windowOwnership.set(windowId, clientId)
    }

    this.logger.info('Registered windows for client', {
      clientId,
      windowCount: windowIds.length,
      windowIds,
    })
  }

  private handleWindowCreated(clientId: string, windowId: number): void {
    if (typeof windowId !== 'number') {
      this.logger.warn('Invalid window_created message', { clientId, windowId })
      return
    }

    this.windowOwnership.set(windowId, clientId)
    this.logger.debug('Window created and registered', { clientId, windowId })
  }

  private handleWindowRemoved(clientId: string, windowId: number): void {
    if (typeof windowId !== 'number') {
      this.logger.warn('Invalid window_removed message', { clientId, windowId })
      return
    }

    // Only remove if this client owns the window
    if (this.windowOwnership.get(windowId) === clientId) {
      this.windowOwnership.delete(windowId)
      this.logger.debug('Window removed from registry', { clientId, windowId })
    }
  }
}

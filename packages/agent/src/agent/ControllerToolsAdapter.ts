/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'
import type { ToolDefinition } from '@browseros/tools'
import { ControllerResponse } from '@browseros/tools/controller-definitions'
import type { Context } from '@browseros/tools/controller-definitions'
import { Logger } from '../utils/Logger.js'

/**
 * Convert a controller tool to Claude SDK MCP tool format
 */
function adaptControllerTool(
  toolDef: ToolDefinition<any, Context, ControllerResponse>,
  context: Context
) {
  return tool(
    toolDef.name,
    toolDef.description,
    toolDef.schema,
    async (args, _extra) => {
      Logger.debug(`🔧 Executing controller tool: ${toolDef.name}`, { args })

      try {
        // Create request and response objects
        const request = { params: args }
        const response = new ControllerResponse()

        // Execute the tool handler
        await toolDef.handler(request, response, context)

        // Convert response to CallToolResult format
        const content = response.toContent()

        return { content }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        Logger.error(`❌ Controller tool ${toolDef.name} failed`, { error: errorMsg })

        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${errorMsg}`
          }],
          isError: true
        }
      }
    }
  )
}

/**
 * Create an in-process SDK MCP server with all controller tools
 *
 * @param tools - Array of controller tool definitions
 * @param context - Controller context for executing actions
 * @returns SDK MCP server configuration
 */
export function createControllerMcpServer(
  tools: ToolDefinition<any, Context, ControllerResponse>[],
  context: Context
) {
  // Adapt all controller tools to SDK format
  const sdkTools = tools.map(tool => adaptControllerTool(tool, context))

  Logger.info(`🔧 Creating SDK MCP server with ${sdkTools.length} controller tools`)

  // Create and return the SDK MCP server
  return createSdkMcpServer({
    name: 'browseros-controller',
    version: '1.0.0',
    tools: sdkTools
  })
}

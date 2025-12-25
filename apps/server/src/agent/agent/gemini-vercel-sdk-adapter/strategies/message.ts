/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Message Conversion Strategy
 * Converts conversation history from Gemini to Vercel format
 */

import type {
  JSONValue,
  LanguageModelV2ToolResultOutput,
} from '@ai-sdk/provider'
import type { Content, ContentUnion } from '@google/genai'
import type { CoreMessage } from 'ai'

import type { ProviderAdapter } from '../adapters/index.js'
import type {
  FunctionCallWithMetadata,
  ProviderMetadata,
} from '../adapters/types.js'
import type { VercelContentPart } from '../types.js'
import {
  isFunctionCallPart,
  isFunctionResponsePart,
  isInlineDataPart,
  isTextPart,
} from '../utils/type-guards.js'

export class MessageConversionStrategy {
  constructor(private adapter: ProviderAdapter) {}

  /**
   * Convert Gemini conversation history to Vercel messages
   *
   * @param contents - Array of Gemini Content objects
   * @returns Array of Vercel CoreMessage objects
   */
  geminiToVercel(contents: readonly Content[]): CoreMessage[] {
    const messages: CoreMessage[] = []
    const seenToolResultIds = new Set<string>()

    // PHASE 1: Build tool call/result pairs with synchronized IDs
    // This ensures that even when IDs are missing, we generate consistent IDs for pairs
    const { pairedToolCallIds, pairedToolResultIds, idMapping } =
      this.buildToolPairs(contents)

    // Track global indices to match special keys used in buildToolPairs for empty IDs
    let globalCallIndex = 0
    let globalResultIndex = 0

    for (const content of contents) {
      const role = content.role === 'model' ? 'assistant' : 'user'

      // Separate parts by type
      const textParts: string[] = []
      const functionCalls: FunctionCallWithMetadata[] = []
      const functionResponses: Array<{
        id?: string
        name?: string
        response?: Record<string, unknown>
      }> = []
      const imageParts: Array<{
        mimeType: string
        data: string
      }> = []

      for (const part of content.parts || []) {
        if (isTextPart(part)) {
          textParts.push(part.text)
        } else if (isFunctionCallPart(part)) {
          // Extract provider metadata from part (attached by ResponseConversionStrategy)
          const partWithMetadata = part as typeof part & {
            providerMetadata?: ProviderMetadata
          }
          functionCalls.push({
            ...part.functionCall,
            providerMetadata: partWithMetadata.providerMetadata,
          })
        } else if (isFunctionResponsePart(part)) {
          functionResponses.push(part.functionResponse)
        } else if (isInlineDataPart(part)) {
          imageParts.push(part.inlineData)
        }
      }

      const textContent = textParts.join('\n')

      // CASE 1: Simple text message (possibly with images)
      if (functionCalls.length === 0 && functionResponses.length === 0) {
        if (imageParts.length > 0) {
          // Multi-part message with text and images

          const contentParts: VercelContentPart[] = []

          if (textContent) {
            contentParts.push({
              type: 'text',
              text: textContent,
            })
          }

          for (const img of imageParts) {
            contentParts.push({
              type: 'image',
              image: img.data, // Pass raw base64 string
              mediaType: img.mimeType,
            })
          }

          messages.push({
            role: role as 'user' | 'assistant',
            content: contentParts,
          } as CoreMessage)
        } else if (textContent) {
          messages.push({
            role: role as 'user' | 'assistant',
            content: textContent,
          })
        }
        continue
      }

      // CASE 2: Tool results (user providing tool execution results)
      if (functionResponses.length > 0) {
        // Filter out duplicate tool results AND orphaned tool results (no matching tool_use)
        // We need to track indices for empty ID lookup, so use explicit loop
        const uniqueResponses: Array<{
          id?: string
          name?: string
          response?: Record<string, unknown>
          lookupKey: string
        }> = []

        for (const fr of functionResponses) {
          const originalId = fr.id || ''
          // For empty IDs, use the special key format that buildToolPairs uses
          const lookupKey = originalId || `__empty_result_${globalResultIndex}`
          globalResultIndex++

          const synchronizedId = idMapping.get(lookupKey) || originalId

          // Skip duplicates
          if (synchronizedId && seenToolResultIds.has(synchronizedId)) {
            continue
          }
          // Skip orphaned tool results (no matching tool_use in paired set)
          // This prevents: "unexpected tool_use_id found in tool_result blocks"
          if (!pairedToolResultIds.has(lookupKey)) {
            continue
          }
          if (synchronizedId) {
            seenToolResultIds.add(synchronizedId)
          }
          uniqueResponses.push({ ...fr, lookupKey })
        }

        // If all tool results were duplicates, skip this message entirely
        if (uniqueResponses.length === 0) {
          continue
        }

        // If there are NO images → standard tool message
        if (imageParts.length === 0) {
          const toolResultParts = this.convertFunctionResponsesToToolResults(
            uniqueResponses,
            idMapping,
          )
          messages.push({
            role: 'tool',
            content: toolResultParts,
          } as unknown as CoreMessage)
          continue
        }

        // If there ARE images → create TWO messages:
        // 1. Tool message (satisfies OpenAI requirement that tool_calls must be followed by tool messages)
        // 2. User message with images (tool messages don't support images)

        // Message 1: Tool message with tool results (no images)
        const toolResultParts = this.convertFunctionResponsesToToolResults(
          uniqueResponses,
          idMapping,
        )
        messages.push({
          role: 'tool',
          content: toolResultParts,
        } as unknown as CoreMessage)

        // Message 2: User message with images
        const userContentParts: VercelContentPart[] = []

        // Add explanatory text
        userContentParts.push({
          type: 'text',
          text: `Here are the screenshots from the tool execution:`,
        })

        // Add images as raw base64 string (will be converted to data URL by OpenAI provider)
        for (const img of imageParts) {
          userContentParts.push({
            type: 'image',
            image: img.data,
            mediaType: img.mimeType,
          })
        }

        messages.push({
          role: 'user',
          content: userContentParts,
        } as CoreMessage)
        continue
      }

      // CASE 3: Assistant with tool calls
      if (role === 'assistant' && functionCalls.length > 0) {
        const contentParts: VercelContentPart[] = []

        // Add text if present
        if (textContent) {
          contentParts.push({
            type: 'text' as const,
            text: textContent,
          })
        }

        // Add tool calls - but ONLY if they have matching tool results
        // This prevents Anthropic error: "tool_use ids were found without tool_result blocks"
        let isFirst = true
        for (const fc of functionCalls) {
          const originalId = fc.id || ''
          // For empty IDs, use the special key format that buildToolPairs uses
          const lookupKey = originalId || `__empty_call_${globalCallIndex}`
          globalCallIndex++

          // Skip orphaned tool calls (no matching tool result in paired set)
          if (!pairedToolCallIds.has(lookupKey)) {
            continue
          }

          // Use synchronized ID from pairing - this ensures tool_call and tool_result have SAME ID
          const toolCallId =
            idMapping.get(lookupKey) || originalId || this.generateToolCallId()

          const toolCallPart: Record<string, unknown> = {
            type: 'tool-call' as const,
            toolCallId,
            toolName: fc.name || 'unknown',
            input: fc.args || {},
          }

          // Let adapter extract provider options from stored metadata
          if (isFirst) {
            const providerOptions = this.adapter.getToolCallProviderOptions(fc)
            if (providerOptions) {
              toolCallPart.providerOptions = providerOptions
            }
            isFirst = false
          }

          contentParts.push(toolCallPart as unknown as VercelContentPart)
        }

        // Only add the message if there's content (text or valid tool calls)
        if (contentParts.length > 0) {
          const message = {
            role: 'assistant' as const,
            content: contentParts,
          }

          messages.push(message as CoreMessage)
        }
      }
    }

    // CRITICAL: Merge consecutive tool messages to satisfy API requirement
    // The API requires ALL tool_results to be in a single message immediately following
    // the assistant message with tool_uses. If tool_results are split across multiple
    // messages, we get: "unexpected tool_use_id found in tool_result blocks"
    const merged = this.mergeConsecutiveToolMessages(messages)

    // CRITICAL: Validate adjacency - tool_use must be immediately followed by tool_result
    // After compression, pairs may exist but not be adjacent, causing:
    // "Each tool_result block must have a corresponding tool_use block in the previous message"
    return this.validateToolAdjacency(merged)
  }

  /**
   * Convert system instruction to plain text
   *
   * @param instruction - Gemini system instruction (string, Content, or Part)
   * @returns Plain text string or undefined
   */
  convertSystemInstruction(
    instruction: ContentUnion | undefined,
  ): string | undefined {
    if (!instruction) {
      return undefined
    }

    // Handle string input
    if (typeof instruction === 'string') {
      return instruction
    }

    // Handle Content object with parts
    if (typeof instruction === 'object' && 'parts' in instruction) {
      const textParts = (instruction.parts || [])
        .filter(isTextPart)
        .map((p) => p.text)

      return textParts.length > 0 ? textParts.join('\n') : undefined
    }

    return undefined
  }

  /**
   * Convert function responses to tool result parts for AI SDK v5
   * Uses idMapping to ensure tool_result IDs match corresponding tool_call IDs
   */
  private convertFunctionResponsesToToolResults(
    responses: Array<{
      id?: string
      name?: string
      response?: Record<string, unknown>
      lookupKey: string
    }>,
    idMapping: Map<string, string>,
  ): VercelContentPart[] {
    return responses.map((fr) => {
      // Convert Gemini response to AI SDK v5 structured output format
      let output: LanguageModelV2ToolResultOutput
      const response = fr.response || {}

      // Check for error first
      if (
        typeof response === 'object' &&
        'error' in response &&
        response.error
      ) {
        const errorValue = response.error
        output =
          typeof errorValue === 'string'
            ? { type: 'error-text', value: errorValue }
            : { type: 'error-json', value: errorValue as JSONValue }
      } else if (typeof response === 'object' && 'output' in response) {
        // Gemini's explicit output format: {output: value}
        const outputValue = response.output
        output =
          typeof outputValue === 'string'
            ? { type: 'text', value: outputValue }
            : { type: 'json', value: outputValue as JSONValue }
      } else {
        // Whole response is the output
        output =
          typeof response === 'string'
            ? { type: 'text', value: response }
            : { type: 'json', value: response as JSONValue }
      }

      // Use synchronized ID from pairing - this ensures tool_result matches tool_call
      const synchronizedId =
        idMapping.get(fr.lookupKey) || fr.id || this.generateToolCallId()

      return {
        type: 'tool-result' as const,
        toolCallId: synchronizedId,
        toolName: fr.name || 'unknown',
        output: output,
      }
    })
  }

  /**
   * Generate unique tool call ID
   */
  private generateToolCallId(): string {
    return `call_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  }

  /**
   * Build tool call/result pairs with synchronized IDs
   *
   * This method solves the root cause of "unexpected tool_use_id" errors:
   * When IDs are missing or inconsistent, we need to:
   * 1. Match tool calls with their corresponding results (by ID, name, or position)
   * 2. Generate a single synchronized ID for pairs where IDs are missing
   * 3. Track which IDs are valid (have both call and result)
   *
   * @returns pairedToolCallIds - Set of original tool call IDs that have matching results
   * @returns pairedToolResultIds - Set of original tool result IDs that have matching calls
   * @returns idMapping - Map from original ID to synchronized ID (for ID generation/consistency)
   */
  private buildToolPairs(contents: readonly Content[]): {
    pairedToolCallIds: Set<string>
    pairedToolResultIds: Set<string>
    idMapping: Map<string, string>
  } {
    // Collect all tool calls and results with their metadata
    const toolCalls: Array<{
      id: string
      name: string
      index: number
      contentIndex: number
    }> = []
    const toolResults: Array<{
      id: string
      name: string
      index: number
      contentIndex: number
    }> = []

    let globalCallIndex = 0
    let globalResultIndex = 0

    for (let contentIndex = 0; contentIndex < contents.length; contentIndex++) {
      const content = contents[contentIndex]
      for (const part of content.parts || []) {
        if (isFunctionCallPart(part)) {
          toolCalls.push({
            id: part.functionCall?.id || '',
            name: part.functionCall?.name || '',
            index: globalCallIndex++,
            contentIndex,
          })
        }
        if (isFunctionResponsePart(part)) {
          toolResults.push({
            id: part.functionResponse?.id || '',
            name: part.functionResponse?.name || '',
            index: globalResultIndex++,
            contentIndex,
          })
        }
      }
    }

    const pairedToolCallIds = new Set<string>()
    const pairedToolResultIds = new Set<string>()
    const idMapping = new Map<string, string>()
    const usedResultIndices = new Set<number>()

    // PHASE 1: Match by exact ID (when both have IDs that match)
    for (const call of toolCalls) {
      if (!call.id) continue

      const matchingResult = toolResults.find(
        (r) => r.id === call.id && !usedResultIndices.has(r.index),
      )

      if (matchingResult) {
        pairedToolCallIds.add(call.id)
        pairedToolResultIds.add(matchingResult.id)
        usedResultIndices.add(matchingResult.index)
        // ID is already synchronized (same value)
        idMapping.set(call.id, call.id)
        idMapping.set(matchingResult.id, call.id)
      }
    }

    // PHASE 2: Match by name for calls/results without IDs or unmatched IDs
    for (const call of toolCalls) {
      // Skip if already paired
      if (call.id && pairedToolCallIds.has(call.id)) continue

      // Find a result with same name that hasn't been used
      const matchingResult = toolResults.find(
        (r) =>
          r.name === call.name &&
          !usedResultIndices.has(r.index) &&
          r.contentIndex > call.contentIndex, // Result must come after call
      )

      if (matchingResult) {
        // Generate a synchronized ID for this pair
        const syncId = call.id || matchingResult.id || this.generateToolCallId()

        if (call.id) {
          pairedToolCallIds.add(call.id)
          idMapping.set(call.id, syncId)
        }
        if (matchingResult.id) {
          pairedToolResultIds.add(matchingResult.id)
          idMapping.set(matchingResult.id, syncId)
        }

        // For empty IDs, we use empty string as key with unique suffix
        if (!call.id) {
          const emptyCallKey = `__empty_call_${call.index}`
          pairedToolCallIds.add(emptyCallKey)
          idMapping.set(emptyCallKey, syncId)
        }
        if (!matchingResult.id) {
          const emptyResultKey = `__empty_result_${matchingResult.index}`
          pairedToolResultIds.add(emptyResultKey)
          idMapping.set(emptyResultKey, syncId)
        }

        usedResultIndices.add(matchingResult.index)
      }
    }

    // PHASE 3: REMOVED - Positional matching is too risky
    // It could incorrectly pair unrelated tools (e.g., call_A with result_B)
    // If a call/result has no ID AND no matching name, it's truly orphaned
    // and should be filtered out rather than incorrectly paired

    return { pairedToolCallIds, pairedToolResultIds, idMapping }
  }

  /**
   * Merge consecutive tool messages into a single tool message
   *
   * The API requires that ALL tool_results must be in a single message immediately
   * following the assistant message with tool_uses. If tool_results are split across
   * multiple consecutive tool messages, the API returns:
   * "unexpected tool_use_id found in tool_result blocks"
   *
   * This method merges consecutive tool messages so all tool_results are grouped together.
   */
  private mergeConsecutiveToolMessages(messages: CoreMessage[]): CoreMessage[] {
    if (messages.length === 0) {
      return messages
    }

    const merged: CoreMessage[] = []
    let currentToolParts: VercelContentPart[] | null = null

    for (const msg of messages) {
      if (msg.role === 'tool') {
        // Accumulate tool message content
        const content = msg.content as VercelContentPart[]
        if (currentToolParts === null) {
          // Start a new tool message accumulator
          currentToolParts = [...content]
        } else {
          // Merge into existing accumulator
          currentToolParts.push(...content)
        }
      } else {
        // Non-tool message - flush any accumulated tool parts first
        if (currentToolParts !== null) {
          merged.push({
            role: 'tool',
            content: currentToolParts,
          } as unknown as CoreMessage)
          currentToolParts = null
        }
        merged.push(msg)
      }
    }

    // Flush any remaining tool parts
    if (currentToolParts !== null) {
      merged.push({
        role: 'tool',
        content: currentToolParts,
      } as unknown as CoreMessage)
    }

    return merged
  }

  /**
   * Validate tool_use/tool_result adjacency and remove non-adjacent pairs
   *
   * Anthropic requires: "Each tool_result block must have a corresponding
   * tool_use block in the previous message."
   *
   * After compression, tool_use and tool_result may exist but not be adjacent.
   * This method removes any:
   * - tool_use that is not immediately followed by a tool message with matching tool_result
   * - tool_result that doesn't have a matching tool_use in the immediately preceding assistant message
   */
  private validateToolAdjacency(messages: CoreMessage[]): CoreMessage[] {
    if (messages.length === 0) {
      return messages
    }

    const result: CoreMessage[] = []

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      const nextMsg = messages[i + 1]
      const prevMsg = i > 0 ? result[result.length - 1] : undefined

      if (msg.role === 'assistant') {
        const content = msg.content

        // Check if this assistant message has tool_call parts
        if (Array.isArray(content)) {
          const toolCallParts = content.filter(
            (p) =>
              typeof p === 'object' &&
              p !== null &&
              (p as { type?: string }).type === 'tool-call',
          )

          if (toolCallParts.length > 0) {
            // Get tool_use IDs from this assistant message
            const _toolUseIds = new Set(
              toolCallParts
                .map((p) => (p as { toolCallId?: string }).toolCallId)
                .filter(Boolean),
            )

            // Get tool_result IDs from the next message (if it's a tool message)
            const nextToolResultIds = new Set<string>()
            if (
              nextMsg &&
              nextMsg.role === 'tool' &&
              Array.isArray(nextMsg.content)
            ) {
              for (const part of nextMsg.content as VercelContentPart[]) {
                if ((part as { type?: string }).type === 'tool-result') {
                  const id = (part as { toolCallId?: string }).toolCallId
                  if (id) nextToolResultIds.add(id)
                }
              }
            }

            // Filter tool_call parts to only those with matching tool_result in next message
            const validToolCalls = toolCallParts.filter((p) => {
              const id = (p as { toolCallId?: string }).toolCallId
              return id && nextToolResultIds.has(id)
            })

            // Keep non-tool-call parts (text, etc.) + valid tool calls
            const nonToolCallParts = content.filter(
              (p) =>
                typeof p === 'object' &&
                p !== null &&
                (p as { type?: string }).type !== 'tool-call',
            )

            const newContent = [...nonToolCallParts, ...validToolCalls]

            // Only add message if there's content left
            if (newContent.length > 0) {
              result.push({
                role: 'assistant',
                content: newContent,
              } as CoreMessage)
            } else if (
              nonToolCallParts.length === 0 &&
              toolCallParts.length > 0 &&
              validToolCalls.length === 0
            ) {
              // All tool_calls were filtered out, skip this message entirely
              continue
            }
            continue
          }
        }

        // No tool_call parts, keep as-is
        result.push(msg)
      } else if (msg.role === 'tool') {
        const content = msg.content as VercelContentPart[]

        // Get tool_use IDs from the previous assistant message
        const prevToolUseIds = new Set<string>()
        if (
          prevMsg &&
          prevMsg.role === 'assistant' &&
          Array.isArray(prevMsg.content)
        ) {
          for (const part of prevMsg.content as VercelContentPart[]) {
            if ((part as { type?: string }).type === 'tool-call') {
              const id = (part as { toolCallId?: string }).toolCallId
              if (id) prevToolUseIds.add(id)
            }
          }
        }

        // Filter tool_result parts to only those with matching tool_use in previous message
        const validToolResults = content.filter((part) => {
          if ((part as { type?: string }).type !== 'tool-result') {
            return true // Keep non-tool-result parts
          }
          const id = (part as { toolCallId?: string }).toolCallId
          return id && prevToolUseIds.has(id)
        })

        // Only add message if there are valid tool results
        if (validToolResults.length > 0) {
          result.push({
            role: 'tool',
            content: validToolResults,
          } as unknown as CoreMessage)
        }
      } else {
        // User or other messages, keep as-is
        result.push(msg)
      }
    }

    return result
  }
}

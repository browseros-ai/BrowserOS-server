/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Tool Conversion Strategy
 * Converts tool definitions and tool calls between Gemini and Vercel formats
 */

import type {
  ToolListUnion,
  FunctionDeclaration,
  FunctionCall,
} from '@google/genai';
import {jsonSchema} from 'ai';

import {ConversionError} from '../errors.js';
import type {VercelTool} from '../types.js';
import {VercelToolCallSchema} from '../types.js';

export class ToolConversionStrategy {
  /**
   * Convert Gemini tool definitions to Vercel format
   *
   * @param tools - Array of Gemini Tool/CallableTool objects
   * @returns Record mapping tool names to Vercel tool definitions
   */
  geminiToVercel(
    tools: ToolListUnion | undefined,
  ): Record<string, VercelTool> | undefined {
    if (!tools || tools.length === 0) {
      return undefined;
    }

    // Extract function declarations from all tools
    // Filter for Tool types (not CallableTool)
    const declarations: FunctionDeclaration[] = [];
    for (const tool of tools) {
      // Check if this is a Tool with functionDeclarations (not CallableTool)
      if ('functionDeclarations' in tool && tool.functionDeclarations) {
        declarations.push(...tool.functionDeclarations);
      }
    }

    if (declarations.length === 0) {
      return undefined;
    }

    const vercelTools: Record<string, VercelTool> = {};

    for (const func of declarations) {
      // Validate required fields
      if (!func.name) {
        throw new ConversionError(
          'Tool definition missing required name field',
          {
            stage: 'tool',
            operation: 'geminiToVercel',
            input: {hasDescription: !!func.description},
          },
        );
      }

      // Get parameters from either parametersJsonSchema (JSON Schema) or parameters (Gemini Schema)
      // Gemini SDK provides both, they are mutually exclusive
      // parametersJsonSchema is typed as 'unknown', need to validate it's an object
      let rawParameters: Record<string, unknown>;

      if (func.parametersJsonSchema !== undefined) {
        // Prefer parametersJsonSchema (standard JSON Schema format)
        if (
          typeof func.parametersJsonSchema === 'object' &&
          func.parametersJsonSchema !== null
        ) {
          rawParameters = func.parametersJsonSchema as Record<string, unknown>;
        } else {
          throw new ConversionError(
            `Tool ${func.name}: parametersJsonSchema must be an object`,
            {
              stage: 'tool',
              operation: 'geminiToVercel',
              input: {parametersJsonSchema: func.parametersJsonSchema},
            },
          );
        }
      } else if (func.parameters !== undefined) {
        // Fallback to parameters (Gemini Schema format)
        rawParameters = func.parameters as unknown as Record<string, unknown>;
      } else {
        // No parameters defined
        rawParameters = {};
      }

      const parametersWithType = {
        type: 'object' as const,
        properties: {},
        ...rawParameters,
      };

      const normalizedParameters = parametersWithType;

      const wrappedParams = jsonSchema(
        normalizedParameters as Parameters<typeof jsonSchema>[0],
      );

      vercelTools[func.name] = {
        description: func.description || '',
        inputSchema: wrappedParams,
      };
    }

    return Object.keys(vercelTools).length > 0 ? vercelTools : undefined;
  }

  /**
   * Convert Vercel tool calls to Gemini function calls
   *
   * @param toolCalls - Array of tool calls from Vercel response
   * @returns Array of Gemini FunctionCall objects
   */
  vercelToGemini(toolCalls: readonly unknown[]): FunctionCall[] {
    if (!toolCalls || toolCalls.length === 0) {
      return [];
    }

    return toolCalls.map((tc, index) => {
      const parsed = VercelToolCallSchema.safeParse(tc);

      if (!parsed.success) {
        return {
          id: `invalid_${index}`,
          name: 'unknown',
          args: {},
        };
      }

      const validated = parsed.data;

      // Convert to Gemini format
      // SDK uses 'input' property matching ToolCallPart interface (AI SDK v5)
      // CRITICAL: FunctionCall.args must be Record<string, unknown>
      // Arrays violate this type contract and must be converted to {}
      return {
        id: validated.toolCallId,
        name: validated.toolName,
        args:
          typeof validated.input === 'object' &&
          validated.input !== null &&
          !Array.isArray(validated.input)
            ? (validated.input as Record<string, unknown>)
            : {},
      };
    });
  }
}

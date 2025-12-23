/**
 * @license
 * Copyright 2025 BrowserOS
 */
import { z } from 'zod'

import type { ToolCategories } from './ToolCategories.js'

/**
 * Structure for defining a browser automation tool
 * Now generic to support both CDP and Controller contexts/responses
 */
export interface ToolDefinition<
  Schema extends z.ZodRawShape = z.ZodRawShape,
  TContext = any,
  TResponse = any,
> {
  /** Unique identifier for the tool */
  name: string

  /** Human-readable description of what the tool does */
  description: string

  /** Metadata and categorization */
  annotations: {
    /** Optional display title */
    title?: string
    /** Category for grouping */
    category: ToolCategories | string
    /** If true, the tool does not modify its environment */
    readOnlyHint: boolean
  }

  /** Zod schema for validating input parameters */
  schema: Schema

  /** Implementation handler */
  handler: (
    request: Request<Schema>,
    response: TResponse,
    context: TContext,
  ) => Promise<void>
}

/**
 * Request structure with validated parameters
 */
export interface Request<Schema extends z.ZodRawShape> {
  params: z.infer<z.ZodObject<Schema>>
}

/**
 * Helper function for defining tools with type safety
 * Now generic to support both CDP and Controller contexts/responses
 */
export function defineTool<
  Schema extends z.ZodRawShape,
  TContext = any,
  TResponse = any,
>(
  definition: ToolDefinition<Schema, TContext, TResponse>,
): ToolDefinition<Schema, TContext, TResponse> {
  return definition
}

/**
 * Common schema fragments
 */
export const commonSchemas = {
  timeout: {
    timeout: z
      .number()
      .int()
      .optional()
      .describe(
        'Maximum wait time in milliseconds. If set to 0, the default timeout will be used.',
      )
      .transform((value: number | undefined) => {
        return value && value <= 0 ? undefined : value
      }),
  },
} as const

/**
 * Common error messages
 */
export const ERRORS = {
  CLOSE_PAGE:
    'The last open page cannot be closed. It is fine to keep it open.',
  NO_DIALOG: 'No open dialog found',
  NAVIGATION_FAILED: 'Unable to navigate in currently selected page.',
} as const

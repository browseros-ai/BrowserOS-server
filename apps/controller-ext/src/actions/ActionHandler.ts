/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import {z} from 'zod';

import type {ActionResponse} from '@/protocol/types';
import {ActionResponseSchema} from '@/protocol/types';
import {logger} from '@/utils/Logger';

// Re-export for convenience
export type {ActionResponse};
export {ActionResponseSchema};

/**
 * ActionHandler - Abstract base class for all actions
 *
 * Responsibilities:
 * - Define contract for all actions (must implement inputSchema + execute)
 * - Validate input using Zod schemas
 * - Handle validation and execution errors
 * - Return standardized ActionResponse
 *
 * Usage:
 * class MyAction extends ActionHandler<InputType, OutputType> {
 *   inputSchema = z.object({ ... });
 *   async execute(input: InputType): Promise<OutputType> { ... }
 * }
 */
export abstract class ActionHandler<TInput = any, TOutput = any> {
  /**
   * Zod schema for input validation
   * Must be implemented by concrete actions
   */
  abstract readonly inputSchema: z.ZodSchema<TInput>;

  /**
   * Execute the action logic
   * Must be implemented by concrete actions
   *
   * @param input - Validated input (guaranteed to match inputSchema)
   * @returns Action result
   */
  abstract execute(input: TInput): Promise<TOutput>;

  /**
   * Handle request with validation and error handling
   * Called by ActionRegistry
   *
   * Flow:
   * 1. Validate input with Zod schema
   * 2. Execute action logic
   * 3. Return standardized response (ok/error)
   *
   * @param payload - Raw payload from request (unvalidated)
   * @returns Standardized action response
   */
  async handle(payload: unknown): Promise<ActionResponse> {
    const actionName = this.constructor.name;

    try {
      // Step 1: Validate input
      logger.debug(`[${actionName}] Validating input`);
      const validatedInput = this.inputSchema.parse(payload);

      // Step 2: Execute action
      logger.debug(`[${actionName}] Executing action`);
      const result = await this.execute(validatedInput);

      // Step 3: Return success response
      logger.debug(`[${actionName}] Action completed successfully`);
      return {ok: true, data: result};
    } catch (error) {
      // Handle validation or execution errors
      const errorMessage = this._formatError(error);
      logger.error(`[${actionName}] Action failed: ${errorMessage}`);
      return {ok: false, error: errorMessage};
    }
  }

  /**
   * Format error for user-friendly response
   *
   * @param error - Error from validation or execution
   * @returns Formatted error message
   */
  protected _formatError(error: unknown): string {
    // Zod validation error
    if (error instanceof z.ZodError) {
      const errors = error.issues.map((e: any) => {
        const path = e.path.length > 0 ? `${e.path.join('.')}: ` : '';
        return `${path}${e.message}`;
      });
      return `Validation error: ${errors.join(', ')}`;
    }

    // Standard Error
    if (error instanceof Error) {
      return error.message;
    }

    // Unknown error
    return String(error);
  }
}

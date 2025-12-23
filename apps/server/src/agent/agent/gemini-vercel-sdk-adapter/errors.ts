/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Conversion error with structured details
 */

/**
 * Structured error compatible with Gemini CLI error handling
 */
export interface StructuredError {
  message: string
  status?: number
}

export interface ConversionErrorDetails {
  /** Stage where conversion failed */
  stage: 'tool' | 'message' | 'response' | 'stream'

  /** Specific operation that failed */
  operation: string

  /** Input that caused the failure (sanitized, no secrets) */
  input?: unknown

  /** Underlying error if available */
  cause?: Error

  /** Additional context for debugging */
  context?: Record<string, unknown>
}

export class ConversionError extends Error {
  constructor(
    message: string,
    readonly details: ConversionErrorDetails,
  ) {
    super(message)
    this.name = 'ConversionError'

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConversionError)
    }
  }

  /**
   * Convert to StructuredError for Gemini CLI error handling
   */
  toStructuredError(): StructuredError {
    return {
      message: `[${this.details.stage}] ${this.details.operation}: ${this.message}`,
      status: 500,
    }
  }

  /**
   * Get user-friendly error message
   */
  toFriendlyMessage(): string {
    const stage =
      this.details.stage.charAt(0).toUpperCase() + this.details.stage.slice(1)
    return `${stage} conversion failed: ${this.message}`
  }
}

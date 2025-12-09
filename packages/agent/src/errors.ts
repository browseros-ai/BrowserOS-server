/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
export class HttpAgentError extends Error {
  constructor(
    message: string,
    public statusCode = 500,
    public code?: string,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        name: this.name,
        message: this.message,
        code: this.code,
        statusCode: this.statusCode,
      },
    };
  }
}

export class ValidationError extends HttpAgentError {
  constructor(
    message: string,
    public details?: unknown,
  ) {
    super(message, 400, 'VALIDATION_ERROR');
  }

  override toJSON() {
    return {
      error: {
        name: this.name,
        message: this.message,
        code: this.code,
        statusCode: this.statusCode,
        details: this.details,
      },
    };
  }
}

export class SessionNotFoundError extends HttpAgentError {
  constructor(public conversationId: string) {
    super(`Session "${conversationId}" not found.`, 404, 'SESSION_NOT_FOUND');
  }
}

export class AgentExecutionError extends HttpAgentError {
  constructor(
    message: string,
    public originalError?: Error,
  ) {
    super(message, 500, 'AGENT_EXECUTION_ERROR');
  }

  override toJSON() {
    return {
      error: {
        name: this.name,
        message: this.message,
        code: this.code,
        statusCode: this.statusCode,
        originalError: this.originalError?.message,
      },
    };
  }
}

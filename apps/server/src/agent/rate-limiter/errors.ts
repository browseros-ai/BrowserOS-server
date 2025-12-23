/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { HttpAgentError } from '../errors.js'

export class RateLimitError extends HttpAgentError {
  constructor(
    public used: number,
    public limit: number,
  ) {
    super(
      `Daily limit reached (${used}/${limit}). Add your own API key for unlimited usage. https://dub.sh/browseros-usage-limit`,
      429,
      'RATE_LIMIT_EXCEEDED',
    )
  }

  override toJSON() {
    return {
      error: {
        name: this.name,
        message: this.message,
        code: this.code,
        statusCode: this.statusCode,
        used: this.used,
        limit: this.limit,
      },
    }
  }
}

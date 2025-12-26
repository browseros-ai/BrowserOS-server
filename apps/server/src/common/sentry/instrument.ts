/**
 * @license
 * Copyright 2025 BrowserOS
 */
import * as Sentry from '@sentry/bun'

import { VERSION } from '../../version.js'

const SENTRY_ENVIRONMENT = process.env.NODE_ENV || 'development'

// Ensure to call this before importing any other modules!
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // Adds request headers and IP for users, for more info visit:
  // https://docs.sentry.io/platforms/javascript/guides/bun/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
  environment: SENTRY_ENVIRONMENT,
  release: VERSION,
})

export { Sentry }

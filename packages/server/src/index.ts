#!/usr/bin/env bun
/**
 * @license
 * Copyright 2025 BrowserOS
 *
 * Main entry point for BrowserOS unified server
 */

// Runtime check for Bun
if (typeof Bun === 'undefined') {
  console.error('Error: This application requires Bun runtime.');
  console.error(
    'Please install Bun from https://bun.sh and run with: bun src/index.ts',
  );
  process.exit(1);
}

// Import polyfills first
import '@browseros/common/polyfill';
import {Sentry} from '@browseros/common/sentry';
import {CommanderError} from 'commander';

// Start the main server
import('./main.js').catch(error => {
  if (error instanceof CommanderError) {
    // Commander already printed its message (help, validation error, etc)
    process.exit(error.exitCode);
  }
  Sentry.captureException(error);
  console.error('Failed to start server:', error);
  process.exit(1);
});

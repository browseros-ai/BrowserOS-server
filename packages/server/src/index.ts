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
  console.error('Please install Bun from https://bun.sh and run with: bun src/index.ts');
  process.exit(1);
}

// Import polyfills first
import '@browseros/core/polyfill';

// Start the main server
import('./main.js').catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
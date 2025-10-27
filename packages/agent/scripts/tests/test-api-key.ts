#!/usr/bin/env bun
/**
 * API Key Validation Test
 *
 * Verifies that the ANTHROPIC_API_KEY is valid by making a simple query.
 * This is the first verification step after setup.
 */

import {query} from '@anthropic-ai/claude-agent-sdk';

const API_KEY = process.env.ANTHROPIC_API_KEY;

// Check if API key exists
if (!API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY not found in environment');
  console.error('');
  console.error('Please add your API key to the .env file:');
  console.error('  ANTHROPIC_API_KEY=sk-ant-api03-xxxxx');
  console.error('');
  console.error('Get your API key from:');
  console.error('  https://console.anthropic.com/settings/keys');
  process.exit(1);
}

// Validate API key format
if (!API_KEY.startsWith('sk-ant-api03-')) {
  console.error('❌ Invalid API key format');
  console.error('');
  console.error('Expected format: sk-ant-api03-xxxxx');
  console.error('Your key starts with:', API_KEY.substring(0, 15) + '...');
  console.error('');
  console.error('Please check your .env file and get a valid key from:');
  console.error('  https://console.anthropic.com/settings/keys');
  process.exit(1);
}

console.log('🔑 Testing API key...');
console.log('');

async function testAPIKey() {
  try {
    const testMessage =
      'Hello! Please respond with just "API key is valid" if you can read this.';

    const options = {
      apiKey: API_KEY,
      maxTurns: 1,
      cwd: process.cwd(),
      permissionMode: 'bypassPermissions' as const,
    };

    let receivedResponse = false;

    for await (const event of query({prompt: testMessage, options})) {
      // Look for a response event
      if (event.type === 'assistant' && event.message?.content) {
        receivedResponse = true;
        break;
      }
    }

    if (receivedResponse) {
      console.log('✅ API key is valid!');
      console.log('✅ Successfully connected to Anthropic API');
      console.log('');
      console.log('Next steps:');
      console.log('  1. Start the development server:');
      console.log('     bun run dev');
      console.log('');
      console.log('  2. (Optional) Test browser automation:');
      console.log('     bun run test:browser');
      console.log('');
      process.exit(0);
    } else {
      throw new Error('No response received from API');
    }
  } catch (error) {
    console.error('❌ API key test failed');
    console.error('');

    if (error instanceof Error) {
      // Check for common error patterns
      if (
        error.message.includes('401') ||
        error.message.includes('authentication')
      ) {
        console.error('Authentication error: Invalid API key');
        console.error('');
        console.error('Please verify your API key at:');
        console.error('  https://console.anthropic.com/settings/keys');
      } else if (
        error.message.includes('network') ||
        error.message.includes('ENOTFOUND')
      ) {
        console.error('Network error: Could not reach Anthropic API');
        console.error('');
        console.error('Please check your internet connection');
      } else {
        console.error('Error:', error.message);
      }
    } else {
      console.error('Unknown error occurred');
    }

    console.error('');
    process.exit(1);
  }
}

testAPIKey();

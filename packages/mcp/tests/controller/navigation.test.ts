/**
 * @license
 * Copyright 2025 BrowserOS
 */
import assert from 'node:assert';

import {withMcpServer} from '@browseros/common/tests/utils';
import {describe, it} from 'bun:test';

describe('MCP Controller Navigation Tools', () => {
  describe('browser_navigate - Success Cases', () => {
    it('tests that navigation to HTTPS URL succeeds', async () => {
      await withMcpServer(async client => {
        const result = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'https://example.com',
          },
        });

        console.log('\n=== HTTPS URL Response ===');
        console.log(JSON.stringify(result, null, 2));

        // Should not error (isError is undefined on success, true on error)
        assert.ok(!result.isError, 'Navigation should succeed');

        // Should return content
        assert.ok(Array.isArray(result.content), 'Content should be an array');
        assert.ok(result.content.length > 0, 'Content should not be empty');

        // Content should include success message
        const textContent = result.content.find(c => c.type === 'text');
        assert.ok(textContent, 'Should include text content');
        assert.ok(
          textContent.text.includes('Navigating to'),
          'Should include navigation message',
        );
        assert.ok(
          textContent.text.includes('Tab ID:'),
          'Should include tab ID',
        );
      });
    }, 30000);

    it('tests that navigation to data URL succeeds', async () => {
      await withMcpServer(async client => {
        const result = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<h1>Test Page</h1>',
          },
        });

        console.log('\n=== Data URL Response ===');
        console.log(JSON.stringify(result, null, 2));

        // Should not error
        assert.ok(!result.isError, 'Navigation to data URL should succeed');

        // Should return valid content
        assert.ok(Array.isArray(result.content), 'Content should be array');
        assert.ok(result.content.length > 0, 'Should have content');

        const textContent = result.content.find(c => c.type === 'text');
        assert.ok(textContent, 'Should have text content');
        assert.ok(
          textContent.text.includes('data:text/html'),
          'Should reference data URL',
        );
      });
    }, 30000);

    it('tests that navigation to HTTP URL succeeds', async () => {
      await withMcpServer(async client => {
        const result = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'http://example.com',
          },
        });

        assert.ok(!result.isError, 'Should succeed');
        assert.ok(
          Array.isArray(result.content) && result.content.length > 0,
          'Should have content',
        );
      });
    }, 30000);
  });

  describe('browser_navigate - Error Handling', () => {
    it('tests that invalid URL is handled gracefully', async () => {
      await withMcpServer(async client => {
        const result = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'not-a-valid-url',
          },
        });

        console.log('\n=== Invalid URL Response ===');
        console.log(JSON.stringify(result, null, 2));

        // Should return a result (not throw)
        assert.ok(result, 'Should return a result');
        assert.ok(Array.isArray(result.content), 'Should have content array');

        // May succeed with extension's URL handling or return error
        // Just verify structure is valid
        if (result.isError) {
          const textContent = result.content.find(c => c.type === 'text');
          assert.ok(
            textContent,
            'Error should include text content explaining the issue',
          );
        }
      });
    }, 30000);

    it('tests that meaningful response structure is provided on any error', async () => {
      await withMcpServer(async client => {
        // Try navigating with an empty string
        const result = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: '',
          },
        });

        console.log('\n=== Empty URL Response ===');
        console.log(JSON.stringify(result, null, 2));

        // Structure should always be valid
        assert.ok(result, 'Should return result object');
        assert.ok(
          typeof result.isError === 'boolean',
          'isError should be boolean',
        );
        assert.ok(Array.isArray(result.content), 'content should be an array');

        // If error, should have descriptive message
        if (result.isError) {
          assert.ok(
            result.content.length > 0,
            'Error response should have content',
          );
          const textContent = result.content.find(c => c.type === 'text');
          assert.ok(textContent, 'Should have text explaining error');
          assert.ok(
            textContent.text.length > 0,
            'Error message should not be empty',
          );
        }
      });
    }, 30000);
  });

  describe('browser_navigate - Response Structure Validation', () => {
    it('tests that valid MCP response structure is always returned', async () => {
      await withMcpServer(async client => {
        const result = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'https://example.com',
          },
        });

        // Validate response structure
        assert.ok(result, 'Result should exist');
        assert.ok('content' in result, 'Should have content field');
        assert.ok(Array.isArray(result.content), 'content must be an array');

        // isError is only present when there's an error (undefined on success)
        if ('isError' in result) {
          assert.strictEqual(
            typeof result.isError,
            'boolean',
            'isError must be boolean when present',
          );
        }

        // Validate content items
        for (const item of result.content) {
          assert.ok(item.type, 'Content item must have type');
          assert.ok(
            item.type === 'text' || item.type === 'image',
            'Content type must be text or image',
          );

          if (item.type === 'text') {
            assert.ok('text' in item, 'Text content must have text property');
            assert.strictEqual(
              typeof item.text,
              'string',
              'Text must be string',
            );
          }
        }
      });
    }, 30000);
  });
});

/**
 * @license
 * Copyright 2025 BrowserOS
 */
import assert from 'node:assert';

import {withMcpServer} from '@browseros/common/tests/utils';
import {describe, it} from 'bun:test';

describe('MCP Controller Content Tools', () => {
  describe('browser_get_page_content - Success Cases', () => {
    it('tests that page content extraction with text type succeeds', async () => {
      await withMcpServer(async client => {
        // Navigate to a page with content
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body><h1>Title</h1><p>This is a paragraph of text.</p><p>Another paragraph.</p></body>',
          },
        });

        const navText = navResult.content.find(c => c.type === 'text');
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/);
        const tabId = parseInt(tabIdMatch[1]);

        const result = await client.callTool({
          name: 'browser_get_page_content',
          arguments: {tabId, type: 'text'},
        });

        console.log('\n=== Get Page Content (Text) Response ===');
        console.log(JSON.stringify(result, null, 2));

        assert.ok(Array.isArray(result.content), 'Content should be array');

        const textContent = result.content.find(c => c.type === 'text');
        assert.ok(textContent, 'Should have text content');

        // If getSnapshot API is available, check for pagination info
        if (!result.isError && textContent.text.includes('Total pages:')) {
          assert.ok(
            textContent.text.includes('characters total'),
            'Should include character count',
          );
        }
      });
    }, 30000);

    it('tests that page content extraction with text-with-links type succeeds', async () => {
      await withMcpServer(async client => {
        // Navigate to a page with links
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body><h1>Links Page</h1><a href="https://example.com">Example Link</a><p>Some text</p><a href="https://test.com">Test Link</a></body>',
          },
        });

        const navText = navResult.content.find(c => c.type === 'text');
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/);
        const tabId = parseInt(tabIdMatch[1]);

        const result = await client.callTool({
          name: 'browser_get_page_content',
          arguments: {tabId, type: 'text-with-links'},
        });

        console.log('\n=== Get Page Content (Text with Links) Response ===');
        console.log(JSON.stringify(result, null, 2));

        const textContent = result.content.find(c => c.type === 'text');
        assert.ok(textContent, 'Should have text content');

        // If getSnapshot API is available, check for pagination info
        if (!result.isError) {
          assert.ok(
            textContent.text.includes('Total pages:') ||
              textContent.text.includes('Error:'),
            'Should include pagination info or error',
          );
        }
      });
    }, 30000);

    it('tests that page content extraction with specific page number succeeds', async () => {
      await withMcpServer(async client => {
        // Navigate to a page with content
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body><h1>Page Title</h1><p>Content here</p></body>',
          },
        });

        const navText = navResult.content.find(c => c.type === 'text');
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/);
        const tabId = parseInt(tabIdMatch[1]);

        const result = await client.callTool({
          name: 'browser_get_page_content',
          arguments: {tabId, type: 'text', page: '1'},
        });

        console.log('\n=== Get Page Content (Page 1) Response ===');
        console.log(JSON.stringify(result, null, 2));

        const textContent = result.content.find(c => c.type === 'text');
        assert.ok(textContent, 'Should have text content');

        // If getSnapshot API is available, check for page info
        if (!result.isError) {
          assert.ok(
            textContent.text.includes('Page 1 of') ||
              textContent.text.includes('Error:'),
            'Should indicate page 1 or error',
          );
        }
      });
    }, 30000);

    it('tests that page content extraction with all pages succeeds', async () => {
      await withMcpServer(async client => {
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body><h1>Title</h1><p>Content</p></body>',
          },
        });

        const navText = navResult.content.find(c => c.type === 'text');
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/);
        const tabId = parseInt(tabIdMatch[1]);

        const result = await client.callTool({
          name: 'browser_get_page_content',
          arguments: {tabId, type: 'text', page: 'all'},
        });

        console.log('\n=== Get Page Content (All Pages) Response ===');
        console.log(JSON.stringify(result, null, 2));

        const textContent = result.content.find(c => c.type === 'text');
        assert.ok(textContent, 'Should have text content');

        // If getSnapshot API is available, check for total pages
        if (!result.isError) {
          assert.ok(
            textContent.text.includes('Total pages:') ||
              textContent.text.includes('Error:'),
            'Should show total pages or error',
          );
        }
      });
    }, 30000);

    it('tests that page content extraction with different context window sizes succeeds', async () => {
      await withMcpServer(async client => {
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body><h1>Title</h1><p>Content</p></body>',
          },
        });

        const navText = navResult.content.find(c => c.type === 'text');
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/);
        const tabId = parseInt(tabIdMatch[1]);

        // Test different context windows
        const contextWindows = ['20k', '30k', '50k', '100k'];

        for (const contextWindow of contextWindows) {
          const result = await client.callTool({
            name: 'browser_get_page_content',
            arguments: {tabId, type: 'text', contextWindow},
          });

          console.log(
            `\n=== Get Page Content (${contextWindow} window) Response ===`,
          );
          console.log(JSON.stringify(result, null, 2));

          const textContent = result.content.find(c => c.type === 'text');
          assert.ok(textContent, 'Should have text content');

          // If getSnapshot API is available, check for context window info
          if (!result.isError) {
            assert.ok(
              textContent.text.includes(contextWindow) ||
                textContent.text.includes('Error:'),
              `Should mention ${contextWindow} or error`,
            );
          }
        }
      });
    }, 60000);

    it('tests that empty page content extraction is handled', async () => {
      await withMcpServer(async client => {
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body></body>',
          },
        });

        const navText = navResult.content.find(c => c.type === 'text');
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/);
        const tabId = parseInt(tabIdMatch[1]);

        const result = await client.callTool({
          name: 'browser_get_page_content',
          arguments: {tabId, type: 'text'},
        });

        console.log('\n=== Get Page Content (Empty Page) Response ===');
        console.log(JSON.stringify(result, null, 2));

        assert.ok(!result.isError, 'Should succeed');

        const textContent = result.content.find(c => c.type === 'text');
        assert.ok(textContent, 'Should have text content');
      });
    }, 30000);
  });

  describe('browser_get_page_content - Error Handling', () => {
    it('tests that content extraction with invalid tab ID is handled', async () => {
      await withMcpServer(async client => {
        const result = await client.callTool({
          name: 'browser_get_page_content',
          arguments: {tabId: 999999999, type: 'text'},
        });

        console.log('\n=== Get Page Content Invalid Tab Response ===');
        console.log(JSON.stringify(result, null, 2));

        assert.ok(result, 'Should return a result');
        assert.ok(Array.isArray(result.content), 'Should have content array');

        if (result.isError) {
          const textContent = result.content.find(c => c.type === 'text');
          assert.ok(textContent, 'Error should include text content');
        }
      });
    }, 30000);

    it('tests that non-numeric tab ID is rejected', async () => {
      await withMcpServer(async client => {
        try {
          await client.callTool({
            name: 'browser_get_page_content',
            arguments: {tabId: 'invalid', type: 'text'},
          });
          assert.fail('Should have thrown validation error');
        } catch (error) {
          console.log('\n=== Get Page Content Invalid Tab Type Error ===');
          console.log(error.message);

          assert.ok(
            error.message.includes('Invalid arguments') ||
              error.message.includes('Expected number'),
            'Should reject with validation error',
          );
        }
      });
    }, 30000);

    it('tests that invalid type enum is rejected', async () => {
      await withMcpServer(async client => {
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body><p>Content</p></body>',
          },
        });

        const navText = navResult.content.find(c => c.type === 'text');
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/);
        const tabId = parseInt(tabIdMatch[1]);

        try {
          await client.callTool({
            name: 'browser_get_page_content',
            arguments: {tabId, type: 'invalid-type'},
          });
          assert.fail('Should have thrown validation error');
        } catch (error) {
          console.log('\n=== Get Page Content Invalid Type Error ===');
          console.log(error.message);

          assert.ok(
            error.message.includes('Invalid') || error.message.includes('enum'),
            'Should reject with validation error',
          );
        }
      });
    }, 30000);

    it('tests that invalid page number is handled', async () => {
      await withMcpServer(async client => {
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body><p>Content</p></body>',
          },
        });

        const navText = navResult.content.find(c => c.type === 'text');
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/);
        const tabId = parseInt(tabIdMatch[1]);

        const result = await client.callTool({
          name: 'browser_get_page_content',
          arguments: {tabId, type: 'text', page: '999'},
        });

        console.log('\n=== Get Page Content Invalid Page Response ===');
        console.log(JSON.stringify(result, null, 2));

        assert.ok(!result.isError, 'Should not throw error');

        const textContent = result.content.find(c => c.type === 'text');
        assert.ok(
          textContent.text.includes('Error') ||
            textContent.text.includes('Invalid page'),
          'Should indicate invalid page',
        );
      });
    }, 30000);

    it('tests that non-numeric page number is handled', async () => {
      await withMcpServer(async client => {
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body><p>Content</p></body>',
          },
        });

        const navText = navResult.content.find(c => c.type === 'text');
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/);
        const tabId = parseInt(tabIdMatch[1]);

        const result = await client.callTool({
          name: 'browser_get_page_content',
          arguments: {tabId, type: 'text', page: 'invalid'},
        });

        console.log('\n=== Get Page Content Non-Numeric Page Response ===');
        console.log(JSON.stringify(result, null, 2));

        assert.ok(!result.isError, 'Should not throw error');

        const textContent = result.content.find(c => c.type === 'text');
        assert.ok(
          textContent.text.includes('Error') ||
            textContent.text.includes('Invalid page'),
          'Should indicate invalid page',
        );
      });
    }, 30000);
  });

  describe('browser_get_page_content - Response Structure Validation', () => {
    it('tests that content tool returns valid MCP response structure', async () => {
      await withMcpServer(async client => {
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body><h1>Test</h1><p>Content</p></body>',
          },
        });

        const navText = navResult.content.find(c => c.type === 'text');
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/);
        const tabId = parseInt(tabIdMatch[1]);

        const result = await client.callTool({
          name: 'browser_get_page_content',
          arguments: {tabId, type: 'text'},
        });

        // Validate response structure
        assert.ok(result, 'Result should exist');
        assert.ok('content' in result, 'Should have content field');
        assert.ok(Array.isArray(result.content), 'content must be an array');

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

  describe('browser_get_page_content - Workflow Tests', () => {
    it('tests complete content extraction workflow: navigate -> extract text -> extract text-with-links', async () => {
      await withMcpServer(async client => {
        // Navigate to a page
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body><h1>Article Title</h1><p>This is a paragraph with <a href="https://example.com">a link</a>.</p><h2>Subtitle</h2><p>More content here.</p></body>',
          },
        });

        console.log('\n=== Workflow: Navigate Response ===');
        console.log(JSON.stringify(navResult, null, 2));

        const navText = navResult.content.find(c => c.type === 'text');
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/);
        const tabId = parseInt(tabIdMatch[1]);

        // Extract text only
        const textResult = await client.callTool({
          name: 'browser_get_page_content',
          arguments: {tabId, type: 'text'},
        });

        console.log('\n=== Workflow: Extract Text ===');
        console.log(JSON.stringify(textResult, null, 2));

        assert.ok(!textResult.isError, 'Text extraction should succeed');

        // Extract text with links
        const linksResult = await client.callTool({
          name: 'browser_get_page_content',
          arguments: {tabId, type: 'text-with-links'},
        });

        console.log('\n=== Workflow: Extract Text with Links ===');
        console.log(JSON.stringify(linksResult, null, 2));

        assert.ok(
          !linksResult.isError,
          'Text with links extraction should succeed',
        );
      });
    }, 30000);

    it('tests pagination workflow: extract all pages -> extract specific page', async () => {
      await withMcpServer(async client => {
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url:
              'data:text/html,<body><h1>Long Content</h1><p>'.repeat(100) +
              'Content paragraph.' +
              '</p>'.repeat(100) +
              '</body>',
          },
        });

        const navText = navResult.content.find(c => c.type === 'text');
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/);
        const tabId = parseInt(tabIdMatch[1]);

        // Extract all pages with small context window
        const allPagesResult = await client.callTool({
          name: 'browser_get_page_content',
          arguments: {tabId, type: 'text', page: 'all', contextWindow: '20k'},
        });

        console.log('\n=== Workflow: Extract All Pages ===');
        console.log(JSON.stringify(allPagesResult, null, 2));

        assert.ok(
          !allPagesResult.isError,
          'All pages extraction should succeed',
        );

        // Extract specific page
        const page1Result = await client.callTool({
          name: 'browser_get_page_content',
          arguments: {tabId, type: 'text', page: '1', contextWindow: '20k'},
        });

        console.log('\n=== Workflow: Extract Page 1 ===');
        console.log(JSON.stringify(page1Result, null, 2));

        assert.ok(!page1Result.isError, 'Page 1 extraction should succeed');
      });
    }, 30000);
  });
});

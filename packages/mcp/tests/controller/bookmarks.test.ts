/**
 * @license
 * Copyright 2025 BrowserOS
 */
import assert from 'node:assert';

import {withMcpServer} from '@browseros/common/tests/utils';
import {describe, it} from 'bun:test';

describe('MCP Controller Bookmark Tools', () => {
  describe('browser_get_bookmarks - Success Cases', () => {
    it('tests that getting all bookmarks succeeds', async () => {
      await withMcpServer(async client => {
        const result = await client.callTool({
          name: 'browser_get_bookmarks',
          arguments: {},
        });

        console.log('\n=== Get All Bookmarks Response ===');
        console.log(JSON.stringify(result, null, 2));

        assert.ok(!result.isError, 'Should succeed');
        assert.ok(Array.isArray(result.content), 'Content should be array');

        const textContent = result.content.find(c => c.type === 'text');
        assert.ok(textContent, 'Should have text content');
        assert.ok(
          textContent.text.includes('Found'),
          'Should indicate bookmarks found',
        );
        assert.ok(
          textContent.text.includes('bookmarks'),
          'Should mention bookmarks',
        );
      });
    }, 30000);

    it('tests that getting bookmarks from specific folder succeeds', async () => {
      await withMcpServer(async client => {
        const result = await client.callTool({
          name: 'browser_get_bookmarks',
          arguments: {folderId: '1'},
        });

        console.log('\n=== Get Bookmarks from Folder Response ===');
        console.log(JSON.stringify(result, null, 2));

        assert.ok(!result.isError, 'Should succeed');

        const textContent = result.content.find(c => c.type === 'text');
        assert.ok(textContent, 'Should have text content');
      });
    }, 30000);

    it('tests that empty bookmarks list is handled', async () => {
      await withMcpServer(async client => {
        const result = await client.callTool({
          name: 'browser_get_bookmarks',
          arguments: {folderId: '999999'},
        });

        console.log('\n=== Get Empty Bookmarks Response ===');
        console.log(JSON.stringify(result, null, 2));

        const textContent = result.content.find(c => c.type === 'text');
        assert.ok(textContent, 'Should have text content');
      });
    }, 30000);
  });

  describe('browser_create_bookmark - Success Cases', () => {
    it('tests that creating bookmark with title and URL succeeds', async () => {
      await withMcpServer(async client => {
        const result = await client.callTool({
          name: 'browser_create_bookmark',
          arguments: {
            title: 'Test Bookmark',
            url: 'https://example.com',
          },
        });

        console.log('\n=== Create Bookmark Response ===');
        console.log(JSON.stringify(result, null, 2));

        assert.ok(!result.isError, 'Should succeed');

        const textContent = result.content.find(c => c.type === 'text');
        assert.ok(textContent, 'Should have text content');
        assert.ok(
          textContent.text.includes('Created bookmark'),
          'Should confirm creation',
        );
        assert.ok(
          textContent.text.includes('Test Bookmark'),
          'Should include title',
        );
        assert.ok(textContent.text.includes('ID:'), 'Should include ID');
      });
    }, 30000);

    it('tests that creating bookmark with parentId succeeds', async () => {
      await withMcpServer(async client => {
        const result = await client.callTool({
          name: 'browser_create_bookmark',
          arguments: {
            title: 'Nested Bookmark',
            url: 'https://nested.example.com',
            parentId: '1',
          },
        });

        console.log('\n=== Create Bookmark with Parent Response ===');
        console.log(JSON.stringify(result, null, 2));

        assert.ok(!result.isError, 'Should succeed');

        const textContent = result.content.find(c => c.type === 'text');
        assert.ok(
          textContent.text.includes('Created bookmark'),
          'Should confirm creation',
        );
      });
    }, 30000);

    it('tests that creating bookmark with special characters succeeds', async () => {
      await withMcpServer(async client => {
        const result = await client.callTool({
          name: 'browser_create_bookmark',
          arguments: {
            title: 'Test & Special <Characters>',
            url: 'https://example.com/path?query=value&foo=bar',
          },
        });

        console.log('\n=== Create Bookmark Special Chars Response ===');
        console.log(JSON.stringify(result, null, 2));

        assert.ok(!result.isError, 'Should succeed');
      });
    }, 30000);

    it('tests that creating bookmark with unicode title succeeds', async () => {
      await withMcpServer(async client => {
        const result = await client.callTool({
          name: 'browser_create_bookmark',
          arguments: {
            title: '测试书签 📚 テスト',
            url: 'https://unicode.example.com',
          },
        });

        console.log('\n=== Create Bookmark Unicode Response ===');
        console.log(JSON.stringify(result, null, 2));

        assert.ok(!result.isError, 'Should succeed');
      });
    }, 30000);

    it('tests that creating bookmark with localhost URL succeeds', async () => {
      await withMcpServer(async client => {
        const result = await client.callTool({
          name: 'browser_create_bookmark',
          arguments: {
            title: 'Localhost',
            url: 'http://localhost:3000',
          },
        });

        console.log('\n=== Create Bookmark Localhost Response ===');
        console.log(JSON.stringify(result, null, 2));

        assert.ok(!result.isError, 'Should succeed');
      });
    }, 30000);
  });

  describe('browser_create_bookmark - Error Handling', () => {
    it('tests that missing title is rejected', async () => {
      await withMcpServer(async client => {
        try {
          await client.callTool({
            name: 'browser_create_bookmark',
            arguments: {
              url: 'https://example.com',
            },
          });
          assert.fail('Should have thrown validation error');
        } catch (error) {
          console.log('\n=== Create Bookmark Missing Title Error ===');
          console.log(error.message);

          assert.ok(
            error.message.includes('Invalid arguments') ||
              error.message.includes('Required'),
            'Should reject with validation error',
          );
        }
      });
    }, 30000);

    it('tests that missing URL is rejected', async () => {
      await withMcpServer(async client => {
        try {
          await client.callTool({
            name: 'browser_create_bookmark',
            arguments: {
              title: 'Test',
            },
          });
          assert.fail('Should have thrown validation error');
        } catch (error) {
          console.log('\n=== Create Bookmark Missing URL Error ===');
          console.log(error.message);

          assert.ok(
            error.message.includes('Invalid arguments') ||
              error.message.includes('Required'),
            'Should reject with validation error',
          );
        }
      });
    }, 30000);

    it('tests that empty title is handled', async () => {
      await withMcpServer(async client => {
        const result = await client.callTool({
          name: 'browser_create_bookmark',
          arguments: {
            title: '',
            url: 'https://example.com',
          },
        });

        console.log('\n=== Create Bookmark Empty Title Response ===');
        console.log(JSON.stringify(result, null, 2));

        // Should either succeed or return error
        assert.ok(result, 'Should return a result');
      });
    }, 30000);
  });

  describe('browser_remove_bookmark - Success Cases', () => {
    it('tests that removing bookmark by ID succeeds', async () => {
      await withMcpServer(async client => {
        // First create a bookmark
        const createResult = await client.callTool({
          name: 'browser_create_bookmark',
          arguments: {
            title: 'To Be Deleted',
            url: 'https://delete.example.com',
          },
        });

        const createText = createResult.content.find(c => c.type === 'text');
        const idMatch = createText.text.match(/ID: (\d+)/);
        const bookmarkId = idMatch ? idMatch[1] : '1';

        // Remove it
        const result = await client.callTool({
          name: 'browser_remove_bookmark',
          arguments: {bookmarkId},
        });

        console.log('\n=== Remove Bookmark Response ===');
        console.log(JSON.stringify(result, null, 2));

        assert.ok(!result.isError, 'Should succeed');

        const textContent = result.content.find(c => c.type === 'text');
        assert.ok(textContent, 'Should have text content');
        assert.ok(
          textContent.text.includes('Removed bookmark'),
          'Should confirm removal',
        );
      });
    }, 30000);

    it('tests that removing multiple bookmarks sequentially succeeds', async () => {
      await withMcpServer(async client => {
        // Create two bookmarks
        const create1 = await client.callTool({
          name: 'browser_create_bookmark',
          arguments: {
            title: 'First',
            url: 'https://first.example.com',
          },
        });

        const create2 = await client.callTool({
          name: 'browser_create_bookmark',
          arguments: {
            title: 'Second',
            url: 'https://second.example.com',
          },
        });

        const id1Match = create1.content
          .find(c => c.type === 'text')
          .text.match(/ID: (\d+)/);
        const id2Match = create2.content
          .find(c => c.type === 'text')
          .text.match(/ID: (\d+)/);

        const id1 = id1Match ? id1Match[1] : '1';
        const id2 = id2Match ? id2Match[1] : '2';

        // Remove both
        const remove1 = await client.callTool({
          name: 'browser_remove_bookmark',
          arguments: {bookmarkId: id1},
        });

        const remove2 = await client.callTool({
          name: 'browser_remove_bookmark',
          arguments: {bookmarkId: id2},
        });

        console.log('\n=== Remove Multiple Bookmarks Response ===');
        console.log('First removal:', JSON.stringify(remove1, null, 2));
        console.log('Second removal:', JSON.stringify(remove2, null, 2));

        assert.ok(!remove1.isError, 'First removal should succeed');
        assert.ok(!remove2.isError, 'Second removal should succeed');
      });
    }, 30000);
  });

  describe('browser_remove_bookmark - Error Handling', () => {
    it('tests that missing bookmarkId is rejected', async () => {
      await withMcpServer(async client => {
        try {
          await client.callTool({
            name: 'browser_remove_bookmark',
            arguments: {},
          });
          assert.fail('Should have thrown validation error');
        } catch (error) {
          console.log('\n=== Remove Bookmark Missing ID Error ===');
          console.log(error.message);

          assert.ok(
            error.message.includes('Invalid arguments') ||
              error.message.includes('Required'),
            'Should reject with validation error',
          );
        }
      });
    }, 30000);

    it('tests that invalid bookmarkId is handled', async () => {
      await withMcpServer(async client => {
        const result = await client.callTool({
          name: 'browser_remove_bookmark',
          arguments: {bookmarkId: '999999999'},
        });

        console.log('\n=== Remove Invalid Bookmark Response ===');
        console.log(JSON.stringify(result, null, 2));

        // Should either error or succeed gracefully
        assert.ok(result, 'Should return a result');
      });
    }, 30000);
  });

  describe('Bookmark Tools - Response Structure Validation', () => {
    it('tests that bookmark tools return valid MCP response structure', async () => {
      await withMcpServer(async client => {
        const tools = [
          {name: 'browser_get_bookmarks', args: {}},
          {
            name: 'browser_create_bookmark',
            args: {title: 'Test', url: 'https://test.com'},
          },
        ];

        for (const tool of tools) {
          const result = await client.callTool({
            name: tool.name,
            arguments: tool.args,
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
        }
      });
    }, 30000);
  });

  describe('Bookmark Tools - Workflow Tests', () => {
    it('tests complete bookmark workflow: create → get → verify → remove', async () => {
      await withMcpServer(async client => {
        // Create bookmark
        const createResult = await client.callTool({
          name: 'browser_create_bookmark',
          arguments: {
            title: 'Workflow Test',
            url: 'https://workflow.example.com',
          },
        });

        console.log('\n=== Workflow: Create Bookmark ===');
        console.log(JSON.stringify(createResult, null, 2));

        assert.ok(!createResult.isError, 'Create should succeed');

        const createText = createResult.content.find(c => c.type === 'text');
        const idMatch = createText.text.match(/ID: (\d+)/);
        const bookmarkId = idMatch ? idMatch[1] : '1';

        // Get all bookmarks
        const getResult = await client.callTool({
          name: 'browser_get_bookmarks',
          arguments: {},
        });

        console.log('\n=== Workflow: Get Bookmarks ===');
        console.log(JSON.stringify(getResult, null, 2));

        assert.ok(!getResult.isError, 'Get should succeed');

        const getText = getResult.content.find(c => c.type === 'text');
        assert.ok(
          getText.text.includes('Workflow Test'),
          'Should find created bookmark',
        );

        // Remove bookmark
        const removeResult = await client.callTool({
          name: 'browser_remove_bookmark',
          arguments: {bookmarkId},
        });

        console.log('\n=== Workflow: Remove Bookmark ===');
        console.log(JSON.stringify(removeResult, null, 2));

        assert.ok(!removeResult.isError, 'Remove should succeed');
      });
    }, 30000);

    it('tests bookmark batch operations workflow', async () => {
      await withMcpServer(async client => {
        const bookmarks = [
          {title: 'Batch 1', url: 'https://batch1.com'},
          {title: 'Batch 2', url: 'https://batch2.com'},
          {title: 'Batch 3', url: 'https://batch3.com'},
        ];

        const bookmarkIds: string[] = [];

        // Create multiple bookmarks
        for (const bookmark of bookmarks) {
          const result = await client.callTool({
            name: 'browser_create_bookmark',
            arguments: bookmark,
          });

          assert.ok(
            !result.isError,
            `Creating ${bookmark.title} should succeed`,
          );

          const text = result.content.find(c => c.type === 'text');
          const idMatch = text.text.match(/ID: (\d+)/);
          if (idMatch) {
            bookmarkIds.push(idMatch[1]);
          }
        }

        console.log('\n=== Batch Workflow: Created Bookmarks ===');
        console.log('IDs:', bookmarkIds);

        // Get all bookmarks
        const getAllResult = await client.callTool({
          name: 'browser_get_bookmarks',
          arguments: {},
        });

        assert.ok(!getAllResult.isError, 'Get all should succeed');

        // Remove all created bookmarks
        for (const id of bookmarkIds) {
          const removeResult = await client.callTool({
            name: 'browser_remove_bookmark',
            arguments: {bookmarkId: id},
          });

          assert.ok(!removeResult.isError, `Removing ${id} should succeed`);
        }

        console.log('\n=== Batch Workflow: Completed ===');
      });
    }, 30000);
  });
});

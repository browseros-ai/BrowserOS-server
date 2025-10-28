/**
 * @license
 * Copyright 2025 BrowserOS
 */
import {execSync} from 'node:child_process';

import {McpResponse} from '@browseros/tools';
import type {Browser} from 'puppeteer';
import puppeteer from 'puppeteer';
import type {HTTPRequest, HTTPResponse} from 'puppeteer-core';

import {logger} from '../src/logger.js';
import {McpContext} from '../src/McpContext.js';

import {ensureBrowserOS} from './browseros.js';

let cachedBrowser: Browser | undefined;

export async function killProcessOnPort(port: number): Promise<void> {
  try {
    console.log(`Finding process on port ${port}...`);

    const pids = execSync(`lsof -ti :${port}`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    if (pids) {
      const pidList = pids.replace(/\n/g, ', ');
      console.log(`Terminating process(es) ${pidList} on port ${port}...`);

      // First try SIGTERM for graceful shutdown
      try {
        execSync(`kill -15 ${pids.replace(/\n/g, ' ')}`, {
          stdio: 'ignore',
        });
        // Give it a moment to shut down
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch {
        // If SIGTERM fails, try SIGKILL as last resort
        execSync(`kill -9 ${pids.replace(/\n/g, ' ')}`, {
          stdio: 'ignore',
        });
      }

      console.log(`Terminated process on port ${port}`);
    }
  } catch {
    console.log(`No process found on port ${port}`);
  }

  console.log('Waiting 1 second for port to be released...');
  await new Promise(resolve => setTimeout(resolve, 1000));
}

export async function withBrowser(
  cb: (response: McpResponse, context: McpContext) => Promise<void>,
  options: {debug?: boolean} = {},
): Promise<void> {
  const {cdpPort} = await ensureBrowserOS();

  if (!cachedBrowser || !cachedBrowser.connected) {
    cachedBrowser = await puppeteer.connect({
      browserURL: `http://127.0.0.1:${cdpPort}`,
    });
  }

  const newPage = await cachedBrowser.newPage();

  const pages = await cachedBrowser.pages();
  await Promise.all(
    pages.map(async page => {
      if (page !== newPage) {
        await page.close();
      }
    }),
  );

  const response = new McpResponse();
  const context = await McpContext.from(cachedBrowser, logger);

  await cb(response, context);
}

export function getMockRequest(
  options: {
    method?: string;
    response?: HTTPResponse;
    failure?: HTTPRequest['failure'];
    resourceType?: string;
    hasPostData?: boolean;
    postData?: string;
    fetchPostData?: Promise<string>;
  } = {},
): HTTPRequest {
  return {
    url() {
      return 'http://example.com';
    },
    method() {
      return options.method ?? 'GET';
    },
    fetchPostData() {
      return options.fetchPostData ?? Promise.reject();
    },
    hasPostData() {
      return options.hasPostData ?? false;
    },
    postData() {
      return options.postData;
    },
    response() {
      return options.response ?? null;
    },
    failure() {
      return options.failure?.() ?? null;
    },
    resourceType() {
      return options.resourceType ?? 'document';
    },
    headers(): Record<string, string> {
      return {
        'content-size': '10',
      };
    },
    redirectChain(): HTTPRequest[] {
      return [];
    },
  } as HTTPRequest;
}

export function getMockResponse(
  options: {
    status?: number;
  } = {},
): HTTPResponse {
  return {
    status() {
      return options.status ?? 200;
    },
  } as HTTPResponse;
}

export function html(
  strings: TemplateStringsArray,
  ...values: unknown[]
): string {
  const bodyContent = strings.reduce((acc, str, i) => {
    return acc + str + (values[i] || '');
  }, '');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My test page</title>
  </head>
  <body>
    ${bodyContent}
  </body>
</html>`;
}

/**
 * @license
 * Copyright 2025 BrowserOS
 */
import type {Browser, ConnectOptions, Target} from 'puppeteer-core';
import puppeteer from 'puppeteer-core';

let browser: Browser | undefined;

const ignoredPrefixes = new Set([
  'chrome://',
  'chrome-extension://',
  'chrome-untrusted://',
  'devtools://',
]);

function targetFilter(target: Target): boolean {
  if (target.url() === 'chrome://newtab/') {
    return true;
  }
  for (const prefix of ignoredPrefixes) {
    if (target.url().startsWith(prefix)) {
      return false;
    }
  }
  return true;
}

const connectOptions: ConnectOptions = {
  targetFilter,
};

/**
 * Connect to an existing browser instance via CDP.
 * Always connects, never launches.
 */
export async function ensureBrowserConnected(
  browserURL: string,
): Promise<Browser> {
  if (browser?.connected) {
    return browser;
  }
  browser = await puppeteer.connect({
    ...connectOptions,
    browserURL,
    defaultViewport: null,
  });
  return browser;
}

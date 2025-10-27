/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import {logger} from '@/utils/Logger';

/**
 * TabAdapter - Wrapper for Chrome tabs API
 *
 * Responsibilities:
 * - Provide clean Promise-based interface to Chrome tabs API
 * - Handle Chrome API errors
 * - Log operations for debugging
 *
 * Chrome tabs API is already Promise-based in Manifest V3,
 * so we add error handling and logging.
 */
export class TabAdapter {
  /**
   * Get the currently active tab
   *
   * @returns Active tab in current window
   * @throws Error if no active tab found
   */
  async getActiveTab(): Promise<chrome.tabs.Tab> {
    logger.debug('[TabAdapter] Getting active tab');

    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (tabs.length === 0) {
        throw new Error('No active tab found');
      }

      logger.debug(
        `[TabAdapter] Found active tab: ${tabs[0].id} (${tabs[0].url})`,
      );
      return tabs[0];
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`[TabAdapter] Failed to get active tab: ${errorMessage}`);
      throw new Error(`Failed to get active tab: ${errorMessage}`);
    }
  }

  /**
   * Get a specific tab by ID
   *
   * @param tabId - Tab ID to retrieve
   * @returns Tab object
   * @throws Error if tab not found
   */
  async getTab(tabId: number): Promise<chrome.tabs.Tab> {
    logger.debug(`[TabAdapter] Getting tab ${tabId}`);

    try {
      const tab = await chrome.tabs.get(tabId);
      logger.debug(`[TabAdapter] Found tab: ${tab.id} (${tab.url})`);
      return tab;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`[TabAdapter] Failed to get tab ${tabId}: ${errorMessage}`);
      throw new Error(`Tab not found (id: ${tabId})`);
    }
  }

  /**
   * Get all tabs across all windows
   *
   * @returns Array of all tabs
   */
  async getAllTabs(): Promise<chrome.tabs.Tab[]> {
    logger.debug('[TabAdapter] Getting all tabs');

    try {
      const tabs = await chrome.tabs.query({});
      logger.debug(`[TabAdapter] Found ${tabs.length} tabs`);
      return tabs;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`[TabAdapter] Failed to get all tabs: ${errorMessage}`);
      throw new Error(`Failed to get tabs: ${errorMessage}`);
    }
  }

  /**
   * Query tabs with specific criteria
   *
   * @param query - Chrome tabs query object
   * @returns Array of matching tabs
   */
  async queryTabs(query: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> {
    logger.debug(`[TabAdapter] Querying tabs: ${JSON.stringify(query)}`);

    try {
      const tabs = await chrome.tabs.query(query);
      logger.debug(`[TabAdapter] Query found ${tabs.length} tabs`);
      return tabs;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`[TabAdapter] Failed to query tabs: ${errorMessage}`);
      throw new Error(`Failed to query tabs: ${errorMessage}`);
    }
  }

  /**
   * Get tabs in specific window
   *
   * @param windowId - Window ID
   * @returns Array of tabs in window
   */
  async getTabsInWindow(windowId: number): Promise<chrome.tabs.Tab[]> {
    logger.debug(`[TabAdapter] Getting tabs in window ${windowId}`);

    try {
      const tabs = await chrome.tabs.query({windowId});
      logger.debug(
        `[TabAdapter] Found ${tabs.length} tabs in window ${windowId}`,
      );
      return tabs;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `[TabAdapter] Failed to get tabs in window ${windowId}: ${errorMessage}`,
      );
      throw new Error(`Failed to get tabs in window: ${errorMessage}`);
    }
  }

  /**
   * Get current window's tabs
   *
   * @returns Array of tabs in current window
   */
  async getCurrentWindowTabs(): Promise<chrome.tabs.Tab[]> {
    logger.debug('[TabAdapter] Getting current window tabs');

    try {
      const tabs = await chrome.tabs.query({currentWindow: true});
      logger.debug(`[TabAdapter] Found ${tabs.length} tabs in current window`);
      return tabs;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `[TabAdapter] Failed to get current window tabs: ${errorMessage}`,
      );
      throw new Error(`Failed to get current window tabs: ${errorMessage}`);
    }
  }

  /**
   * Open a new tab with optional URL
   *
   * @param url - URL to open (optional, defaults to new tab page)
   * @param active - Whether to make the new tab active (default: true)
   * @returns Newly created tab
   */
  async openTab(url?: string, active = true): Promise<chrome.tabs.Tab> {
    const targetUrl = url || 'chrome://newtab/';
    logger.debug(
      `[TabAdapter] Opening new tab: ${targetUrl} (active: ${active})`,
    );

    try {
      const tab = await chrome.tabs.create({url: targetUrl, active});

      if (!tab.id) {
        throw new Error('Created tab has no ID');
      }

      logger.debug(`[TabAdapter] Created tab ${tab.id}: ${targetUrl}`);
      return tab;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`[TabAdapter] Failed to open tab: ${errorMessage}`);
      throw new Error(`Failed to open tab: ${errorMessage}`);
    }
  }

  /**
   * Close a specific tab by ID
   *
   * @param tabId - Tab ID to close
   */
  async closeTab(tabId: number): Promise<void> {
    logger.debug(`[TabAdapter] Closing tab ${tabId}`);

    try {
      // Get tab info before closing for logging
      const tab = await chrome.tabs.get(tabId);
      const title = tab.title || 'Untitled';

      await chrome.tabs.remove(tabId);
      logger.debug(`[TabAdapter] Closed tab ${tabId}: ${title}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `[TabAdapter] Failed to close tab ${tabId}: ${errorMessage}`,
      );
      throw new Error(`Failed to close tab ${tabId}: ${errorMessage}`);
    }
  }

  /**
   * Switch to (activate) a specific tab by ID
   *
   * @param tabId - Tab ID to switch to
   * @returns Updated tab object
   */
  async switchTab(tabId: number): Promise<chrome.tabs.Tab> {
    logger.debug(`[TabAdapter] Switching to tab ${tabId}`);

    try {
      // Update tab to be active
      const tab = await chrome.tabs.update(tabId, {active: true});

      if (!tab) {
        throw new Error('Failed to update tab');
      }

      logger.debug(
        `[TabAdapter] Switched to tab ${tabId}: ${tab.title || 'Untitled'}`,
      );
      return tab;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `[TabAdapter] Failed to switch to tab ${tabId}: ${errorMessage}`,
      );
      throw new Error(`Failed to switch to tab ${tabId}: ${errorMessage}`);
    }
  }

  /**
   * Navigate a tab to a specific URL
   *
   * @param tabId - Tab ID to navigate
   * @param url - URL to navigate to
   * @returns Updated tab object
   */
  async navigateTab(tabId: number, url: string): Promise<chrome.tabs.Tab> {
    logger.debug(`[TabAdapter] Navigating tab ${tabId} to ${url}`);

    try {
      const tab = await chrome.tabs.update(tabId, {url});

      if (!tab) {
        throw new Error('Failed to update tab');
      }

      logger.debug(`[TabAdapter] Tab ${tabId} navigating to ${url}`);
      return tab;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `[TabAdapter] Failed to navigate tab ${tabId}: ${errorMessage}`,
      );
      throw new Error(
        `Failed to navigate tab ${tabId} to ${url}: ${errorMessage}`,
      );
    }
  }
}

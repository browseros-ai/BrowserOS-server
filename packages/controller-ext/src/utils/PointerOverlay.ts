/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import {getBrowserOSAdapter} from '@/adapters/BrowserOSAdapter';
import {logger} from '@/utils/Logger';

const POINTER_DISPLAY_DURATION_MS = 3000;
const POINTER_DELAY_BEFORE_ACTION_MS = 500;

/**
 * PointerOverlay - Shows a visual mouse pointer overlay before actions
 *
 * Injects JavaScript to display a pointer arrow at the specified coordinates.
 * The pointer auto-removes after POINTER_DISPLAY_DURATION_MS.
 */
export class PointerOverlay {
  private static browserOS = getBrowserOSAdapter();

  /**
   * Show a pointer at the specified coordinates
   * @param tabId - Tab to show pointer in
   * @param x - X coordinate in viewport pixels
   * @param y - Y coordinate in viewport pixels
   * @param text - Optional label text (e.g., "Click", "Type: hello...")
   */
  static async showPointer(
    tabId: number,
    x: number,
    y: number,
    text?: string,
  ): Promise<void> {
    const pointerId = `browseros-pointer-${Date.now()}`;

    const textLabel = text
      ? `
      var label = document.createElement('div');
      label.style.cssText = 'position: absolute; top: 20px; left: 12px; background: rgba(0,0,0,0.9); color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-family: monospace; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.5);';
      label.textContent = '${text.replace(/'/g, "\\'")}';
      container.appendChild(label);
    `
      : '';

    const script = `
      (function() {
        var existing = document.querySelector('.browseros-pointer');
        if (existing) existing.remove();

        var container = document.createElement('div');
        container.id = '${pointerId}';
        container.className = 'browseros-pointer';
        container.style.cssText = 'position: fixed; left: ${x}px; top: ${y}px; z-index: 2147483647; pointer-events: none;';

        var arrow = document.createElement('div');
        arrow.style.cssText = 'width: 0; height: 0; border-style: solid; border-width: 0 12px 20px 12px; border-color: transparent transparent #FB6618 transparent; transform: translate(-3px, -3px) rotate(45deg); filter: drop-shadow(1px 1px 2px rgba(0,0,0,0.4));';
        container.appendChild(arrow);

        ${textLabel}

        document.body.appendChild(container);

        setTimeout(function() {
          var el = document.getElementById('${pointerId}');
          if (el) el.remove();
        }, ${POINTER_DISPLAY_DURATION_MS});
      })();
    `;

    try {
      await this.browserOS.executeJavaScript(tabId, script);
      logger.debug(
        `[PointerOverlay] Showed pointer at (${x}, ${y}) in tab ${tabId}${text ? ` with label "${text}"` : ''}`,
      );
    } catch (error) {
      logger.warn(
        `[PointerOverlay] Failed to show pointer: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Show pointer and wait before action
   * Returns after the delay so the action can proceed
   */
  static async showPointerAndWait(
    tabId: number,
    x: number,
    y: number,
    text?: string,
  ): Promise<void> {
    await this.showPointer(tabId, x, y, text);
    await this.delay(POINTER_DELAY_BEFORE_ACTION_MS);
  }

  /**
   * Calculate center coordinates from a rect
   */
  static getCenterCoordinates(rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): {x: number; y: number} {
    return {
      x: Math.round(rect.x + rect.width / 2),
      y: Math.round(rect.y + rect.height / 2),
    };
  }

  /**
   * Calculate left-center coordinates (for type actions)
   */
  static getLeftCenterCoordinates(rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): {x: number; y: number} {
    return {
      x: Math.round(rect.x + 10),
      y: Math.round(rect.y + rect.height / 2),
    };
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/// <reference path="../types/chrome-browser-os.d.ts" />

import { logger } from '@/utils/logger'

// ============= Re-export types from chrome.browserOS namespace =============

export type InteractiveNode = chrome.browserOS.InteractiveNode
export type InteractiveSnapshot = chrome.browserOS.InteractiveSnapshot
export type InteractiveSnapshotOptions =
  chrome.browserOS.InteractiveSnapshotOptions
export type PageLoadStatus = chrome.browserOS.PageLoadStatus
export type InteractiveNodeType = chrome.browserOS.InteractiveNodeType
export type Rect = chrome.browserOS.BoundingRect

// New snapshot types
export type SnapshotType = chrome.browserOS.SnapshotType
export type SnapshotContext = chrome.browserOS.SnapshotContext
export type SectionType = chrome.browserOS.SectionType
export type TextSnapshotResult = chrome.browserOS.TextSnapshotResult
export type LinkInfo = chrome.browserOS.LinkInfo
export type LinksSnapshotResult = chrome.browserOS.LinksSnapshotResult
export type SnapshotSection = chrome.browserOS.SnapshotSection
export type Snapshot = chrome.browserOS.Snapshot
export type SnapshotOptions = chrome.browserOS.SnapshotOptions

export type PrefObject = chrome.browserOS.PrefObject

// ============= BrowserOS Adapter =============

// Screenshot size constants
export const SCREENSHOT_SIZES = {
  small: 512, // Low token usage
  medium: 768, // Balanced (default)
  large: 1028, // High detail (note: 1028 not 1024)
} as const

export type ScreenshotSizeKey = keyof typeof SCREENSHOT_SIZES

/**
 * Adapter for Chrome BrowserOS Extension APIs
 * Provides a clean interface to browserOS functionality with extensibility
 */
export class BrowserOSAdapter {
  private static instance: BrowserOSAdapter | null = null

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): BrowserOSAdapter {
    if (!BrowserOSAdapter.instance) {
      BrowserOSAdapter.instance = new BrowserOSAdapter()
    }
    return BrowserOSAdapter.instance
  }

  /**
   * Get interactive snapshot of the current page
   */
  async getInteractiveSnapshot(
    tabId: number,
    options?: InteractiveSnapshotOptions,
  ): Promise<InteractiveSnapshot> {
    try {
      logger.debug(
        `[BrowserOSAdapter] Getting interactive snapshot for tab ${tabId} with options: ${JSON.stringify(options)}`,
      )

      return new Promise<InteractiveSnapshot>((resolve, reject) => {
        if (options) {
          chrome.browserOS.getInteractiveSnapshot(
            tabId,
            options,
            (snapshot: InteractiveSnapshot) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message))
              } else {
                logger.debug(
                  `[BrowserOSAdapter] Retrieved snapshot with ${snapshot.elements.length} elements`,
                )
                resolve(snapshot)
              }
            },
          )
        } else {
          chrome.browserOS.getInteractiveSnapshot(
            tabId,
            (snapshot: InteractiveSnapshot) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message))
              } else {
                logger.debug(
                  `[BrowserOSAdapter] Retrieved snapshot with ${snapshot.elements.length} elements`,
                )
                resolve(snapshot)
              }
            },
          )
        }
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(
        `[BrowserOSAdapter] Failed to get interactive snapshot: ${errorMessage}`,
      )
      throw new Error(`Failed to get interactive snapshot: ${errorMessage}`)
    }
  }

  /**
   * Click an element by node ID
   */
  async click(tabId: number, nodeId: number): Promise<void> {
    try {
      logger.debug(`[BrowserOSAdapter] Clicking node ${nodeId} in tab ${tabId}`)

      return new Promise<void>((resolve, reject) => {
        chrome.browserOS.click(tabId, nodeId, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve()
          }
        })
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(`[BrowserOSAdapter] Failed to click node: ${errorMessage}`)
      throw new Error(`Failed to click node ${nodeId}: ${errorMessage}`)
    }
  }

  /**
   * Input text into an element
   */
  async inputText(tabId: number, nodeId: number, text: string): Promise<void> {
    try {
      logger.debug(
        `[BrowserOSAdapter] Inputting text into node ${nodeId} in tab ${tabId}`,
      )

      return new Promise<void>((resolve, reject) => {
        chrome.browserOS.inputText(tabId, nodeId, text, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve()
          }
        })
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(`[BrowserOSAdapter] Failed to input text: ${errorMessage}`)
      throw new Error(
        `Failed to input text into node ${nodeId}: ${errorMessage}`,
      )
    }
  }

  /**
   * Clear text from an element
   */
  async clear(tabId: number, nodeId: number): Promise<void> {
    try {
      logger.debug(`[BrowserOSAdapter] Clearing node ${nodeId} in tab ${tabId}`)

      return new Promise<void>((resolve, reject) => {
        chrome.browserOS.clear(tabId, nodeId, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve()
          }
        })
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(`[BrowserOSAdapter] Failed to clear node: ${errorMessage}`)
      throw new Error(`Failed to clear node ${nodeId}: ${errorMessage}`)
    }
  }

  /**
   * Scroll to a specific node
   */
  async scrollToNode(tabId: number, nodeId: number): Promise<boolean> {
    try {
      logger.debug(
        `[BrowserOSAdapter] Scrolling to node ${nodeId} in tab ${tabId}`,
      )

      return new Promise<boolean>((resolve, reject) => {
        chrome.browserOS.scrollToNode(tabId, nodeId, (scrolled: boolean) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve(scrolled)
          }
        })
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(
        `[BrowserOSAdapter] Failed to scroll to node: ${errorMessage}`,
      )
      throw new Error(`Failed to scroll to node ${nodeId}: ${errorMessage}`)
    }
  }

  /**
   * Send keyboard keys
   */
  async sendKeys(tabId: number, keys: chrome.browserOS.Key): Promise<void> {
    try {
      logger.debug(`[BrowserOSAdapter] Sending keys "${keys}" to tab ${tabId}`)

      return new Promise<void>((resolve, reject) => {
        chrome.browserOS.sendKeys(tabId, keys, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve()
          }
        })
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(`[BrowserOSAdapter] Failed to send keys: ${errorMessage}`)
      throw new Error(`Failed to send keys: ${errorMessage}`)
    }
  }

  /**
   * Get page load status
   */
  async getPageLoadStatus(tabId: number): Promise<PageLoadStatus> {
    try {
      logger.debug(
        `[BrowserOSAdapter] Getting page load status for tab ${tabId}`,
      )

      return new Promise<PageLoadStatus>((resolve, reject) => {
        chrome.browserOS.getPageLoadStatus(tabId, (status: PageLoadStatus) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve(status)
          }
        })
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(
        `[BrowserOSAdapter] Failed to get page load status: ${errorMessage}`,
      )
      throw new Error(`Failed to get page load status: ${errorMessage}`)
    }
  }

  /**
   * Get accessibility tree (if available)
   */
  async getAccessibilityTree(
    tabId: number,
  ): Promise<chrome.browserOS.AccessibilityTree> {
    try {
      logger.debug(
        `[BrowserOSAdapter] Getting accessibility tree for tab ${tabId}`,
      )

      return new Promise<chrome.browserOS.AccessibilityTree>(
        (resolve, reject) => {
          chrome.browserOS.getAccessibilityTree(
            tabId,
            (tree: chrome.browserOS.AccessibilityTree) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message))
              } else {
                resolve(tree)
              }
            },
          )
        },
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(
        `[BrowserOSAdapter] Failed to get accessibility tree: ${errorMessage}`,
      )
      throw new Error(`Failed to get accessibility tree: ${errorMessage}`)
    }
  }

  /**
   * Capture a screenshot of the tab
   * @param tabId - The tab ID to capture
   * @param size - Optional screenshot size ('small', 'medium', or 'large')
   * @param showHighlights - Optional flag to show element highlights
   * @param width - Optional exact width for screenshot
   * @param height - Optional exact height for screenshot
   */
  async captureScreenshot(
    tabId: number,
    size?: ScreenshotSizeKey,
    showHighlights?: boolean,
    width?: number,
    height?: number,
  ): Promise<string> {
    try {
      const sizeDesc = size ? ` (${size})` : ''
      const highlightDesc = showHighlights ? ' with highlights' : ''
      const dimensionsDesc = width && height ? ` (${width}x${height})` : ''
      logger.debug(
        `[BrowserOSAdapter] Capturing screenshot for tab ${tabId}${sizeDesc}${highlightDesc}${dimensionsDesc}`,
      )

      return new Promise<string>((resolve, reject) => {
        // Use exact dimensions if provided
        if (width !== undefined && height !== undefined) {
          chrome.browserOS.captureScreenshot(
            tabId,
            0, // thumbnailSize ignored when width/height specified
            showHighlights || false,
            width,
            height,
            (dataUrl: string) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message))
              } else {
                logger.debug(
                  `[BrowserOSAdapter] Screenshot captured for tab ${tabId} (${width}x${height})${highlightDesc}`,
                )
                resolve(dataUrl)
              }
            },
          )
        } else if (size !== undefined || showHighlights !== undefined) {
          const pixelSize = size ? SCREENSHOT_SIZES[size] : 0
          // Use the API with thumbnail size and highlights
          if (showHighlights !== undefined) {
            chrome.browserOS.captureScreenshot(
              tabId,
              pixelSize,
              showHighlights,
              (dataUrl: string) => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message))
                } else {
                  logger.debug(
                    `[BrowserOSAdapter] Screenshot captured for tab ${tabId}${sizeDesc}${highlightDesc}`,
                  )
                  resolve(dataUrl)
                }
              },
            )
          } else {
            chrome.browserOS.captureScreenshot(
              tabId,
              pixelSize,
              (dataUrl: string) => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message))
                } else {
                  logger.debug(
                    `[BrowserOSAdapter] Screenshot captured for tab ${tabId} (${size}: ${pixelSize}px)`,
                  )
                  resolve(dataUrl)
                }
              },
            )
          }
        } else {
          // Use the original API without size (backwards compatibility)
          chrome.browserOS.captureScreenshot(tabId, (dataUrl: string) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              logger.debug(
                `[BrowserOSAdapter] Screenshot captured for tab ${tabId}`,
              )
              resolve(dataUrl)
            }
          })
        }
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(
        `[BrowserOSAdapter] Failed to capture screenshot: ${errorMessage}`,
      )
      throw new Error(`Failed to capture screenshot: ${errorMessage}`)
    }
  }

  /**
   * Get a content snapshot from the page
   */
  async getSnapshot(tabId: number, _type: SnapshotType): Promise<Snapshot> {
    try {
      logger.debug(`[BrowserOSAdapter] Getting snapshot for tab ${tabId}`)

      return new Promise<Snapshot>((resolve, reject) => {
        chrome.browserOS.getSnapshot(tabId, (snapshot: Snapshot) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            logger.debug(
              `[BrowserOSAdapter] Retrieved snapshot: ${JSON.stringify(snapshot)}`,
            )
            resolve(snapshot)
          }
        })
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(`[BrowserOSAdapter] Failed to get snapshot: ${errorMessage}`)
      throw new Error(`Failed to get snapshot: ${errorMessage}`)
    }
  }

  /**
   * Get text content snapshot from the page
   * Convenience method (deprecated - use getSnapshot directly)
   * Use getSnapshot(tabId, 'text') instead
   */
  async getTextSnapshot(tabId: number): Promise<Snapshot> {
    return this.getSnapshot(tabId, 'text')
  }

  /**
   * Get links snapshot from the page
   * Convenience method (deprecated - use getSnapshot directly)
   * Use getSnapshot(tabId, 'links') instead
   */
  async getLinksSnapshot(tabId: number): Promise<Snapshot> {
    return this.getSnapshot(tabId, 'links')
  }

  /**
   * Generic method to invoke any BrowserOS API
   * Useful for future APIs or experimental features
   */
  async invokeAPI(method: string, ...args: unknown[]): Promise<unknown> {
    try {
      logger.debug(`[BrowserOSAdapter] Invoking BrowserOS API: ${method}`)

      if (!(method in chrome.browserOS)) {
        throw new Error(`Unknown BrowserOS API method: ${method}`)
      }

      // @ts-expect-error - Dynamic API invocation
      const result = await chrome.browserOS[method](...args)
      return result
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(
        `[BrowserOSAdapter] Failed to invoke API ${method}: ${errorMessage}`,
      )
      throw new Error(
        `Failed to invoke BrowserOS API ${method}: ${errorMessage}`,
      )
    }
  }

  /**
   * Check if a specific API is available
   */
  isAPIAvailable(method: string): boolean {
    return method in chrome.browserOS
  }

  /**
   * Get list of available BrowserOS APIs
   */
  getAvailableAPIs(): string[] {
    return Object.keys(chrome.browserOS).filter((key) => {
      // @ts-expect-error - Dynamic key access for API discovery
      return typeof chrome.browserOS[key] === 'function'
    })
  }

  /**
   * Get BrowserOS version information
   */
  async getVersion(): Promise<string | null> {
    try {
      logger.debug('[BrowserOSAdapter] Getting BrowserOS version')

      return new Promise<string | null>((resolve, reject) => {
        // Check if getVersionNumber API is available
        if (
          'getVersionNumber' in chrome.browserOS &&
          typeof chrome.browserOS.getVersionNumber === 'function'
        ) {
          chrome.browserOS.getVersionNumber((version: string) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              logger.debug(`[BrowserOSAdapter] BrowserOS version: ${version}`)
              resolve(version)
            }
          })
        } else {
          // Fallback - return null if API not available
          resolve(null)
        }
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(`[BrowserOSAdapter] Failed to get version: ${errorMessage}`)
      // Return null on error
      return null
    }
  }

  /**
   * Log a metric event with optional properties
   */
  async logMetric(
    eventName: string,
    properties?: Record<string, unknown>,
  ): Promise<void> {
    try {
      logger.debug(
        `[BrowserOSAdapter] Logging metric: ${eventName} with properties: ${JSON.stringify(properties)}`,
      )

      return new Promise<void>((resolve, reject) => {
        // Check if logMetric API is available
        if (
          'logMetric' in chrome.browserOS &&
          typeof chrome.browserOS.logMetric === 'function'
        ) {
          if (properties) {
            chrome.browserOS.logMetric(eventName, properties, () => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message))
              } else {
                logger.debug(`[BrowserOSAdapter] Metric logged: ${eventName}`)
                resolve()
              }
            })
          } else {
            chrome.browserOS.logMetric(eventName, () => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message))
              } else {
                logger.debug(`[BrowserOSAdapter] Metric logged: ${eventName}`)
                resolve()
              }
            })
          }
        } else {
          // If API not available, log a warning but don't fail
          logger.warn(
            `[BrowserOSAdapter] logMetric API not available, skipping metric: ${eventName}`,
          )
          resolve()
        }
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(`[BrowserOSAdapter] Failed to log metric: ${errorMessage}`)
      return
    }
  }

  /**
   * Execute JavaScript code in the specified tab
   * @param tabId - The tab ID to execute code in
   * @param code - The JavaScript code to execute
   * @returns The result of the execution
   */
  async executeJavaScript(tabId: number, code: string): Promise<unknown> {
    try {
      logger.debug(`[BrowserOSAdapter] Executing JavaScript in tab ${tabId}`)

      return new Promise<unknown>((resolve, reject) => {
        // Check if executeJavaScript API is available
        if (
          'executeJavaScript' in chrome.browserOS &&
          typeof chrome.browserOS.executeJavaScript === 'function'
        ) {
          chrome.browserOS.executeJavaScript(tabId, code, (result: unknown) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              logger.debug(
                `[BrowserOSAdapter] JavaScript executed successfully in tab ${tabId}`,
              )
              resolve(result)
            }
          })
        } else {
          reject(new Error('executeJavaScript API not available'))
        }
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(
        `[BrowserOSAdapter] Failed to execute JavaScript: ${errorMessage}`,
      )
      throw new Error(`Failed to execute JavaScript: ${errorMessage}`)
    }
  }

  /**
   * Click at specific viewport coordinates
   * @param tabId - The tab ID to click in
   * @param x - X coordinate in viewport pixels
   * @param y - Y coordinate in viewport pixels
   */
  async clickCoordinates(tabId: number, x: number, y: number): Promise<void> {
    try {
      logger.debug(
        `[BrowserOSAdapter] Clicking at coordinates (${x}, ${y}) in tab ${tabId}`,
      )

      return new Promise<void>((resolve, reject) => {
        // Check if clickCoordinates API is available
        if (
          'clickCoordinates' in chrome.browserOS &&
          typeof chrome.browserOS.clickCoordinates === 'function'
        ) {
          chrome.browserOS.clickCoordinates(tabId, x, y, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              logger.debug(
                `[BrowserOSAdapter] Successfully clicked at (${x}, ${y}) in tab ${tabId}`,
              )
              resolve()
            }
          })
        } else {
          reject(new Error('clickCoordinates API not available'))
        }
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(
        `[BrowserOSAdapter] Failed to click at coordinates: ${errorMessage}`,
      )
      throw new Error(
        `Failed to click at coordinates (${x}, ${y}): ${errorMessage}`,
      )
    }
  }

  /**
   * Type text at specific viewport coordinates
   * @param tabId - The tab ID to type in
   * @param x - X coordinate in viewport pixels
   * @param y - Y coordinate in viewport pixels
   * @param text - Text to type at the location
   */
  async typeAtCoordinates(
    tabId: number,
    x: number,
    y: number,
    text: string,
  ): Promise<void> {
    try {
      logger.debug(
        `[BrowserOSAdapter] Typing at coordinates (${x}, ${y}) in tab ${tabId}`,
      )

      return new Promise<void>((resolve, reject) => {
        // Check if typeAtCoordinates API is available
        if (
          'typeAtCoordinates' in chrome.browserOS &&
          typeof chrome.browserOS.typeAtCoordinates === 'function'
        ) {
          chrome.browserOS.typeAtCoordinates(tabId, x, y, text, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              logger.debug(
                `[BrowserOSAdapter] Successfully typed "${text}" at (${x}, ${y}) in tab ${tabId}`,
              )
              resolve()
            }
          })
        } else {
          reject(new Error('typeAtCoordinates API not available'))
        }
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(
        `[BrowserOSAdapter] Failed to type at coordinates: ${errorMessage}`,
      )
      throw new Error(
        `Failed to type at coordinates (${x}, ${y}): ${errorMessage}`,
      )
    }
  }

  /**
   * Get a specific preference value
   * @param name - The preference name (e.g., "browseros.server.mcp_port")
   * @returns Promise resolving to the preference object containing key, type, and value
   */
  async getPref(name: string): Promise<PrefObject> {
    try {
      console.log(`[BrowserOSAdapter] Getting preference: ${name}`)

      return new Promise<PrefObject>((resolve, reject) => {
        chrome.browserOS.getPref(name, (pref: PrefObject) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            console.log(
              `[BrowserOSAdapter] Retrieved preference ${name}: ${JSON.stringify(pref)}`,
            )
            resolve(pref)
          }
        })
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      console.error(
        `[BrowserOSAdapter] Failed to get preference: ${errorMessage}`,
      )
      throw new Error(`Failed to get preference ${name}: ${errorMessage}`)
    }
  }

  /**
   * Set a specific preference value
   * @param name - The preference name (e.g., "browseros.server.mcp_enabled")
   * @param value - The value to set
   * @param pageId - Optional page ID for settings tracking
   * @returns Promise resolving to true if successful
   */
  async setPref(
    name: string,
    value: unknown,
    pageId?: string,
  ): Promise<boolean> {
    try {
      console.log(
        `[BrowserOSAdapter] Setting preference ${name} to ${JSON.stringify(value)}`,
      )

      return new Promise<boolean>((resolve, reject) => {
        if (pageId !== undefined) {
          chrome.browserOS.setPref(name, value, pageId, (success: boolean) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              console.log(
                `[BrowserOSAdapter] Successfully set preference ${name}`,
              )
              resolve(success)
            }
          })
        } else {
          chrome.browserOS.setPref(name, value, (success: boolean) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              console.log(
                `[BrowserOSAdapter] Successfully set preference ${name}`,
              )
              resolve(success)
            }
          })
        }
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      console.error(
        `[BrowserOSAdapter] Failed to set preference: ${errorMessage}`,
      )
      throw new Error(`Failed to set preference ${name}: ${errorMessage}`)
    }
  }

  /**
   * Get all preferences (filtered to browseros.* prefs)
   * @returns Promise resolving to array of preference objects
   */
  async getAllPrefs(): Promise<PrefObject[]> {
    try {
      console.log('[BrowserOSAdapter] Getting all preferences')

      return new Promise<PrefObject[]>((resolve, reject) => {
        chrome.browserOS.getAllPrefs((prefs: PrefObject[]) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            console.log(
              `[BrowserOSAdapter] Retrieved ${prefs.length} preferences`,
            )
            resolve(prefs)
          }
        })
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      console.error(
        `[BrowserOSAdapter] Failed to get all preferences: ${errorMessage}`,
      )
      throw new Error(`Failed to get all preferences: ${errorMessage}`)
    }
  }
}

// Export singleton instance getter for convenience
export const getBrowserOSAdapter = () => BrowserOSAdapter.getInstance()

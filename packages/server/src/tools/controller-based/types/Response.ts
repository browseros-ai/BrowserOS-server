/**
 * @license
 * Copyright 2025 BrowserOS
 */

/**
 * Image content data for screenshot attachments
 */
export interface ImageContentData {
  data: string; // base64-encoded image data
  mimeType: string; // e.g., 'image/png'
}

/**
 * Response builder interface for controller tools.
 * Supports formatted text output and image attachments.
 */
export interface Response {
  /**
   * Append a line of text to the response
   */
  appendResponseLine(value: string): void;

  /**
   * Attach an image to the response (for screenshots)
   */
  attachImage(value: ImageContentData): void;

  /**
   * Get all response lines (read-only)
   */
  readonly responseLines: readonly string[];

  /**
   * Get all attached images (read-only)
   */
  readonly images: ImageContentData[];

  /**
   * Add a key-value pair to structured content (flat, no nesting)
   */
  addStructuredContent(key: string, value: unknown): void;
}

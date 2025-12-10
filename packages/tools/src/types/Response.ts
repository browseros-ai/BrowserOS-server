/**
 * @license
 * Copyright 2025 BrowserOS
 */

/**
 * Image content data for attachments
 */
export interface ImageContentData {
  data: string;
  mimeType: string;
}

/**
 * Response builder interface for tool handlers
 */
export interface Response {
  /** Append a text line to the response */
  appendResponseLine(value: string): void;

  /** Include page information in the response */
  setIncludePages(value: boolean): void;

  /** Include network request information */
  setIncludeNetworkRequests(
    value: boolean,
    options?: {
      pageSize?: number;
      pageIdx?: number;
      resourceTypes?: string[];
    },
  ): void;

  /** Include console messages in the response */
  setIncludeConsoleData(value: boolean): void;

  /** Include accessibility snapshot */
  setIncludeSnapshot(value: boolean): void;

  /** Attach an image to the response */
  attachImage(value: ImageContentData): void;

  /** Attach network request details */
  attachNetworkRequest(url: string): void;

  /** Add a key-value pair to structured content (flat, no nesting) */
  addStructuredContent(key: string, value: unknown): void;
}

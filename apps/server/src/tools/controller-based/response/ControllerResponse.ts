/**
 * @license
 * Copyright 2025 BrowserOS
 */
import type {
  TextContent,
  ImageContent,
} from '@modelcontextprotocol/sdk/types.js';

import type {Response, ImageContentData} from '../types/Response.js';

/**
 * Response builder for controller tools.
 * Collects text lines and images, then converts to MCP content format.
 */
export class ControllerResponse implements Response {
  #textResponseLines: string[] = [];
  #images: ImageContentData[] = [];
  #structuredContent: Record<string, unknown> = {};

  appendResponseLine(value: string): void {
    this.#textResponseLines.push(value);
  }

  attachImage(value: ImageContentData): void {
    this.#images.push(value);
  }

  get responseLines(): readonly string[] {
    return this.#textResponseLines;
  }

  get images(): ImageContentData[] {
    return this.#images;
  }

  addStructuredContent(key: string, value: unknown): void {
    if (!key || typeof key !== 'string') {
      return;
    }
    if (value === undefined) {
      return;
    }
    this.#structuredContent[key] = value;
  }

  get structuredContent(): Record<string, unknown> | undefined {
    return Object.keys(this.#structuredContent).length > 0
      ? this.#structuredContent
      : undefined;
  }

  /**
   * Convert collected data to MCP content format
   */
  toContent(): Array<TextContent | ImageContent> {
    const content: Array<TextContent | ImageContent> = [];

    // Add text if any
    if (this.#textResponseLines.length > 0) {
      content.push({
        type: 'text',
        text: this.#textResponseLines.join('\n'),
      });
    }

    // Add images if any
    for (const image of this.#images) {
      content.push({
        type: 'image',
        data: image.data,
        mimeType: image.mimeType,
      });
    }

    // Default to success message if no content
    return content.length > 0 ? content : [{type: 'text', text: 'Success'}];
  }
}

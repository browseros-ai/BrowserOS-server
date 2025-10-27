/**
 * @license
 * Copyright 2025 BrowserOS
 */

export interface ParsedDataUrl {
  mimeType: string;
  data: string;
}

/**
 * Parse a data URL (e.g., from screenshot) into MIME type and base64 data
 *
 * @param dataUrl - Data URL string (e.g., "data:image/png;base64,iVBORw...")
 * @returns Parsed MIME type and base64 data
 * @throws Error if data URL format is invalid
 */
export function parseDataUrl(dataUrl: string): ParsedDataUrl {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

  if (!match) {
    throw new Error(`Invalid data URL format: ${dataUrl.substring(0, 50)}...`);
  }

  const [, mimeType, data] = match;

  // Validate it's an image
  if (!mimeType.startsWith('image/')) {
    throw new Error(`Expected image MIME type, got: ${mimeType}`);
  }

  // Basic base64 validation
  if (!/^[A-Za-z0-9+/]+=*$/.test(data)) {
    throw new Error('Invalid base64 data in data URL');
  }

  return {mimeType, data};
}

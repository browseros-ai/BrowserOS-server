import type { Content, Part } from '@google/genai';

const MAX_CONTEXT_LENGTH = 32000; // ~8k tokens

export function extractTextFromPart(part: Part): string {
  if ('text' in part && typeof part.text === 'string') {
    return part.text;
  }
  return '';
}

export function extractTextFromContent(content: Content): string {
  if (!content.parts) return '';

  return content.parts
    .map(extractTextFromPart)
    .filter(Boolean)
    .join('\n');
}

export function buildExtractionContext(
  history: Content[],
  maxResponses: number = 4,
): string | null {
  // Get last N model responses
  const modelResponses = history
    .filter((msg) => msg.role === 'model')
    .slice(-maxResponses);

  if (modelResponses.length === 0) {
    return null;
  }

  // Extract text from each model response
  const texts = modelResponses
    .map(extractTextFromContent)
    .filter(Boolean);

  if (texts.length === 0) {
    return null;
  }

  let context = texts.join('\n\n---\n\n');

  // Truncate from start if too long
  if (context.length > MAX_CONTEXT_LENGTH) {
    context = context.slice(-MAX_CONTEXT_LENGTH);
  }

  return context;
}

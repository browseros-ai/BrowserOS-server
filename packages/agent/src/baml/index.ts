/**
 * BAML Structured Output Module
 *
 * Uses BAML's Modular API for structured data extraction:
 * - b.request.* → Renders prompts with schema via ctx.output_format()
 * - b.parse.* → Parses responses with SAP (~99% success rate)
 *
 * LLM calls are made via Vercel AI SDK (not BAML's HTTP client).
 */

export { BAMLExtractor, getBAMLExtractor } from './extractor.js';
export { jsonSchemaToBAML, type JSONSchema } from './schemaConverter.js';

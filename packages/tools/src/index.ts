/**
 * @license
 * Copyright 2025 BrowserOS
 *
 * Main entry point for @browseros/tools package
 */

// Export all tool definitions
export {allTools} from './definitions/index.js';
export * as tools from './definitions/index.js';

// Export types
export * from './types/index.js';

// Export response handler
export {McpResponse} from './response/index.js';

// Export formatters for custom use
export * as formatters from './formatters/index.js';

// Re-export specific tool categories for direct import
export {console} from './definitions/index.js';
export {emulation} from './definitions/index.js';
export {input} from './definitions/index.js';
export {network} from './definitions/index.js';
export {pages} from './definitions/index.js';
export {screenshot} from './definitions/index.js';
export {script} from './definitions/index.js';
export {snapshot} from './definitions/index.js';

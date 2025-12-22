/**
 * @license
 * Copyright 2025 BrowserOS
 *
 * Main entry point for @browseros/tools package
 */

// Export CDP-based tools (Chrome DevTools Protocol)
export {allCdpTools} from './cdp-based/index.js';
export * as cdpTools from './cdp-based/index.js';

// Export controller-based tools (BrowserOS Controller via Extension)
export {allControllerTools} from './controller-based/index.js';
export * as controllerTools from './controller-based/index.js';

// Export types
export * from './types/index.js';

// Export response handlers
export {McpResponse} from './response/index.js';

// Export formatters for custom use
export * as formatters from './formatters/index.js';

// Re-export specific CDP tool categories for direct import
export {console} from './cdp-based/index.js';
export {emulation} from './cdp-based/index.js';
export {input} from './cdp-based/index.js';
export {network} from './cdp-based/index.js';
export {pages} from './cdp-based/index.js';
export {screenshot} from './cdp-based/index.js';
export {script} from './cdp-based/index.js';
export {snapshot} from './cdp-based/index.js';

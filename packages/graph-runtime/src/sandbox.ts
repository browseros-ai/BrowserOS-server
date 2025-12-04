/**
 * Sandbox Executor for Graph Runtime
 *
 * Provides isolated code execution with restricted file/network access.
 * Less aggressive sandbox - blocks file system and non-localhost network only.
 */

import { Agent } from './index.js';

interface SandboxConfig {
  mcpServerUrl: string;
  agentServerUrl: string;
  llmProvider?: string;
  llmModel?: string;
  apiKey?: string;
}

interface SandboxResult {
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
}

// Create a fetch wrapper that only allows localhost
function createSafeFetch(originalFetch: typeof fetch) {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const parsed = new URL(url);

    const isLocalhost =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '0.0.0.0' ||
      parsed.hostname.endsWith('.localhost');

    if (!isLocalhost) {
      throw new Error(`[sandbox] Network access blocked: ${parsed.hostname} (only localhost allowed)`);
    }

    return originalFetch(input, init);
  };
}

export class SandboxExecutor {
  private config: SandboxConfig;

  constructor(config: SandboxConfig) {
    this.config = config;
  }

  async execute(code: string): Promise<SandboxResult> {
    const startTime = Date.now();

    const agent = new Agent({
      mcpServerUrl: this.config.mcpServerUrl,
      agentServerUrl: this.config.agentServerUrl,
      llmProvider: this.config.llmProvider,
      llmModel: this.config.llmModel,
      apiKey: this.config.apiKey,
    });

    // Safe console that prefixes output
    const safeConsole = {
      log: (...args: any[]) => console.log('[sandbox]', ...args),
      warn: (...args: any[]) => console.warn('[sandbox]', ...args),
      error: (...args: any[]) => console.error('[sandbox]', ...args),
      info: (...args: any[]) => console.info('[sandbox]', ...args),
    };

    // Safe fetch - only allows localhost
    const safeFetch = createSafeFetch(fetch);

    // Globals available to sandbox code
    const sandboxGlobals: Record<string, any> = {
      agent,
      console: safeConsole,
      fetch: safeFetch,
      // Standard JS globals
      JSON,
      Promise,
      Array,
      Object,
      String,
      Number,
      Boolean,
      Math,
      Date,
      Error,
      TypeError,
      RangeError,
      SyntaxError,
      ReferenceError,
      Map,
      Set,
      WeakMap,
      WeakSet,
      Symbol,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      encodeURI,
      decodeURI,
      encodeURIComponent,
      decodeURIComponent,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      // Block file system access
      require: undefined,
      Bun: undefined,
    };

    try {
      console.log('[sandbox] Executing code...');

      const paramNames = Object.keys(sandboxGlobals);
      const paramValues = Object.values(sandboxGlobals);

      // Wrap code in async IIFE
      const wrappedCode = `
        return (async () => {
          ${code}
        })();
      `;

      const sandboxedFn = new Function(...paramNames, wrappedCode);
      const result = await sandboxedFn(...paramValues);

      await agent.close();

      return {
        success: true,
        result,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      await agent.close();

      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[sandbox] Execution failed:', errorMessage);

      return {
        success: false,
        error: errorMessage,
        duration: Date.now() - startTime,
      };
    }
  }
}

export async function executeInSandbox(
  code: string,
  config: SandboxConfig,
): Promise<SandboxResult> {
  const executor = new SandboxExecutor(config);
  return executor.execute(code);
}

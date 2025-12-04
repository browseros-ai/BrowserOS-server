/**
 * @browseros/graph-runtime
 *
 * Runtime library for executing BrowserOS graphs.
 * Generated code imports this to interface with the browser.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { ZodSchema } from 'zod';

interface RuntimeConfig {
  mcpServerUrl: string;
  agentServerUrl: string;
  llmProvider?: string;
  llmModel?: string;
  apiKey?: string;
}

interface NavOptions {
  timeout?: number;
}

interface ActOptions {
  context?: Record<string, any>;
  maxSteps?: number;
}

interface ExtractOptions<T> {
  schema: ZodSchema<T>;
  context?: Record<string, any>;
}

interface AnswerOptions<T> {
  schema?: ZodSchema<T>;
  context?: Record<string, any>;
}

type Operation =
  | { type: 'nav'; url: string; options?: NavOptions }
  | { type: 'act'; instruction: string; options?: ActOptions }
  | { type: 'extract'; instruction: string; options: ExtractOptions<any> }
  | { type: 'answer'; prompt: string; options?: AnswerOptions<any> };

export class Agent {
  private config: RuntimeConfig;
  private chain: Operation[] = [];
  private conversationId: string;
  private memory: any[] = [];
  private mcpClient: Client | null = null;
  private mcpConnected: boolean = false;

  constructor(config: RuntimeConfig) {
    this.config = config;
    this.conversationId = crypto.randomUUID();
  }

  private async ensureMcpConnected(): Promise<Client> {
    if (this.mcpClient && this.mcpConnected) {
      return this.mcpClient;
    }

    console.log(`[graph-runtime] Connecting to MCP server: ${this.config.mcpServerUrl}`);

    this.mcpClient = new Client({
      name: 'graph-runtime',
      version: '0.0.1',
    });

    const transport = new StreamableHTTPClientTransport(
      new URL(this.config.mcpServerUrl)
    );

    await this.mcpClient.connect(transport);
    this.mcpConnected = true;

    console.log(`[graph-runtime] MCP client connected`);
    return this.mcpClient;
  }

  nav(url: string, options?: NavOptions): this {
    this.chain.push({ type: 'nav', url, options });
    return this;
  }

  act(instruction: string, options?: ActOptions): this {
    this.chain.push({ type: 'act', instruction, options });
    return this;
  }

  extract<T>(instruction: string, options: ExtractOptions<T>): this {
    this.chain.push({ type: 'extract', instruction, options });
    return this;
  }

  answer<T>(prompt: string, options?: AnswerOptions<T>): this {
    this.chain.push({ type: 'answer', prompt, options });
    return this;
  }

  async exec(): Promise<any> {
    let lastResult: any;

    for (const op of this.chain) {
      console.log(`[graph-runtime] Executing: ${op.type}`);

      switch (op.type) {
        case 'nav':
          await this.executeNav(op.url, op.options);
          break;
        case 'act':
          await this.executeAct(op.instruction, op.options);
          break;
        case 'extract':
          lastResult = await this.executeExtract(op.instruction, op.options);
          break;
        case 'answer':
          lastResult = await this.executeAnswer(op.prompt, op.options);
          break;
      }
    }

    this.chain = [];
    return lastResult;
  }

  async close(): Promise<void> {
    if (this.mcpClient) {
      await this.mcpClient.close();
      this.mcpClient = null;
      this.mcpConnected = false;
    }
  }


  async listTabs(): Promise<Array<{ id: number; url: string; title: string; active: boolean }>> {
    console.log(`[graph-runtime] listTabs`);

    const client = await this.ensureMcpConnected();

    const result = await client.callTool({
      name: 'browser_list_tabs',
      arguments: {},
    });

    if (result.isError) {
      const errorText = result.content?.[0]?.type === 'text'
        ? (result.content[0] as any).text
        : 'Unknown error';
      throw new Error(`listTabs failed: ${errorText}`);
    }

    // Use native MCP structuredContent
    const structured = (result as any).structuredContent;
    const tabs = structured?.tabs || [];
    console.log(`[graph-runtime] listTabs: found ${tabs.length} tabs`);
    return tabs;
  }

  async switchToTab(tabId: number): Promise<void> {
    console.log(`[graph-runtime] switchToTab: ${tabId}`);

    const client = await this.ensureMcpConnected();

    const result = await client.callTool({
      name: 'browser_switch_tab',
      arguments: { tabId },
    });

    if (result.isError) {
      const errorText = result.content?.[0]?.type === 'text'
        ? (result.content[0] as any).text
        : 'Unknown error';
      throw new Error(`switchToTab failed: ${errorText}`);
    }

    console.log(`[graph-runtime] switchToTab complete`);
  }

  private async executeNav(url: string, options?: NavOptions): Promise<void> {
    console.log(`[graph-runtime] nav: ${url}`);

    const client = await this.ensureMcpConnected();

    const result = await client.callTool({
      name: 'browser_navigate',
      arguments: { url },
    });

    if (result.isError) {
      const errorText = result.content?.[0]?.type === 'text'
        ? (result.content[0] as any).text
        : 'Unknown error';
      throw new Error(`nav failed: ${errorText}`);
    }

    console.log(`[graph-runtime] nav complete`);
    this.memory.push({ type: 'nav', url, success: true });
  }

  private async executeAct(instruction: string, options?: ActOptions): Promise<void> {
    console.log(`[graph-runtime] act: ${instruction}`);

    const message = options?.context
      ? `${instruction}\n\nUse this data where appropriate:\n${JSON.stringify(options.context, null, 2)}`
      : instruction;

    const result = await this.callAgent(message);

    console.log(`[graph-runtime] act complete`);
    this.memory.push({ type: 'act', instruction, result });
  }

  private async executeExtract<T>(instruction: string, options: ExtractOptions<T>): Promise<T> {
    console.log(`[graph-runtime] extract: ${instruction}`);

    // Handle both Zod schemas and plain object schemas
    const schemaDescription = (options.schema as any)?._def
      ? JSON.stringify((options.schema as any)._def, null, 2)
      : JSON.stringify(options.schema, null, 2);

    const message = `Extract data from the current page.

Instruction: ${instruction}

Return ONLY valid JSON matching this structure (no markdown, no explanation):
${schemaDescription}

${options.context ? `Additional context:\n${JSON.stringify(options.context, null, 2)}` : ''}`;

    const result = await this.callAgent(message);

    // Try to parse JSON from the response
    const jsonMatch = result.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error(`extract failed: could not parse JSON from response`);
    }

    const parsed = JSON.parse(jsonMatch[0]);

    console.log(`[graph-runtime] extract complete:`, parsed);
    this.memory.push({ type: 'extract', instruction, result: parsed });

    return parsed;
  }

  private async executeAnswer<T>(prompt: string, options?: AnswerOptions<T>): Promise<T | string> {
    console.log(`[graph-runtime] answer: ${prompt}`);

    const memoryContext = this.memory.length > 0
      ? `\n\nPrevious operations in this session:\n${JSON.stringify(this.memory, null, 2)}`
      : '';

    const schemaInstruction = options?.schema
      ? `\n\nReturn ONLY valid JSON matching this structure:\n${JSON.stringify(options.schema._def, null, 2)}`
      : '';

    const message = `${prompt}${memoryContext}${options?.context ? `\n\nAdditional context:\n${JSON.stringify(options.context, null, 2)}` : ''}${schemaInstruction}`;

    const result = await this.callAgent(message);

    if (options?.schema) {
      const jsonMatch = result.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }

    return result;
  }

  private async callAgent(message: string): Promise<string> {
    const response = await fetch(`${this.config.agentServerUrl}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: this.conversationId,
        message,
        provider: this.config.llmProvider || 'browseros',
        model: this.config.llmModel || 'default-model',
        apiKey: this.config.apiKey,
      }),
    });

    if (!response.ok) {
      throw new Error(`Agent call failed: ${response.status} ${response.statusText}`);
    }

    // Parse SSE stream to get final text
    const text = await response.text();
    const finalText = this.parseSSEResponse(text);

    return finalText;
  }

  private parseSSEResponse(sseText: string): string {
    // SSE format: lines starting with "data: " followed by JSON
    // We want to extract all text parts and concatenate them
    const lines = sseText.split('\n');
    const textParts: string[] = [];

    for (const line of lines) {
      if (line.startsWith('0:')) {
        // Vercel AI format: 0:["text","content"]
        try {
          const jsonPart = line.slice(2);
          const parsed = JSON.parse(jsonPart);
          if (Array.isArray(parsed) && parsed[0] === 'text') {
            textParts.push(parsed[1]);
          }
        } catch {
          // Skip unparseable lines
        }
      }
    }

    return textParts.join('');
  }
}

// Global singleton for generated code to use
let _runtimeConfig: RuntimeConfig | null = null;

export function initialize(config: RuntimeConfig): void {
  _runtimeConfig = config;
  console.log('[graph-runtime] Initialized with config:', {
    mcpServerUrl: config.mcpServerUrl,
    agentServerUrl: config.agentServerUrl,
    llmProvider: config.llmProvider,
    llmModel: config.llmModel,
  });
}

export function createAgent(): Agent {
  if (!_runtimeConfig) {
    throw new Error('Runtime not initialized. Call initialize() first.');
  }
  return new Agent(_runtimeConfig);
}

// Convenience: pre-initialized agent for simple scripts
export function getAgent(): Agent {
  return createAgent();
}

// Re-export zod for generated code
export { z } from 'zod';

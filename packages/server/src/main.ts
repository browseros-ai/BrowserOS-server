/**
 * @license
 * Copyright 2025 BrowserOS
 *
 * Main server orchestration
 */
import type http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

import {createHttpServer as createAgentHttpServer} from '@browseros/agent';
import {
  ensureBrowserConnected,
  McpContext,
  Mutex,
  logger,
  readVersion,
} from '@browseros/common';
import {
  ControllerContext,
  ControllerBridge,
} from '@browseros/controller-server';
import {createHttpMcpServer, shutdownMcpServer} from '@browseros/mcp';
import {
  allCdpTools,
  allControllerTools,
  type ToolDefinition,
} from '@browseros/tools';
import {allKlavisTools} from '@browseros/tools/klavis';

import {parseArguments} from './args.js';

const version = readVersion();
const ports = parseArguments();

configureLogDirectory(ports.executionDir);

const generatedCodeSimple = `
  // Graph-generated code - agent is passed in, no imports needed
  export default async function run(agent) {
    // Simple test: just navigate to a page
    await agent
      .nav('https://google.com')
      .exec();

    console.log('[GRAPH] Navigation complete!');
    return { success: true, message: 'Graph executed successfully' };
  }
`;

const generatedCodeComplex = `
  // Complex graph: HN -> open top 5 links -> list tabs -> summarize each
  export default async function run(agent) {
    console.log('[GRAPH] Step 1: Navigate to Hacker News');
    await agent.nav('https://news.ycombinator.com').exec();

    console.log('[GRAPH] Step 2: Open top 5 story links in new tabs');
    await agent.act('Open the first 5 story links (the main article links, not comments) in new tabs.').exec();

    console.log('[GRAPH] Step 3: List all open tabs');
    const tabs = await agent.listTabs();
    console.log('[GRAPH] Open tabs:', tabs.length);

    console.log('[GRAPH] Step 4: Summarize each tab');
    const summaries = [];
    for (const tab of tabs) {
      if (tab.url && !tab.url.includes('news.ycombinator.com')) {
        console.log('[GRAPH] Summarizing:', tab.title);
        await agent.switchToTab(tab.id);

        const summary = await agent
          .extract('Summarize this page in 2-3 sentences. What is the main topic and key points?', {
            schema: { type: 'object', properties: { title: { type: 'string' }, summary: { type: 'string' } } }
          })
          .exec();

        summaries.push({ url: tab.url, ...summary });
      }
    }

    console.log('[GRAPH] Done! Summaries:', JSON.stringify(summaries, null, 2));
    return { success: true, tabCount: tabs.length, summaries };
  }
`;

async function testGraphRuntime(
  mcpPort: number,
  agentPort: number,
  useComplex: boolean = false,
): Promise<void> {
  logger.info(
    `[Graph Runtime Test] Starting ${useComplex ? 'COMPLEX' : 'SIMPLE'} test...`,
  );

  const {Agent} = await import('@browseros/graph-runtime');

  const agent = new Agent({
    mcpServerUrl: `http://127.0.0.1:${mcpPort}/mcp`,
    agentServerUrl: `http://127.0.0.1:${agentPort}`,
  });

  const generatedCode = useComplex ? generatedCodeComplex : generatedCodeSimple;

  const tempPath = path.join(ports.executionDir, `test-graph-${Date.now()}.ts`);

  logger.info(`[Graph Runtime Test] Writing generated code to: ${tempPath}`);
  logger.info(`[Graph Runtime Test] Code:\n${generatedCode}`);

  fs.writeFileSync(tempPath, generatedCode);

  try {
    const module = await import(tempPath);
    const result = await module.default(agent); // Pass agent to the function
    logger.info(
      `[Graph Runtime Test] Execution result: ${JSON.stringify(result)}`,
    );
    logger.info(`[Graph Runtime Test] SUCCESS - Graph runtime works!`);
  } catch (err) {
    logger.error(`[Graph Runtime Test] FAILED: ${err}`);
  } finally {
    await agent.close();
    // fs.unlinkSync(tempPath);
    // logger.info(`[Graph Runtime Test] Cleaned up temp file`);
  }
}

void (async () => {
  logger.info(`Starting BrowserOS Server v${version}`);

  logger.info(
    `[Controller Server] Starting on ws://127.0.0.1:${ports.extensionPort}`,
  );
  const {controllerBridge, controllerContext} = createController(
    ports.extensionPort,
  );

  const cdpContext = await connectToCdp(ports.cdpPort);

  logger.info(
    `Loaded ${allControllerTools.length} controller (extension) tools`,
  );
  const tools = mergeTools(cdpContext, controllerContext);
  const toolMutex = new Mutex();

  const mcpServer = startMcpServer({
    ports,
    version,
    tools,
    cdpContext,
    controllerContext,
    toolMutex,
  });

  const agentServer = startAgentServer(ports);

  logSummary(ports);

  // Test graph runtime after controller is connected
  // Comment this out to skip the test
  const waitForConnectionAndTest = async () => {
    logger.info('[Graph Runtime Test] Waiting for controller connection...');
    while (!controllerContext.isConnected()) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      logger.info(
        '[Graph Runtime Test] Still waiting for controller connection...',
      );
    }
    logger.info('[Graph Runtime Test] Controller connected! Starting test...');
    await testGraphRuntime(ports.httpMcpPort, ports.agentPort, false); // true = complex test
  };
  waitForConnectionAndTest().catch(err => {
    logger.error(`[Graph Runtime Test] Error: ${err}`);
  });

  const shutdown = createShutdownHandler(
    mcpServer,
    agentServer,
    controllerBridge,
  );
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
})();

function createController(extensionPort: number) {
  const controllerBridge = new ControllerBridge(extensionPort, logger);
  const controllerContext = new ControllerContext(controllerBridge);
  return {controllerBridge, controllerContext};
}

async function connectToCdp(
  cdpPort: number | null,
): Promise<McpContext | null> {
  if (!cdpPort) {
    logger.info(
      'CDP disabled (no --cdp-port specified). Only extension tools will be available.',
    );
    return null;
  }

  try {
    const browser = await ensureBrowserConnected(`http://127.0.0.1:${cdpPort}`);
    logger.info(`Connected to CDP at http://127.0.0.1:${cdpPort}`);
    const context = await McpContext.from(browser, logger);
    logger.info(`Loaded ${allCdpTools.length} CDP tools`);
    return context;
  } catch (error) {
    logger.warn(
      `Warning: Could not connect to CDP at http://127.0.0.1:${cdpPort}`,
    );
    logger.warn(
      'CDP tools will not be available. Only extension tools will work.',
    );
    return null;
  }
}

function wrapControllerTools(
  tools: typeof allControllerTools,
  controllerContext: ControllerContext,
): Array<ToolDefinition<any, any, any>> {
  return tools.map((tool: any) => ({
    ...tool,
    handler: async (request: any, response: any, _context: any) => {
      return tool.handler(request, response, controllerContext);
    },
  }));
}

function mergeTools(
  cdpContext: McpContext | null,
  controllerContext: ControllerContext,
): Array<ToolDefinition<any, any, any>> {
  const cdpTools = cdpContext ? allCdpTools : [];
  const wrappedControllerTools = wrapControllerTools(
    allControllerTools,
    controllerContext,
  );
  const klavisTools = process.env.KLAVIS_API_KEY ? allKlavisTools : [];

  logger.info(
    `Total tools available: ${cdpTools.length + wrappedControllerTools.length + klavisTools.length} ` +
      `(${cdpTools.length} CDP + ${wrappedControllerTools.length} extension + ${klavisTools.length} Klavis)`,
  );

  return [...cdpTools, ...wrappedControllerTools, ...klavisTools];
}

function startMcpServer(config: {
  ports: ReturnType<typeof parseArguments>;
  version: string;
  tools: Array<ToolDefinition<any, any, any>>;
  cdpContext: McpContext | null;
  controllerContext: ControllerContext;
  toolMutex: Mutex;
}): http.Server {
  const {ports, version, tools, cdpContext, controllerContext, toolMutex} =
    config;

  const mcpServer = createHttpMcpServer({
    port: ports.httpMcpPort,
    version,
    tools,
    context: cdpContext || ({} as any),
    controllerContext,
    toolMutex,
    logger,
    mcpServerEnabled: ports.mcpServerEnabled,
  });

  if (!ports.mcpServerEnabled) {
    logger.info('[MCP Server] Disabled (--disable-mcp-server)');
  } else {
    logger.info(
      `[MCP Server] Listening on http://127.0.0.1:${ports.httpMcpPort}/mcp`,
    );
    logger.info(
      `[MCP Server] Health check: http://127.0.0.1:${ports.httpMcpPort}/health`,
    );
  }

  return mcpServer;
}

function startAgentServer(ports: ReturnType<typeof parseArguments>): {
  server: any;
  config: any;
} {
  const mcpServerUrl = `http://127.0.0.1:${ports.httpMcpPort}/mcp`;

  const {server, config} = createAgentHttpServer({
    port: ports.agentPort,
    host: '0.0.0.0',
    corsOrigins: ['*'],
    tempDir: ports.executionDir || ports.resourcesDir,
    mcpServerUrl,
  });

  logger.info(
    `[Agent Server] Listening on http://127.0.0.1:${ports.agentPort}`,
  );
  logger.info(`[Agent Server] MCP Server URL: ${mcpServerUrl}`);

  return {server, config};
}

function logSummary(ports: ReturnType<typeof parseArguments>) {
  logger.info('');
  logger.info('Services running:');
  logger.info(`  Controller Server: ws://127.0.0.1:${ports.extensionPort}`);
  logger.info(`  Agent Server: http://127.0.0.1:${ports.agentPort}`);
  if (ports.mcpServerEnabled) {
    logger.info(`  MCP Server: http://127.0.0.1:${ports.httpMcpPort}/mcp`);
  }
  logger.info('');
}

function createShutdownHandler(
  mcpServer: http.Server,
  agentServer: {server: any; config: any},
  controllerBridge: ControllerBridge,
) {
  return async () => {
    logger.info('Shutting down server...');

    await shutdownMcpServer(mcpServer, logger);

    logger.info('Stopping agent server...');
    agentServer.server.close();

    logger.info('Closing ControllerBridge...');
    await controllerBridge.close();

    logger.info('Server shutdown complete');
    process.exit(0);
  };
}

function configureLogDirectory(logDirCandidate: string): void {
  const resolvedDir = path.isAbsolute(logDirCandidate)
    ? logDirCandidate
    : path.resolve(process.cwd(), logDirCandidate);

  try {
    fs.mkdirSync(resolvedDir, {recursive: true});
    logger.setLogFile(resolvedDir);
  } catch (error) {
    console.warn(
      `Failed to configure log directory ${resolvedDir}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

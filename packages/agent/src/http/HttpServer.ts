import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { stream } from 'hono/streaming';
import { serve } from '@hono/node-server';
import { formatDataStreamPart } from '@ai-sdk/ui-utils';
import { logger } from '@browseros/common';
import type { Context, Next } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { z } from 'zod';

import { SessionManager } from '../session/SessionManager.js';
import { HttpAgentError, ValidationError, AgentExecutionError } from '../errors.js';
import { ChatRequestSchema, HttpServerConfigSchema } from './types.js';
import type { HttpServerConfig, ValidatedHttpServerConfig, ChatRequest } from './types.js';

type AppVariables = {
  validatedBody: unknown;
};

const DEFAULT_MCP_SERVER_URL = 'http://127.0.0.1:9150/mcp';
const DEFAULT_TEMP_DIR = '/tmp';

function validateRequest<T>(schema: z.ZodType<T>) {
  return async (c: Context<{ Variables: AppVariables }>, next: Next) => {
    try {
      const body = await c.req.json();
      const validated = schema.parse(body);
      c.set('validatedBody', validated);
      await next();
    } catch (err) {
      if (err && typeof err === 'object' && 'issues' in err) {
        const zodError = err as { issues: unknown };
        logger.warn('Request validation failed', { issues: zodError.issues });
        throw new ValidationError('Request validation failed', zodError.issues);
      }
      throw err;
    }
  };
}

export function createHttpServer(config: HttpServerConfig) {
  const validatedConfig: ValidatedHttpServerConfig = HttpServerConfigSchema.parse(config);
  const mcpServerUrl = validatedConfig.mcpServerUrl || process.env.MCP_SERVER_URL || DEFAULT_MCP_SERVER_URL;

  const app = new Hono<{ Variables: AppVariables }>();
  const sessionManager = new SessionManager();

  app.use(
    '/*',
    cors({
      origin: (origin) => origin || '*',
      allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    }),
  );

  app.onError((err, c) => {
    const error = err as Error;

    if (error instanceof HttpAgentError) {
      logger.warn('HTTP Agent Error', {
        name: error.name,
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
      });
      return c.json(error.toJSON(), error.statusCode as ContentfulStatusCode);
    }

    logger.error('Unhandled Error', {
      message: error.message,
      stack: error.stack,
    });

    return c.json(
      {
        error: {
          name: 'InternalServerError',
          message: error.message || 'An unexpected error occurred',
          code: 'INTERNAL_SERVER_ERROR',
          statusCode: 500,
        },
      },
      500,
    );
  });

  app.get('/health', (c) => c.json({ status: 'ok' }));

  app.post('/chat', validateRequest(ChatRequestSchema), async (c) => {
    const request = c.get('validatedBody') as ChatRequest;

    logger.info('Chat request received', {
      conversationId: request.conversationId,
      provider: request.provider,
      model: request.model,
    });

    c.header('Content-Type', 'text/plain; charset=utf-8');
    c.header('X-Vercel-AI-Data-Stream', 'v1');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');

    // Get abort signal from the raw request - fires when client disconnects
    const abortSignal = c.req.raw.signal;

    return stream(c, async (honoStream) => {
      try {
        const agent = await sessionManager.getOrCreate({
          conversationId: request.conversationId,
          provider: request.provider,
          model: request.model,
          apiKey: request.apiKey,
          baseUrl: request.baseUrl,
          // Azure-specific
          resourceName: request.resourceName,
          // AWS Bedrock-specific
          region: request.region,
          accessKeyId: request.accessKeyId,
          secretAccessKey: request.secretAccessKey,
          sessionToken: request.sessionToken,
          // Agent-specific
          tempDir: validatedConfig.tempDir || DEFAULT_TEMP_DIR,
          mcpServerUrl,
        });

        await agent.execute(request.message, honoStream, abortSignal);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Agent execution failed';
        logger.error('Agent execution error', {
          conversationId: request.conversationId,
          error: errorMessage,
        });
        await honoStream.write(formatDataStreamPart('error', errorMessage));
        throw new AgentExecutionError('Agent execution failed', error instanceof Error ? error : undefined);
      }
    });
  });

  // Batch endpoint: execute multiple act() commands sequentially
  // Input: act("open amazon.com")\nact("open google.com")
  app.post('/batch', validateRequest(ChatRequestSchema), async (c) => {
    const request = c.get('validatedBody') as ChatRequest;

    // Parse act("...") commands from message
    const actRegex = /act\("([^"]+)"\)/g;
    const actions: string[] = [];
    let match;
    while ((match = actRegex.exec(request.message)) !== null) {
      actions.push(match[1]);
    }

    if (actions.length === 0) {
      // If no act() found, treat whole message as single action
      actions.push(request.message);
    }

    logger.info('Batch request received', {
      conversationId: request.conversationId,
      actionCount: actions.length,
      actions,
    });

    c.header('Content-Type', 'text/plain; charset=utf-8');
    c.header('X-Vercel-AI-Data-Stream', 'v1');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');

    const abortSignal = c.req.raw.signal;

    return stream(c, async (honoStream) => {
      try {
        const agent = await sessionManager.getOrCreate({
          conversationId: request.conversationId,
          provider: request.provider,
          model: request.model,
          apiKey: request.apiKey,
          baseUrl: request.baseUrl,
          resourceName: request.resourceName,
          region: request.region,
          accessKeyId: request.accessKeyId,
          secretAccessKey: request.secretAccessKey,
          sessionToken: request.sessionToken,
          tempDir: validatedConfig.tempDir || DEFAULT_TEMP_DIR,
          mcpServerUrl,
        });

        // Execute each action sequentially
        for (let i = 0; i < actions.length; i++) {
          if (abortSignal.aborted) break;

          const action = actions[i];
          logger.info(`Executing action ${i + 1}/${actions.length}`, { action });

          // Stream a marker for this action
          await honoStream.write(formatDataStreamPart('text', `\n--- Action ${i + 1}: ${action} ---\n`));

          await agent.execute(action, honoStream, abortSignal);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Batch execution failed';
        logger.error('Batch execution error', {
          conversationId: request.conversationId,
          error: errorMessage,
        });
        await honoStream.write(formatDataStreamPart('error', errorMessage));
        throw new AgentExecutionError('Batch execution failed', error instanceof Error ? error : undefined);
      }
    });
  });

  app.delete('/chat/:conversationId', (c) => {
    const conversationId = c.req.param('conversationId');
    const deleted = sessionManager.delete(conversationId);

    if (deleted) {
      return c.json({
        success: true,
        message: `Session ${conversationId} deleted`,
        sessionCount: sessionManager.count(),
      });
    }

    return c.json({
      success: false,
      message: `Session ${conversationId} not found`,
    }, 404);
  });

  const server = serve({
    fetch: app.fetch,
    port: validatedConfig.port,
    hostname: validatedConfig.host,
  });

  logger.info('HTTP Agent Server started', {
    port: validatedConfig.port,
    host: validatedConfig.host,
  });

  return {
    app,
    server,
    config: validatedConfig,
  };
}

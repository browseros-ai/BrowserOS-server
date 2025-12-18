/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import {logger} from '@browseros/common';
import {Sentry} from '@browseros/common/sentry';
import {Hono} from 'hono';
import type {Context, Next} from 'hono';
import {cors} from 'hono/cors';
import {stream} from 'hono/streaming';
import type {ContentfulStatusCode} from 'hono/utils/http-status';
import type {z} from 'zod';

import {testProviderConnection} from '../agent/gemini-vercel-sdk-adapter/testProvider.js';
import {
  VercelAIConfigSchema,
  AIProvider,
} from '../agent/gemini-vercel-sdk-adapter/types.js';
import type {VercelAIConfig} from '../agent/gemini-vercel-sdk-adapter/types.js';
import {
  formatUIMessageStreamEvent,
  formatUIMessageStreamDone,
} from '../agent/gemini-vercel-sdk-adapter/ui-message-stream.js';
import {
  HttpAgentError,
  ValidationError,
  AgentExecutionError,
} from '../errors.js';
import {SessionManager} from '../session/SessionManager.js';

import {ChatRequestSchema, HttpServerConfigSchema} from './types.js';
import type {
  HttpServerConfig,
  ValidatedHttpServerConfig,
  ChatRequest,
} from './types.js';

interface AppVariables {
  validatedBody: unknown;
}

const DEFAULT_MCP_SERVER_URL = 'http://127.0.0.1:9150/mcp';
const DEFAULT_TEMP_DIR = '/tmp';

function validateRequest<T>(schema: z.ZodType<T>) {
  return async (c: Context<{Variables: AppVariables}>, next: Next) => {
    try {
      const body = await c.req.json();
      const validated = schema.parse(body);
      c.set('validatedBody', validated);
      await next();
    } catch (err) {
      if (err && typeof err === 'object' && 'issues' in err) {
        const zodError = err as {issues: unknown};
        logger.warn('Request validation failed', {issues: zodError.issues});
        throw new ValidationError('Request validation failed', zodError.issues);
      }
      throw err;
    }
  };
}

export function createHttpServer(config: HttpServerConfig) {
  const validatedConfig: ValidatedHttpServerConfig =
    HttpServerConfigSchema.parse(config);
  const mcpServerUrl =
    validatedConfig.mcpServerUrl ||
    process.env.MCP_SERVER_URL ||
    DEFAULT_MCP_SERVER_URL;

  const {rateLimiter, browserosId} = config;

  const app = new Hono<{Variables: AppVariables}>();
  const sessionManager = new SessionManager();

  app.use(
    '/*',
    cors({
      origin: origin => origin || '*',
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

  app.get('/health', c => c.json({status: 'ok'}));

  app.post('/chat', validateRequest(ChatRequestSchema), async c => {
    const request = c.get('validatedBody') as ChatRequest;

    const {provider, model, baseUrl} = request;

    Sentry.setContext('request', {
      provider,
      model,
      baseUrl,
    });

    logger.info('Chat request received', {
      conversationId: request.conversationId,
      provider: request.provider,
      model: request.model,
      browserContext: request.browserContext,
    });

    // Rate limiting for BrowserOS provider
    if (
      request.provider === AIProvider.BROWSEROS &&
      rateLimiter &&
      browserosId
    ) {
      rateLimiter.check(browserosId);
      rateLimiter.record({
        conversationId: request.conversationId,
        browserosId,
        provider: request.provider,
        initialQuery: request.message,
      });
    }

    c.header('Content-Type', 'text/event-stream');
    c.header('x-vercel-ai-ui-message-stream', 'v1');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');

    // Create AbortController that we can trigger from multiple sources
    const abortController = new AbortController();
    const abortSignal = abortController.signal;

    // Forward raw request abort to our controller
    if (c.req.raw.signal) {
      c.req.raw.signal.addEventListener(
        'abort',
        () => {
          abortController.abort();
        },
        {once: true},
      );
    }

    return stream(c, async honoStream => {
      // Register onAbort callback - fires when client disconnects
      honoStream.onAbort(() => {
        abortController.abort();
      });

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
          contextWindowSize: request.contextWindowSize,
          tempDir: validatedConfig.tempDir || DEFAULT_TEMP_DIR,
          mcpServerUrl,
          browserosId,
        });

        await agent.execute(
          request.message,
          honoStream,
          abortSignal,
          request.browserContext,
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Agent execution failed';
        logger.error('Agent execution error', {
          conversationId: request.conversationId,
          error: errorMessage,
        });
        await honoStream.write(
          formatUIMessageStreamEvent({type: 'error', errorText: errorMessage}),
        );
        await honoStream.write(formatUIMessageStreamDone());
        throw new AgentExecutionError(
          'Agent execution failed',
          error instanceof Error ? error : undefined,
        );
      }
    });
  });

  app.delete('/chat/:conversationId', c => {
    const conversationId = c.req.param('conversationId');
    const deleted = sessionManager.delete(conversationId);

    if (deleted) {
      return c.json({
        success: true,
        message: `Session ${conversationId} deleted`,
        sessionCount: sessionManager.count(),
      });
    }

    return c.json(
      {
        success: false,
        message: `Session ${conversationId} not found`,
      },
      404,
    );
  });

  app.post('/test-provider', validateRequest(VercelAIConfigSchema), async c => {
    const config = c.get('validatedBody') as VercelAIConfig;

    logger.info('Testing provider connection', {
      provider: config.provider,
      model: config.model,
    });

    const result = await testProviderConnection(config);

    logger.info('Provider test result', {
      provider: config.provider,
      model: config.model,
      success: result.success,
      responseTime: result.responseTime,
    });

    return c.json(result, result.success ? 200 : 400);
  });

  // Use Bun's native serve for proper abort detection (fixes Hono issue #3032)
  const server = Bun.serve({
    fetch: app.fetch,
    port: validatedConfig.port,
    hostname: validatedConfig.host,
    idleTimeout: 0, // Disable idle timeout for long-running LLM streams
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

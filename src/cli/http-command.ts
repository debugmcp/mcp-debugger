import type { Logger as WinstonLoggerType } from 'winston';
import type { Express, Request, Response, NextFunction } from 'express';
import express from 'express';
import { randomUUID } from 'crypto';
import { IncomingMessage, ServerResponse } from 'http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { DebugMcpServer } from '../server.js';
import { SSEOptions } from './setup.js';

export interface ServerFactoryOptions {
  logLevel?: string;
  logFile?: string;
}

export interface HttpCommandDependencies {
  logger: WinstonLoggerType;
  serverFactory: (options: ServerFactoryOptions) => DebugMcpServer;
  exitProcess?: (code: number) => void;
}

interface SessionData {
  transport: StreamableHTTPServerTransport;
  server: DebugMcpServer;
}

export function createHttpApp(
  options: SSEOptions,
  dependencies: HttpCommandDependencies
): Express {
  const { logger, serverFactory } = dependencies;

  // createMcpExpressApp wires hostHeaderValidation for localhost binds
  const app = createMcpExpressApp();

  const httpSessions = new Map<string, SessionData>();

  // CORS — Mcp-Session-Id and last-event-id must be exposed for the MCP Inspector
  // and for clients to read the session ID from the Initialize response.
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.header(
      'Access-Control-Allow-Headers',
      'Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-Id'
    );
    res.header(
      'Access-Control-Expose-Headers',
      'Mcp-Session-Id, Last-Event-Id, Mcp-Protocol-Version'
    );
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  app.use(express.json({ limit: '10mb' }));

  const handleMcpRequest = async (req: Request, res: Response): Promise<void> => {
    try {
      const sessionIdHeader = req.headers['mcp-session-id'];
      const sessionId = Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader;

      let transport: StreamableHTTPServerTransport;

      if (sessionId && httpSessions.has(sessionId)) {
        // Existing session — route to its transport
        transport = httpSessions.get(sessionId)!.transport;
      } else if (!sessionId && req.method === 'POST' && isInitializeRequest(req.body)) {
        // New session — spin up an isolated DebugMcpServer + transport
        const newDebugServer = serverFactory({
          logLevel: options.logLevel,
          logFile: options.logFile,
        });
        await newDebugServer.start();

        // Forward declarations so the closures below can refer to the transport.
        // The SDK assigns its own internal sessionId before invoking onsessioninitialized.
        let createdTransport: StreamableHTTPServerTransport | null = null;

        const newTransport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid: string) => {
            if (createdTransport) {
              httpSessions.set(sid, { transport: createdTransport, server: newDebugServer });
              logger.info(`HTTP session initialized: ${sid}`);
            }
          },
        });
        createdTransport = newTransport;

        newTransport.onclose = () => {
          const sid = newTransport.sessionId;
          if (!sid) return;
          const session = httpSessions.get(sid);
          if (!session) return;
          httpSessions.delete(sid);
          logger.info(`HTTP session closed: ${sid}`);
          session.server.stop().catch((err) => {
            logger.error(`Error stopping debug server for session ${sid}:`, err);
          });
        };

        newTransport.onerror = (error: Error) => {
          const sid = newTransport.sessionId ?? '<pre-init>';
          logger.error(`HTTP transport error for session ${sid}`, error);
        };

        await newDebugServer.server.connect(newTransport);
        transport = newTransport;
      } else {
        logger.warn('Rejecting MCP request: missing or unknown session ID', {
          method: req.method,
          hasSessionId: !!sessionId,
          isInit: req.method === 'POST' && isInitializeRequest(req.body),
        });
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32600,
            message: 'Bad Request: missing or unknown Mcp-Session-Id, and this is not an initialize request',
          },
          id: null,
        });
        return;
      }

      await transport.handleRequest(req as IncomingMessage, res as ServerResponse, req.body);
    } catch (error) {
      logger.error('Error handling MCP request', { error });
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal error',
            data: error instanceof Error ? error.message : 'Unknown error',
          },
          id: null,
        });
      }
    }
  };

  app.post('/mcp', handleMcpRequest);
  app.get('/mcp', handleMcpRequest);
  app.delete('/mcp', handleMcpRequest);

  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      mode: 'http',
      connections: httpSessions.size,
      sessions: Array.from(httpSessions.keys()),
    });
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (app as any).httpSessions = httpSessions;

  return app;
}

export async function handleHttpCommand(
  options: SSEOptions,
  dependencies: HttpCommandDependencies
): Promise<void> {
  const { logger, exitProcess = process.exit } = dependencies;

  if (options.logLevel) {
    logger.level = options.logLevel;
  }

  const port = parseInt(options.port, 10);
  logger.info(`Starting Debug MCP Server in HTTP (Streamable HTTP) mode on port ${port}`);

  try {
    const app = createHttpApp(options, dependencies);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const httpSessions = (app as any).httpSessions as Map<string, SessionData>;

    const server = app.listen(port, () => {
      logger.info(`Debug MCP Server (HTTP) listening on port ${port}`);
      logger.info(`MCP endpoint available at http://localhost:${port}/mcp`);
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`Port ${port} is already in use. Another instance may be running.`);
      } else {
        logger.error(`Server error: ${err.message}`);
      }
      exitProcess(1);
    });

    const gracefulShutdown = async () => {
      logger.info('Shutting down HTTP server...');

      // Close every active transport and stop its DebugMcpServer
      for (const { transport, server: debugServer } of httpSessions.values()) {
        try {
          await transport.close();
        } catch (err) {
          logger.error('Error closing transport during shutdown', { error: err });
        }
        try {
          await debugServer.stop();
        } catch (err) {
          logger.error('Error stopping debug server during shutdown', { error: err });
        }
      }
      httpSessions.clear();

      server.close(() => {
        exitProcess(0);
      });
    };

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
  } catch (error) {
    logger.error('Failed to start server in HTTP mode', { error });
    exitProcess(1);
  }
}

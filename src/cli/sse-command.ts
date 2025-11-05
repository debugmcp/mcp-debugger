import type { Logger as WinstonLoggerType } from 'winston';
import express from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { IncomingMessage, ServerResponse } from 'http';
import { DebugMcpServer } from '../server.js';
import { SSEOptions } from './setup.js';

export interface ServerFactoryOptions {
  logLevel?: string;
  logFile?: string;
}

export interface SSECommandDependencies {
  logger: WinstonLoggerType;
  serverFactory: (options: ServerFactoryOptions) => DebugMcpServer;
  exitProcess?: (code: number) => void;
}

interface SessionData {
  transport: SSEServerTransport;
  isClosing?: boolean;
}

export function createSSEApp(
  options: SSEOptions,
  dependencies: SSECommandDependencies
): express.Application {
  const { logger, serverFactory } = dependencies;
  const app = express();
  
  // Create a single shared Debug MCP Server instance for all connections
  const sharedDebugServer = serverFactory({
    logLevel: options.logLevel,
    logFile: options.logFile,
  });
  logger.info('Created shared Debug MCP Server instance for SSE mode');
  
  // Store active SSE transports by session ID
  const sseTransports = new Map<string, SessionData>();
  
  // CORS middleware
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, X-Session-ID');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  // SSE endpoint - for server-to-client messages
  app.get('/sse', async (req, res) => {
    try {
      // Create SSE transport with the response object
      const transport = new SSEServerTransport('/sse', res as ServerResponse);
      
      // Connect the shared server to the transport (this automatically calls start())
      await sharedDebugServer.server.connect(transport);
      
      // Store the transport by session ID
      const sessionId = transport.sessionId;
      const sessionData: SessionData = { transport, isClosing: false };
      sseTransports.set(sessionId, sessionData);
      
      logger.info(`SSE connection established: ${sessionId}`);
      
      // Keep the connection alive with periodic pings
      const pingInterval = setInterval(() => {
        if (!sseTransports.has(sessionId)) {
          clearInterval(pingInterval);
          return;
        }
        res.write(':ping\n\n');
      }, 30000); // Every 30 seconds
      
      // Handle connection close with guard against infinite recursion
      const closeHandler = () => {
        const session = sseTransports.get(sessionId);
        if (!session || session.isClosing) {
          return; // Already closing or doesn't exist
        }
        
        session.isClosing = true;
        logger.info(`SSE connection closed: ${sessionId}`);
        
        // Clean up ping interval
        clearInterval(pingInterval);
        
        // Remove from map first to prevent any further operations
        sseTransports.delete(sessionId);
        
        // Clean up only the transport, NOT the shared server
        // The shared server persists across connections
        logger.info(`SSE transport cleaned up for session ${sessionId}. Debug sessions remain active.`);
      };
      
      transport.onclose = closeHandler;
      
      // Also handle client disconnect
      req.on('close', closeHandler);
      req.on('end', closeHandler);
      
      // Handle errors
      transport.onerror = (error) => {
        logger.error(`SSE transport error for session ${sessionId}:`, error);
      };
      
    } catch (error) {
      logger.error('Error establishing SSE connection:', error);
      if (!res.headersSent) {
        res.status(500).end();
      }
    }
  });

  // POST endpoint - for client-to-server messages
  app.post('/sse', async (req, res) => {
    try {
      // Extract session ID from query parameter (as per MCP SDK SSE protocol)
      const sessionId = req.query.sessionId as string;
      
      if (!sessionId || !sseTransports.has(sessionId)) {
        logger.warn(`Invalid session ID: ${sessionId}`, { 
          headers: req.headers,
          query: req.query,
          hasSessionId: !!sessionId,
          knownSessions: Array.from(sseTransports.keys())
        });
        res.status(400).json({ 
          jsonrpc: '2.0',
          error: { 
            code: -32600,
            message: 'Invalid session ID' 
          },
          id: null
        });
        return;
      }
      
      const { transport } = sseTransports.get(sessionId)!;
      
      // Handle the POST message through the transport
      await transport.handlePostMessage(req as IncomingMessage, res as ServerResponse);
      
    } catch (error) {
      logger.error('Error handling SSE POST request', { error });
      res.status(500).json({ 
        jsonrpc: '2.0',
        error: { 
          code: -32603,
          message: 'Internal error',
          data: error instanceof Error ? error.message : 'Unknown error'
        },
        id: null
      });
    }
  });

  // Add a simple health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      mode: 'sse',
      connections: sseTransports.size,
      sessions: Array.from(sseTransports.keys())
    });
  });

  // Expose the transports map and shared server for graceful shutdown
  (app as any).sseTransports = sseTransports; // eslint-disable-line @typescript-eslint/no-explicit-any
  (app as any).sharedDebugServer = sharedDebugServer; // eslint-disable-line @typescript-eslint/no-explicit-any

  return app;
}

export async function handleSSECommand(
  options: SSEOptions,
  dependencies: SSECommandDependencies
): Promise<void> {
  const { logger, exitProcess = process.exit } = dependencies;
  
  if (options.logLevel) {
    logger.level = options.logLevel;
  }
  
  const port = parseInt(options.port, 10);
  logger.info(`Starting Debug MCP Server in SSE mode on port ${port}`);

  try {
    const app = createSSEApp(options, dependencies);
    const server = app.listen(port, () => {
      logger.info(`Debug MCP Server (SSE) listening on port ${port}`);
      logger.info(`SSE endpoint available at http://localhost:${port}/sse`);
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      logger.info('Shutting down SSE server...');
      
      // Close all SSE connections
      const sseTransports = (app as any).sseTransports as Map<string, SessionData> | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (sseTransports) {
        sseTransports.forEach(({ transport }) => {
          transport.close();
        });
      }
      
      // Stop the shared debug server
      const sharedDebugServer = (app as any).sharedDebugServer as DebugMcpServer | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (sharedDebugServer) {
        logger.info('Stopping shared Debug MCP Server...');
        sharedDebugServer.stop().catch((error) => {
          logger.error('Error stopping shared Debug MCP Server:', error);
        });
      }
      
      server.close(() => {
        exitProcess(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start server in SSE mode', { error });
    exitProcess(1);
  }
}

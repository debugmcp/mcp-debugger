#!/usr/bin/env node
/**
 * Debug MCP Server - Entry Point
 * 
 * This is the main entry point for the Debug MCP Server.
 */

import { Command } from 'commander';
import { createLogger } from './utils/logger.js';
import { DebugMcpServer } from './server.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { IncomingMessage, ServerResponse } from 'http';

// Read version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.resolve(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const { version } = packageJson;

const logger = createLogger('debug-mcp:cli');

// Global error handlers for the main server process
process.on('uncaughtException', (err: Error, origin: string) => {
  logger.error(`[Server UNCAUGHT_EXCEPTION] Origin: ${origin}`, { errorName: err.name, errorMessage: err.message, errorStack: err.stack });
  // Optionally, try to gracefully shutdown server if possible, then exit
  process.exit(1); // Ensure process exits on uncaught exception
});

process.on('unhandledRejection', (reason: any, promise: Promise<unknown>) => {
  logger.error('[Server UNHANDLED_REJECTION] Reason:', { reason });
  logger.error('[Server UNHANDLED_REJECTION] Promise:', { promise });
  // Optionally, try to gracefully shutdown server if possible, then exit
  process.exit(1); // Ensure process exits on unhandled rejection
});

// Parse command line arguments
const program = new Command();

program
  .name('debug-mcp-server')
  .description('Step-through debugging MCP server for LLMs')
  .version(version);

program
  .command('stdio', { isDefault: true })
  .description('Start the server using stdio as transport')
  .option('-l, --log-level <level>', 'Set log level (error, warn, info, debug)', 'info')
  .option('--log-file <path>', 'Log to file instead of console')
  .action(async (options) => {
    if (options.logLevel) {
      logger.level = options.logLevel;
    }
    logger.info('Starting Debug MCP Server in stdio mode');
    
    try {
      const debugMcpServer = new DebugMcpServer({
        logLevel: options.logLevel,
        logFile: options.logFile
      });
      
      await debugMcpServer.start(); // This will use StdioServerTransport by default
      logger.info('Server started successfully in stdio mode');
    } catch (error) {
      logger.error('Failed to start server in stdio mode', { error });
      process.exit(1);
    }
  });

program
  .command('sse')
  .description('Start the server using SSE (Server-Sent Events) transport')
  .option('-p, --port <number>', 'Port to listen on', '3001')
  .option('-l, --log-level <level>', 'Set log level (error, warn, info, debug)', 'info')
  .option('--log-file <path>', 'Log to file instead of console')
  .action(async (options) => {
    if (options.logLevel) {
      logger.level = options.logLevel;
    }
    const port = parseInt(options.port, 10);
    logger.info(`Starting Debug MCP Server in SSE mode on port ${port}`);

    try {
      const app = express();
      
      // Middleware for parsing JSON bodies
      // Removed express.json() - SSEServerTransport needs raw body stream
      
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

      // Store active SSE transports by session ID
      const sseTransports = new Map<string, { transport: SSEServerTransport, server: DebugMcpServer, isClosing?: boolean }>();

      // SSE endpoint - for server-to-client messages
      app.get('/sse', async (req, res) => {
        try {
          // Create a new Debug MCP Server instance for this connection
          const debugMcpServer = new DebugMcpServer({
            logLevel: options.logLevel,
            logFile: options.logFile,
          });

          // Create SSE transport with the response object
          // The SSEServerTransport will handle setting appropriate headers
          const transport = new SSEServerTransport('/sse', res as ServerResponse);
          
          // Connect the server to the transport (this automatically calls start())
          await debugMcpServer.server.connect(transport);
          
          // Store the transport and server by session ID
          const sessionId = transport.sessionId;
          const sessionData = { transport, server: debugMcpServer, isClosing: false };
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
            
            // Stop the server asynchronously
            setImmediate(() => {
              debugMcpServer.stop().catch(error => {
                logger.error(`Error stopping server for session ${sessionId}:`, error);
              });
            });
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
              id: req.body?.id || null
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
            id: req.body?.id || null
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

      // Start the Express server
      const server = app.listen(port, () => {
        logger.info(`Debug MCP Server (SSE) listening on port ${port}`);
        logger.info(`SSE endpoint available at http://localhost:${port}/sse`);
      });

      // Handle graceful shutdown
      process.on('SIGINT', () => {
        logger.info('Shutting down SSE server...');
        // Close all SSE connections
        sseTransports.forEach(({ transport, server }) => {
          transport.close();
          server.stop();
        });
        server.close(() => {
          process.exit(0);
        });
      });

    } catch (error) {
      logger.error('Failed to start server in SSE mode', { error });
      process.exit(1);
    }
  });

program.parse();

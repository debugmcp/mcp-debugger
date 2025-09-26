import express from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
export function createSSEApp(options, dependencies) {
    const { logger, serverFactory } = dependencies;
    const app = express();
    // Store active SSE transports by session ID
    const sseTransports = new Map();
    // CORS middleware
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, X-Session-ID');
        if (req.method === 'OPTIONS') {
            res.sendStatus(200);
        }
        else {
            next();
        }
    });
    // SSE endpoint - for server-to-client messages
    app.get('/sse', async (req, res) => {
        try {
            // Create a new Debug MCP Server instance for this connection
            const debugMcpServer = serverFactory({
                logLevel: options.logLevel,
                logFile: options.logFile,
            });
            // Create SSE transport with the response object
            const transport = new SSEServerTransport('/sse', res);
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
        }
        catch (error) {
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
            const sessionId = req.query.sessionId;
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
            const { transport } = sseTransports.get(sessionId);
            // Handle the POST message through the transport
            await transport.handlePostMessage(req, res);
        }
        catch (error) {
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
    // Expose the transports map for graceful shutdown
    app.sseTransports = sseTransports; // eslint-disable-line @typescript-eslint/no-explicit-any
    return app;
}
export async function handleSSECommand(options, dependencies) {
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
            const sseTransports = app.sseTransports; // eslint-disable-line @typescript-eslint/no-explicit-any
            if (sseTransports) {
                sseTransports.forEach(({ transport, server }) => {
                    transport.close();
                    server.stop();
                });
            }
            server.close(() => {
                exitProcess(0);
            });
        });
    }
    catch (error) {
        logger.error('Failed to start server in SSE mode', { error });
        exitProcess(1);
    }
}
//# sourceMappingURL=sse-command.js.map
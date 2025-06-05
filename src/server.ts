/**
 * Debug MCP Server - Main Server Implementation
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
// import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"; // Unused
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode as McpErrorCode, 
  McpError,
  ServerResult, 
} from '@modelcontextprotocol/sdk/types.js';
import { createLogger } from './utils/logger.js';
import { SessionManager, SessionManagerConfig } from './session/session-manager.js';
import { createProductionDependencies } from './container/dependencies.js';
import { ContainerConfig } from './container/types.js';
import { 
    DebugSessionInfo, 
    // SessionState, // Unused
    Variable, 
    StackFrame, 
    // DebugSession, // Unused
    DebugLanguage 
} from './session/models.js';
import { DebugProtocol } from '@vscode/debugprotocol'; // Import DebugProtocol
import path from 'path';
// import crypto from 'node:crypto'; // Unused

/**
 * Configuration options for the Debug MCP Server
 */
export interface DebugMcpServerOptions {
  logLevel?: string;
  logFile?: string;
  // httpPort is removed; CLI will handle transport choice
}

/**
 * Main Debug MCP Server class
 */
export class DebugMcpServer {
  public server: Server; // Made public
  private sessionManager: SessionManager;
  private logger;
  private constructorOptions: DebugMcpServerOptions; // To store constructor options

  constructor(options: DebugMcpServerOptions = {}) {
    this.constructorOptions = options; // Store options
    
    // Create container configuration from options
    const containerConfig: ContainerConfig = {
      logLevel: options.logLevel,
      logFile: options.logFile,
      sessionLogDirBase: options.logFile ? path.dirname(options.logFile) + '/sessions' : undefined
    };
    
    // Create all dependencies
    const dependencies = createProductionDependencies(containerConfig);
    
    // Use the logger from dependencies
    this.logger = dependencies.logger;
    this.logger.info('[DebugMcpServer Constructor] Main server logger instance assigned.');

    this.server = new Server(
      { name: 'debug-mcp-server', version: '0.1.0' },
      { capabilities: { tools: {} } }
    );

    // Create SessionManager with modern constructor
    const sessionManagerConfig: SessionManagerConfig = {
      logDirBase: containerConfig.sessionLogDirBase
    };
    
    this.sessionManager = new SessionManager(sessionManagerConfig, dependencies);

    this.registerTools();
    this.server.onerror = (error) => {
      this.logger.error('Server error', { error });
    };
  }

  private registerTools(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      this.logger.debug('Handling ListToolsRequest');
      return {
        tools: [
          { name: 'create_debug_session', description: 'Create a new debugging session', inputSchema: { type: 'object', properties: { language: { type: 'string', enum: ['python'] }, name: { type: 'string' }, pythonPath: {type: 'string'}, host: {type: 'string'}, port: {type: 'number'} }, required: ['language'] } },
          { name: 'list_debug_sessions', description: 'List all active debugging sessions', inputSchema: { type: 'object', properties: {} } },
          { name: 'set_breakpoint', description: 'Set a breakpoint. Setting breakpoints on non-executable lines (structural, declarative) may lead to unexpected behavior', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' }, file: { type: 'string', description: 'Path to the source file (absolute or relative to project root)' }, line: { type: 'number', description: 'Line number where to set breakpoint. Executable statements (assignments, function calls, conditionals, returns) work best. Structural lines (function/class definitions), declarative lines (imports), or non-executable lines (comments, blank lines) may cause unexpected stepping behavior' }, condition: { type: 'string' } }, required: ['sessionId', 'file', 'line'] } },
          { name: 'start_debugging', description: 'Start debugging a script', inputSchema: { 
              type: 'object', 
              properties: { 
                sessionId: { type: 'string' }, 
                scriptPath: { type: 'string' }, 
                args: { type: 'array', items: { type: 'string' } }, 
                dapLaunchArgs: { 
                  type: 'object', 
                  properties: { 
                    stopOnEntry: { type: 'boolean' },
                    justMyCode: { type: 'boolean' } 
                    // Add other DAP launch args here if needed by schema
                  },
                  additionalProperties: true // Allow other DAP args
                },
                dryRunSpawn: { type: 'boolean' } 
              }, 
              required: ['sessionId', 'scriptPath'] 
            } 
          },
          { name: 'close_debug_session', description: 'Close a debugging session', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' } }, required: ['sessionId'] } },
          { name: 'step_over', description: 'Step over', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' } }, required: ['sessionId'] } },
          { name: 'step_into', description: 'Step into', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' } }, required: ['sessionId'] } },
          { name: 'step_out', description: 'Step out', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' } }, required: ['sessionId'] } },
          { name: 'continue_execution', description: 'Continue execution', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' } }, required: ['sessionId'] } },
          { name: 'pause_execution', description: 'Pause execution (Not Implemented)', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' } }, required: ['sessionId'] } },
          { name: 'get_variables', description: 'Get variables (scope is variablesReference: number)', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' }, scope: { type: 'number', description: "The variablesReference number from a StackFrame or Variable" } }, required: ['sessionId', 'scope'] } },
          { name: 'get_stack_trace', description: 'Get stack trace', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' } }, required: ['sessionId'] } },
          { name: 'get_scopes', description: 'Get scopes for a stack frame', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' }, frameId: { type: 'number', description: "The ID of the stack frame from a stackTrace response" } }, required: ['sessionId', 'frameId'] } },
          { name: 'evaluate_expression', description: 'Evaluate expression (Not Implemented)', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' }, expression: { type: 'string' } }, required: ['sessionId', 'expression'] } },
          { name: 'get_source_context', description: 'Get source context (Not Implemented)', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' }, file: { type: 'string' }, line: { type: 'number' }, linesContext: { type: 'number' } }, required: ['sessionId', 'file', 'line'] } },
        ],
      };
    });

    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request): Promise<ServerResult> => { // Removed _extra
        const toolName = request.params.name;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args = request.params.arguments as any; 

        this.logger.debug(`Handling tool call: ${toolName}`, { args });

        try {
          switch (toolName) {
            case 'create_debug_session': return this.handleCreateDebugSession(args);
            case 'list_debug_sessions': return this.handleListDebugSessions();
            case 'set_breakpoint': return this.handleSetBreakpoint(args);
            case 'start_debugging': return this.handleStartDebugging(args);
            case 'close_debug_session': return this.handleCloseDebugSession(args);
            case 'step_over': return this.handleStepOver(args);
            case 'step_into': return this.handleStepInto(args);
            case 'step_out': return this.handleStepOut(args);
            case 'continue_execution': return this.handleContinue(args);
            case 'pause_execution': return this.handlePause(args);
            case 'get_variables': return this.handleGetVariables(args);
            case 'get_stack_trace': return this.handleGetStackTrace(args);
            case 'get_scopes': return this.handleGetScopes(args);
            case 'evaluate_expression': return this.handleEvaluateExpression(args);
            case 'get_source_context': return this.handleGetSourceContext(args);
            default:
              throw new McpError(McpErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
          }
        } catch (error) {
          if (error instanceof McpError) throw error;
          this.logger.error(`Error handling tool call: ${toolName}`, { error });
          throw new McpError(McpErrorCode.InternalError, `Failed to execute tool ${toolName}: ${(error as Error).message}`);
        }
      }
    );
  }

  private async handleCreateDebugSession(args: { language: string, name?: string, pythonPath?: string /* host and port are unused here */ }): Promise<ServerResult> {
    if (args.language !== 'python') { 
        throw new McpError(McpErrorCode.InvalidParams, "language parameter must be 'python'");
    }
    // const debuggerConfig = { pythonPath: args.pythonPath, host: args.host, port: args.port }; // Unused
    const name = args.name || `Debug-${Date.now()}`;
    try {
      // Updated call to match new signature of sessionManager.createSession
      const sessionInfo: DebugSessionInfo = await this.sessionManager.createSession({
        language: args.language as DebugLanguage, // Already validated as 'python'
        name: name,
        pythonPath: args.pythonPath 
        // Note: args.host and args.port are not directly passed to the new createSession signature.
        // If they are needed, SessionManager.createSession would need to be adjusted.
      });
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, sessionId: sessionInfo.id, message: `Created ${args.language} debug session: ${name}` }) }] };
    } catch (error) {
      const errorMessage = (error as Error).message || String(error);
      this.logger.error('Failed to create debug session', { error: errorMessage, stack: (error as Error).stack });
      throw new McpError(McpErrorCode.InternalError, `Failed to create debug session: ${errorMessage}`);
    }
  }

  private async handleListDebugSessions(): Promise<ServerResult> {
    try {
      const sessionsInfo: DebugSessionInfo[] = this.sessionManager.getAllSessions();
      const sessionData = sessionsInfo.map((session: DebugSessionInfo) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mappedSession: any = { 
            id: session.id, 
            name: session.name, 
            language: session.language as DebugLanguage, 
            state: session.state, 
            createdAt: session.createdAt.toISOString(),
        };
        if (session.updatedAt) { 
            mappedSession.updatedAt = session.updatedAt.toISOString();
        }
        return mappedSession;
      });
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, sessions: sessionData, count: sessionData.length }) }] };
    } catch (error) {
      this.logger.error('Failed to list debug sessions', { error });
      throw new McpError(McpErrorCode.InternalError, `Failed to list debug sessions: ${(error as Error).message}`);
    }
  }

  private async handleSetBreakpoint(args: { sessionId: string, file: string, line: number, condition?: string }): Promise<ServerResult> {
    try {
      const breakpoint = await this.sessionManager.setBreakpoint(args.sessionId, args.file, args.line, args.condition);
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, breakpointId: breakpoint.id, file: breakpoint.file, line: breakpoint.line, verified: breakpoint.verified, message: `Breakpoint set at ${breakpoint.file}:${breakpoint.line}` }) }] };
    } catch (error) {
      this.logger.error('Failed to set breakpoint', { error });
      throw new McpError(McpErrorCode.InternalError, `Failed to set breakpoint: ${(error as Error).message}`);
    }
  }

  private async handleStartDebugging(payload: { 
    sessionId: string, 
    scriptPath: string, 
    args?: string[], 
    dapLaunchArgs?: Partial<DebugProtocol.LaunchRequestArguments>, // Allow dapLaunchArgs
    dryRunSpawn?: boolean 
  }): Promise<ServerResult> {
    try {
      const result = await this.sessionManager.startDebugging(
        payload.sessionId, 
        payload.scriptPath, 
        payload.args, 
        payload.dapLaunchArgs, // Pass dapLaunchArgs
        payload.dryRunSpawn
      );
      // Ensure the 'data' field from SessionManager's result is passed through, especially for dryRun
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const responsePayload: any = {
        success: result.success,
        state: result.state,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        message: result.error ? result.error : (result.data as any)?.message || `Operation status for ${payload.scriptPath}`,
      };
      if (result.data) {
        responsePayload.data = result.data;
      }
      return { content: [{ type: 'text', text: JSON.stringify(responsePayload) }] };
    } catch (error) {
      this.logger.error('Failed to start debugging', { error });
      throw new McpError(McpErrorCode.InternalError, `Failed to start debugging: ${(error as Error).message}`);
    }
  }

  private async handleCloseDebugSession(args: { sessionId: string }): Promise<ServerResult> {
    try {
      const closed = await this.sessionManager.closeSession(args.sessionId);
      return { content: [{ type: 'text', text: JSON.stringify({ success: closed, message: closed ? `Closed debug session: ${args.sessionId}` : `Failed to close debug session: ${args.sessionId}` }) }] };
    } catch (error) {
      this.logger.error('Failed to close debug session', { error });
      throw new McpError(McpErrorCode.InternalError, `Failed to close debug session: ${(error as Error).message}`);
    }
  }

  private async handleStepOver(args: { sessionId: string }): Promise<ServerResult> {
    try {
      const result = await this.sessionManager.stepOver(args.sessionId);
      return { content: [{ type: 'text', text: JSON.stringify({ success: result.success, state: result.state, message: result.success ? 'Stepped over' : result.error }) }] };
    } catch (error) {
      this.logger.error('Failed to step over', { error });
      throw new McpError(McpErrorCode.InternalError, `Failed to step over: ${(error as Error).message}`);
    }
  }

  private async handleStepInto(args: { sessionId: string }): Promise<ServerResult> {
    try {
      const result = await this.sessionManager.stepInto(args.sessionId);
      return { content: [{ type: 'text', text: JSON.stringify({ success: result.success, state: result.state, message: result.success ? 'Stepped into' : result.error }) }] };
    } catch (error) {
      this.logger.error('Failed to step into', { error });
      throw new McpError(McpErrorCode.InternalError, `Failed to step into: ${(error as Error).message}`);
    }
  }

  private async handleStepOut(args: { sessionId: string }): Promise<ServerResult> {
    try {
      const result = await this.sessionManager.stepOut(args.sessionId);
      return { content: [{ type: 'text', text: JSON.stringify({ success: result.success, state: result.state, message: result.success ? 'Stepped out' : result.error }) }] };
    } catch (error) {
      this.logger.error('Failed to step out', { error });
      throw new McpError(McpErrorCode.InternalError, `Failed to step out: ${(error as Error).message}`);
    }
  }

  private async handleContinue(args: { sessionId: string }): Promise<ServerResult> {
    try {
      const result = await this.sessionManager.continue(args.sessionId);
      return { content: [{ type: 'text', text: JSON.stringify({ success: result.success, state: result.state, message: result.success ? 'Continued execution' : result.error }) }] };
    } catch (error) {
      this.logger.error('Failed to continue execution', { error });
      throw new McpError(McpErrorCode.InternalError, `Failed to continue execution: ${(error as Error).message}`);
    }
  }

  private async handlePause(args: { sessionId: string }): Promise<ServerResult> { // Parameter changed back, will be used or removed
    try {
      this.logger.info(`Pause requested for session: ${args.sessionId}`); // Use the arg
      throw new McpError(McpErrorCode.InternalError, "Pause execution not yet implemented with proxy.");
    } catch (error) {
      this.logger.error('Failed to pause execution', { error });
      if (error instanceof McpError) throw error;
      throw new McpError(McpErrorCode.InternalError, `Failed to pause execution: ${(error as Error).message}`);
    }
  }

  private async handleGetVariables(args: { sessionId: string, scope?: number }): Promise<ServerResult> { 
    if (args.scope === undefined || typeof args.scope !== 'number') {
      throw new McpError(McpErrorCode.InvalidParams, 'scope (variablesReference) parameter is required and must be a number.');
    }
    try {
      const variables: Variable[] = await this.sessionManager.getVariables(args.sessionId, args.scope);
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, variables, count: variables.length, variablesReference: args.scope }) }] };
    } catch (error) {
      this.logger.error('Failed to get variables', { error });
      throw new McpError(McpErrorCode.InternalError, `Failed to get variables: ${(error as Error).message}`);
    }
  }

  private async handleGetStackTrace(args: { sessionId: string }): Promise<ServerResult> {
    try {
      const session = this.sessionManager.getSession(args.sessionId);
      // Get current thread ID from ProxyManager
      const currentThreadId = session?.proxyManager?.getCurrentThreadId();
      if (!session || !session.proxyManager || !currentThreadId) {
          throw new McpError(McpErrorCode.InvalidRequest, "Cannot get stack trace: no active proxy, thread, or session not found/paused.");
      }
      const stackFrames: StackFrame[] = await this.sessionManager.getStackTrace(args.sessionId, currentThreadId);
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, stackFrames, count: stackFrames.length }) }] };
    } catch (error) {
      this.logger.error('Failed to get stack trace', { error });
      throw new McpError(McpErrorCode.InternalError, `Failed to get stack trace: ${(error as Error).message}`);
    }
  }

  private async handleGetScopes(args: { sessionId: string, frameId: number }): Promise<ServerResult> {
    try {
      // Type for scopes from DebugProtocol needs to be imported in SessionManager if not already
      const scopes = await this.sessionManager.getScopes(args.sessionId, args.frameId);
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, scopes }) }] };
    } catch (error) {
      this.logger.error('Failed to get scopes', { error });
      throw new McpError(McpErrorCode.InternalError, `Failed to get scopes: ${(error as Error).message}`);
    }
  }

  private async handleEvaluateExpression(args: { sessionId: string, expression: string }): Promise<ServerResult> { // Parameter changed back
    try {
      this.logger.info(`Evaluate requested for session: ${args.sessionId}, expression: ${args.expression}`); // Use the args
      throw new McpError(McpErrorCode.InternalError, "Evaluate expression not yet implemented with proxy.");
    } catch (error) {
      this.logger.error('Failed to evaluate expression', { error });
      if (error instanceof McpError) throw error;
      throw new McpError(McpErrorCode.InternalError, `Failed to evaluate expression: ${(error as Error).message}`);
    }
  }

  private async handleGetSourceContext(args: { sessionId: string, file: string, line: number, linesContext?: number }): Promise<ServerResult> {
    const linesContext = args.linesContext !== undefined ? Number(args.linesContext) : 5;
    if (isNaN(linesContext)) {
      throw new McpError(McpErrorCode.InvalidParams, 'linesContext parameter must be a number');
    }
    try {
      throw new McpError(McpErrorCode.InternalError, "Get source context not yet fully implemented with proxy.");
    } catch (error) {
      this.logger.error('Failed to get source context', { error });
      if (error instanceof McpError) throw error;
      throw new McpError(McpErrorCode.InternalError, `Failed to get source context: ${(error as Error).message}`);
    }
  }

  async start(): Promise<void> { // This method is now only for Stdio mode by convention
    this.logger.info('Starting Debug MCP Server (for StdioTransport)');
    try {
      // This method is now implicitly for Stdio. HTTP setup is done in src/index.ts.
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      this.logger.info('Server connected to stdio transport');
    } catch (error) {
      this.logger.error('Failed to start server with StdioTransport', { error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping Debug MCP Server');
    try {
      await this.sessionManager.closeAllSessions();
      await this.server.close();
      this.logger.info('Server stopped');
    } catch (error) {
      this.logger.error('Error stopping server', { error });
      throw error;
    }
  }
}

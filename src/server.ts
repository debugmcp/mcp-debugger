
/**
 * Debug MCP Server - Main Server Implementation
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
// StdioServerTransport is used in index.ts, not here
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode as McpErrorCode,
  McpError,
  ServerResult,
} from '@modelcontextprotocol/sdk/types.js';
import {
  SessionNotFoundError,
  SessionTerminatedError,
  UnsupportedLanguageError,
  ProxyNotRunningError
} from './errors/debug-errors.js';
import { SessionManager, SessionManagerConfig } from './session/session-manager.js';
import { createProductionDependencies } from './container/dependencies.js';
import { ContainerConfig } from './container/types.js';
import { 
    DebugSessionInfo, 
    Variable, 
    StackFrame, 
    DebugLanguage,
    Breakpoint,
    SessionLifecycleState 
} from '@debugmcp/shared';
import { DebugProtocol } from '@vscode/debugprotocol';
import path from 'path';
import { SimpleFileChecker, createSimpleFileChecker } from './utils/simple-file-checker.js';
import { LineReader, createLineReader } from './utils/line-reader.js';

/**
 * Configuration options for the Debug MCP Server
 */
export interface DebugMcpServerOptions {
  logLevel?: string;
  logFile?: string;
}

/**
 * Language metadata for supported languages
 */
interface LanguageMetadata {
  id: string;
  displayName: string;
  version: string;
  requiresExecutable: boolean;
  defaultExecutable?: string;
}

/**
 * Tool arguments interface
 */
interface ToolArguments {
  sessionId?: string;
  language?: string;
  name?: string;
  executablePath?: string;  // Language-agnostic executable path
  file?: string;
  line?: number;
  condition?: string;
  scriptPath?: string;
  args?: string[];
  dapLaunchArgs?: Partial<DebugProtocol.LaunchRequestArguments>;
  dryRunSpawn?: boolean;
  scope?: number;
  frameId?: number;
  expression?: string;
  linesContext?: number;
  includeInternals?: boolean;
}

/**
 * Main Debug MCP Server class
 */
export class DebugMcpServer {
  public server: Server;
  private sessionManager: SessionManager;
  private logger;
  private constructorOptions: DebugMcpServerOptions;
  private supportedLanguages: string[] = [];
  private fileChecker: SimpleFileChecker;
  private lineReader: LineReader;

  // Get supported languages from adapter registry
  private async getSupportedLanguagesAsync(): Promise<string[]> {
    const adapterRegistry = this.getAdapterRegistry();
    // Guard against undefined registry in certain test environments
    if (!adapterRegistry) {
      return ['python', 'mock'];
    }
    // Prefer dynamic discovery if available on the concrete registry
    const dynRegistry = adapterRegistry as unknown as { listLanguages?: () => Promise<string[]> };
    const maybeList = dynRegistry.listLanguages;
    if (typeof maybeList === 'function') {
      try {
        const langs = await maybeList.call(adapterRegistry);
        if (Array.isArray(langs) && langs.length > 0) return langs;
      } catch (e) {
        this.logger.warn('Dynamic adapter language discovery failed, falling back to registered languages', { error: (e as Error)?.message });
      }
    }
    // Fallback to already-registered factories (may be empty until first use)
    const langs = adapterRegistry.getSupportedLanguages?.() || [];
    if (langs.length > 0) {
      // In container runtime, ensure python is advertised even if not yet registered (preload may be async)
      if (process.env.MCP_CONTAINER === 'true' && !langs.includes('python')) {
        return [...new Set([...langs, 'python'])];
      }
      return langs;
    }
    // Final fallback to known defaults for UX (ensure python listed in container)
    if (process.env.MCP_CONTAINER === 'true') {
      return ['python', 'mock'];
    }
    return ['python', 'mock'];
  }

  // Get language metadata for all supported languages
  private async getLanguageMetadata(): Promise<LanguageMetadata[]> {
    const languages = await this.getSupportedLanguagesAsync();

    // Map to metadata - in future, this info can come directly from adapter registry
    return languages.map((lang: string) => {
      switch (lang) {
        case 'python':
          return {
            id: 'python',
            displayName: 'Python',
            version: '1.0.0',
            requiresExecutable: true,
            defaultExecutable: 'python'
          };
        case 'mock':
          return {
            id: 'mock',
            displayName: 'Mock',
            version: '1.0.0',
            requiresExecutable: false
          };
        case 'javascript':
          return {
            id: 'javascript',
            displayName: 'JavaScript/TypeScript',
            version: '1.0.0',
            requiresExecutable: true,
            defaultExecutable: 'node'
          };
        default:
          return {
            id: lang,
            displayName: lang.charAt(0).toUpperCase() + lang.slice(1),
            version: '1.0.0',
            requiresExecutable: true
          };
      }
    });
  }

  /**
   * Validate session exists and is not terminated
   */
  private validateSession(sessionId: string): void {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new McpError(McpErrorCode.InvalidParams, `Session not found: ${sessionId}`);
    }
    // Check the new lifecycle state instead of legacy state
    if (session.sessionLifecycle === SessionLifecycleState.TERMINATED) {
      throw new McpError(McpErrorCode.InvalidRequest, `Session is terminated: ${sessionId}`);
    }
  }

  // Public methods to expose SessionManager functionality for testing/external use
  public async createDebugSession(params: { language: DebugLanguage; name?: string; executablePath?: string; }): Promise<DebugSessionInfo> {
    // Validate language support using dynamic discovery
    const supported = await this.getSupportedLanguagesAsync();
    const requested = params.language as unknown as string;
    const isContainer = process.env.MCP_CONTAINER === 'true';
    const allowInContainer = isContainer && requested === 'python'; // ensure python allowed in container
    if (!allowInContainer && !supported.includes(requested)) {
      throw new McpError(
        McpErrorCode.InvalidParams, 
        `Language '${params.language}' is not supported. Available languages: ${supported.join(', ')}`
      );
    }
    
    const name = params.name || `${params.language}-debug-${Date.now()}`;
    try {
      const sessionInfo: DebugSessionInfo = await this.sessionManager.createSession({
        language: params.language as DebugLanguage,
        name: name,
        executablePath: params.executablePath  // Use executablePath for consistency
      });
      return sessionInfo;
    } catch (error) {
      const errorMessage = (error as Error).message || String(error);
      this.logger.error('Failed to create debug session', { error: errorMessage, stack: (error as Error).stack });
      throw new McpError(McpErrorCode.InternalError, `Failed to create debug session: ${errorMessage}`);
    }
  }

  public async startDebugging(
    sessionId: string, 
    scriptPath: string, 
    args?: string[], 
    dapLaunchArgs?: Partial<DebugProtocol.LaunchRequestArguments>, 
    dryRunSpawn?: boolean
  ): Promise<{ success: boolean; state: string; error?: string; data?: unknown; errorType?: string; errorCode?: number; }> {
    this.validateSession(sessionId);
    
    // Check script file exists for immediate feedback
    const fileCheck = await this.fileChecker.checkExists(scriptPath);
    if (!fileCheck.exists) {
      throw new McpError(McpErrorCode.InvalidParams, 
        `Script file not found: '${scriptPath}'\nLooked for: '${fileCheck.effectivePath}'${fileCheck.errorMessage ? `\nError: ${fileCheck.errorMessage}` : ''}`);
    }
    
    this.logger.info(`[DebugMcpServer.startDebugging] Script file exists: ${fileCheck.effectivePath} (original: ${scriptPath})`);
    
    // Pass the effective path (which has been resolved for container) to session manager
    const result = await this.sessionManager.startDebugging(
      sessionId, 
      fileCheck.effectivePath, 
      args, 
      dapLaunchArgs, 
      dryRunSpawn
    );
    return result;
  }

  public async closeDebugSession(sessionId: string): Promise<boolean> {
    return this.sessionManager.closeSession(sessionId);
  }

  public async setBreakpoint(sessionId: string, file: string, line: number, condition?: string): Promise<Breakpoint> {
    this.validateSession(sessionId);
    
    // Check file exists for immediate feedback
    const fileCheck = await this.fileChecker.checkExists(file);
    if (!fileCheck.exists) {
      throw new McpError(McpErrorCode.InvalidParams, 
        `Breakpoint file not found: '${file}'\nLooked for: '${fileCheck.effectivePath}'${fileCheck.errorMessage ? `\nError: ${fileCheck.errorMessage}` : ''}`);
    }
    
    this.logger.info(`[DebugMcpServer.setBreakpoint] File exists: ${fileCheck.effectivePath} (original: ${file})`);
    
    // Pass the effective path (which has been resolved for container) to session manager
    return this.sessionManager.setBreakpoint(sessionId, fileCheck.effectivePath, line, condition);
  }

  public async getVariables(sessionId: string, variablesReference: number): Promise<Variable[]> {
    this.validateSession(sessionId);
    return this.sessionManager.getVariables(sessionId, variablesReference);
  }

  public async getStackTrace(sessionId: string, includeInternals: boolean = false): Promise<StackFrame[]> {
    this.validateSession(sessionId);
    const session = this.sessionManager.getSession(sessionId);
    const currentThreadId = session?.proxyManager?.getCurrentThreadId();
    if (!session || !session.proxyManager || typeof currentThreadId !== 'number') {
        throw new ProxyNotRunningError(sessionId || 'unknown', 'get stack trace');
    }
    return this.sessionManager.getStackTrace(sessionId, currentThreadId, includeInternals);
  }

  public async getScopes(sessionId: string, frameId: number): Promise<DebugProtocol.Scope[]> {
    this.validateSession(sessionId);
    return this.sessionManager.getScopes(sessionId, frameId);
  }

  public async getLocalVariables(sessionId: string, includeSpecial: boolean = false): Promise<{
    variables: Variable[];
    frame: { name: string; file: string; line: number } | null;
    scopeName: string | null;
  }> {
    this.validateSession(sessionId);
    return this.sessionManager.getLocalVariables(sessionId, includeSpecial);
  }

  public async continueExecution(sessionId: string): Promise<boolean> {
    this.validateSession(sessionId);
    const result = await this.sessionManager.continue(sessionId);
    if (!result.success) {
      throw new Error(result.error || 'Failed to continue execution');
    }
    return true;
  }

  public async stepOver(sessionId: string): Promise<boolean> {
    this.validateSession(sessionId);
    const result = await this.sessionManager.stepOver(sessionId);
    if (!result.success) {
      throw new Error(result.error || 'Failed to step over');
    }
    return true;
  }

  public async stepInto(sessionId: string): Promise<boolean> {
    this.validateSession(sessionId);
    const result = await this.sessionManager.stepInto(sessionId);
    if (!result.success) {
      throw new Error(result.error || 'Failed to step into');
    }
    return true;
  }

  public async stepOut(sessionId: string): Promise<boolean> {
    this.validateSession(sessionId);
    const result = await this.sessionManager.stepOut(sessionId);
    if (!result.success) {
      throw new Error(result.error || 'Failed to step out');
    }
    return true;
  }

  constructor(options: DebugMcpServerOptions = {}) {
    this.constructorOptions = options;
    
    const containerConfig: ContainerConfig = {
      logLevel: options.logLevel,
      logFile: options.logFile,
      sessionLogDirBase: options.logFile ? path.resolve(path.dirname(options.logFile), 'sessions') : undefined
    };
    
    const dependencies = createProductionDependencies(containerConfig);
    
    this.logger = dependencies.logger;
    this.logger.info('[DebugMcpServer Constructor] Main server logger instance assigned.');

    // Create simple file checker for existence validation only
    this.fileChecker = createSimpleFileChecker(
      dependencies.fileSystem,
      dependencies.environment,
      this.logger
    );

    // Create line reader
    this.lineReader = createLineReader(
      dependencies.fileSystem,
      this.logger
    );

    this.server = new Server(
      { name: 'debug-mcp-server', version: '0.1.0' },
      { capabilities: { tools: {} } }
    );

    const sessionManagerConfig: SessionManagerConfig = {
      logDirBase: containerConfig.sessionLogDirBase
    };
    
    this.sessionManager = new SessionManager(sessionManagerConfig, dependencies);

    this.registerTools();
    this.server.onerror = (error) => {
      this.logger.error('Server error', { error });
    };
  }

  /**
   * Sanitize request data for logging (remove sensitive information)
   */
  private sanitizeRequest(args: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...args };
    // Remove absolute paths from executablePath
    if (sanitized.executablePath && typeof sanitized.executablePath === 'string' && path.isAbsolute(sanitized.executablePath)) {
      sanitized.executablePath = '<absolute-path>';
    }
    // Truncate long arrays
    if (sanitized.args && Array.isArray(sanitized.args) && sanitized.args.length > 5) {
      sanitized.args = [...sanitized.args.slice(0, 5), `... +${sanitized.args.length - 5} more`];
    }
    return sanitized;
  }

  /**
   * Get session name for logging
   */
  private getSessionName(sessionId: string): string {
    try {
      const session = this.sessionManager.getSession(sessionId);
      return session?.name || 'Unknown Session';
    } catch {
      return 'Unknown Session';
    }
  }

  private getPathDescription(parameterName: string): string {
    // Hands-off approach: provide simple, generic path guidance
    // Let OS/containers/debug adapters handle paths naturally
    if (parameterName === 'script') {
      return `Path to the script to debug. Use absolute paths or paths relative to your current working directory`;
    }
    return `Path to the ${parameterName}. Use absolute paths or paths relative to your current working directory`;
  }

  private registerTools(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      this.logger.debug('Handling ListToolsRequest');
      
      // Get supported languages dynamically - deferred until request time
      const supportedLanguages = await this.getSupportedLanguagesAsync();
      
      // Generate dynamic descriptions for path parameters
      const fileDescription = this.getPathDescription('source file');
      const scriptPathDescription = this.getPathDescription('script');
      
      return {
        tools: [
          { name: 'create_debug_session', description: 'Create a new debugging session', inputSchema: { type: 'object', properties: { language: { type: 'string', enum: supportedLanguages, description: 'Programming language for debugging' }, name: { type: 'string', description: 'Optional session name' }, executablePath: {type: 'string', description: 'Path to language executable (optional, will auto-detect if not provided)'} }, required: ['language'] } },
          { name: 'list_supported_languages', description: 'List all supported debugging languages with metadata', inputSchema: { type: 'object', properties: {} } },
          { name: 'list_debug_sessions', description: 'List all active debugging sessions', inputSchema: { type: 'object', properties: {} } },
          { name: 'set_breakpoint', description: 'Set a breakpoint. Setting breakpoints on non-executable lines (structural, declarative) may lead to unexpected behavior', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' }, file: { type: 'string', description: fileDescription }, line: { type: 'number', description: 'Line number where to set breakpoint. Executable statements (assignments, function calls, conditionals, returns) work best. Structural lines (function/class definitions), declarative lines (imports), or non-executable lines (comments, blank lines) may cause unexpected stepping behavior' }, condition: { type: 'string' } }, required: ['sessionId', 'file', 'line'] } },
          { name: 'start_debugging', description: 'Start debugging a script', inputSchema: { 
              type: 'object', 
              properties: { 
                sessionId: { type: 'string' }, 
                scriptPath: { type: 'string', description: scriptPathDescription }, 
                args: { type: 'array', items: { type: 'string' } }, 
                dapLaunchArgs: { 
                  type: 'object', 
                  properties: { 
                    stopOnEntry: { type: 'boolean' },
                    justMyCode: { type: 'boolean' } 
                  },
                  additionalProperties: true
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
          { name: 'get_local_variables', description: 'Get local variables for the current stack frame. This is a convenience tool that returns just the local variables without needing to traverse stack->scopes->variables manually', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' }, includeSpecial: { type: 'boolean', description: 'Include special/internal variables like this, __proto__, __builtins__, etc. Default: false' } }, required: ['sessionId'] } },
          { name: 'get_stack_trace', description: 'Get stack trace', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' }, includeInternals: { type: 'boolean', description: 'Include internal/framework frames (e.g., Node.js internals). Default: false for cleaner output.' } }, required: ['sessionId'] } },
          { name: 'get_scopes', description: 'Get scopes for a stack frame', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' }, frameId: { type: 'number', description: "The ID of the stack frame from a stackTrace response" } }, required: ['sessionId', 'frameId'] } },
          { name: 'evaluate_expression', description: 'Evaluate expression in the current debug context. Expressions can read and modify program state', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' }, expression: { type: 'string' }, frameId: { type: 'number', description: 'Optional stack frame ID for evaluation context. Must be a frame ID from a get_stack_trace response. If not provided, uses the current (top) frame automatically' } }, required: ['sessionId', 'expression'] } },
          { name: 'get_source_context', description: 'Get source context around a specific line in a file', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' }, file: { type: 'string', description: fileDescription }, line: { type: 'number', description: 'Line number to get context for' }, linesContext: { type: 'number', description: 'Number of lines before and after to include (default: 5)' } }, required: ['sessionId', 'file', 'line'] } },
        ],
      };
    });

    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request): Promise<ServerResult> => {
        const toolName = request.params.name;
        const args = request.params.arguments as ToolArguments; 

        // Log tool call with structured logging
        this.logger.info('tool:call', {
          tool: toolName,
          sessionId: args.sessionId,
          sessionName: args.sessionId ? this.getSessionName(args.sessionId) : undefined,
          request: this.sanitizeRequest(args as Record<string, unknown>),
          timestamp: Date.now()
        });

        try {
          let result: ServerResult;
          
          switch (toolName) {
            case 'create_debug_session': {
              // Ensure requested language is among dynamically supported ones
              const supported = await this.getSupportedLanguagesAsync();
              const lang = (args.language || 'python') as DebugLanguage;
              const requested = lang as unknown as string;
              const isContainer = process.env.MCP_CONTAINER === 'true';
              const allowInContainer = isContainer && requested === 'python';
              if (!allowInContainer && !supported.includes(lang)) {
                throw new UnsupportedLanguageError(lang, supported);
              }

              const sessionInfo = await this.createDebugSession({
                language: lang,
                name: args.name,
                executablePath: args.executablePath
              });
              
              // Log session creation
              this.logger.info('session:created', {
                sessionId: sessionInfo.id,
                sessionName: sessionInfo.name,
                language: sessionInfo.language,
                executablePath: args.executablePath,
                timestamp: Date.now()
              });
              
              result = { content: [{ type: 'text', text: JSON.stringify({ success: true, sessionId: sessionInfo.id, message: `Created ${sessionInfo.language} debug session: ${sessionInfo.name}` }) }] };
              break;
            }
            case 'list_debug_sessions': {
              result = await this.handleListDebugSessions();
              break;
            }
            case 'set_breakpoint': {
              if (!args.sessionId || !args.file || args.line === undefined) {
                throw new McpError(McpErrorCode.InvalidParams, 'Missing required parameters');
              }
              
              try {
                const breakpoint = await this.setBreakpoint(args.sessionId, args.file, args.line, args.condition);
                
                // Log breakpoint event
                this.logger.info('debug:breakpoint', {
                  event: 'set',
                  sessionId: args.sessionId,
                  sessionName: this.getSessionName(args.sessionId),
                  breakpointId: breakpoint.id,
                  file: breakpoint.file,
                  line: breakpoint.line,
                  verified: breakpoint.verified,
                  timestamp: Date.now()
                });
                
                // Try to get line context for the breakpoint
                let context;
                try {
                  const lineContext = await this.lineReader.getLineContext(
                    breakpoint.file,
                    breakpoint.line,
                    { contextLines: 2 }
                  );
                  
                  if (lineContext) {
                    context = {
                      lineContent: lineContext.lineContent,
                      surrounding: lineContext.surrounding
                    };
                  }
                } catch (contextError) {
                  // Log but don't fail if we can't get context
                  this.logger.debug('Could not get line context for breakpoint', { 
                    file: breakpoint.file, 
                    line: breakpoint.line, 
                    error: contextError 
                  });
                }
                
                result = { content: [{ type: 'text', text: JSON.stringify({ 
                  success: true, 
                  breakpointId: breakpoint.id, 
                  file: breakpoint.file, 
                  line: breakpoint.line, 
                  verified: breakpoint.verified, 
                  message: breakpoint.message || `Breakpoint set at ${breakpoint.file}:${breakpoint.line}`,
                  // Only add warning if there's a message from debugpy (indicating a problem)
                  warning: breakpoint.message || undefined,
                  // Include context if available
                  context: context || undefined
                }) }] };
                const contentEntry = Array.isArray(result.content) ? result.content[0] : undefined;
                const textContent = contentEntry && typeof (contentEntry as { text?: unknown }).text === 'string'
                  ? (contentEntry as { text: string }).text
                  : undefined;
                let parsedResponse: Record<string, unknown> | null = null;
                if (typeof textContent === 'string') {
                  try {
                    parsedResponse = JSON.parse(textContent) as Record<string, unknown>;
                  } catch {
                    parsedResponse = null;
                  }
                }
                this.logger.info('tool:set_breakpoint:result', {
                  sessionId: args.sessionId,
                  response: parsedResponse
                });
              } catch (error) {
                // Handle session state errors specifically
                if (error instanceof McpError && 
                    (error.message.includes('terminated') || 
                     error.message.includes('closed') || 
                     (error.message.includes('not found') && error.message.includes('Session')))) {
                  result = { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }] };
                } else {
                  // Re-throw all other errors (including file validation errors)
                  throw error;
                }
              }
              break;
            }
            case 'start_debugging': {
              if (!args.sessionId || !args.scriptPath) {
                throw new McpError(McpErrorCode.InvalidParams, 'Missing required parameters');
              }
              
              try {
                const debugResult = await this.startDebugging(args.sessionId, args.scriptPath, args.args, args.dapLaunchArgs, args.dryRunSpawn);
                const responsePayload: Record<string, unknown> = {
                  success: debugResult.success,
                  state: debugResult.state,
                  message: debugResult.error ? debugResult.error : (debugResult.data as Record<string, unknown>)?.message || `Operation status for ${args.scriptPath}`,
                };
                if (debugResult.data) {
                  responsePayload.data = debugResult.data;
                }
                result = { content: [{ type: 'text', text: JSON.stringify(responsePayload) }] };
              } catch (error) {
                // Handle session state errors specifically
                if (error instanceof McpError && 
                    (error.message.includes('terminated') || 
                     error.message.includes('closed') || 
                     (error.message.includes('not found') && error.message.includes('Session')))) {
                  result = { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message, state: 'stopped' }) }] };
                } else {
                  // Re-throw all other errors (including file validation errors)
                  throw error;
                }
              }
              break;
            }
            case 'close_debug_session': {
              if (!args.sessionId) {
                throw new McpError(McpErrorCode.InvalidParams, 'Missing required sessionId');
              }
              
              const sessionName = this.getSessionName(args.sessionId);
              const sessionCreatedAt = Date.now(); // In real implementation, would track creation time
              const closed = await this.closeDebugSession(args.sessionId);
              
              if (closed) {
                // Log session closure
                this.logger.info('session:closed', {
                  sessionId: args.sessionId,
                  sessionName: sessionName,
                  duration: Date.now() - sessionCreatedAt,
                  timestamp: Date.now()
                });
              }
              
              result = { content: [{ type: 'text', text: JSON.stringify({ success: closed, message: closed ? `Closed debug session: ${args.sessionId}` : `Failed to close debug session: ${args.sessionId}` }) }] };
              break;
            }
            case 'step_over':
            case 'step_into':
            case 'step_out': {
              if (!args.sessionId) {
                throw new McpError(McpErrorCode.InvalidParams, 'Missing required sessionId');
              }
              
              try {
                let stepResult: boolean;
                if (toolName === 'step_over') {
                  stepResult = await this.stepOver(args.sessionId);
                } else if (toolName === 'step_into') {
                  stepResult = await this.stepInto(args.sessionId);
                } else {
                  stepResult = await this.stepOut(args.sessionId);
                }
                result = { content: [{ type: 'text', text: JSON.stringify({ success: stepResult, message: stepResult ? `Stepped ${toolName.replace('step_', '')}` : `Failed to ${toolName.replace('_', ' ')}` }) }] };
              } catch (error) {
                // Handle validation errors specifically
                if (error instanceof SessionTerminatedError ||
                    error instanceof SessionNotFoundError ||
                    error instanceof ProxyNotRunningError) {
                  result = { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }] };
                } else if (error instanceof Error) {
                  // Handle other expected errors (like "Failed to step over")
                  result = { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }] };
                } else {
                  // Re-throw unexpected errors
                  throw error;
                }
              }
              break;
            }
            case 'continue_execution': {
              if (!args.sessionId) {
                throw new McpError(McpErrorCode.InvalidParams, 'Missing required sessionId');
              }
              
              try {
                const continueResult = await this.continueExecution(args.sessionId);
                result = { content: [{ type: 'text', text: JSON.stringify({ success: continueResult, message: continueResult ? 'Continued execution' : 'Failed to continue execution' }) }] };
              } catch (error) {
                // Handle validation errors specifically
                if (error instanceof SessionTerminatedError ||
                    error instanceof SessionNotFoundError ||
                    error instanceof ProxyNotRunningError) {
                  result = { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }] };
                } else if (error instanceof Error) {
                  // Handle other expected errors
                  result = { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }] };
                } else {
                  // Re-throw unexpected errors
                  throw error;
                }
              }
              break;
            }
            case 'pause_execution': {
              result = await this.handlePause(args as { sessionId: string });
              break;
            }
            case 'get_variables': {
              if (!args.sessionId || args.scope === undefined) {
                throw new McpError(McpErrorCode.InvalidParams, 'Missing required parameters');
              }
              
              try {
                const variables = await this.getVariables(args.sessionId, args.scope);
                
                // Log variable inspection (truncate large values)
                const truncatedVars = variables.map(v => ({
                  name: v.name,
                  type: v.type,
                  value: v.value.length > 200 ? v.value.substring(0, 200) + '... (truncated)' : v.value
                }));
                
                this.logger.info('debug:variables', {
                  sessionId: args.sessionId,
                  sessionName: this.getSessionName(args.sessionId),
                  variablesReference: args.scope,
                  variableCount: variables.length,
                  variables: truncatedVars.slice(0, 10), // Log first 10 variables
                  timestamp: Date.now()
                });
                
                result = { content: [{ type: 'text', text: JSON.stringify({ success: true, variables, count: variables.length, variablesReference: args.scope }) }] };
              } catch (error) {
                // Handle validation errors specifically
                if (error instanceof SessionTerminatedError ||
                    error instanceof SessionNotFoundError ||
                    error instanceof ProxyNotRunningError) {
                  result = { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }] };
                } else {
                  // Re-throw unexpected errors
                  throw error;
                }
              }
              break;
            }
            case 'get_stack_trace': {
              if (!args.sessionId) {
                throw new McpError(McpErrorCode.InvalidParams, 'Missing required sessionId');
              }
              
              try {
                // Default to false for cleaner output
                const includeInternals = args.includeInternals ?? false;
                const stackFrames = await this.getStackTrace(args.sessionId, includeInternals);
                result = { content: [{ type: 'text', text: JSON.stringify({ success: true, stackFrames, count: stackFrames.length, includeInternals }) }] };
              } catch (error) {
                // Handle validation errors specifically
                if (error instanceof SessionTerminatedError ||
                    error instanceof SessionNotFoundError ||
                    error instanceof ProxyNotRunningError) {
                  result = { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }] };
                } else {
                  // Re-throw unexpected errors
                  throw error;
                }
              }
              break;
            }
            case 'get_scopes': {
              if (!args.sessionId || args.frameId === undefined) {
                throw new McpError(McpErrorCode.InvalidParams, 'Missing required parameters');
              }
              
              try {
                const scopes = await this.getScopes(args.sessionId, args.frameId);
                result = { content: [{ type: 'text', text: JSON.stringify({ success: true, scopes }) }] };
              } catch (error) {
                // Handle validation errors specifically
                if (error instanceof SessionTerminatedError ||
                    error instanceof SessionNotFoundError ||
                    error instanceof ProxyNotRunningError) {
                  result = { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }] };
                } else {
                  // Re-throw unexpected errors
                  throw error;
                }
              }
              break;
            }
            case 'evaluate_expression': {
              result = await this.handleEvaluateExpression(args as { sessionId: string; expression: string });
              break;
            }
            case 'get_source_context': {
              result = await this.handleGetSourceContext(args as { sessionId: string; file: string; line: number; linesContext?: number });
              break;
            }
            case 'get_local_variables': {
              result = await this.handleGetLocalVariables(args as { sessionId: string; includeSpecial?: boolean });
              break;
            }
            case 'list_supported_languages': {
              result = await this.handleListSupportedLanguages();
              break;
            }
            default:
              throw new McpError(McpErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
          }
          
          // Log successful tool response
          this.logger.info('tool:response', {
            tool: toolName,
            sessionId: args.sessionId,
            sessionName: args.sessionId ? this.getSessionName(args.sessionId) : undefined,
            success: true,
            timestamp: Date.now()
          });
          
          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          // Log tool error
          this.logger.error('tool:error', {
            tool: toolName,
            sessionId: args.sessionId,
            sessionName: args.sessionId ? this.getSessionName(args.sessionId) : undefined,
            error: errorMessage,
            timestamp: Date.now()
          });
          
          if (error instanceof McpError) throw error;
          throw new McpError(McpErrorCode.InternalError, `Failed to execute tool ${toolName}: ${errorMessage}`);
        }
      }
    );
  }

  private async handleListDebugSessions(): Promise<ServerResult> {
    try {
      const sessionsInfo: DebugSessionInfo[] = this.sessionManager.getAllSessions();
      const sessionData = sessionsInfo.map((session: DebugSessionInfo) => {
        const mappedSession: Record<string, unknown> = { 
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

  private async handlePause(args: { sessionId: string }): Promise<ServerResult> {
    try {
      this.logger.info(`Pause requested for session: ${args.sessionId}`);
      throw new McpError(McpErrorCode.InternalError, "Pause execution not yet implemented with proxy.");
    } catch (error) {
      this.logger.error('Failed to pause execution', { error });
      if (error instanceof McpError) throw error;
      throw new McpError(McpErrorCode.InternalError, `Failed to pause execution: ${(error as Error).message}`);
    }
  }

  private async handleEvaluateExpression(args: { sessionId: string, expression: string, frameId?: number }): Promise<ServerResult> {
    try {
      // Validate session
      this.validateSession(args.sessionId);
      
      // Check expression length (sanity check)
      if (args.expression.length > 10240) {
        throw new McpError(McpErrorCode.InvalidParams, 'Expression too long (max 10KB)');
      }
      
      // Call SessionManager's evaluateExpression method (uses 'watch' context by default for variable access)
      const result = await this.sessionManager.evaluateExpression(
        args.sessionId,
        args.expression,
        args.frameId
        // Let SessionManager use its default context ('watch') for proper variable access
      );
      
      // Log for audit trail
      this.logger.info('tool:evaluate_expression', {
        sessionId: args.sessionId,
        sessionName: this.getSessionName(args.sessionId),
        expression: args.expression.substring(0, 100), // Truncate for logging
        success: result.success,
        hasResult: !!result.result,
        timestamp: Date.now()
      });
      
      // Return formatted response
      return { 
        content: [{ 
          type: 'text', 
          text: JSON.stringify(result) 
        }] 
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Log the error
      this.logger.error('tool:evaluate_expression:error', {
        sessionId: args.sessionId,
        expression: args.expression.substring(0, 100),
        error: errorMessage,
        timestamp: Date.now()
      });
      
      // Handle session state errors specifically
      if (error instanceof McpError && 
          (error.message.includes('terminated') || 
           error.message.includes('closed') || 
           error.message.includes('not found') ||
           error.message.includes('not paused'))) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }] };
      } else if (error instanceof McpError) {
        throw error;
      } else {
        // Wrap unexpected errors
        throw new McpError(McpErrorCode.InternalError, `Failed to evaluate expression: ${errorMessage}`);
      }
    }
  }

  private async handleGetSourceContext(args: { sessionId: string, file: string, line: number, linesContext?: number }): Promise<ServerResult> {
    try {
      // Validate session
      this.validateSession(args.sessionId);
      
      // Check file exists for immediate feedback
      const fileCheck = await this.fileChecker.checkExists(args.file);
      if (!fileCheck.exists) {
        throw new McpError(McpErrorCode.InvalidParams, 
          `Line context file not found: '${args.file}'\nLooked for: '${fileCheck.effectivePath}'${fileCheck.errorMessage ? `\nError: ${fileCheck.errorMessage}` : ''}`);
      }
      
      this.logger.info(`Source context requested for session: ${args.sessionId}, file: ${fileCheck.effectivePath}, line: ${args.line}`);
      
      // Get line context using the line reader
      const contextLines = args.linesContext ?? 5; // Default to 5 lines of context
      const lineContext = await this.lineReader.getLineContext(
        fileCheck.effectivePath,
        args.line,
        { contextLines }
      );
      
      if (!lineContext) {
        // File might be binary or unreadable
        return { 
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ 
              success: false, 
              error: 'Could not read source context. File may be binary or inaccessible.',
              file: args.file,
              line: args.line
            }) 
          }] 
        };
      }
      
      // Log source context request
      this.logger.info('debug:source_context', {
        sessionId: args.sessionId,
        sessionName: this.getSessionName(args.sessionId),
        file: args.file,
        line: args.line,
        contextLines: contextLines,
        timestamp: Date.now()
      });
      
      return { 
        content: [{ 
          type: 'text', 
          text: JSON.stringify({ 
            success: true,
            file: args.file,
            line: args.line,
            lineContent: lineContext.lineContent,
            surrounding: lineContext.surrounding,
            contextLines: contextLines
          }) 
        }] 
      };
    } catch (error) {
      this.logger.error('Failed to get source context', { error });
      if (error instanceof McpError) throw error;
      throw new McpError(McpErrorCode.InternalError, `Failed to get source context: ${(error as Error).message}`);
    }
  }

  private async handleGetLocalVariables(args: { sessionId: string; includeSpecial?: boolean }): Promise<ServerResult> {
    try {
      // Validate session
      this.validateSession(args.sessionId);
      
      // Get local variables using the new convenience method
      const result = await this.getLocalVariables(
        args.sessionId,
        args.includeSpecial ?? false
      );
      
      // Log for debugging
      this.logger.info('tool:get_local_variables', {
        sessionId: args.sessionId,
        sessionName: this.getSessionName(args.sessionId),
        includeSpecial: args.includeSpecial ?? false,
        variableCount: result.variables.length,
        frame: result.frame,
        scopeName: result.scopeName,
        timestamp: Date.now()
      });
      
      // Format response
      const response: Record<string, unknown> = {
        success: true,
        variables: result.variables,
        count: result.variables.length
      };
      
      // Include frame information if available
      if (result.frame) {
        response.frame = result.frame;
      }
      
      // Include scope name if available
      if (result.scopeName) {
        response.scopeName = result.scopeName;
      }
      
      // Add helpful messages for edge cases
      if (result.variables.length === 0) {
        if (!result.frame) {
          response.message = 'No stack frames available. The debugger may not be paused.';
        } else if (!result.scopeName) {
          response.message = 'No local scope found in the current frame.';
        } else {
          response.message = `The ${result.scopeName} scope is empty.`;
        }
      }
      
      return { 
        content: [{ 
          type: 'text', 
          text: JSON.stringify(response) 
        }] 
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Log the error
      this.logger.error('tool:get_local_variables:error', {
        sessionId: args.sessionId,
        error: errorMessage,
        timestamp: Date.now()
      });
      
      // Handle session state errors specifically
      if (error instanceof McpError && 
          (error.message.includes('terminated') || 
           error.message.includes('closed') || 
           error.message.includes('not found') ||
           error.message.includes('not paused'))) {
        return { content: [{ type: 'text', text: JSON.stringify({ 
          success: false, 
          error: error.message,
          message: 'Cannot get local variables. The session must be paused at a breakpoint.'
        }) }] };
      } else if (error instanceof McpError) {
        throw error;
      } else {
        // Wrap unexpected errors
        throw new McpError(McpErrorCode.InternalError, `Failed to get local variables: ${errorMessage}`);
      }
    }
  }

  private async handleListSupportedLanguages(): Promise<ServerResult> {
    try {
      const adapterRegistry = this.getAdapterRegistry();
      // Get installed languages via dynamic registry if available
      const installed = await this.getSupportedLanguagesAsync();

      // Also surface known adapters with install status if available from registry
      let available: Array<{ language: string; package: string; installed: boolean; description?: string }> = [];
      const dyn = adapterRegistry as unknown as { listAvailableAdapters?: () => Promise<Array<{ name: string; packageName: string; description?: string; installed: boolean }>> };
      if (typeof dyn.listAvailableAdapters === 'function') {
        try {
          const meta = await dyn.listAvailableAdapters!();
          available = meta.map(m => ({
            language: m.name,
            package: m.packageName,
            installed: m.installed,
            description: m.description
          }));
        } catch (e) {
          this.logger.warn('Failed to query detailed adapter metadata; returning installed list only', { error: (e as Error)?.message });
        }
      } else {
        // Fallback: build minimal available list from installed
        available = installed.map(lang => ({
          language: lang,
          package: `@debugmcp/adapter-${lang}`,
          installed: true
        }));
      }

      // Also build simple metadata array for backward compatibility with previous payload shape
      const languageMetadata = await this.getLanguageMetadata();

      return { content: [{ type: 'text', text: JSON.stringify({
        success: true,
        installed,
        available,
        languages: languageMetadata, // backward-compatible field with display info
        count: installed.length
      }) }] };
    } catch (error) {
      this.logger.error('Failed to list supported languages', { error });
      throw new McpError(McpErrorCode.InternalError, `Failed to list supported languages: ${(error as Error).message}`);
    }
  }

  /**
   * Public methods for server lifecycle management
   */
  public async start(): Promise<void> {
    // For MCP servers, start is handled by transport
    this.logger.info('Debug MCP Server started');
  }

  public async stop(): Promise<void> {
    await this.sessionManager.closeAllSessions();
    this.logger.info('Debug MCP Server stopped');
  }

  /**
   * Get adapter registry from session manager
   */
  public getAdapterRegistry() {
    return this.sessionManager.adapterRegistry;
  }
}

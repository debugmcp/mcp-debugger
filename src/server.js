/**
 * Debug MCP Server - Main Server Implementation
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
// StdioServerTransport is used in index.ts, not here
import { ListToolsRequestSchema, CallToolRequestSchema, ErrorCode as McpErrorCode, McpError, } from '@modelcontextprotocol/sdk/types.js';
import { SessionNotFoundError, SessionTerminatedError, UnsupportedLanguageError, ProxyNotRunningError } from './errors/debug-errors.js';
import { SessionManager } from './session/session-manager.js';
import { createProductionDependencies } from './container/dependencies.js';
import { SessionLifecycleState } from '@debugmcp/shared';
import path from 'path';
import { createSimpleFileChecker } from './utils/simple-file-checker.js';
import { createLineReader } from './utils/line-reader.js';
/**
 * Main Debug MCP Server class
 */
export class DebugMcpServer {
    server;
    sessionManager;
    logger;
    constructorOptions;
    supportedLanguages = [];
    fileChecker;
    lineReader;
    // Get supported languages from adapter registry
    async getSupportedLanguagesAsync() {
        const adapterRegistry = this.getAdapterRegistry();
        // Guard against undefined registry in certain test environments
        if (!adapterRegistry) {
            return ['python', 'mock'];
        }
        // Prefer dynamic discovery if available on the concrete registry
        const dynRegistry = adapterRegistry;
        const maybeList = dynRegistry.listLanguages;
        if (typeof maybeList === 'function') {
            try {
                const langs = await maybeList.call(adapterRegistry);
                if (Array.isArray(langs) && langs.length > 0)
                    return langs;
            }
            catch (e) {
                this.logger.warn('Dynamic adapter language discovery failed, falling back to registered languages', { error: e?.message });
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
    async getLanguageMetadata() {
        const languages = await this.getSupportedLanguagesAsync();
        // Map to metadata - in future, this info can come directly from adapter registry
        return languages.map((lang) => {
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
    validateSession(sessionId) {
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
    async createDebugSession(params) {
        // Validate language support using dynamic discovery
        const supported = await this.getSupportedLanguagesAsync();
        const requested = params.language;
        const isContainer = process.env.MCP_CONTAINER === 'true';
        const allowInContainer = isContainer && requested === 'python'; // ensure python allowed in container
        if (!allowInContainer && !supported.includes(requested)) {
            throw new McpError(McpErrorCode.InvalidParams, `Language '${params.language}' is not supported. Available languages: ${supported.join(', ')}`);
        }
        const name = params.name || `${params.language}-debug-${Date.now()}`;
        try {
            const sessionInfo = await this.sessionManager.createSession({
                language: params.language,
                name: name,
                executablePath: params.executablePath // Use executablePath for consistency
            });
            return sessionInfo;
        }
        catch (error) {
            const errorMessage = error.message || String(error);
            this.logger.error('Failed to create debug session', { error: errorMessage, stack: error.stack });
            throw new McpError(McpErrorCode.InternalError, `Failed to create debug session: ${errorMessage}`);
        }
    }
    async startDebugging(sessionId, scriptPath, args, dapLaunchArgs, dryRunSpawn) {
        this.validateSession(sessionId);
        // Check script file exists for immediate feedback (hands-off: no path manipulation)
        const fileCheck = await this.fileChecker.checkExists(scriptPath);
        if (!fileCheck.exists) {
            throw new McpError(McpErrorCode.InvalidParams, `Script file not found: '${scriptPath}'\nLooked for: '${fileCheck.effectivePath}'${fileCheck.errorMessage ? `\nError: ${fileCheck.errorMessage}` : ''}`);
        }
        this.logger.info(`[DebugMcpServer.startDebugging] Script file exists: ${scriptPath}`);
        const result = await this.sessionManager.startDebugging(sessionId, scriptPath, args, dapLaunchArgs, dryRunSpawn);
        return result;
    }
    async closeDebugSession(sessionId) {
        return this.sessionManager.closeSession(sessionId);
    }
    async setBreakpoint(sessionId, file, line, condition) {
        this.validateSession(sessionId);
        // Check file exists for immediate feedback (hands-off: no path manipulation)
        const fileCheck = await this.fileChecker.checkExists(file);
        if (!fileCheck.exists) {
            throw new McpError(McpErrorCode.InvalidParams, `Breakpoint file not found: '${file}'\nLooked for: '${fileCheck.effectivePath}'${fileCheck.errorMessage ? `\nError: ${fileCheck.errorMessage}` : ''}`);
        }
        this.logger.info(`[DebugMcpServer.setBreakpoint] File exists: ${file}`);
        return this.sessionManager.setBreakpoint(sessionId, file, line, condition);
    }
    async getVariables(sessionId, variablesReference) {
        this.validateSession(sessionId);
        return this.sessionManager.getVariables(sessionId, variablesReference);
    }
    async getStackTrace(sessionId) {
        this.validateSession(sessionId);
        const session = this.sessionManager.getSession(sessionId);
        const currentThreadId = session?.proxyManager?.getCurrentThreadId();
        if (!session || !session.proxyManager || !currentThreadId) {
            throw new ProxyNotRunningError(sessionId || 'unknown', 'get stack trace');
        }
        return this.sessionManager.getStackTrace(sessionId, currentThreadId);
    }
    async getScopes(sessionId, frameId) {
        this.validateSession(sessionId);
        return this.sessionManager.getScopes(sessionId, frameId);
    }
    async continueExecution(sessionId) {
        this.validateSession(sessionId);
        const result = await this.sessionManager.continue(sessionId);
        if (!result.success) {
            throw new Error(result.error || 'Failed to continue execution');
        }
        return true;
    }
    async stepOver(sessionId) {
        this.validateSession(sessionId);
        const result = await this.sessionManager.stepOver(sessionId);
        if (!result.success) {
            throw new Error(result.error || 'Failed to step over');
        }
        return true;
    }
    async stepInto(sessionId) {
        this.validateSession(sessionId);
        const result = await this.sessionManager.stepInto(sessionId);
        if (!result.success) {
            throw new Error(result.error || 'Failed to step into');
        }
        return true;
    }
    async stepOut(sessionId) {
        this.validateSession(sessionId);
        const result = await this.sessionManager.stepOut(sessionId);
        if (!result.success) {
            throw new Error(result.error || 'Failed to step out');
        }
        return true;
    }
    constructor(options = {}) {
        this.constructorOptions = options;
        const containerConfig = {
            logLevel: options.logLevel,
            logFile: options.logFile,
            sessionLogDirBase: options.logFile ? path.resolve(path.dirname(options.logFile), 'sessions') : undefined
        };
        const dependencies = createProductionDependencies(containerConfig);
        this.logger = dependencies.logger;
        this.logger.info('[DebugMcpServer Constructor] Main server logger instance assigned.');
        // Create simple file checker for existence validation only
        this.fileChecker = createSimpleFileChecker(dependencies.fileSystem, dependencies.environment, this.logger);
        // Create line reader
        this.lineReader = createLineReader(dependencies.fileSystem, this.logger);
        this.server = new Server({ name: 'debug-mcp-server', version: '0.1.0' }, { capabilities: { tools: {} } });
        const sessionManagerConfig = {
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
    sanitizeRequest(args) {
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
    getSessionName(sessionId) {
        try {
            const session = this.sessionManager.getSession(sessionId);
            return session?.name || 'Unknown Session';
        }
        catch {
            return 'Unknown Session';
        }
    }
    getPathDescription(parameterName) {
        // Hands-off approach: provide simple, generic path guidance
        // Let OS/containers/debug adapters handle paths naturally
        if (parameterName === 'script') {
            return `Path to the script to debug. Use absolute paths or paths relative to your current working directory`;
        }
        return `Path to the ${parameterName}. Use absolute paths or paths relative to your current working directory`;
    }
    registerTools() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            this.logger.debug('Handling ListToolsRequest');
            // Get supported languages dynamically - deferred until request time
            const supportedLanguages = await this.getSupportedLanguagesAsync();
            // Generate dynamic descriptions for path parameters
            const fileDescription = this.getPathDescription('source file');
            const scriptPathDescription = this.getPathDescription('script');
            return {
                tools: [
                    { name: 'create_debug_session', description: 'Create a new debugging session', inputSchema: { type: 'object', properties: { language: { type: 'string', enum: supportedLanguages, description: 'Programming language for debugging' }, name: { type: 'string', description: 'Optional session name' }, executablePath: { type: 'string', description: 'Path to language executable (optional, will auto-detect if not provided)' } }, required: ['language'] } },
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
                    { name: 'get_stack_trace', description: 'Get stack trace', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' } }, required: ['sessionId'] } },
                    { name: 'get_scopes', description: 'Get scopes for a stack frame', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' }, frameId: { type: 'number', description: "The ID of the stack frame from a stackTrace response" } }, required: ['sessionId', 'frameId'] } },
                    { name: 'evaluate_expression', description: 'Evaluate expression in the current debug context. Expressions can read and modify program state', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' }, expression: { type: 'string' }, frameId: { type: 'number', description: 'Optional stack frame ID for evaluation context (defaults to 0 - top frame)' } }, required: ['sessionId', 'expression'] } },
                    { name: 'get_source_context', description: 'Get source context around a specific line in a file', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' }, file: { type: 'string', description: fileDescription }, line: { type: 'number', description: 'Line number to get context for' }, linesContext: { type: 'number', description: 'Number of lines before and after to include (default: 5)' } }, required: ['sessionId', 'file', 'line'] } },
                ],
            };
        });
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const toolName = request.params.name;
            const args = request.params.arguments;
            // Log tool call with structured logging
            this.logger.info('tool:call', {
                tool: toolName,
                sessionId: args.sessionId,
                sessionName: args.sessionId ? this.getSessionName(args.sessionId) : undefined,
                request: this.sanitizeRequest(args),
                timestamp: Date.now()
            });
            try {
                let result;
                switch (toolName) {
                    case 'create_debug_session': {
                        // Ensure requested language is among dynamically supported ones
                        const supported = await this.getSupportedLanguagesAsync();
                        const lang = (args.language || 'python');
                        const requested = lang;
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
                                const lineContext = await this.lineReader.getLineContext(breakpoint.file, breakpoint.line, { contextLines: 2 });
                                if (lineContext) {
                                    context = {
                                        lineContent: lineContext.lineContent,
                                        surrounding: lineContext.surrounding
                                    };
                                }
                            }
                            catch (contextError) {
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
                        }
                        catch (error) {
                            // Handle session state errors specifically
                            if (error instanceof McpError &&
                                (error.message.includes('terminated') ||
                                    error.message.includes('closed') ||
                                    (error.message.includes('not found') && error.message.includes('Session')))) {
                                result = { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }] };
                            }
                            else {
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
                            const responsePayload = {
                                success: debugResult.success,
                                state: debugResult.state,
                                message: debugResult.error ? debugResult.error : debugResult.data?.message || `Operation status for ${args.scriptPath}`,
                            };
                            if (debugResult.data) {
                                responsePayload.data = debugResult.data;
                            }
                            result = { content: [{ type: 'text', text: JSON.stringify(responsePayload) }] };
                        }
                        catch (error) {
                            // Handle session state errors specifically
                            if (error instanceof McpError &&
                                (error.message.includes('terminated') ||
                                    error.message.includes('closed') ||
                                    (error.message.includes('not found') && error.message.includes('Session')))) {
                                result = { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message, state: 'stopped' }) }] };
                            }
                            else {
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
                            let stepResult;
                            if (toolName === 'step_over') {
                                stepResult = await this.stepOver(args.sessionId);
                            }
                            else if (toolName === 'step_into') {
                                stepResult = await this.stepInto(args.sessionId);
                            }
                            else {
                                stepResult = await this.stepOut(args.sessionId);
                            }
                            result = { content: [{ type: 'text', text: JSON.stringify({ success: stepResult, message: stepResult ? `Stepped ${toolName.replace('step_', '')}` : `Failed to ${toolName.replace('_', ' ')}` }) }] };
                        }
                        catch (error) {
                            // Handle validation errors specifically
                            if (error instanceof SessionTerminatedError ||
                                error instanceof SessionNotFoundError ||
                                error instanceof ProxyNotRunningError) {
                                result = { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }] };
                            }
                            else if (error instanceof Error) {
                                // Handle other expected errors (like "Failed to step over")
                                result = { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }] };
                            }
                            else {
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
                        }
                        catch (error) {
                            // Handle validation errors specifically
                            if (error instanceof SessionTerminatedError ||
                                error instanceof SessionNotFoundError ||
                                error instanceof ProxyNotRunningError) {
                                result = { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }] };
                            }
                            else if (error instanceof Error) {
                                // Handle other expected errors
                                result = { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }] };
                            }
                            else {
                                // Re-throw unexpected errors
                                throw error;
                            }
                        }
                        break;
                    }
                    case 'pause_execution': {
                        result = await this.handlePause(args);
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
                        }
                        catch (error) {
                            // Handle validation errors specifically
                            if (error instanceof SessionTerminatedError ||
                                error instanceof SessionNotFoundError ||
                                error instanceof ProxyNotRunningError) {
                                result = { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }] };
                            }
                            else {
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
                            const stackFrames = await this.getStackTrace(args.sessionId);
                            result = { content: [{ type: 'text', text: JSON.stringify({ success: true, stackFrames, count: stackFrames.length }) }] };
                        }
                        catch (error) {
                            // Handle validation errors specifically
                            if (error instanceof SessionTerminatedError ||
                                error instanceof SessionNotFoundError ||
                                error instanceof ProxyNotRunningError) {
                                result = { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }] };
                            }
                            else {
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
                        }
                        catch (error) {
                            // Handle validation errors specifically
                            if (error instanceof SessionTerminatedError ||
                                error instanceof SessionNotFoundError ||
                                error instanceof ProxyNotRunningError) {
                                result = { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }] };
                            }
                            else {
                                // Re-throw unexpected errors
                                throw error;
                            }
                        }
                        break;
                    }
                    case 'evaluate_expression': {
                        result = await this.handleEvaluateExpression(args);
                        break;
                    }
                    case 'get_source_context': {
                        result = await this.handleGetSourceContext(args);
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
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                // Log tool error
                this.logger.error('tool:error', {
                    tool: toolName,
                    sessionId: args.sessionId,
                    sessionName: args.sessionId ? this.getSessionName(args.sessionId) : undefined,
                    error: errorMessage,
                    timestamp: Date.now()
                });
                if (error instanceof McpError)
                    throw error;
                throw new McpError(McpErrorCode.InternalError, `Failed to execute tool ${toolName}: ${errorMessage}`);
            }
        });
    }
    async handleListDebugSessions() {
        try {
            const sessionsInfo = this.sessionManager.getAllSessions();
            const sessionData = sessionsInfo.map((session) => {
                const mappedSession = {
                    id: session.id,
                    name: session.name,
                    language: session.language,
                    state: session.state,
                    createdAt: session.createdAt.toISOString(),
                };
                if (session.updatedAt) {
                    mappedSession.updatedAt = session.updatedAt.toISOString();
                }
                return mappedSession;
            });
            return { content: [{ type: 'text', text: JSON.stringify({ success: true, sessions: sessionData, count: sessionData.length }) }] };
        }
        catch (error) {
            this.logger.error('Failed to list debug sessions', { error });
            throw new McpError(McpErrorCode.InternalError, `Failed to list debug sessions: ${error.message}`);
        }
    }
    async handlePause(args) {
        try {
            this.logger.info(`Pause requested for session: ${args.sessionId}`);
            throw new McpError(McpErrorCode.InternalError, "Pause execution not yet implemented with proxy.");
        }
        catch (error) {
            this.logger.error('Failed to pause execution', { error });
            if (error instanceof McpError)
                throw error;
            throw new McpError(McpErrorCode.InternalError, `Failed to pause execution: ${error.message}`);
        }
    }
    async handleEvaluateExpression(args) {
        try {
            // Validate session
            this.validateSession(args.sessionId);
            // Check expression length (sanity check)
            if (args.expression.length > 10240) {
                throw new McpError(McpErrorCode.InvalidParams, 'Expression too long (max 10KB)');
            }
            // Call SessionManager's evaluateExpression method
            const result = await this.sessionManager.evaluateExpression(args.sessionId, args.expression, args.frameId, 'repl' // Default context for AI/user evaluation
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
        }
        catch (error) {
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
            }
            else if (error instanceof McpError) {
                throw error;
            }
            else {
                // Wrap unexpected errors
                throw new McpError(McpErrorCode.InternalError, `Failed to evaluate expression: ${errorMessage}`);
            }
        }
    }
    async handleGetSourceContext(args) {
        try {
            // Validate session
            this.validateSession(args.sessionId);
            // Check file exists for immediate feedback (hands-off: no path manipulation)
            const fileCheck = await this.fileChecker.checkExists(args.file);
            if (!fileCheck.exists) {
                throw new McpError(McpErrorCode.InvalidParams, `Line context file not found: '${args.file}'\nLooked for: '${fileCheck.effectivePath}'${fileCheck.errorMessage ? `\nError: ${fileCheck.errorMessage}` : ''}`);
            }
            this.logger.info(`Source context requested for session: ${args.sessionId}, file: ${args.file}, line: ${args.line}`);
            // Get line context using the line reader
            const contextLines = args.linesContext ?? 5; // Default to 5 lines of context
            const lineContext = await this.lineReader.getLineContext(fileCheck.effectivePath, args.line, { contextLines });
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
        }
        catch (error) {
            this.logger.error('Failed to get source context', { error });
            if (error instanceof McpError)
                throw error;
            throw new McpError(McpErrorCode.InternalError, `Failed to get source context: ${error.message}`);
        }
    }
    async handleListSupportedLanguages() {
        try {
            const adapterRegistry = this.getAdapterRegistry();
            // Get installed languages via dynamic registry if available
            const installed = await this.getSupportedLanguagesAsync();
            // Also surface known adapters with install status if available from registry
            let available = [];
            const dyn = adapterRegistry;
            if (typeof dyn.listAvailableAdapters === 'function') {
                try {
                    const meta = await dyn.listAvailableAdapters();
                    available = meta.map(m => ({
                        language: m.name,
                        package: m.packageName,
                        installed: m.installed,
                        description: m.description
                    }));
                }
                catch (e) {
                    this.logger.warn('Failed to query detailed adapter metadata; returning installed list only', { error: e?.message });
                }
            }
            else {
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
        }
        catch (error) {
            this.logger.error('Failed to list supported languages', { error });
            throw new McpError(McpErrorCode.InternalError, `Failed to list supported languages: ${error.message}`);
        }
    }
    /**
     * Public methods for server lifecycle management
     */
    async start() {
        // For MCP servers, start is handled by transport
        this.logger.info('Debug MCP Server started');
    }
    async stop() {
        await this.sessionManager.closeAllSessions();
        this.logger.info('Debug MCP Server stopped');
    }
    /**
     * Get adapter registry from session manager
     */
    getAdapterRegistry() {
        return this.sessionManager.adapterRegistry;
    }
}
//# sourceMappingURL=server.js.map
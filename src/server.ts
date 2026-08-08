
/**
 * Debug MCP Server - Main Server Implementation
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ErrorCode as McpErrorCode,
  McpError,
  ServerResult,
} from '@modelcontextprotocol/sdk/types.js';
import { buildServerInstructions, buildDebuggingWorkflowPrompt } from './skill-content.js';
import {
  SessionNotFoundError,
  SessionTerminatedError,
  UnsupportedLanguageError,
  UnsupportedFeatureError,
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
    SessionLifecycleState,
    IEnvironment,
    ExceptionBreakMode
} from '@debugmcp/shared';
import { DebugProtocol } from '@vscode/debugprotocol';
import path from 'path';
import { SimpleFileChecker, createSimpleFileChecker, FileExistenceResult } from './utils/simple-file-checker.js';
import { LineReader, createLineReader } from './utils/line-reader.js';
import { getDisabledLanguages, isLanguageDisabled } from './utils/language-config.js';
import { isContainerMode, getWorkspaceRoot } from './utils/container-path-utils.js';
import {
  BP_ADDRESSING_ENV_KEY,
  getBpAddressingMode,
  supportsExpectedContent,
  supportsStatementAnchors,
  supportsLoudSnapping
} from './utils/bp-addressing.js';
import { assertLineContent } from './utils/breakpoint-resolver.js';

const DEFAULT_LANGUAGES = Object.freeze([DebugLanguage.PYTHON, DebugLanguage.MOCK] as const);

function getDefaultLanguages(): string[] {
  return [...DEFAULT_LANGUAGES];
}

function ensureLanguage(
  languages: readonly string[],
  language: string
): string[] {
  return languages.includes(language) ? [...languages] : [...languages, language];
}

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
  logMessage?: string;
  expectedContent?: string;
  breakpointId?: string;
  scriptPath?: string;
  args?: string[];
  dapLaunchArgs?: Partial<DebugProtocol.LaunchRequestArguments>;
  dryRunSpawn?: boolean;
  breakOnExceptions?: string;
  adapterLaunchConfig?: Record<string, unknown>;
  scope?: number;
  frameId?: number;
  expression?: string;
  linesContext?: number;
  includeInternals?: boolean;
  includeSpecial?: boolean;
  // Attach-related parameters
  port?: number;
  host?: string;
  processId?: number | string;
  timeout?: number;
  verifyTimeout?: number;
  sourcePaths?: string[];
  stopOnEntry?: boolean;
  justMyCode?: boolean;
  terminateProcess?: boolean;
  suspendPolicy?: 'all' | 'thread';
  threadId?: number;
  // redefine_classes parameters
  classesDir?: string;
  sinceTimestamp?: number;
  // get_output parameters
  since?: number;
  limit?: number;
}

/**
 * Request shape for DebugMcpServer.setBreakpoint (issue #271).
 */
export interface SetBreakpointRequest {
  sessionId: string;
  file: string;
  /** 1-based target line */
  line: number;
  /** Assert the target line's trimmed content before setting (assert/content modes) */
  expectedContent?: string;
  condition?: string;
  logMessage?: string;
  suspendPolicy?: 'all' | 'thread';
}

/**
 * Schema-driven type coercion for MCP tool arguments.
 *
 * Works around a known Claude Code bug (anthropics/claude-code#11359) where
 * SSE-transport tool arguments arrive as strings instead of their declared
 * JSON-Schema types.  Called once per request on the fresh args object — no
 * shared state is mutated.
 */
const TOOL_ARG_EXPECTED_TYPES: Record<string, 'number' | 'boolean' | 'object' | 'array'> = {
  // numbers
  line: 'number', linesContext: 'number', scope: 'number',
  frameId: 'number', port: 'number', timeout: 'number', threadId: 'number',
  verifyTimeout: 'number', since: 'number', limit: 'number',
  sinceTimestamp: 'number',
  // booleans
  includeInternals: 'boolean', includeSpecial: 'boolean',
  stopOnEntry: 'boolean', justMyCode: 'boolean',
  dryRunSpawn: 'boolean', terminateProcess: 'boolean',
  // objects
  dapLaunchArgs: 'object', adapterLaunchConfig: 'object',
  // arrays
  args: 'array', sourcePaths: 'array',
};

export function coerceToolArguments(args: Record<string, unknown>): Record<string, unknown> {
  for (const [key, expectedType] of Object.entries(TOOL_ARG_EXPECTED_TYPES)) {
    const val = args[key];
    if (val === undefined) continue;

    // Handle "null" string → undefined for optional params
    if (val === 'null') { args[key] = undefined; continue; }

    if (typeof val !== 'string') continue; // already correct type

    switch (expectedType) {
      case 'number': {
        if (val !== '') {
          const n = Number(val);
          if (!Number.isNaN(n)) args[key] = n;
        }
        break;
      }
      case 'boolean':
        if (val === 'true') args[key] = true;
        else if (val === 'false') args[key] = false;
        break;
      case 'object':
      case 'array':
        try {
          const parsed = JSON.parse(val);
          if (expectedType === 'object' && typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            args[key] = parsed;
          } else if (expectedType === 'array' && Array.isArray(parsed)) {
            args[key] = parsed;
          }
        } catch { /* leave as-is, downstream validation will catch */ }
        break;
    }
  }
  return args;
}

/**
 * Main Debug MCP Server class
 */
export class DebugMcpServer {
  public server: Server;
  private sessionManager: SessionManager;
  private logger;
  private fileChecker: SimpleFileChecker;
  private lineReader: LineReader;
  private environment: IEnvironment;

  // Debuggee-output resource subscriptions (issue #218).
  // URIs subscribed via resources/subscribe; updated-pings are debounced so
  // notification volume is independent of debuggee output volume.
  private static readonly OUTPUT_UPDATE_DEBOUNCE_MS = 150;
  private subscribedUris = new Set<string>();
  private outputUpdateTimers = new Map<string, NodeJS.Timeout>();
  private handleOutputCaptured = (sessionId: string): void => {
    this.scheduleOutputResourceUpdated(sessionId);
  };

  // Get supported languages from adapter registry
  private async getSupportedLanguagesAsync(): Promise<string[]> {
    const disabled = getDisabledLanguages();
    const filter = (langs: readonly string[]) => this.filterDisabledLanguages(langs, disabled);
    const adapterRegistry = this.getAdapterRegistry();
    // Guard against undefined registry in certain test environments
    if (!adapterRegistry) {
      return filter(getDefaultLanguages());
    }
    // Prefer dynamic discovery if available on the concrete registry
    const dynRegistry = adapterRegistry as unknown as { listLanguages?: () => Promise<string[]> };
    const maybeList = dynRegistry.listLanguages;
    if (typeof maybeList === 'function') {
      try {
        const langs = await maybeList.call(adapterRegistry);
        if (Array.isArray(langs) && langs.length > 0) {
          const normalized =
            process.env.MCP_CONTAINER === 'true' ? ensureLanguage(langs, DebugLanguage.PYTHON) : langs;
          return filter(normalized);
        }
      } catch (e) {
        this.logger.warn('Dynamic adapter language discovery failed, falling back to registered languages', { error: (e as Error)?.message });
      }
    }
    // Fallback to already-registered factories (may be empty until first use)
    const langs = adapterRegistry.getSupportedLanguages?.() || [];
    if (langs.length > 0) {
      // In container runtime, ensure python is advertised even if not yet registered (preload may be async)
      if (process.env.MCP_CONTAINER === 'true') {
        return filter(ensureLanguage(langs, DebugLanguage.PYTHON));
      }
      return filter(langs);
    }
    // Final fallback to known defaults for UX (ensure python listed in container)
    if (process.env.MCP_CONTAINER === 'true') {
      return filter(ensureLanguage(getDefaultLanguages(), DebugLanguage.PYTHON));
    }
    return filter(getDefaultLanguages());
  }

  // Get language metadata for all supported languages
  private async getLanguageMetadata(): Promise<LanguageMetadata[]> {
    const languages = await this.getSupportedLanguagesAsync();

    // Hardcoded metadata fallback; adapters could provide this via registry in the future
    return languages.map((lang: string) => {
      switch (lang) {
        case DebugLanguage.PYTHON:
          return {
            id: DebugLanguage.PYTHON,
            displayName: 'Python',
            version: '1.0.0',
            requiresExecutable: true,
            defaultExecutable: 'python'
          };
        case DebugLanguage.RUBY:
          return {
            id: DebugLanguage.RUBY,
            displayName: 'Ruby',
            version: '1.0.0',
            requiresExecutable: true,
            defaultExecutable: 'ruby'
          };
        case DebugLanguage.MOCK:
          return {
            id: DebugLanguage.MOCK,
            displayName: 'Mock',
            version: '1.0.0',
            requiresExecutable: false
          };
        case DebugLanguage.JAVASCRIPT:
          return {
            id: DebugLanguage.JAVASCRIPT,
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
      // Typed subclass of McpError (same code/message) so per-tool catch blocks
      // can convert session-lifecycle failures into {success: false} results
      throw new SessionNotFoundError(sessionId);
    }
    // Check the new lifecycle state instead of legacy state
    if (session.sessionLifecycle === SessionLifecycleState.TERMINATED) {
      throw new SessionTerminatedError(sessionId);
    }
  }

  /**
   * Hybrid logpoint gating (issue #235): a known-unsupported adapter — the
   * live DAP capabilities (post-launch) or the static policy table says
   * supportsLogPoints is false — is a hard error; known-supported passes;
   * unknown support passes with a warning and is re-checked against the
   * adapter's real capabilities at launch (drift warning).
   */
  private validateLogPointSupport(sessionId: string): { warning?: string } {
    const session = this.sessionManager.getSession(sessionId);
    const liveCaps = session?.adapterCapabilities;
    const policy = this.sessionManager.getSessionPolicy(sessionId);
    const language = session?.language ?? policy.name;

    if (liveCaps) {
      if (liveCaps.supportsLogPoints === true) {
        return {};
      }
      throw new UnsupportedFeatureError('Logpoints (logMessage)', String(language),
        'the adapter did not advertise supportsLogPoints');
    }
    if (policy.supportsLogPoints === false) {
      throw new UnsupportedFeatureError('Logpoints (logMessage)', String(language));
    }
    if (policy.supportsLogPoints === true) {
      return {};
    }
    return {
      warning: `Logpoint support for ${String(language)} is unknown; it will be validated against the adapter's capabilities at launch`
    };
  }

  /**
   * Shared catch for the breakpoint management tools: session-lifecycle
   * failures become {success: false} results (same contract as
   * set_breakpoint's catch); everything else re-throws.
   */
  private handleBreakpointToolError(error: unknown): { content: [{ type: 'text'; text: string }] } {
    if (error instanceof McpError &&
        (error.message.includes('terminated') ||
         error.message.includes('closed') ||
         (error.message.includes('not found') && error.message.includes('Session')))) {
      return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }] };
    }
    throw error;
  }

  private validateBreakOnExceptions(value: string | undefined): ExceptionBreakMode | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value !== 'uncaught' && value !== 'all' && value !== 'none') {
      throw new McpError(
        McpErrorCode.InvalidParams,
        `breakOnExceptions must be one of 'uncaught', 'all', 'none' (got '${value}')`
      );
    }
    return value;
  }

  // Public methods to expose SessionManager functionality for testing/external use
  public async createDebugSession(params: { language: DebugLanguage; name?: string; executablePath?: string; }): Promise<DebugSessionInfo> {
    // Validate language support using dynamic discovery
    const supported = await this.getSupportedLanguagesAsync();
    const requested = params.language as unknown as string;
    const isContainer = process.env.MCP_CONTAINER === 'true';
    const allowInContainer = isContainer && requested === DebugLanguage.PYTHON; // ensure python allowed in container
    if (isLanguageDisabled(requested)) {
      throw new McpError(
        McpErrorCode.InvalidParams,
        `Language '${params.language}' is disabled in this runtime. Available languages: ${supported.join(', ')}`,
      );
    }
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
    dryRunSpawn?: boolean,
    adapterLaunchConfig?: Record<string, unknown>,
    breakOnExceptions?: ExceptionBreakMode
  ): Promise<{ success: boolean; state: string; error?: string; data?: unknown; errorType?: string; errorCode?: number; }> {
    this.validateSession(sessionId);

    // Check script file exists for immediate feedback
    const fileCheck = await this.fileChecker.checkExists(scriptPath);
    if (!fileCheck.exists) {
      throw this.fileNotFoundError('Script file', scriptPath, fileCheck);
    }

    this.logger.info(`[DebugMcpServer.startDebugging] Script file exists: ${fileCheck.effectivePath} (original: ${scriptPath})`);

    // Pass the effective path (which has been resolved for container) to session manager
    const result = await this.sessionManager.startDebugging(
      sessionId,
      fileCheck.effectivePath,
      args,
      dapLaunchArgs,
      dryRunSpawn,
      adapterLaunchConfig,
      breakOnExceptions
    );
    return result;
  }

  public async restartDebugging(sessionId: string): Promise<{ success: boolean; state: string; error?: string; data?: unknown }> {
    // Deliberately no validateSession(): a finished debuggee is
    // lifecycle-TERMINATED, and restarting after exit is the primary use
    // case (cf. handleGetOutput). Session existence is still enforced.
    if (!this.sessionManager.getSession(sessionId)) {
      throw new SessionNotFoundError(sessionId);
    }
    return this.sessionManager.restartDebugging(sessionId);
  }

  public async closeDebugSession(sessionId: string): Promise<boolean> {
    return this.sessionManager.closeSession(sessionId);
  }

  /**
   * Resolve a breakpoint file argument the same way for every breakpoint
   * tool: Java FQCNs and attach-session paths pass through verbatim; host
   * paths are resolved (and container-translated) via the file checker so
   * they string-match the effective paths stored on the session.
   * With requireExists, a missing file throws (set_breakpoint's behavior);
   * without it the resolved path is returned regardless, so breakpoints on
   * files deleted since being set can still be removed.
   */
  private async resolveBreakpointFile(
    sessionId: string,
    file: string,
    options?: { requireExists?: boolean }
  ): Promise<{ path: string; contentAddressable: boolean }> {
    // Check if the adapter handles non-file source identifiers (e.g. Java FQCNs)
    const policy = this.sessionManager.getSessionPolicy(sessionId);
    if (policy.isNonFileSourceIdentifier?.(file)) {
      this.logger.info(`[DebugMcpServer.resolveBreakpointFile] Non-file source identifier detected: ${file}`);
      return { path: file, contentAddressable: false };
    }

    // Attach sessions may debug a target on a remote filesystem (container,
    // pod, another machine); host-side existence checks don't apply. Pass the
    // path through as-is — the debugger knows its own filesystem best.
    if (this.sessionManager.getSession(sessionId)?.attachMode) {
      this.logger.info(`[DebugMcpServer.resolveBreakpointFile] Attach session: skipping host file check for ${file}`);
      return { path: file, contentAddressable: false };
    }

    const fileCheck = await this.fileChecker.checkExists(file);
    if (options?.requireExists && !fileCheck.exists) {
      throw this.fileNotFoundError('Breakpoint file', file, fileCheck);
    }

    this.logger.info(`[DebugMcpServer.resolveBreakpointFile] Resolved ${file} -> ${fileCheck.effectivePath} (exists: ${fileCheck.exists})`);
    return { path: fileCheck.effectivePath, contentAddressable: true };
  }

  public async setBreakpoint(req: SetBreakpointRequest): Promise<{ breakpoint: Breakpoint; warning?: string }> {
    this.validateSession(req.sessionId);

    const resolved = await this.resolveBreakpointFile(req.sessionId, req.file, { requireExists: true });
    const mode = getBpAddressingMode(this.environment);

    if (req.expectedContent !== undefined) {
      if (!resolved.contentAddressable) {
        throw new McpError(
          McpErrorCode.InvalidParams,
          `expectedContent requires a source file readable by the mcp-debugger server; "${req.file}" is a class name or remote path. Use line addressing instead.`
        );
      }
      const lines = await this.lineReader.getFileLines(resolved.path);
      if (!lines) {
        throw new McpError(
          McpErrorCode.InvalidParams,
          `Breakpoint not set: could not read ${resolved.path} to verify content (binary, too large, or unreadable). Use plain line addressing to skip verification.`
        );
      }
      const check = assertLineContent(lines, req.line, req.expectedContent, resolved.path, {
        statementHint: supportsStatementAnchors(mode)
      });
      if (!check.ok) {
        throw new McpError(McpErrorCode.InvalidParams, check.message);
      }
    }

    return this.sessionManager.setBreakpoint(req.sessionId, {
      file: resolved.path,
      line: req.line,
      condition: req.condition,
      suspendPolicy: req.suspendPolicy,
      logMessage: req.logMessage,
      // Loud snapping bookkeeping is absent in line mode so the control arm's
      // breakpoint records stay byte-identical to pre-#271 behavior.
      ...(supportsLoudSnapping(mode) ? { requestedLine: req.line } : {})
    });
  }

  // The breakpoint management tools below deliberately skip validateSession's
  // TERMINATED rejection (cf. handleGetOutput): a terminated-but-unclosed
  // session keeps its breakpoints so they can be listed and adjusted between
  // launches. Session existence is still enforced by the SessionManager.
  public listBreakpoints(sessionId: string, file?: string): Breakpoint[] {
    return this.sessionManager.listBreakpoints(sessionId, file);
  }

  public async removeBreakpoint(sessionId: string, breakpointId: string): Promise<{ removed?: Breakpoint; warning?: string }> {
    return this.sessionManager.removeBreakpoint(sessionId, breakpointId);
  }

  public async removeBreakpointsByLocation(sessionId: string, file: string, line: number): Promise<{ removed: Breakpoint[]; warning?: string }> {
    const resolved = await this.resolveBreakpointFile(sessionId, file);
    return this.sessionManager.removeBreakpointsByLocation(sessionId, resolved.path, line);
  }

  public async clearBreakpoints(sessionId: string, file?: string): Promise<{ cleared: number; files: string[]; warning?: string }> {
    const effectiveFile = file !== undefined
      ? (await this.resolveBreakpointFile(sessionId, file)).path
      : undefined;
    return this.sessionManager.clearBreakpoints(sessionId, effectiveFile);
  }

  public async getVariables(sessionId: string, variablesReference: number): Promise<Variable[]> {
    this.validateSession(sessionId);
    return this.sessionManager.getVariables(sessionId, variablesReference);
  }

  public async getStackTrace(sessionId: string, includeInternals: boolean = false): Promise<StackFrame[]> {
    this.validateSession(sessionId);
    const session = this.sessionManager.getSession(sessionId);
    if (!session || !session.proxyManager) {
        throw new ProxyNotRunningError(sessionId || 'unknown', 'get stack trace');
    }
    let currentThreadId = session.proxyManager.getCurrentThreadId();
    // If no thread ID is known (e.g. adapter omitted threadId from stopped event),
    // try to discover one via a 'threads' DAP request.
    if (typeof currentThreadId !== 'number') {
      try {
        const threadsResp = await session.proxyManager.sendDapRequest<DebugProtocol.ThreadsResponse>('threads', {});
        const threads = threadsResp?.body?.threads;
        if (Array.isArray(threads) && threads.length > 0 && typeof threads[0]?.id === 'number') {
          currentThreadId = threads[0].id;
        }
      } catch {
        // threads request failed — fall through to error
      }
    }
    if (typeof currentThreadId !== 'number') {
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

  public async stepOver(sessionId: string): Promise<{ success: boolean; state: string; error?: string; data?: unknown; }> {
    this.validateSession(sessionId);
    const result = await this.sessionManager.stepOver(sessionId);
    if (!result.success) {
      throw new Error(result.error || 'Failed to step over');
    }
    return result;
  }

  public async stepInto(sessionId: string): Promise<{ success: boolean; state: string; error?: string; data?: unknown; }> {
    this.validateSession(sessionId);
    const result = await this.sessionManager.stepInto(sessionId);
    if (!result.success) {
      throw new Error(result.error || 'Failed to step into');
    }
    return result;
  }

  public async stepOut(sessionId: string): Promise<{ success: boolean; state: string; error?: string; data?: unknown; }> {
    this.validateSession(sessionId);
    const result = await this.sessionManager.stepOut(sessionId);
    if (!result.success) {
      throw new Error(result.error || 'Failed to step out');
    }
    return result;
  }

  constructor(options: DebugMcpServerOptions = {}) {
    const containerConfig: ContainerConfig = {
      logLevel: options.logLevel,
      logFile: options.logFile,
      sessionLogDirBase: options.logFile ? path.resolve(path.dirname(options.logFile), 'sessions') : undefined
    };
    
    const dependencies = createProductionDependencies(containerConfig);
    
    this.logger = dependencies.logger;
    this.environment = dependencies.environment;
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
      {
        capabilities: { tools: {}, resources: { subscribe: true, listChanged: true }, prompts: {} },
        // Mode-gated (issue #271): the handshake must not teach restricted
        // addressing features. Env is process-stable, so constructor-time is fine.
        instructions: buildServerInstructions(getBpAddressingMode(this.environment))
      }
    );

    const sessionManagerConfig: SessionManagerConfig = {
      logDirBase: containerConfig.sessionLogDirBase
    };
    
    this.sessionManager = new SessionManager(sessionManagerConfig, dependencies);

    this.registerTools();
    this.registerResources();
    this.registerPrompts();
    this.sessionManager.on('output-captured', this.handleOutputCaptured);
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
    if (isContainerMode(this.environment)) {
      return `Path to the ${parameterName}. Use paths relative to the project root (e.g., examples/python/script.py). The server resolves these against the workspace mount.`;
    }
    if (parameterName === 'script') {
      return `Path to the script to debug. Use absolute paths or paths relative to your current working directory`;
    }
    return `Path to the ${parameterName}. Use absolute paths or paths relative to your current working directory`;
  }

  private fileNotFoundError(label: string, originalPath: string, fileCheck: FileExistenceResult): McpError {
    const containerHint = isContainerMode(this.environment)
      ? `\nHint: Ensure the Docker volume mount maps your project root to ${getWorkspaceRoot(this.environment)} (e.g., -v /path/to/project:${getWorkspaceRoot(this.environment)})`
      : '';
    return new McpError(McpErrorCode.InvalidParams,
      `${label} not found: '${originalPath}'\nLooked for: '${fileCheck.effectivePath}'${fileCheck.errorMessage ? `\nError: ${fileCheck.errorMessage}` : ''}${containerHint}`);
  }

  private registerTools(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      this.logger.debug('Handling ListToolsRequest');
      
      // Get supported languages dynamically - deferred until request time
      const supportedLanguages = await this.getSupportedLanguagesAsync();
      
      // Generate dynamic descriptions for path parameters
      const fileDescription = this.getPathDescription('source file');
      const scriptPathDescription = this.getPathDescription('script');

      // Addressing-mode-gated set_breakpoint params (issue #271): a server
      // restricted to line mode must not advertise content-addressing at all.
      const bpMode = getBpAddressingMode(this.environment);
      const setBreakpointExtraProps: Record<string, unknown> = {};
      if (supportsExpectedContent(bpMode)) {
        setBreakpointExtraProps.expectedContent = {
          type: 'string',
          description: 'Optional assertion: the exact text you expect on the target line (leading/trailing whitespace ignored). If it does not match, the breakpoint is NOT set and the error shows the actual content of that line and its neighbors — use this to catch stale or off-by-one line numbers before they cause confusing behavior'
        };
      }

      return {
        tools: [
          { name: 'create_debug_session', description: 'Create a new debugging session. Provide host and port to attach to a running process; omit them for launch mode', inputSchema: { type: 'object', properties: { language: { type: 'string', enum: supportedLanguages, description: 'Programming language for debugging' }, name: { type: 'string', description: 'Optional session name' }, executablePath: {type: 'string', description: 'Path to language executable (optional, will auto-detect if not provided)'}, host: { type: 'string', description: 'Host to attach to for remote debugging (optional, triggers attach mode)' }, port: { type: 'number', description: 'Debug port to attach to for remote debugging (optional, triggers attach mode)' }, timeout: { type: 'number', description: 'Connection timeout in milliseconds for attach mode (default: 30000)' }, verifyTimeout: { type: 'number', description: 'Attach mode only: how long to wait (ms) for the debugger to report at least one thread after attaching before failing the attach (default: 5000, max: 600000)' } }, required: ['language'] } },
          { name: 'list_supported_languages', description: 'List all supported debugging languages with metadata', inputSchema: { type: 'object', properties: {} } },
          { name: 'list_debug_sessions', description: 'List all active debugging sessions. Paused sessions include lastStop with the reason for the most recent stop (e.g. "breakpoint" vs "exception")', inputSchema: { type: 'object', properties: {} } },
          { name: 'set_breakpoint', description: 'Set a breakpoint. Setting breakpoints on non-executable lines (structural, declarative) may lead to unexpected behavior', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' }, file: { type: 'string', description: 'Path to the source file or Java FQCN. For Java, passing a fully-qualified class name (e.g. "com.example.MyClass" or "com.example.Outer$Inner") is preferred — it works reliably with all classloaders including custom classloaders. Alternatively, use absolute file paths.' }, line: { type: 'number', description: 'Line number where to set breakpoint. Executable statements (assignments, function calls, conditionals, returns) work best. Structural lines (function/class definitions), declarative lines (imports), or non-executable lines (comments, blank lines) may cause unexpected stepping behavior' }, ...setBreakpointExtraProps, condition: { type: 'string', description: 'Optional expression: only break (or log) when it evaluates truthy' }, logMessage: { type: 'string', description: 'Create a logpoint: instead of pausing, log this message when the line is hit. Expressions in {curly braces} are interpolated (e.g. "order={orderId} total={total}"). Messages arrive in get_output while the program runs at full speed. Supported by Python, JavaScript, Go, and Rust adapters; not by Java or .NET' }, suspendPolicy: { type: 'string', enum: ['all', 'thread'], description: 'Suspend policy when breakpoint is hit: "all" suspends all threads (default), "thread" only suspends the event thread. Only supported by the Java/JDI adapter.' } }, required: ['sessionId', 'file', 'line'] } },
          { name: 'list_breakpoints', description: 'List all breakpoints in a session with their verified state and adapter-assigned ids. Works before launch (queued, verified=false), while running or paused, and after the program exits', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' }, file: { type: 'string', description: 'Optional: only list breakpoints in this file' } }, required: ['sessionId'] } },
          { name: 'remove_breakpoint', description: 'Remove a breakpoint by breakpointId (returned by set_breakpoint / list_breakpoints), or by file + line (removes all breakpoints at that location). Takes effect immediately while the program is running or paused; also works after the program exits, before a relaunch', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' }, breakpointId: { type: 'string', description: 'Breakpoint id from set_breakpoint or list_breakpoints. Takes precedence over file + line' }, file: { type: 'string', description: 'Alternative addressing: source file path (use together with line)' }, line: { type: 'number', description: 'Alternative addressing: line number (use together with file)' } }, required: ['sessionId'] } },
          { name: 'clear_breakpoints', description: 'Remove all breakpoints in a session, or all breakpoints in one file. Clearing zero breakpoints is success. Takes effect immediately while the program is running or paused', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' }, file: { type: 'string', description: 'Optional: only clear breakpoints in this file' } }, required: ['sessionId'] } },
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
                dryRunSpawn: { type: 'boolean' },
                breakOnExceptions: { type: 'string', enum: ['uncaught', 'all', 'none'], description: 'Break when exceptions are thrown: "uncaught" pauses at uncaught exceptions at the crash site instead of terminating the session; "all" also pauses on caught/raised exceptions (language-dependent). Launch sessions default to "uncaught" (Ruby is the exception — rdbg has no uncaught-only filter, so it stays "none"); pass "none" to opt out and let crashing scripts run to termination' },
                adapterLaunchConfig: {
                  type: 'object',
                  description: 'Optional adapter-specific launch configuration overrides',
                  additionalProperties: true
                }
              },
              required: ['sessionId', 'scriptPath']
            }
          },
          { name: 'restart_debugging', description: 'Restart the debuggee: terminate the current program (if still running) and relaunch it with the same configuration as the last start_debugging. All current breakpoints are re-applied automatically. The get_output buffer starts fresh — read from since=0 after a restart. Works while running, paused, or after the program has exited. Not available for attach sessions or sessions never launched', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' } }, required: ['sessionId'] } },
          { name: 'attach_to_process', description: 'Attach to a running process for debugging. After the attach handshake the target is verified by polling for threads; if none are reported within verifyTimeout (~5s default) the attach fails and the debug proxy is torn down', inputSchema: {
              type: 'object',
              properties: {
                sessionId: { type: 'string', description: 'Debug session ID' },
                port: { type: 'number', description: 'Debug port to attach to' },
                host: { type: 'string', description: 'Host to attach to (default: localhost)' },
                processId: { type: ['number', 'string'], description: 'Process ID (for local attach, language-specific)' },
                timeout: { type: 'number', description: 'Connection timeout in milliseconds (default: 30000)' },
                verifyTimeout: { type: 'number', description: 'How long to wait (ms) for the debugger to report at least one thread after attaching before failing the attach (default: 5000, max: 600000). Increase for targets that are slow to become debuggable, e.g. a busy or warming JVM' },
                sourcePaths: { type: 'array', items: { type: 'string' }, description: 'Source paths for code mapping' },
                stopOnEntry: { type: 'boolean', description: 'Stop on entry after attaching' },
                justMyCode: { type: 'boolean', description: 'Only debug user code (skip library code)' },
                breakOnExceptions: { type: 'string', enum: ['uncaught', 'all', 'none'], description: 'Break when exceptions are thrown: "uncaught" pauses at uncaught exceptions at the crash site; "all" also pauses on caught/raised exceptions (language-dependent). Default "none" — attach sessions never apply a language default (unlike launch)' }
              },
              required: ['sessionId']
            }
          },
          { name: 'detach_from_process', description: 'Detach from the debugged process without terminating it', inputSchema: {
              type: 'object',
              properties: {
                sessionId: { type: 'string', description: 'Debug session ID' },
                terminateProcess: { type: 'boolean', description: 'Whether to terminate the process on detach (default: false)' }
              },
              required: ['sessionId']
            }
          },
          { name: 'close_debug_session', description: 'Close a debugging session', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' } }, required: ['sessionId'] } },
          { name: 'step_over', description: 'Step over the current line. Waits briefly for the program to stop; if the step is still executing after ~5s (e.g. stepping over a long-running call), returns success with state "running" and pending:true — the session becomes "paused" when the step completes (check list_debug_sessions, or call pause_execution to interrupt)', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' } }, required: ['sessionId'] } },
          { name: 'step_into', description: 'Step into the current call. Waits briefly for the program to stop; if the step is still executing after ~5s, returns success with state "running" and pending:true — the session becomes "paused" when the step completes', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' } }, required: ['sessionId'] } },
          { name: 'step_out', description: 'Step out of the current function. Waits briefly for the program to stop; if the step is still executing after ~5s (e.g. the rest of the function is long-running), returns success with state "running" and pending:true — the session becomes "paused" when the step completes', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' } }, required: ['sessionId'] } },
          { name: 'continue_execution', description: 'Continue execution. Returns immediately after the adapter acknowledges; does not wait for the next stop. When the program stops again the session state becomes "paused" — check list_debug_sessions or get_stack_trace, whose lastStop/stopReason tells you why it stopped (e.g. "breakpoint" vs "exception"). Use get_output to read the program\'s stdout/stderr', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' } }, required: ['sessionId'] } },
          { name: 'pause_execution', description: 'Pause a running program. Waits briefly for the stop; if the program cannot stop within ~5s (e.g. blocked in native code), returns success with pending:true and the session reports "paused" once the stop lands', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' }, threadId: { type: 'number', description: 'Thread ID to pause. If omitted or 0, pauses all threads.' } }, required: ['sessionId'] } },
          { name: 'list_threads', description: 'List all threads in the debugged process', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' } }, required: ['sessionId'] } },
          { name: 'get_variables', description: 'Get variables (scope is variablesReference: number)', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' }, scope: { type: 'number', description: "The variablesReference number from a StackFrame or Variable" } }, required: ['sessionId', 'scope'] } },
          { name: 'get_local_variables', description: 'Get local variables for the current stack frame. This is a convenience tool that returns just the local variables without needing to traverse stack->scopes->variables manually', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' }, includeSpecial: { type: 'boolean', description: 'Include special/internal variables like this, __proto__, __builtins__, etc. Default: false' } }, required: ['sessionId'] } },
          { name: 'get_stack_trace', description: 'Get stack trace. The response includes stopReason — why the session is paused (e.g. "breakpoint" vs "exception")', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' }, includeInternals: { type: 'boolean', description: 'Include internal/framework frames (e.g., Node.js internals). Default: false for cleaner output.' } }, required: ['sessionId'] } },
          { name: 'get_scopes', description: 'Get scopes for a stack frame', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' }, frameId: { type: 'number', description: "The ID of the stack frame from a stackTrace response" } }, required: ['sessionId', 'frameId'] } },
          { name: 'evaluate_expression', description: 'Evaluate expression in the current debug context. Expressions can read and modify program state. Waits up to 30s for the result by default; pass timeout for long-running expressions', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' }, expression: { type: 'string' }, frameId: { type: 'number', description: 'Optional stack frame ID for evaluation context. Must be a frame ID from a get_stack_trace response. If not provided, uses the current (top) frame automatically' }, timeout: { type: 'number', description: 'Max time (ms) to wait for the evaluation to complete (default: 30000, max: 600000). On expiry the request fails but the expression may keep executing in the debuggee. Note: your MCP client may enforce its own overall request timeout' } }, required: ['sessionId', 'expression'] } },
          { name: 'get_source_context', description: 'Get source context around a specific line in a file', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' }, file: { type: 'string', description: fileDescription }, line: { type: 'number', description: 'Line number to get context for' }, linesContext: { type: 'number', description: 'Number of lines before and after to include (default: 5)' } }, required: ['sessionId', 'file', 'line'] } },
          { name: 'get_output', description: 'Get debuggee output (stdout/stderr/console) captured for a session. Buffered per launch (last 1000 entries; adapter telemetry filtered out). Works while the program is running and after it finishes, until the session is closed. Pass since=nextSince from the previous response to fetch only new output', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' }, since: { type: 'number', description: 'Only return entries with seq greater than this cursor (use nextSince from the previous response). Default: 0 = from the start of the buffer' }, limit: { type: 'number', description: 'Maximum entries to return (default: 100, max: 1000). hasMore:true in the response means more entries are available' } }, required: ['sessionId'] } },
          { name: 'redefine_classes', description: 'Hot-swap changed Java classes into a running JVM. Scans a classes directory for .class files modified after sinceTimestamp, matches them against loaded classes in the target JVM, and redefines them using JDI. Returns which classes were redefined and the newest file timestamp (pass as sinceTimestamp on next call for incremental updates). Only works with Java debug sessions.', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' }, classesDir: { type: 'string', description: 'Absolute path to compiled classes directory (e.g. build/classes/java/main/)' }, sinceTimestamp: { type: 'number', description: 'Unix timestamp (ms). Only redefine .class files modified after this time. 0 or omitted = all files.' }, timeout: { type: 'number', description: 'Max time (ms) to wait for the redefinition to complete (default: 30000, max: 600000). Increase when hot-swapping many classes at once' } }, required: ['sessionId', 'classesDir'] } },
        ],
      };
    });

    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request): Promise<ServerResult> => {
        const toolName = request.params.name;
        const args = coerceToolArguments((request.params.arguments ?? {}) as Record<string, unknown>) as ToolArguments;

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
              const lang = (args.language || DebugLanguage.PYTHON) as DebugLanguage;
              const requested = lang as unknown as string;
              const isContainer = process.env.MCP_CONTAINER === 'true';
              const allowInContainer = isContainer && requested === DebugLanguage.PYTHON;
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

              // A new output resource is now listable (issue #218)
              this.notifyResourceListChanged();

              // Check if attach mode is requested (host/port provided)
              const isAttachMode = args.port !== undefined;

              if (isAttachMode) {
                // Attach mode: immediately attach to the running process
                this.logger.info('session:attach-mode', {
                  sessionId: sessionInfo.id,
                  host: args.host || 'localhost',
                  port: args.port,
                  timestamp: Date.now()
                });

                try {
                  const attachResult = await this.sessionManager.attachToProcess(sessionInfo.id, {
                    port: args.port as number,
                    host: (args.host as string) || 'localhost',
                    timeout: (args.timeout as number) || 30000,
                    stopOnEntry: args.stopOnEntry,
                    verifyTimeout: args.verifyTimeout,
                  });

                  result = { content: [{ type: 'text', text: JSON.stringify({
                    success: attachResult.success,
                    sessionId: sessionInfo.id,
                    state: attachResult.state,
                    message: attachResult.success
                      ? `Created and attached ${sessionInfo.language} debug session: ${sessionInfo.name}`
                      : `Created session but attach failed: ${attachResult.error || 'Unknown error'}`
                  }) }] };
                } catch (error) {
                  this.logger.error('session:attach-failed', {
                    sessionId: sessionInfo.id,
                    error: error instanceof Error ? error.message : String(error),
                    timestamp: Date.now()
                  });

                  result = { content: [{ type: 'text', text: JSON.stringify({
                    success: false,
                    sessionId: sessionInfo.id,
                    state: 'error',
                    message: `Created session but failed to attach: ${error instanceof Error ? error.message : String(error)}`
                  }) }] };
                }
              } else {
                // Launch mode: just create the session
                result = { content: [{ type: 'text', text: JSON.stringify({
                  success: true,
                  sessionId: sessionInfo.id,
                  message: `Created ${sessionInfo.language} debug session: ${sessionInfo.name}`
                }) }] };
              }

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

              // Addressing-mode gating (issue #271): reject params outside the
              // configured mode even though the schema omits them — a client
              // replaying a cached schema must not slip features into a
              // restricted server. Checked on the raw args so unknown params
              // are caught too.
              const bpMode = getBpAddressingMode(this.environment);
              if (args.expectedContent !== undefined && !supportsExpectedContent(bpMode)) {
                throw new McpError(
                  McpErrorCode.InvalidParams,
                  `expectedContent is disabled (${BP_ADDRESSING_ENV_KEY}=${bpMode}). Use plain line addressing.`
                );
              }

              try {
                // Logpoint gating (issue #235): hard error for known-unsupported
                // adapters; a warning when support is unknown pre-launch.
                const logPointGate = args.logMessage !== undefined
                  ? this.validateLogPointSupport(args.sessionId)
                  : {};

                const { breakpoint, warning: syncWarning } = await this.setBreakpoint({
                  sessionId: args.sessionId,
                  file: args.file,
                  line: args.line,
                  expectedContent: args.expectedContent,
                  condition: args.condition,
                  suspendPolicy: args.suspendPolicy,
                  logMessage: args.logMessage
                });

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
                
                // Loud snapping (issue #271): if the adapter bound the
                // breakpoint to a different line than requested, say so
                // prominently instead of silently reporting the moved line.
                const snapped =
                  breakpoint.requestedLine !== undefined &&
                  breakpoint.line !== breakpoint.requestedLine;
                const snapWarning = snapped
                  ? `Breakpoint moved by the debugger: requested line ${breakpoint.requestedLine}, bound to line ${breakpoint.line}${
                      context ? `: \`${context.lineContent.trim()}\`` : ''
                    }`
                  : undefined;

                const warnings = [breakpoint.message, logPointGate.warning, syncWarning, snapWarning].filter(Boolean);
                result = { content: [{ type: 'text', text: JSON.stringify({
                  success: true,
                  breakpointId: breakpoint.id,
                  file: breakpoint.file,
                  line: breakpoint.line,
                  requestedLine: breakpoint.requestedLine,
                  content: context?.lineContent,
                  verified: breakpoint.verified,
                  logMessage: breakpoint.logMessage,
                  message: snapWarning || breakpoint.message || `${breakpoint.logMessage !== undefined ? 'Logpoint' : 'Breakpoint'} set at ${breakpoint.file}:${breakpoint.line}`,
                  // Warn on adapter validation messages, sync failures, snaps,
                  // and unknown logpoint support
                  warning: warnings.length > 0 ? warnings.join('; ') : undefined,
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
            case 'list_breakpoints': {
              if (!args.sessionId) {
                throw new McpError(McpErrorCode.InvalidParams, 'Missing required parameter: sessionId');
              }
              try {
                const breakpoints = this.listBreakpoints(args.sessionId, args.file);
                result = { content: [{ type: 'text', text: JSON.stringify({
                  success: true,
                  breakpoints,
                  count: breakpoints.length
                }) }] };
              } catch (error) {
                result = this.handleBreakpointToolError(error);
              }
              break;
            }
            case 'remove_breakpoint': {
              if (!args.sessionId) {
                throw new McpError(McpErrorCode.InvalidParams, 'Missing required parameter: sessionId');
              }
              if (!args.breakpointId && (!args.file || args.line === undefined)) {
                throw new McpError(
                  McpErrorCode.InvalidParams,
                  'Provide either breakpointId, or file and line together'
                );
              }
              try {
                let removed: Breakpoint[];
                let warning: string | undefined;
                if (args.breakpointId) {
                  const res = await this.removeBreakpoint(args.sessionId, args.breakpointId);
                  removed = res.removed ? [res.removed] : [];
                  warning = res.warning;
                  if (removed.length === 0) {
                    result = { content: [{ type: 'text', text: JSON.stringify({
                      success: false,
                      error: `No breakpoint found with id ${args.breakpointId}`
                    }) }] };
                    break;
                  }
                } else {
                  const res = await this.removeBreakpointsByLocation(args.sessionId, args.file!, args.line!);
                  removed = res.removed;
                  warning = res.warning;
                  if (removed.length === 0) {
                    result = { content: [{ type: 'text', text: JSON.stringify({
                      success: false,
                      error: `No breakpoint found at ${args.file}:${args.line}`
                    }) }] };
                    break;
                  }
                }
                result = { content: [{ type: 'text', text: JSON.stringify({
                  success: true,
                  removed,
                  message: `Removed ${removed.length} breakpoint(s)`,
                  warning
                }) }] };
              } catch (error) {
                result = this.handleBreakpointToolError(error);
              }
              break;
            }
            case 'clear_breakpoints': {
              if (!args.sessionId) {
                throw new McpError(McpErrorCode.InvalidParams, 'Missing required parameter: sessionId');
              }
              try {
                const res = await this.clearBreakpoints(args.sessionId, args.file);
                result = { content: [{ type: 'text', text: JSON.stringify({
                  success: true,
                  cleared: res.cleared,
                  files: res.files,
                  message: `Cleared ${res.cleared} breakpoint(s)`,
                  warning: res.warning
                }) }] };
              } catch (error) {
                result = this.handleBreakpointToolError(error);
              }
              break;
            }
            case 'start_debugging': {
              if (!args.sessionId || !args.scriptPath) {
                throw new McpError(McpErrorCode.InvalidParams, 'Missing required parameters');
              }
              
              try {
                if (args.adapterLaunchConfig !== undefined) {
                  const cfg = args.adapterLaunchConfig;
                  if (cfg === null || typeof cfg !== 'object' || Array.isArray(cfg)) {
                    throw new McpError(McpErrorCode.InvalidParams, 'adapterLaunchConfig must be an object when provided');
                  }
                }

                const debugResult = await this.startDebugging(
                  args.sessionId,
                  args.scriptPath,
                  args.args,
                  args.dapLaunchArgs,
                  args.dryRunSpawn,
                  args.adapterLaunchConfig,
                  this.validateBreakOnExceptions(args.breakOnExceptions)
                );
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
            case 'restart_debugging': {
              if (!args.sessionId) {
                throw new McpError(McpErrorCode.InvalidParams, 'Missing required parameter: sessionId');
              }
              try {
                const debugResult = await this.restartDebugging(args.sessionId);
                const responsePayload: Record<string, unknown> = {
                  success: debugResult.success,
                  state: debugResult.state,
                  message: debugResult.error
                    ? debugResult.error
                    : (debugResult.data as Record<string, unknown>)?.message || 'Debugging restarted',
                };
                if (debugResult.error) {
                  responsePayload.error = debugResult.error;
                }
                if (debugResult.data) {
                  responsePayload.data = debugResult.data;
                }
                result = { content: [{ type: 'text', text: JSON.stringify(responsePayload) }] };
              } catch (error) {
                result = this.handleBreakpointToolError(error);
              }
              break;
            }
            case 'attach_to_process': {
              if (!args.sessionId) {
                throw new McpError(McpErrorCode.InvalidParams, 'Missing required sessionId');
              }

              try {
                this.logger.info('Attach to process requested', {
                  sessionId: args.sessionId,
                  port: args.port,
                  host: args.host,
                  processId: args.processId
                });

                const attachResult = await this.sessionManager.attachToProcess(args.sessionId, {
                  port: args.port,
                  host: args.host,
                  processId: args.processId,
                  timeout: args.timeout,
                  verifyTimeout: args.verifyTimeout,
                  sourcePaths: args.sourcePaths,
                  stopOnEntry: args.stopOnEntry,
                  justMyCode: args.justMyCode,
                  breakOnExceptions: this.validateBreakOnExceptions(args.breakOnExceptions)
                });

                const responsePayload: Record<string, unknown> = {
                  success: attachResult.success,
                  state: attachResult.state,
                  message: attachResult.error ||
                    (attachResult.data as Record<string, unknown>)?.message ||
                    'Attach operation completed'
                };

                if (attachResult.data) {
                  responsePayload.data = attachResult.data;
                }

                result = { content: [{ type: 'text', text: JSON.stringify(responsePayload) }] };
              } catch (error) {
                // Handle session state errors specifically
                if (error instanceof McpError &&
                    (error.message.includes('terminated') ||
                     error.message.includes('closed') ||
                     (error.message.includes('not found') && error.message.includes('Session')))) {
                  result = { content: [{ type: 'text', text: JSON.stringify({
                    success: false,
                    error: error.message,
                    state: 'stopped'
                  }) }] };
                } else {
                  throw error;
                }
              }
              break;
            }
            case 'detach_from_process': {
              if (!args.sessionId) {
                throw new McpError(McpErrorCode.InvalidParams, 'Missing required sessionId');
              }

              try {
                this.logger.info('Detach from process requested', {
                  sessionId: args.sessionId,
                  terminateProcess: args.terminateProcess
                });

                const detachResult = await this.sessionManager.detachFromProcess(
                  args.sessionId,
                  args.terminateProcess ?? false
                );

                const responsePayload: Record<string, unknown> = {
                  success: detachResult.success,
                  state: detachResult.state,
                  message: detachResult.error ||
                    (detachResult.data as Record<string, unknown>)?.message ||
                    'Detach operation completed'
                };

                if (detachResult.data) {
                  responsePayload.data = detachResult.data;
                }

                result = { content: [{ type: 'text', text: JSON.stringify(responsePayload) }] };
              } catch (error) {
                // Handle session state errors specifically
                if (error instanceof McpError &&
                    (error.message.includes('terminated') ||
                     error.message.includes('closed') ||
                     (error.message.includes('not found') && error.message.includes('Session')))) {
                  result = { content: [{ type: 'text', text: JSON.stringify({
                    success: false,
                    error: error.message,
                    state: 'stopped'
                  }) }] };
                } else {
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
              const closed = await this.closeDebugSession(args.sessionId);

              if (closed) {
                // Log session closure
                this.logger.info('session:closed', {
                  sessionId: args.sessionId,
                  sessionName: sessionName,
                  timestamp: Date.now()
                });

                // The session's output resource is gone (issue #218)
                const outputUri = this.outputResourceUri(args.sessionId);
                this.subscribedUris.delete(outputUri);
                this.clearOutputUpdateTimer(outputUri);
                this.notifyResourceListChanged();
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
                let stepResult: { success: boolean; state: string; error?: string; data?: unknown; };
                if (toolName === 'step_over') {
                  stepResult = await this.stepOver(args.sessionId);
                } else if (toolName === 'step_into') {
                  stepResult = await this.stepInto(args.sessionId);
                } else {
                  stepResult = await this.stepOut(args.sessionId);
                }

                // Build response with location and line context if available
                const stepType = toolName.replace('step_', '').replace('_', ' ');
                const resultData = stepResult.data as { message?: string; location?: { file: string; line: number; column?: number }; pending?: boolean } | undefined;
                const response: Record<string, unknown> = {
                  success: stepResult.success,
                  message: `Stepped ${stepType}`,
                  state: stepResult.state
                };

                // A pending step means the program is still executing (e.g. stepping
                // over a long-running call); report that truthfully instead of "Stepped".
                if (resultData?.pending) {
                  response.pending = true;
                  if (resultData.message) {
                    response.message = resultData.message;
                  }
                }

                // Extract location from result data
                const location = resultData?.location;

                if (location) {
                  response.location = location;

                  // Try to get line context
                  try {
                    const lineContext = await this.lineReader.getLineContext(
                      location.file,
                      location.line,
                      { contextLines: 2 }
                    );

                    if (lineContext) {
                      response.context = {
                        lineContent: lineContext.lineContent,
                        surrounding: lineContext.surrounding
                      };
                    }
                  } catch (contextError) {
                    // Log but don't fail if we can't get context
                    this.logger.debug('Could not get line context for step result', {
                      file: location.file,
                      line: location.line,
                      error: contextError
                    });
                  }
                }

                result = { content: [{ type: 'text', text: JSON.stringify(response) }] };
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
              result = await this.handlePause(args as { sessionId: string; threadId?: number });
              break;
            }
            case 'list_threads': {
              if (!args.sessionId) {
                throw new McpError(McpErrorCode.InvalidParams, 'Missing required sessionId');
              }
              result = await this.handleListThreads(args as { sessionId: string });
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
                const lastStop = this.sessionManager.getSession(args.sessionId)?.lastStop;
                result = { content: [{ type: 'text', text: JSON.stringify({ success: true, stackFrames, count: stackFrames.length, includeInternals, stopReason: lastStop?.reason, lastStop }) }] };
              } catch (error) {
                // Handle validation errors specifically
                if (error instanceof SessionTerminatedError ||
                    error instanceof SessionNotFoundError ||
                    error instanceof ProxyNotRunningError) {
                  result = { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }] };
                } else if (error instanceof Error && !(error instanceof McpError)) {
                  // DAP-level failures (e.g. "Child session not ready ...")
                  // must surface as errors, not as an empty-but-successful
                  // stack trace (issue #124).
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
              result = await this.handleEvaluateExpression(args as { sessionId: string; expression: string; frameId?: number; timeout?: number });
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
            case 'get_output': {
              result = await this.handleGetOutput(args as { sessionId: string; since?: number; limit?: number });
              break;
            }
            case 'list_supported_languages': {
              result = await this.handleListSupportedLanguages();
              break;
            }
            case 'redefine_classes': {
              const redefineResult = await this.sessionManager.redefineClasses(
                args.sessionId as string,
                args.classesDir as string,
                (args.sinceTimestamp as number) || 0,
                args.timeout
              );
              result = {
                content: [{ type: 'text' as const, text: JSON.stringify(redefineResult, null, 2) }],
              };
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

  // ===== Debuggee-output resources (issue #218) =====

  private outputResourceUri(sessionId: string): string {
    return `debug://sessions/${sessionId}/output`;
  }

  /** Returns the sessionId encoded in a debug output resource URI, or undefined. */
  private parseOutputResourceUri(uri: string): string | undefined {
    const match = /^debug:\/\/sessions\/([^/]+)\/output$/.exec(uri);
    return match?.[1];
  }

  /**
   * Registers MCP resource handlers. Each debug session exposes its captured
   * debuggee output as debug://sessions/{id}/output — a verbatim console
   * transcript (all categories interleaved, in arrival order). Clients may
   * subscribe to receive coalesced resources/updated pings as output arrives;
   * structured/cursor access is available via the get_output tool.
   */
  private registerResources(): void {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const sessions = this.sessionManager.getAllSessions();
      return {
        resources: sessions.map(session => ({
          uri: this.outputResourceUri(session.id),
          name: `Debuggee output — ${session.name}`,
          description: `stdout/stderr/console output captured for ${session.language} debug session '${session.name}'`,
          mimeType: 'text/plain'
        }))
      };
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;
      const sessionId = this.parseOutputResourceUri(uri);
      const session = sessionId ? this.sessionManager.getSession(sessionId) : undefined;
      if (!session) {
        throw new McpError(McpErrorCode.InvalidParams, `Unknown resource: ${uri}`);
      }
      return {
        contents: [{
          uri,
          mimeType: 'text/plain',
          // Empty until the first launch creates the buffer
          text: session.outputBuffer?.renderText() ?? ''
        }]
      };
    });

    this.server.setRequestHandler(SubscribeRequestSchema, async (request) => {
      const uri = request.params.uri;
      const sessionId = this.parseOutputResourceUri(uri);
      if (!sessionId || !this.sessionManager.getSession(sessionId)) {
        throw new McpError(McpErrorCode.InvalidParams, `Unknown resource: ${uri}`);
      }
      this.subscribedUris.add(uri);
      return {};
    });

    this.server.setRequestHandler(UnsubscribeRequestSchema, async (request) => {
      const uri = request.params.uri;
      this.subscribedUris.delete(uri);
      this.clearOutputUpdateTimer(uri);
      return {};
    });
  }

  /**
   * Registers MCP prompt handlers. The single `debugging-workflow` prompt
   * serves the condensed debugging skill in-band so any connected agent can
   * pull workflow guidance without a separate skill install (the full skill
   * with per-language references ships in skills/debugging/).
   */
  private registerPrompts(): void {
    const promptDescriptor = {
      name: 'debugging-workflow',
      description:
        'How to debug effectively with mcp-debugger: session golden path, root-cause discipline, attach/remote recipes, and per-language quirks.'
    };

    this.server.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: [promptDescriptor]
    }));

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      if (request.params.name !== promptDescriptor.name) {
        throw new McpError(McpErrorCode.InvalidParams, `Unknown prompt: ${request.params.name}`);
      }
      return {
        description: promptDescriptor.description,
        messages: [
          {
            role: 'user' as const,
            content: { type: 'text' as const, text: buildDebuggingWorkflowPrompt(getBpAddressingMode(this.environment)) }
          }
        ]
      };
    });
  }

  /**
   * Throttled resources/updated ping for a session's output resource: the
   * first captured event after a quiet period arms a timer; everything that
   * arrives inside the window rides the same ping.
   */
  private scheduleOutputResourceUpdated(sessionId: string): void {
    const uri = this.outputResourceUri(sessionId);
    if (!this.subscribedUris.has(uri) || this.outputUpdateTimers.has(uri)) {
      return;
    }
    const timer = setTimeout(() => {
      this.outputUpdateTimers.delete(uri);
      this.server.sendResourceUpdated({ uri }).catch((error: unknown) => {
        // Not connected yet / transport gone — nothing to notify, not an error.
        this.logger.debug(`[Server] Failed to send resources/updated for ${uri}`, { error });
      });
    }, DebugMcpServer.OUTPUT_UPDATE_DEBOUNCE_MS);
    timer.unref?.();
    this.outputUpdateTimers.set(uri, timer);
  }

  private clearOutputUpdateTimer(uri: string): void {
    const timer = this.outputUpdateTimers.get(uri);
    if (timer) {
      clearTimeout(timer);
      this.outputUpdateTimers.delete(uri);
    }
  }

  /** Fire-and-forget resources/list_changed (sessions appeared/disappeared). */
  private notifyResourceListChanged(): void {
    this.server.sendResourceListChanged().catch((error: unknown) => {
      this.logger.debug('[Server] Failed to send resources/list_changed', { error });
    });
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
        if (session.lastStop) {
            mappedSession.lastStop = session.lastStop;
        }
        if (session.exitCode !== undefined) {
            mappedSession.exitCode = session.exitCode;
        }
        return mappedSession;
      });
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, sessions: sessionData, count: sessionData.length }) }] };
    } catch (error) {
      this.logger.error('Failed to list debug sessions', { error });
      throw new McpError(McpErrorCode.InternalError, `Failed to list debug sessions: ${(error as Error).message}`);
    }
  }

  private async handleGetOutput(args: { sessionId: string; since?: number; limit?: number }): Promise<ServerResult> {
    // Deliberately no validateSession(): that rejects TERMINATED sessions, but
    // reading output after the program finished is the primary use case.
    // Output stays readable until close_debug_session removes the session.
    const session = this.sessionManager.getSession(args.sessionId);
    if (!session) {
      return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: `Session not found: ${args.sessionId}` }) }] };
    }
    const since = Math.max(0, args.since ?? 0);
    const limit = Math.min(Math.max(1, args.limit ?? 100), 1000);
    const read = session.outputBuffer
      ? session.outputBuffer.read(since, limit)
      : { entries: [], nextSince: since, hasMore: false, dropped: 0 }; // session created but never launched
    return { content: [{ type: 'text', text: JSON.stringify({
      success: true,
      sessionId: args.sessionId,
      entries: read.entries,
      nextSince: read.nextSince,
      hasMore: read.hasMore,
      dropped: read.dropped
    }) }] };
  }

  private async handlePause(args: { sessionId: string; threadId?: number }): Promise<ServerResult> {
    try {
      this.validateSession(args.sessionId);
      const result = await this.sessionManager.pause(args.sessionId, args.threadId);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (error) {
      this.logger.error('Failed to pause execution', { error });
      if (error instanceof SessionTerminatedError ||
          error instanceof SessionNotFoundError ||
          error instanceof ProxyNotRunningError) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }] };
      }
      if (error instanceof McpError) throw error;
      throw new McpError(McpErrorCode.InternalError, `Failed to pause execution: ${(error as Error).message}`);
    }
  }

  private async handleListThreads(args: { sessionId: string }): Promise<ServerResult> {
    try {
      this.validateSession(args.sessionId);
      const threads = await this.sessionManager.listThreads(args.sessionId);
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, threads }) }] };
    } catch (error) {
      this.logger.error('Failed to list threads', { error });
      if (error instanceof SessionTerminatedError ||
          error instanceof SessionNotFoundError ||
          error instanceof ProxyNotRunningError) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }] };
      }
      if (error instanceof McpError) throw error;
      throw new McpError(McpErrorCode.InternalError, `Failed to list threads: ${(error as Error).message}`);
    }
  }

  private async handleEvaluateExpression(args: { sessionId: string, expression: string, frameId?: number, timeout?: number }): Promise<ServerResult> {
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
        args.frameId,
        // Let SessionManager use its default context ('watch') for proper variable access
        args.timeout
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
        throw this.fileNotFoundError('Source file', args.file, fileCheck);
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
      if (error instanceof SessionTerminatedError ||
          error instanceof SessionNotFoundError ||
          error instanceof ProxyNotRunningError) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }] };
      }
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

      // Surface adapter warnings embedded in the scope name — e.g. Delve
      // reports "Locals (warning: optimized function)" when the debuggee was
      // built with optimizations, which typically means missing variables.
      const warningMatch = result.scopeName?.match(/\(warning:[^)]*\)/i);
      if (warningMatch) {
        response.warning =
          `The debug adapter reported the locals scope as "${result.scopeName}". ` +
          'This usually means the target was compiled with optimizations, so variables may be missing or unreadable. ' +
          'For Go, rebuild the binary with -gcflags="all=-N -l" (exec mode) or launch the .go source directly (debug mode).';
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
        // A terminated session is a normal end state (e.g. a step_out ran the
        // program to completion) — explain that instead of implying misuse.
        const message = error.message.includes('terminated')
          ? 'The program has terminated, so no frames or variables exist. Use restart_debugging to run it again.'
          : 'Cannot get local variables. The session must be paused at a breakpoint.';
        return { content: [{ type: 'text', text: JSON.stringify({
          success: false,
          error: error.message,
          message
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
      let available: Array<{ language: string; package: string; installed: boolean; description?: string }> = installed.map(lang => ({
        language: lang,
        package: `@debugmcp/adapter-${lang}`,
        installed: true
      }));

      if (adapterRegistry) {
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
      }
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
   * Public methods for server lifecycle and configuration
   */
  public async start(): Promise<void> {
    // For MCP servers, start is handled by transport
    const buildTime = new Date().toISOString();
    this.logger.info(`[MCP Server] Started at ${buildTime}, version: ${process.env.npm_package_version || 'dev'}`);
  }

  public async stop(): Promise<void> {
    await this.sessionManager.closeAllSessions();
    // Tear down output-resource bookkeeping (issue #218): pending debounce
    // timers and the SessionManager listener must not outlive the server
    // (the test suite runs with a strict leak guard).
    for (const uri of this.outputUpdateTimers.keys()) {
      this.clearOutputUpdateTimer(uri);
    }
    this.subscribedUris.clear();
    this.sessionManager.removeListener('output-captured', this.handleOutputCaptured);
    this.logger.info('Debug MCP Server stopped');
  }

  /**
   * Get adapter registry from session manager
   */
  public getAdapterRegistry() {
    return this.sessionManager.adapterRegistry;
  }

  private filterDisabledLanguages(
    languages: readonly string[],
    disabled?: Set<string>,
  ): string[] {
    const disabledSet = disabled ?? getDisabledLanguages();
    if (!disabledSet.size) {
      return [...languages];
    }
    return languages.filter((lang) => !disabledSet.has(lang));
  }
}

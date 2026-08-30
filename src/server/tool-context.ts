/**
 * The contract every tool handler in src/server/handlers/ programs against.
 *
 * DebugMcpServer implements it and passes itself, so handlers read every
 * dependency (sessionManager, logger, fileChecker, ...) from the live server
 * at call time rather than from copies captured at construction — the
 * handler tests (tests/core/unit/server/handlers/*.test.ts) assign
 * ctx.lineReader, ctx.fileChecker and ctx.validateSession on an
 * already-constructed context and expect the handlers to see the swap.
 *
 * Type-only imports throughout; this module never imports src/server.ts.
 */
import type { McpError } from '@modelcontextprotocol/sdk/types.js';
import type { DebugProtocol } from '@vscode/debugprotocol';
import type {
  Breakpoint,
  DebugLanguage,
  DebugSessionInfo,
  ExceptionBreakMode,
  FunctionBreakpoint,
  IAdapterRegistry,
  IEnvironment,
  ILogger,
  Variable
} from '@debugmcp/shared';
import type { SessionManager } from '../session/session-manager.js';
import type { StackTraceResult } from '../session/session-manager-data.js';
import type { VariableTruncationSummary } from '../session/variable-caps.js';
import type { SimpleFileChecker, FileExistenceResult } from '../utils/simple-file-checker.js';
import type { LineReader } from '../utils/line-reader.js';
import type { ValidationResultCache } from '../utils/language-availability.js';
import type { OutputResourceNotifier } from './output-resources.js';
import type { LanguageMetadata } from './language-discovery.js';
import type { ToolArguments } from './tool-arguments.js';
import type { ToolResult } from './tool-result.js';

/**
 * Request shape for DebugMcpServer.setBreakpoint (issue #271).
 */
export interface SetBreakpointRequest {
  sessionId: string;
  file: string;
  /** 1-based target line (required unless statement is given) */
  line?: number;
  /** Assert the target line's trimmed content before setting (assert/content modes) */
  expectedContent?: string;
  /** Content anchor: whole-line trimmed-equality match (content mode) */
  statement?: string;
  /** Disambiguates a multi-match statement to the closest occurrence */
  nearLine?: number;
  condition?: string;
  logMessage?: string;
  suspendPolicy?: 'all' | 'thread';
}

export interface ToolContext {
  // ---- live dependencies ----
  readonly sessionManager: SessionManager;
  readonly logger: ILogger;
  readonly fileChecker: SimpleFileChecker;
  readonly lineReader: LineReader;
  readonly environment: IEnvironment;
  readonly validationCache: ValidationResultCache;
  readonly outputResources: OutputResourceNotifier;

  // ---- context services ----
  getAdapterRegistry(): IAdapterRegistry;
  getSessionName(sessionId: string): string;
  validateSession(sessionId: string): void;
  fileNotFoundError(label: string, originalPath: string, fileCheck: FileExistenceResult): McpError;
  getSupportedLanguagesAsync(): Promise<string[]>;
  getLanguageMetadata(): Promise<LanguageMetadata[]>;

  // ---- breakpoint gating ----
  validateLogPointSupport(sessionId: string): { warning?: string };
  validateFunctionBreakpointSupport(sessionId: string): { warning?: string };

  // ---- public facade (unchanged signatures) ----
  createDebugSession(params: { language: DebugLanguage; name?: string; executablePath?: string; }): Promise<DebugSessionInfo>;
  startDebugging(
    sessionId: string,
    scriptPath: string,
    args?: string[],
    dapLaunchArgs?: Partial<DebugProtocol.LaunchRequestArguments>,
    dryRunSpawn?: boolean,
    adapterLaunchConfig?: Record<string, unknown>,
    breakOnExceptions?: ExceptionBreakMode
  ): Promise<{ success: boolean; state: string; error?: string; data?: unknown; errorType?: string; errorCode?: number; }>;
  restartDebugging(sessionId: string): Promise<{ success: boolean; state: string; error?: string; data?: unknown }>;
  closeDebugSession(sessionId: string): Promise<boolean>;
  setFunctionBreakpoint(
    sessionId: string,
    functionName: string,
    condition?: string
  ): Promise<{ breakpoint: FunctionBreakpoint; warning?: string }>;
  setBreakpoint(req: SetBreakpointRequest): Promise<{ breakpoint: Breakpoint; warning?: string }>;
  listBreakpoints(sessionId: string, file?: string): Breakpoint[];
  removeBreakpoint(sessionId: string, breakpointId: string): Promise<{ removed?: Breakpoint | FunctionBreakpoint; warning?: string }>;
  removeBreakpointsByLocation(sessionId: string, file: string, line: number): Promise<{ removed: Breakpoint[]; warning?: string }>;
  clearBreakpoints(sessionId: string, file?: string): Promise<{ cleared: number; files: string[]; warning?: string }>;
  getVariables(sessionId: string, variablesReference: number, names?: string[]): Promise<Variable[]>;
  getVariablesDetailed(sessionId: string, variablesReference: number, names?: string[]): Promise<{
    variables: Variable[];
    truncation?: VariableTruncationSummary;
  }>;
  getStackTrace(sessionId: string, includeInternals?: boolean, threadId?: number): Promise<StackTraceResult>;
  getScopes(sessionId: string, frameId: number): Promise<DebugProtocol.Scope[]>;
  getLocalVariables(sessionId: string, includeSpecial?: boolean, names?: string[]): Promise<{
    variables: Variable[];
    frame: { name: string; file: string; line: number } | null;
    scopeName: string | null;
    anchorNote?: string;
    truncation?: VariableTruncationSummary;
  }>;
  continueExecution(sessionId: string): Promise<boolean>;
  stepOver(sessionId: string): Promise<{ success: boolean; state: string; error?: string; data?: unknown; }>;
  stepInto(sessionId: string): Promise<{ success: boolean; state: string; error?: string; data?: unknown; }>;
  stepOut(sessionId: string): Promise<{ success: boolean; state: string; error?: string; data?: unknown; }>;
}

/**
 * One MCP tool. `toolName` is the name the request carried, for handlers that
 * serve several tools (step_over / step_into / step_out).
 */
export type ToolHandler = (ctx: ToolContext, args: ToolArguments, toolName: string) => Promise<ToolResult>;

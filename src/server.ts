
/**
 * Debug MCP Server - Main Server Implementation
 *
 * Tool schemas, argument coercion, dispatch and the per-tool handlers live in
 * the sibling directory src/server/ (NodeNext resolves ./server.js and
 * ./server/x.js without conflict).
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode as McpErrorCode,
  McpError,
  ServerResult,
} from '@modelcontextprotocol/sdk/types.js';
import { buildServerInstructions } from './skill-content.js';
import {
  SessionNotFoundError,
  SessionTerminatedError,
  UnsupportedFeatureError,
  ProxyNotRunningError
} from './errors/debug-errors.js';
import { SessionManager, SessionManagerConfig } from './session/session-manager.js';
import { StackTraceResult } from './session/session-manager-data.js';
import { buildTruncationNotice, VariableTruncationSummary } from './session/variable-caps.js';
import { createProductionDependencies } from './container/dependencies.js';
import { ContainerConfig } from './container/types.js';
import {
    DebugSessionInfo,
    Variable,
    DebugLanguage,
    Breakpoint,
    FunctionBreakpoint,
    SessionLifecycleState,
    SessionState,
    IEnvironment,
    ILogger,
    ExceptionBreakMode,
    REDACTION_NOTICE
} from '@debugmcp/shared';
import { DebugProtocol } from '@vscode/debugprotocol';
import path from 'path';
import { SimpleFileChecker, createSimpleFileChecker, FileExistenceResult } from './utils/simple-file-checker.js';
import { LineReader, createLineReader } from './utils/line-reader.js';
import { getDisabledLanguages, isLanguageDisabled } from './utils/language-config.js';
import {
  probeLanguageEntry,
  ValidationResultCache,
  LanguageModes
} from './utils/language-availability.js';
import { isContainerMode, getWorkspaceRoot } from './utils/container-path-utils.js';
import {
  getBpAddressingMode,
  supportsStatementAnchors,
  supportsLoudSnapping
} from './utils/bp-addressing.js';
import { isRedactionEnabled } from './utils/redaction-mode.js';
import { getVariableAccessMode, requiresExplicitNames } from './utils/variable-access.js';
import { assertLineContent, resolveStatement, stripTrailingComment } from './utils/breakpoint-resolver.js';
import { coerceToolArguments, ToolArguments } from './server/tool-arguments.js';
import { extractPayloadSuccess, sanitizeRequest } from './server/tool-result.js';
import { buildToolDefinitions } from './server/tool-schemas.js';
import { OutputResourceNotifier, registerResourceHandlers } from './server/output-resources.js';
import { registerPromptHandlers } from './server/prompts.js';
import { discoverSupportedLanguages, buildLanguageMetadata, LanguageMetadata } from './server/language-discovery.js';
import type { ToolContext, SetBreakpointRequest } from './server/tool-context.js';
import type { ToolResult } from './server/tool-result.js';
import {
  createDebugSessionTool,
  listDebugSessionsTool,
  closeDebugSessionTool,
  handleListDebugSessions
} from './server/handlers/session-tools.js';
import {
  startDebuggingTool,
  restartDebuggingTool,
  attachToProcessTool,
  detachFromProcessTool,
  redefineClassesTool
} from './server/handlers/debuggee-tools.js';
import {
  setBreakpointTool,
  listBreakpointsTool,
  removeBreakpointTool,
  clearBreakpointsTool
} from './server/handlers/breakpoint-tools.js';
import {
  stepTool,
  continueExecutionTool,
  pauseExecutionTool,
  listThreadsTool,
  handlePause,
  handleListThreads
} from './server/handlers/execution-tools.js';

export { coerceToolArguments };
export type { SetBreakpointRequest };

/**
 * Configuration options for the Debug MCP Server
 */
export interface DebugMcpServerOptions {
  logLevel?: string;
  logFile?: string;
}

/**
 * Entry in the list_supported_languages 'available' array.
 * 'installed' keeps its historical meaning (adapter package loadable);
 * 'modes' carries per-mode availability with reasons (issue #331).
 */
interface AvailableLanguage {
  language: string;
  package: string;
  installed: boolean;
  description?: string;
  modes: LanguageModes;
}

/**
 * Main Debug MCP Server class
 */
export class DebugMcpServer implements ToolContext {
  public server: Server;
  /** @internal ToolContext dependency; read live by the tool handlers. */
  public readonly sessionManager: SessionManager;
  /** @internal ToolContext dependency; read live by the tool handlers. */
  public readonly logger: ILogger;
  /** Detaches this server's logger from the shared file transport on stop() (issue #404). */
  private readonly disposeLogger?: () => void;
  /** @internal ToolContext dependency; read live by the tool handlers. */
  public readonly fileChecker: SimpleFileChecker;
  /** @internal ToolContext dependency; read live by the tool handlers. */
  public readonly lineReader: LineReader;
  /** @internal ToolContext dependency; read live by the tool handlers. */
  public readonly environment: IEnvironment;

  // Debuggee-output resource subscriptions (issue #218).
  /** @internal ToolContext dependency; read live by the tool handlers. */
  public readonly outputResources: OutputResourceNotifier;
  /** @internal ToolContext dependency; read live by the tool handlers. */
  public readonly validationCache = new ValidationResultCache();

  /** @internal Language discovery is a ToolContext service; see src/server/language-discovery.ts. */
  public async getSupportedLanguagesAsync(): Promise<string[]> {
    return discoverSupportedLanguages(this.getAdapterRegistry(), this.logger);
  }

  /** @internal Language metadata is a ToolContext service; see src/server/language-discovery.ts. */
  public async getLanguageMetadata(): Promise<LanguageMetadata[]> {
    return buildLanguageMetadata(await this.getSupportedLanguagesAsync());
  }

  /**
   * Validate session exists and is not terminated
   * @internal ToolContext service.
   */
  public validateSession(sessionId: string): void {
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
   * @internal ToolContext service.
   */
  public validateLogPointSupport(sessionId: string): { warning?: string } {
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
   * Function-breakpoint gating (issue #271 phase 3). Same hybrid shape as
   * validateLogPointSupport with one deliberate difference: the STATIC policy
   * verdict is checked FIRST. The policy encodes what the adapter and our
   * plumbing can actually deliver, so an explicit policy false must beat
   * whatever the live capabilities claim.
   * @internal ToolContext service.
   */
  public validateFunctionBreakpointSupport(sessionId: string): { warning?: string } {
    const session = this.sessionManager.getSession(sessionId);
    const liveCaps = session?.adapterCapabilities;
    const policy = this.sessionManager.getSessionPolicy(sessionId);
    const language = session?.language ?? policy.name;

    if (policy.supportsFunctionBreakpoints === false) {
      throw new UnsupportedFeatureError('Function breakpoints', String(language));
    }
    // CDP-delivered function breakpoints (issue #295): our proxy arms them out
    // of band, so the adapter's live capability bit is irrelevant — js-debug
    // will always report supportsFunctionBreakpoints: false.
    if (policy.supportsFunctionBreakpoints === true && policy.functionBreakpointsVia === 'cdp') {
      return {};
    }
    if (liveCaps) {
      if (liveCaps.supportsFunctionBreakpoints === true) {
        return {};
      }
      throw new UnsupportedFeatureError('Function breakpoints', String(language),
        'the adapter did not advertise supportsFunctionBreakpoints');
    }
    if (policy.supportsFunctionBreakpoints === true) {
      return {};
    }
    return {
      warning: `Function breakpoint support for ${String(language)} is unknown; it will be validated against the adapter's capabilities at launch`
    };
  }

  /**
   * Per-adapter function-breakpoint name advisory (issues #303/#308).
   * Swallows policy-lookup failures — a hint must never break the set path.
   * @internal ToolContext service.
   */
  public getFunctionBreakpointNameHint(sessionId: string, functionName: string): string | undefined {
    try {
      return this.sessionManager.getSessionPolicy(sessionId).functionBreakpointNameHint?.(functionName);
    } catch {
      return undefined;
    }
  }

  /**
   * Policy-certain function-breakpoint name rewrite (issue #467). Swallows
   * policy-lookup failures — normalization must never break the set path.
   * @internal ToolContext service.
   */
  public normalizeFunctionBreakpointName(
    sessionId: string,
    functionName: string
  ): { name: string; note: string } | undefined {
    try {
      return this.sessionManager.getSessionPolicy(sessionId).normalizeFunctionBreakpointName?.(functionName);
    } catch {
      return undefined;
    }
  }

  /**
   * Shared catch for the breakpoint management tools: session-lifecycle
   * failures become {success: false} results (same contract as
   * set_breakpoint's catch); everything else re-throws.
   * @internal ToolContext service.
   */
  public handleBreakpointToolError(error: unknown): ToolResult {
    if (error instanceof McpError &&
        (error.message.includes('terminated') ||
         error.message.includes('closed') ||
         (error.message.includes('not found') && error.message.includes('Session')))) {
      return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }] };
    }
    throw error;
  }

  /** @internal ToolContext service. */
  public validateBreakOnExceptions(value: string | undefined): ExceptionBreakMode | undefined {
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

  /**
   * Top-level start_debugging parameters that have no meaning inside
   * dapLaunchArgs. Deliberately excludes keys that are legitimate DAP launch
   * arguments (program, cwd, args, env, stopOnEntry, justMyCode, ...) —
   * compiled languages pass the binary as dapLaunchArgs.program.
   * breakOnExceptions is handled separately (honored as an alias).
   */
  private static readonly NEVER_VALID_DAP_LAUNCH_KEYS = [
    'dryRunSpawn',
    'sessionId',
    'scriptPath',
    'adapterLaunchConfig',
    'dapLaunchArgs'
  ] as const;

  /**
   * Intake normalization for start_debugging (issue #305). dapLaunchArgs is
   * declared additionalProperties:true, so a top-level parameter nested there
   * by mistake used to ride through the launch-config merge as a junk DAP key
   * adapters silently ignore — a silent behavioral failure. Now:
   * - dapLaunchArgs.breakOnExceptions is honored as an alias for the
   *   top-level parameter (top-level wins when both are given), stripped from
   *   the forwarded launch args, and reported via a warning.
   * - Other never-valid nested keys are stripped with a warning.
   * Fixing at intake also cures restart_debugging replay, which snapshots the
   * post-intake values into session.lastLaunch downstream.
   * @internal ToolContext service.
   */
  public normalizeStartDebuggingArgs(
    dapLaunchArgs: Partial<DebugProtocol.LaunchRequestArguments> | undefined,
    topLevelBreakOnExceptions: string | undefined
  ): {
    dapLaunchArgs: Partial<DebugProtocol.LaunchRequestArguments> | undefined;
    breakOnExceptions: string | undefined;
    warnings: string[];
  } {
    const warnings: string[] = [];
    let breakOnExceptions = topLevelBreakOnExceptions;
    if (dapLaunchArgs === null || typeof dapLaunchArgs !== 'object' || Array.isArray(dapLaunchArgs)) {
      return { dapLaunchArgs, breakOnExceptions, warnings };
    }
    const cleaned: Record<string, unknown> = { ...dapLaunchArgs };
    if ('breakOnExceptions' in cleaned) {
      const nested = cleaned.breakOnExceptions;
      delete cleaned.breakOnExceptions;
      if (topLevelBreakOnExceptions === undefined) {
        breakOnExceptions = nested as string;
        warnings.push(
          `breakOnExceptions is a top-level start_debugging parameter, not a dapLaunchArgs key — honored as '${String(nested)}' this time; pass it at the top level`
        );
      } else {
        warnings.push(
          `breakOnExceptions was passed both top-level ('${topLevelBreakOnExceptions}') and inside dapLaunchArgs ('${String(nested)}'); the top-level value wins and the nested key was ignored`
        );
      }
    }
    for (const key of DebugMcpServer.NEVER_VALID_DAP_LAUNCH_KEYS) {
      if (key in cleaned) {
        delete cleaned[key];
        warnings.push(
          `'${key}' is a top-level start_debugging parameter and has no meaning inside dapLaunchArgs — ignored; pass it at the top level`
        );
      }
    }
    return {
      dapLaunchArgs: cleaned as Partial<DebugProtocol.LaunchRequestArguments>,
      breakOnExceptions,
      warnings
    };
  }

  // Core business logic methods — delegated to by the MCP tool dispatch handler
  // (CallToolRequestSchema); public so they are also accessible for testing/external use
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
  ): Promise<{ path: string; contentAddressable: boolean; nonAddressableReason?: 'non-file-identifier' | 'attach' }> {
    // Check if the adapter handles non-file source identifiers (e.g. Java FQCNs)
    const policy = this.sessionManager.getSessionPolicy(sessionId);
    if (policy.isNonFileSourceIdentifier?.(file)) {
      this.logger.info(`[DebugMcpServer.resolveBreakpointFile] Non-file source identifier detected: ${file}`);
      return { path: file, contentAddressable: false, nonAddressableReason: 'non-file-identifier' };
    }

    // Attach sessions may debug a target on a remote filesystem (container,
    // pod, another machine); host-side existence checks don't apply. Pass the
    // path through as-is — the debugger knows its own filesystem best.
    if (this.sessionManager.getSession(sessionId)?.attachMode) {
      this.logger.info(`[DebugMcpServer.resolveBreakpointFile] Attach session: skipping host file check for ${file}`);
      return { path: file, contentAddressable: false, nonAddressableReason: 'attach' };
    }

    const fileCheck = await this.fileChecker.checkExists(file);
    if (options?.requireExists && !fileCheck.exists) {
      throw this.fileNotFoundError('Breakpoint file', file, fileCheck);
    }

    this.logger.info(`[DebugMcpServer.resolveBreakpointFile] Resolved ${file} -> ${fileCheck.effectivePath} (exists: ${fileCheck.exists})`);
    return { path: fileCheck.effectivePath, contentAddressable: true };
  }

  public async setFunctionBreakpoint(
    sessionId: string,
    functionName: string,
    condition?: string
  ): Promise<{ breakpoint: FunctionBreakpoint; warning?: string }> {
    this.validateSession(sessionId);
    return this.sessionManager.setFunctionBreakpoint(sessionId, { functionName, condition });
  }

  public async setBreakpoint(req: SetBreakpointRequest): Promise<{ breakpoint: Breakpoint; warning?: string }> {
    this.validateSession(req.sessionId);

    // Addressing-parameter combinations (issue #271)
    if (req.statement !== undefined && req.line !== undefined) {
      throw new McpError(
        McpErrorCode.InvalidParams,
        'Provide line or statement, not both. Use nearLine (with statement) to disambiguate repeated statements.'
      );
    }
    if (req.statement !== undefined && req.expectedContent !== undefined) {
      // A matching expectedContent alongside a statement anchor is redundant
      // but harmless — agents combine them constantly (issue #280), so only
      // genuinely contradictory intent is an error. "Matching" mirrors the
      // relaxed assertLineContent predicate (issue #379): either value may be
      // the more complete form of the other, and stale trailing comments on
      // either side are ignored.
      const stmt = req.statement.trim();
      const exp = req.expectedContent.trim();
      const strippedStmt = stripTrailingComment(req.statement).trim();
      const strippedExp = stripTrailingComment(req.expectedContent).trim();
      const compatible =
        stmt.includes(exp) ||
        exp.includes(stmt) ||
        (strippedStmt !== '' &&
          strippedExp !== '' &&
          (strippedStmt.includes(strippedExp) || strippedExp.includes(strippedStmt)));
      if (!compatible) {
        throw new McpError(
          McpErrorCode.InvalidParams,
          'statement and expectedContent disagree; a statement anchor is already content-addressed. Provide one or the other (a matching expectedContent is accepted as redundant).'
        );
      }
    }
    if (req.nearLine !== undefined && req.statement === undefined) {
      throw new McpError(
        McpErrorCode.InvalidParams,
        'nearLine only disambiguates a statement anchor — provide it together with statement.'
      );
    }
    if (req.line === undefined && req.statement === undefined) {
      throw new McpError(McpErrorCode.InvalidParams, 'Missing required parameters: provide line or statement');
    }

    const resolved = await this.resolveBreakpointFile(req.sessionId, req.file, { requireExists: true });
    const mode = getBpAddressingMode(this.environment);

    const readLinesForContentAddressing = async (feature: string): Promise<string[]> => {
      if (!resolved.contentAddressable) {
        // Two distinct causes, two honest reasons (issue #497): an attach
        // session's file may be perfectly readable here — the rule is that
        // the debuggee's loaded source is the authority, not the host's copy.
        const reason =
          resolved.nonAddressableReason === 'attach'
            ? `${feature} is not supported for attach sessions — the debuggee's loaded source may not match the file on the mcp-debugger host. Use line addressing instead.`
            : `${feature} requires a source file readable by the mcp-debugger server; "${req.file}" is a class name or remote path. Use line addressing instead.`;
        throw new McpError(McpErrorCode.InvalidParams, reason);
      }
      const lines = await this.lineReader.getFileLines(resolved.path);
      if (!lines) {
        throw new McpError(
          McpErrorCode.InvalidParams,
          `Breakpoint not set: could not read ${resolved.path} to verify content (binary, too large, or unreadable). Use plain line addressing to skip verification.`
        );
      }
      return lines;
    };

    let line: number;
    let anchor: { statement: string; nearLine?: number } | undefined;
    // Relaxed content matches succeed but must say so (issue #379): a
    // substring or comment-stripped pass is indistinguishable from an exact
    // one in the stored breakpoint, so the warning is the agent's only
    // signal that its stated content only weakly pinned the line.
    let addressingWarning: string | undefined;
    if (req.statement !== undefined) {
      const lines = await readLinesForContentAddressing('statement addressing');
      const resolution = resolveStatement(lines, req.statement, resolved.path, req.nearLine);
      if (!resolution.ok) {
        throw new McpError(McpErrorCode.InvalidParams, resolution.message);
      }
      line = resolution.line;
      if (resolution.candidates !== undefined) {
        addressingWarning =
          `statement matches ${resolution.candidates.length} lines (${resolution.candidates.join(', ')}); ` +
          `nearLine ${req.nearLine} selected line ${line} — verify against the echoed content.`;
      }
      anchor = {
        statement: req.statement.trim(),
        ...(req.nearLine !== undefined ? { nearLine: req.nearLine } : {})
      };
    } else {
      line = req.line!;
      if (req.expectedContent !== undefined) {
        const lines = await readLinesForContentAddressing('expectedContent');
        const check = assertLineContent(lines, line, req.expectedContent, resolved.path, {
          statementHint: supportsStatementAnchors(mode)
        });
        if (!check.ok) {
          throw new McpError(McpErrorCode.InvalidParams, check.message);
        }
        if (check.matchQuality === 'substring') {
          addressingWarning =
            `expectedContent matched line ${line} as a substring of "${check.actual}", ` +
            `not the whole line — confirm this is the intended line.`;
        } else if (check.matchQuality === 'comment-stripped') {
          addressingWarning =
            `expectedContent matched line ${line} only after ignoring text past a '//' or '#' comment marker, ` +
            `even inside strings (actual: "${check.actual}") — confirm this is the intended line.`;
        }
      }
    }

    const result = await this.sessionManager.setBreakpoint(req.sessionId, {
      file: resolved.path,
      line,
      condition: req.condition,
      suspendPolicy: req.suspendPolicy,
      logMessage: req.logMessage,
      // Loud snapping bookkeeping is absent in line mode so the control arm's
      // breakpoint records stay byte-identical to pre-#271 behavior.
      ...(supportsLoudSnapping(mode) ? { requestedLine: line } : {}),
      ...(anchor !== undefined ? { anchor } : {})
    });
    if (addressingWarning === undefined) {
      return result;
    }
    return {
      ...result,
      warning: result.warning ? `${result.warning}; ${addressingWarning}` : addressingWarning
    };
  }

  // The breakpoint management tools below deliberately skip validateSession's
  // TERMINATED rejection (cf. handleGetOutput): a terminated-but-unclosed
  // session keeps its breakpoints so they can be listed and adjusted between
  // launches. Session existence is still enforced by the SessionManager.
  public listBreakpoints(sessionId: string, file?: string): Breakpoint[] {
    return this.sessionManager.listBreakpoints(sessionId, file);
  }

  public async removeBreakpoint(sessionId: string, breakpointId: string): Promise<{ removed?: Breakpoint | FunctionBreakpoint; warning?: string }> {
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

  public async getVariables(sessionId: string, variablesReference: number, names?: string[]): Promise<Variable[]> {
    this.validateSession(sessionId);
    return this.sessionManager.getVariables(sessionId, variablesReference, names);
  }

  public async getVariablesDetailed(sessionId: string, variablesReference: number, names?: string[]): Promise<{
    variables: Variable[];
    truncation?: VariableTruncationSummary;
  }> {
    this.validateSession(sessionId);
    return this.sessionManager.getVariablesDetailed(sessionId, variablesReference, names);
  }

  public async getStackTrace(
    sessionId: string,
    includeInternals: boolean = false,
    threadId?: number
  ): Promise<StackTraceResult> {
    this.validateSession(sessionId);
    const session = this.sessionManager.getSession(sessionId);
    if (!session || !session.proxyManager) {
        throw new ProxyNotRunningError(sessionId || 'unknown', 'get stack trace');
    }
    // An explicit threadId (issue #465) targets that thread AND adopts it as
    // current when it reports frames, so follow-up scopes/locals/evaluate
    // anchor to it — this is the escape hatch when the session anchored to a
    // frameless thread.
    if (typeof threadId === 'number') {
      // No ensureStackReady here: the caller asked about THIS thread, so an
      // empty answer for it is the honest one — the session layer may look
      // at sibling threads to *suggest* an alternative in `note` (issue
      // #553), but never silently re-anchors to one.
      const result = await this.sessionManager.getStackTraceDetailed(
        sessionId, threadId, includeInternals
      );
      if (result.frames.length > 0) {
        session.proxyManager.setCurrentThreadId(threadId);
      }
      return result;
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
    // ensureStackReady: the thread above was resolved implicitly (the MCP tool
    // has no threadId argument), so a paused session answering with zero
    // frames gets the bounded readiness retry + thread scan instead of a
    // confusing empty success.
    return this.sessionManager.getStackTraceDetailed(sessionId, currentThreadId, includeInternals, { ensureStackReady: true });
  }

  public async getScopes(sessionId: string, frameId: number): Promise<DebugProtocol.Scope[]> {
    this.validateSession(sessionId);
    return this.sessionManager.getScopes(sessionId, frameId);
  }

  public async getLocalVariables(sessionId: string, includeSpecial: boolean = false, names?: string[]): Promise<{
    variables: Variable[];
    frame: { name: string; file: string; line: number } | null;
    scopeName: string | null;
    anchorNote?: string;
    truncation?: VariableTruncationSummary;
  }> {
    this.validateSession(sessionId);
    return this.sessionManager.getLocalVariables(sessionId, includeSpecial, names);
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
    this.disposeLogger = dependencies.disposeLogger;
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
        // Redaction state rides along (issue #237) so agents aren't surprised
        // by <redacted:...> placeholders.
        instructions: buildServerInstructions(getBpAddressingMode(this.environment), {
          redactionEnabled: isRedactionEnabled(this.environment),
          variableAccessMode: getVariableAccessMode(this.environment)
        })
      }
    );

    const sessionManagerConfig: SessionManagerConfig = {
      logDirBase: containerConfig.sessionLogDirBase
    };
    
    this.sessionManager = new SessionManager(sessionManagerConfig, dependencies);
    this.outputResources = new OutputResourceNotifier(this.server, this.logger);

    this.registerTools();
    registerResourceHandlers(this.server, this.sessionManager, this.outputResources);
    registerPromptHandlers(this.server, this.environment);
    this.sessionManager.on('output-captured', this.outputResources.handleOutputCaptured);
    this.server.onerror = (error) => {
      this.logger.error('Server error', { error });
    };
  }

  /**
   * Get session name for logging
   * @internal ToolContext service.
   */
  public getSessionName(sessionId: string): string {
    try {
      const session = this.sessionManager.getSession(sessionId);
      return session?.name || 'Unknown Session';
    } catch {
      return 'Unknown Session';
    }
  }

  /** @internal ToolContext service. */
  public fileNotFoundError(label: string, originalPath: string, fileCheck: FileExistenceResult): McpError {
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
      
      return { tools: buildToolDefinitions({ supportedLanguages, environment: this.environment }) };
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
          request: sanitizeRequest(args as Record<string, unknown>),
          timestamp: Date.now()
        });

        try {
          let result: ServerResult;
          
          switch (toolName) {
            case 'create_debug_session': {
              result = await createDebugSessionTool(this, args, toolName);
              break;
            }
            case 'list_debug_sessions': {
              result = await listDebugSessionsTool(this, args, toolName);
              break;
            }
            case 'set_breakpoint': {
              result = await setBreakpointTool(this, args, toolName);
              break;
            }
            case 'list_breakpoints': {
              result = await listBreakpointsTool(this, args, toolName);
              break;
            }
            case 'remove_breakpoint': {
              result = await removeBreakpointTool(this, args, toolName);
              break;
            }
            case 'clear_breakpoints': {
              result = await clearBreakpointsTool(this, args, toolName);
              break;
            }
            case 'start_debugging': {
              result = await startDebuggingTool(this, args, toolName);
              break;
            }
            case 'restart_debugging': {
              result = await restartDebuggingTool(this, args, toolName);
              break;
            }
            case 'attach_to_process': {
              result = await attachToProcessTool(this, args, toolName);
              break;
            }
            case 'detach_from_process': {
              result = await detachFromProcessTool(this, args, toolName);
              break;
            }
            case 'expose_session': {
              if (!args.sessionId) {
                throw new McpError(McpErrorCode.InvalidParams, 'Missing required sessionId');
              }
              result = await this.handleExposeSession(args.sessionId);
              break;
            }
            case 'unexpose_session': {
              if (!args.sessionId) {
                throw new McpError(McpErrorCode.InvalidParams, 'Missing required sessionId');
              }
              result = await this.handleUnexposeSession(args.sessionId);
              break;
            }
            case 'close_debug_session': {
              result = await closeDebugSessionTool(this, args, toolName);
              break;
            }
            case 'step_over':
            case 'step_into':
            case 'step_out': {
              result = await stepTool(this, args, toolName);
              break;
            }
            case 'continue_execution': {
              result = await continueExecutionTool(this, args, toolName);
              break;
            }
            case 'pause_execution': {
              result = await pauseExecutionTool(this, args, toolName);
              break;
            }
            case 'list_threads': {
              result = await listThreadsTool(this, args, toolName);
              break;
            }
            case 'get_variables': {
              if (!args.sessionId || args.scope === undefined) {
                throw new McpError(McpErrorCode.InvalidParams, 'Missing required parameters');
              }
              this.enforceExplicitNames('get_variables', args.names);

              try {
                const { variables, truncation } = await this.getVariablesDetailed(args.sessionId, args.scope, args.names);

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
                
                const redaction = this.redactionSummary(variables);
                const notFound = args.names
                  ? args.names.filter(name => !variables.some(v => v.name === name))
                  : undefined;
                const truncationInfo = truncation
                  ? { ...truncation, notice: buildTruncationNotice(truncation, variables) }
                  : undefined;
                result = { content: [{ type: 'text', text: JSON.stringify({ success: true, variables, count: variables.length, variablesReference: args.scope, ...(notFound !== undefined ? { notFound } : {}), ...(redaction ? { redaction } : {}), ...(truncationInfo ? { truncation: truncationInfo } : {}) }) }] };
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
                const stackTrace = await this.getStackTrace(args.sessionId, includeInternals, args.threadId);
                const lastStop = this.sessionManager.getSession(args.sessionId)?.lastStop;
                const payload: Record<string, unknown> = {
                  success: true,
                  stackFrames: stackTrace.frames,
                  count: stackTrace.frames.length,
                  ...(typeof stackTrace.threadId === 'number' ? { threadId: stackTrace.threadId } : {}),
                  includeInternals,
                  stopReason: lastStop?.reason,
                  lastStop
                };
                // Anything the result needs explaining (not paused, stack came
                // from a different thread, all threads frameless) plus the
                // issue #346 hidden-frames disclosure share the note field.
                const notes: string[] = [];
                if (stackTrace.note) {
                  notes.push(stackTrace.note);
                }
                if (stackTrace.hiddenFrameCount > 0) {
                  payload.hiddenFrames = stackTrace.hiddenFrameCount;
                  notes.push(stackTrace.allFramesInternal
                    ? `All ${stackTrace.totalFrameCount} frames are internal/runtime frames; showing the top internal frame so scopes and evaluate still work. Pass includeInternals: true to see the full stack.`
                    : `${stackTrace.hiddenFrameCount} internal frame(s) hidden — pass includeInternals: true to see them.`);
                }
                if (notes.length > 0) {
                  payload.note = notes.join(' ');
                }
                result = { content: [{ type: 'text', text: JSON.stringify(payload) }] };
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
              result = await this.handleGetLocalVariables(args as { sessionId: string; includeSpecial?: boolean; names?: string[] });
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
              result = await redefineClassesTool(this, args, toolName);
              break;
            }
            default:
              throw new McpError(McpErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
          }
          
          // Log tool response; success mirrors the payload's own success flag (issue #397)
          this.logger.info('tool:response', {
            tool: toolName,
            sessionId: args.sessionId,
            sessionName: args.sessionId ? this.getSessionName(args.sessionId) : undefined,
            success: extractPayloadSuccess(result),
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

  /** @internal test seam; removed in PR 6 */
  private async handleListDebugSessions(): Promise<ToolResult> {
    return handleListDebugSessions(this);
  }

  /**
   * Least-privilege enforcement (issue #237): in explicit mode, bulk scope
   * dumps are disabled — the tools require a non-empty names filter, and the
   * error teaches the correct call shape.
   * @internal ToolContext service.
   */
  public enforceExplicitNames(toolName: string, names: string[] | undefined): void {
    if (!requiresExplicitNames(getVariableAccessMode(this.environment))) {
      return;
    }
    if (!names || names.length === 0) {
      throw new McpError(
        McpErrorCode.InvalidParams,
        `${toolName} requires "names" in least-privilege mode (DEBUG_MCP_VARIABLE_ACCESS=explicit): ` +
        `pass the exact variable names you need, e.g. names:["user","order_total"]. ` +
        `Unfiltered scope dumps are disabled by this server's configuration.`
      );
    }
  }

  /**
   * Top-level `redaction` notice object for tool results (issue #237):
   * present when any returned item carries the session layer's `redacted`
   * flag, so the agent learns why values changed and how to opt out.
   * @internal ToolContext service.
   */
  public redactionSummary(items: Array<{ redacted?: boolean }>): { masked: number; notice: string } | undefined {
    const masked = items.filter(item => item.redacted).length;
    return masked > 0 ? { masked, notice: REDACTION_NOTICE } : undefined;
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
    const redaction = this.redactionSummary(read.entries);
    return { content: [{ type: 'text', text: JSON.stringify({
      success: true,
      sessionId: args.sessionId,
      entries: read.entries,
      nextSince: read.nextSince,
      hasMore: read.hasMore,
      dropped: read.dropped,
      ...(redaction ? { redaction } : {})
    }) }] };
  }

  /** @internal test seam; removed in PR 6 */
  private async handlePause(args: { sessionId: string; threadId?: number }): Promise<ToolResult> {
    return handlePause(this, args);
  }

  private async handleExposeSession(sessionId: string): Promise<ServerResult> {
    try {
      this.validateSession(sessionId);
      const result = await this.sessionManager.exposeSession(sessionId);
      if (!result.success) {
        return { content: [{ type: 'text', text: JSON.stringify({
          success: false,
          state: result.state,
          error: result.error
        }) }] };
      }
      let message =
        `Session exposed for IDE attach at ${result.host}:${result.port}. ` +
        `VS Code: add a launch.json config {"name": "Mirror: agent debug session", ` +
        `"type": "<your language's debug type, e.g. python>", "request": "attach", ` +
        `"debugServer": ${result.port}, "mirrorToken": "${result.token}"} and start it. ` +
        `The mirror is inspect-only; execution control stays with this session. ` +
        `Full guidance: docs/tool-reference.md#expose_session.`;
      if (isContainerMode(this.environment)) {
        message +=
          ' Note: this server runs inside a container — the mirror listens on the ' +
          "container's loopback and is not reachable from your host IDE without extra " +
          'networking (e.g. docker run --network host on Linux, or a socat/ssh forward ' +
          'into the container).';
      }
      return { content: [{ type: 'text', text: JSON.stringify({
        success: true,
        state: result.state,
        host: result.host,
        port: result.port,
        token: result.token,
        message
      }) }] };
    } catch (error) {
      this.logger.error('Failed to expose session', { error });
      if (error instanceof SessionTerminatedError ||
          error instanceof SessionNotFoundError ||
          error instanceof ProxyNotRunningError) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }] };
      }
      if (error instanceof McpError) throw error;
      throw new McpError(McpErrorCode.InternalError, `Failed to expose session: ${(error as Error).message}`);
    }
  }

  private async handleUnexposeSession(sessionId: string): Promise<ServerResult> {
    try {
      this.validateSession(sessionId);
      const result = await this.sessionManager.unexposeSession(sessionId);
      const message = !result.success
        ? undefined
        : result.wasExposed
          ? `Mirror endpoint closed${typeof result.closedClients === 'number' ? ` (${result.closedClients} client${result.closedClients === 1 ? '' : 's'} disconnected)` : ''}`
          : 'Session was not exposed — nothing to close';
      return { content: [{ type: 'text', text: JSON.stringify({
        success: result.success,
        state: result.state,
        ...(result.wasExposed !== undefined ? { wasExposed: result.wasExposed } : {}),
        ...(message ? { message } : {}),
        ...(result.error ? { error: result.error } : {})
      }) }] };
    } catch (error) {
      this.logger.error('Failed to unexpose session', { error });
      if (error instanceof SessionTerminatedError ||
          error instanceof SessionNotFoundError ||
          error instanceof ProxyNotRunningError) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }] };
      }
      if (error instanceof McpError) throw error;
      throw new McpError(McpErrorCode.InternalError, `Failed to unexpose session: ${(error as Error).message}`);
    }
  }

  /** @internal test seam; removed in PR 6 */
  private async handleListThreads(args: { sessionId: string }): Promise<ToolResult> {
    return handleListThreads(this, args);
  }

  private async handleEvaluateExpression(args: { sessionId: string, expression: string, frameId?: number, timeout?: number }): Promise<ServerResult> {
    try {
      // Validate session
      this.validateSession(args.sessionId);

      // Check expression length (sanity check)
      if (args.expression.length > 10240) {
        throw new McpError(McpErrorCode.InvalidParams, 'Expression too long (max 10KB)');
      }

      // Call SessionManager's evaluateExpression method (no context is passed here;
      // the adapter policy chooses the DAP evaluate context)
      const result = await this.sessionManager.evaluateExpression(
        args.sessionId,
        args.expression,
        args.frameId,
        // Context is chosen by the adapter policy inside SessionManager
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

  private async handleGetLocalVariables(args: { sessionId: string; includeSpecial?: boolean; names?: string[] }): Promise<ServerResult> {
    this.enforceExplicitNames('get_local_variables', args.names);
    try {
      // Validate session
      this.validateSession(args.sessionId);

      // Get local variables using the new convenience method
      const result = await this.getLocalVariables(
        args.sessionId,
        args.includeSpecial ?? false,
        args.names
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

      const redaction = this.redactionSummary(result.variables);
      if (redaction) {
        response.redaction = redaction;
      }

      // Size-guard advisory (issues #356/#359): say explicitly that data was
      // cut and how to fetch the rest, instead of silently dropping it.
      if (result.truncation) {
        response.truncation = {
          ...result.truncation,
          notice: buildTruncationNotice(result.truncation, result.variables)
        };
      }

      if (args.names) {
        response.notFound = args.names.filter(
          name => !result.variables.some(v => v.name === name)
        );
      }

      // Include frame information if available
      if (result.frame) {
        response.frame = result.frame;
      }

      // Include scope name if available
      if (result.scopeName) {
        response.scopeName = result.scopeName;
      }

      // The tool walked down past an empty runtime/stdlib top frame — say so,
      // since `frame` no longer names the top of the stack (issue #468).
      if (result.anchorNote) {
        response.note = result.anchorNote;
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
          // Distinguish "not paused" from "paused but the anchored thread has
          // no frames" — the latter used to claim the debugger may not be
          // paused while list_debug_sessions said paused (issue #465).
          const sessionState = this.sessionManager.getSession(args.sessionId)?.state;
          response.message = sessionState === SessionState.PAUSED
            ? 'The session is paused, but the anchored thread reported no stack frames. ' +
              'Try get_stack_trace with a threadId from list_threads, or continue_execution ' +
              'followed by pause_execution to re-anchor on a reportable thread.'
            : 'No stack frames available. The debugger may not be paused.';
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
      let baseEntries: Array<{ language: string; package: string; installed: boolean; description?: string; attach: 'none' | 'direct-connect' | 'spawn' }> =
        installed.map(lang => ({
          language: lang,
          package: `@debugmcp/adapter-${lang}`,
          installed: true,
          attach: 'none' as const
        }));

      // listAvailableAdapters/getFactory are on IAdapterRegistry (issue #435
      // part 4); the runtime guards stay for partial registry doubles.
      if (adapterRegistry && typeof adapterRegistry.listAvailableAdapters === 'function') {
        try {
          const meta = await adapterRegistry.listAvailableAdapters();
          baseEntries = meta.map(m => ({
            language: m.name,
            package: m.packageName,
            installed: m.installed,
            description: m.description,
            attach: m.attach ?? 'none'
          }));
        } catch (e) {
          this.logger.warn('Failed to query detailed adapter metadata; returning installed list only', { error: (e as Error)?.message });
        }
      }

      // Shared per-entry probe (issue #435): doctor consumes the same
      // function, so the two views cannot drift apart. Probes run in
      // parallel — on a cold cache each may import an adapter package and
      // spawn a toolchain check, and this call should pay the max, not the
      // sum (the doctor path already runs them concurrently).
      const disabledSet = getDisabledLanguages();
      const available: AvailableLanguage[] = await Promise.all(
        baseEntries.map(async (entry) => {
          const probe = await probeLanguageEntry(
            {
              language: entry.language,
              packageName: entry.package,
              installed: entry.installed,
              attach: entry.attach
            },
            {
              registry: adapterRegistry,
              disabledSet,
              runValidate: (language, validate) => this.validationCache.get(language, validate),
              logger: this.logger
            }
          );
          return {
            language: entry.language,
            package: entry.package,
            installed: entry.installed,
            description: entry.description,
            modes: probe.modes
          };
        })
      );

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
    this.outputResources.dispose();
    this.sessionManager.removeListener('output-captured', this.outputResources.handleOutputCaptured);
    this.logger.info('Debug MCP Server stopped');
    // Last: detach this server's logger from the shared file transport so
    // per-session servers in HTTP mode don't accumulate on it (issue #404).
    // After this line the logger no longer writes to the shared file.
    this.disposeLogger?.();
  }

  /**
   * Get adapter registry from session manager
   */
  public getAdapterRegistry() {
    return this.sessionManager.adapterRegistry;
  }
}

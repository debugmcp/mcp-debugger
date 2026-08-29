
/**
 * Debug MCP Server - Main Server Implementation
 *
 * Tool schemas, argument coercion, dispatch and the per-tool handlers live in
 * the sibling directory src/server/ (NodeNext resolves ./server.js and
 * ./server/x.js without conflict).
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ErrorCode as McpErrorCode,
  McpError,
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
import { VariableTruncationSummary } from './session/variable-caps.js';
import { createProductionDependencies } from './container/dependencies.js';
import { ContainerConfig } from './container/types.js';
import {
    DebugSessionInfo,
    Variable,
    DebugLanguage,
    Breakpoint,
    FunctionBreakpoint,
    SessionLifecycleState,
    IEnvironment,
    ILogger,
    ExceptionBreakMode,
    REDACTION_NOTICE
} from '@debugmcp/shared';
import { DebugProtocol } from '@vscode/debugprotocol';
import path from 'path';
import { SimpleFileChecker, createSimpleFileChecker, FileExistenceResult } from './utils/simple-file-checker.js';
import { LineReader, createLineReader } from './utils/line-reader.js';
import { isLanguageDisabled } from './utils/language-config.js';
import { ValidationResultCache } from './utils/language-availability.js';
import { isContainerMode, getWorkspaceRoot } from './utils/container-path-utils.js';
import {
  getBpAddressingMode,
  supportsStatementAnchors,
  supportsLoudSnapping
} from './utils/bp-addressing.js';
import { isRedactionEnabled } from './utils/redaction-mode.js';
import { getVariableAccessMode, requiresExplicitNames } from './utils/variable-access.js';
import { assertLineContent, resolveStatement, stripTrailingComment } from './utils/breakpoint-resolver.js';
import { OutputResourceNotifier, registerResourceHandlers } from './server/output-resources.js';
import { registerPromptHandlers } from './server/prompts.js';
import { discoverSupportedLanguages, buildLanguageMetadata, LanguageMetadata } from './server/language-discovery.js';
import type { ToolContext, SetBreakpointRequest } from './server/tool-context.js';
import type { ToolResult } from './server/tool-result.js';
import { handleListDebugSessions } from './server/handlers/session-tools.js';
import { handlePause, handleListThreads } from './server/handlers/execution-tools.js';
import {
  handleEvaluateExpression,
  handleGetSourceContext,
  handleGetLocalVariables
} from './server/handlers/inspection-tools.js';
import { handleListSupportedLanguages } from './server/handlers/language-tools.js';
import { registerToolHandlers } from './server/tool-dispatch.js';

export { coerceToolArguments } from './server/tool-arguments.js';
export type { SetBreakpointRequest };

/**
 * Configuration options for the Debug MCP Server
 */
export interface DebugMcpServerOptions {
  logLevel?: string;
  logFile?: string;
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

    registerToolHandlers(this.server, this);
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

  /** @internal test seam; removed in PR 6 */
  private async handlePause(args: { sessionId: string; threadId?: number }): Promise<ToolResult> {
    return handlePause(this, args);
  }

  /** @internal test seam; removed in PR 6 */
  private async handleListThreads(args: { sessionId: string }): Promise<ToolResult> {
    return handleListThreads(this, args);
  }

  /** @internal test seam; removed in PR 6 */
  private async handleEvaluateExpression(args: { sessionId: string, expression: string, frameId?: number, timeout?: number }): Promise<ToolResult> {
    return handleEvaluateExpression(this, args);
  }

  /** @internal test seam; removed in PR 6 */
  private async handleGetSourceContext(args: { sessionId: string, file: string, line: number, linesContext?: number }): Promise<ToolResult> {
    return handleGetSourceContext(this, args);
  }

  /** @internal test seam; removed in PR 6 */
  private async handleGetLocalVariables(args: { sessionId: string; includeSpecial?: boolean; names?: string[] }): Promise<ToolResult> {
    return handleGetLocalVariables(this, args);
  }

  /** @internal test seam; removed in PR 6 */
  private async handleListSupportedLanguages(): Promise<ToolResult> {
    return handleListSupportedLanguages(this);
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

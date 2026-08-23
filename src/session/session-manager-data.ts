/**
 * Data retrieval operations for session management including variables,
 * stack traces, and scopes.
 */
import {
  Variable,
  StackFrame,
  SessionState,
  AdapterPolicy,
  getPolicyForLanguage,
  DebugLanguage,
  Breakpoint,
  FunctionBreakpoint,
  redactVariableValue
} from '@debugmcp/shared';
import { SessionManagerCore } from './session-manager-core.js';
import { IProxyManager } from '../proxy/proxy-manager.js';
import { DebugProtocol } from '@vscode/debugprotocol';
import {
  applyVariableCaps,
  mergeTruncationSummaries,
  maxVariablesPerCall,
  VariableTruncationSummary
} from './variable-caps.js';

/**
 * Stack trace frames plus filtering metadata (issue #346): how many frames the
 * adapter reported, how many the language policy hid, and whether the
 * kept-first-frame fallback fired because every frame was internal.
 */
export interface StackTraceResult {
  frames: StackFrame[];
  totalFrameCount: number;
  hiddenFrameCount: number;
  allFramesInternal: boolean;
  /**
   * Present when the result needs explaining: the session was not paused, no
   * stopped thread was known, the stack came from a different thread than the
   * tracked one, or every thread stayed frameless. Surfaced to the agent in
   * the get_stack_trace tool payload.
   */
  note?: string;
}

function emptyStackTraceResult(note?: string): StackTraceResult {
  return { frames: [], totalFrameCount: 0, hiddenFrameCount: 0, allFramesInternal: false, ...(note ? { note } : {}) };
}

/**
 * Data retrieval functionality for session management
 */
export abstract class SessionManagerData extends SessionManagerCore {
  /**
   * How long the agent-facing stack-trace path keeps polling a PAUSED session
   * whose adapter answers stackTrace with success + zero frames, before
   * returning the honest empty result. Some adapters report the stop before
   * the stack is materialized (netcoredbg after the post-attach pause — the
   * milder sibling of issue #353's 0x80131302), so success-with-0-frames
   * while paused is nearly always a transient race, not truth. The poll exits
   * on the first non-empty answer, so the window costs nothing when the
   * adapter is ready. Follows the attachVerifyTimeoutMs pattern.
   */
  protected pausedStackReadyTimeoutMs = 3000;
  protected pausedStackReadyIntervalMs = 250;

  /**
   * Selects the appropriate adapter policy based on language
   */
  protected selectPolicy(language: string | DebugLanguage): AdapterPolicy {
    return getPolicyForLanguage(language);
  }

  /**
   * List the session's breakpoints, optionally filtered to one file (exact
   * path match, same semantics as the per-file DAP re-send). Works in every
   * lifecycle state — including after the debuggee exits — since breakpoints
   * are session state, not debuggee state.
   */
  listBreakpoints(sessionId: string, file?: string): Breakpoint[] {
    const session = this._getSessionById(sessionId);
    const breakpoints = Array.from(session.breakpoints.values())
      .filter(bp => file === undefined || bp.file === file);
    breakpoints.sort((a, b) =>
      a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)
    );
    return breakpoints;
  }

  /**
   * List the session's function breakpoints (issue #271 phase 3). Not
   * file-scoped — a file filter on list_breakpoints deliberately excludes
   * these; they are session-global.
   */
  listFunctionBreakpoints(sessionId: string): FunctionBreakpoint[] {
    const session = this._getSessionById(sessionId);
    return Array.from(session.functionBreakpoints?.values() ?? [])
      .sort((a, b) => a.functionName.localeCompare(b.functionName));
  }

  /**
   * @param names Optional exact-match, case-sensitive filter (issue #237,
   * least-privilege mode): only variables with these names are returned,
   * redacted, or logged.
   */
  async getVariables(sessionId: string, variablesReference: number, names?: string[]): Promise<Variable[]> {
    return (await this.getVariablesDetailed(sessionId, variablesReference, names)).variables;
  }

  /**
   * getVariables plus size-guard metadata (issues #356/#359): the returned
   * list is capped (variable count, per-value length, total size) and
   * `truncation` reports what was cut, so the tool layer can annotate the
   * response instead of blowing a client's per-result size limit.
   */
  async getVariablesDetailed(sessionId: string, variablesReference: number, names?: string[]): Promise<{
    variables: Variable[];
    truncation?: VariableTruncationSummary;
  }> {
    const session = this._getSessionById(sessionId);
    this.logger.info(`[SM getVariables ${sessionId}] Entered. variablesReference: ${variablesReference}, Current state: ${session.state}`);
    
    if (!session.proxyManager || !session.proxyManager.isRunning()) {
      this.logger.warn(`[SM getVariables ${sessionId}] No active proxy.`);
      return { variables: [] };
    }
    if (session.state !== SessionState.PAUSED) {
      this.logger.warn(`[SM getVariables ${sessionId}] Session not paused. State: ${session.state}.`);
      return { variables: [] };
    }
    
    try {
      this.logger.info(`[SM getVariables ${sessionId}] Sending DAP 'variables' for variablesReference ${variablesReference}.`);
      const response = await session.proxyManager.sendDapRequest<DebugProtocol.VariablesResponse>('variables', { variablesReference });
      // Count only — the raw body carries unredacted values (issue #237); the
      // parsed (post-redaction) values are logged below.
      this.logger.info(`[SM getVariables ${sessionId}] DAP 'variables' response received. ${response?.body?.variables?.length ?? 0} variable(s).`);

      if (response && response.body && response.body.variables) {
        let vars = response.body.variables.map((v: DebugProtocol.Variable) => ({
            name: v.name, value: v.value, type: v.type || "<unknown_type>",
            variablesReference: v.variablesReference,
            expandable: v.variablesReference > 0
        }));
        // Names filter before redaction/logging: unrequested values never
        // leave the raw response object.
        if (names) {
          vars = vars.filter(v => names.includes(v.name));
        }
        // Redaction hook (issue #237): this is the single DAP→Variable
        // mapping point, so get_variables, get_local_variables and child
        // expansion are all covered here, upstream of every log line.
        if (this.redactionEnabled()) {
          vars = vars.map(v => {
            const result = redactVariableValue(v.name, v.value);
            return result.redacted ? { ...v, value: result.value, redacted: true } : v;
          });
        }
        // Size guards LAST (issues #356/#359): after the names filter (an
        // explicit request is never starved by unrelated variables) and
        // after redaction (a cut value can't leak a secret prefix).
        const capped = applyVariableCaps(vars);
        if (capped.truncation) {
          this.logger.info(
            `[SM getVariables ${sessionId}] Truncated response: ` +
              `${capped.truncation.omittedCount} omitted, ${capped.truncation.valueTruncatedCount} values cut.`
          );
        }
        this.logger.info(`[SM getVariables ${sessionId}] Parsed variables:`, capped.variables.map(v => ({name: v.name, value: v.value, type: v.type})));
        return capped;
      }
      this.logger.warn(`[SM getVariables ${sessionId}] No variables in response body for reference ${variablesReference}. Response:`, response);
      return { variables: [] };
    } catch (error) {
      this.logger.error(`[SM getVariables ${sessionId}] Error getting variables:`, error);
      return { variables: [] };
    }
  }

  async getStackTrace(sessionId: string, threadId?: number, includeInternals: boolean = false): Promise<StackFrame[]> {
    return (await this.getStackTraceDetailed(sessionId, threadId, includeInternals)).frames;
  }

  /**
   * Stack trace plus filtering metadata. Guarantees a non-empty `frames` array
   * whenever the adapter reported any frames: if the language policy filters
   * every frame as internal (issue #346 — e.g. a goroutine paused entirely in
   * Go runtime frames), the top unfiltered frame is kept so the agent always
   * has a frameId to anchor scopes/evaluate, and `hiddenFrameCount` +
   * `allFramesInternal` let the response say what was hidden.
   */
  async getStackTraceDetailed(
    sessionId: string,
    threadId?: number,
    includeInternals: boolean = false,
    opts?: { ensureStackReady?: boolean }
  ): Promise<StackTraceResult> {
    const session = this._getSessionById(sessionId);
    const currentThreadId = session.proxyManager?.getCurrentThreadId();
    this.logger.info(`[SM getStackTrace ${sessionId}] Entered. Requested threadId: ${threadId}, Current state: ${session.state}, Actual currentThreadId: ${currentThreadId}, includeInternals: ${includeInternals}`);

    if (!session.proxyManager || !session.proxyManager.isRunning()) {
      this.logger.warn(`[SM getStackTrace ${sessionId}] No active proxy.`);
      return emptyStackTraceResult('No active debug process for this session.');
    }
    if (session.state !== SessionState.PAUSED) {
      this.logger.warn(`[SM getStackTrace ${sessionId}] Session not paused. State: ${session.state}.`);
      return emptyStackTraceResult(`Session is not paused (state: ${session.state}); stack traces are only available while paused.`);
    }

    const currentThreadForRequest = threadId || currentThreadId;
    if (typeof currentThreadForRequest !== 'number') {
      this.logger.warn(`[SM getStackTrace ${sessionId}] No effective thread ID to use.`);
      return emptyStackTraceResult('No stopped thread is known for this session.');
    }

    const proxyManager = session.proxyManager;
    try {
      let rawFrames = await this.requestRawStackFrames(sessionId, proxyManager, currentThreadForRequest);
      let note: string | undefined;

      // A PAUSED session answering with zero frames is nearly always a
      // transient adapter race (netcoredbg materializes the managed stack a
      // beat after the stop event) or a frameless runtime thread being
      // tracked as current. On the agent-facing path, chase the real stack
      // instead of handing back a confusing empty success.
      if (rawFrames.length === 0 && opts?.ensureStackReady) {
        const ready = await this.waitForReadyStack(sessionId, session, proxyManager, currentThreadForRequest);
        rawFrames = ready.frames;
        note = ready.note;
      }

      let frames: StackFrame[] = rawFrames.map((sf: DebugProtocol.StackFrame) => ({
          id: sf.id, name: sf.name,
          file: sf.source?.path || sf.source?.name || "<unknown_source>",
          line: sf.line, column: sf.column
      }));

      // Apply filtering using the language's policy
      const totalFrameCount = frames.length;
      let allFramesInternal = false;
      const policy = this.selectPolicy(session.language);
      if (policy.filterStackFrames) {
        this.logger.info(`[SM getStackTrace ${sessionId}] Applying stack frame filtering for ${session.language}. Original count: ${frames.length}`);
        const filtered = policy.filterStackFrames(frames, includeInternals);
        // Central guarantee (issue #346): a policy filter must never leave the
        // agent with zero frames when the adapter reported some — keep the top
        // unfiltered frame so scopes/evaluate still have an anchor.
        if (filtered.length === 0 && frames.length > 0) {
          allFramesInternal = true;
          frames = [frames[0]];
        } else {
          frames = filtered;
        }
        this.logger.info(`[SM getStackTrace ${sessionId}] After filtering: ${frames.length} frames (hidden: ${totalFrameCount - frames.length}, allFramesInternal: ${allFramesInternal})`);
      }

      this.logger.info(`[SM getStackTrace ${sessionId}] Parsed stack frames (top 3):`, frames.slice(0,3).map(f => ({name:f.name, file:f.file, line:f.line})));
      return { frames, totalFrameCount, hiddenFrameCount: totalFrameCount - frames.length, allFramesInternal, ...(note ? { note } : {}) };
    } catch (error) {
      this.logger.error(`[SM getStackTrace ${sessionId}] Error getting stack trace:`, error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Send one DAP stackTrace request and return the raw frames. A failed DAP
   * response (e.g. "Child session not ready ...") must not be flattened into
   * an empty-but-successful stack trace (issue #124): propagate the failure.
   */
  private async requestRawStackFrames(
    sessionId: string,
    proxyManager: IProxyManager,
    threadId: number
  ): Promise<DebugProtocol.StackFrame[]> {
    this.logger.info(`[SM getStackTrace ${sessionId}] Sending DAP 'stackTrace' for threadId ${threadId}.`);
    const response = await proxyManager.sendDapRequest<DebugProtocol.StackTraceResponse>('stackTrace', { threadId });
    this.logger.info(`[SM getStackTrace ${sessionId}] DAP 'stackTrace' response received. Body:`, response?.body);

    if (response?.success === false) {
      throw new Error(response.message || `DAP 'stackTrace' request failed`);
    }
    if (!response || !response.body || !response.body.stackFrames) {
      this.logger.warn(`[SM getStackTrace ${sessionId}] No stackFrames in response body. Response:`, response);
      throw new Error(`DAP 'stackTrace' response did not include stack frames`);
    }
    return response.body.stackFrames;
  }

  /**
   * Bounded readiness loop for a PAUSED session whose stackTrace succeeded
   * with zero frames: re-poll the same thread (the stack may not be
   * materialized yet), and each round also scan the other stopped threads —
   * the tracked thread may be a frameless runtime thread (finalizer, JIT)
   * while the real stack lives elsewhere. A frame-bearing thread found by the
   * scan is adopted as current so scopes/evaluate anchor to it. If nothing
   * reports frames within the window, return the honest empty answer with a
   * note telling the agent what to try instead.
   */
  private async waitForReadyStack(
    sessionId: string,
    session: { state: SessionState },
    proxyManager: IProxyManager,
    threadId: number
  ): Promise<{ frames: DebugProtocol.StackFrame[]; note?: string }> {
    const deadline = Date.now() + this.pausedStackReadyTimeoutMs;
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, this.pausedStackReadyIntervalMs));
      if (session.state !== SessionState.PAUSED) {
        return { frames: [], note: 'The session left the paused state while waiting for the stack; it is no longer paused.' };
      }
      const frames = await this.requestRawStackFrames(sessionId, proxyManager, threadId);
      if (frames.length > 0) {
        return { frames };
      }
      const scanned = await this.scanThreadsForFrames(sessionId, proxyManager, threadId);
      if (scanned) {
        proxyManager.setCurrentThreadId(scanned.threadId);
        this.logger.info(`[SM getStackTrace ${sessionId}] Thread ${threadId} stayed frameless; adopted thread ${scanned.threadId} which has a stack.`);
        return {
          frames: scanned.frames,
          note: `The stopped thread ${threadId} reported no stack frames; switched to thread ${scanned.threadId}, which has one.`
        };
      }
    }
    this.logger.warn(`[SM getStackTrace ${sessionId}] Stack stayed empty for ${this.pausedStackReadyTimeoutMs}ms while paused (threadId ${threadId}).`);
    return {
      frames: [],
      note: `The stopped thread reported no stack frames within ${this.pausedStackReadyTimeoutMs}ms; the target may be paused in native code. Retry get_stack_trace, or use list_threads to inspect other threads.`
    };
  }

  /**
   * Probe the other stopped threads for one that reports stack frames.
   * Probe failures on individual threads are not fatal — runtime threads may
   * reject stackTrace outright.
   */
  private async scanThreadsForFrames(
    sessionId: string,
    proxyManager: IProxyManager,
    excludeThreadId: number
  ): Promise<{ threadId: number; frames: DebugProtocol.StackFrame[] } | null> {
    let threads: DebugProtocol.Thread[] | undefined;
    try {
      const response = await proxyManager.sendDapRequest<DebugProtocol.ThreadsResponse>('threads', {});
      threads = response?.body?.threads;
    } catch (err) {
      this.logger.warn(`[SM getStackTrace ${sessionId}] Thread scan could not list threads: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
    if (!Array.isArray(threads)) {
      return null;
    }
    for (const thread of threads) {
      if (!thread || typeof thread.id !== 'number' || thread.id === excludeThreadId) {
        continue;
      }
      try {
        const frames = await this.requestRawStackFrames(sessionId, proxyManager, thread.id);
        if (frames.length > 0) {
          return { threadId: thread.id, frames };
        }
      } catch {
        // This thread rejected stackTrace — keep scanning.
      }
    }
    return null;
  }

  async getScopes(sessionId: string, frameId: number): Promise<DebugProtocol.Scope[]> {
    const session = this._getSessionById(sessionId);
    this.logger.info(`[SM getScopes ${sessionId}] Entered. frameId: ${frameId}, Current state: ${session.state}`);
    
    if (!session.proxyManager || !session.proxyManager.isRunning()) { 
      this.logger.warn(`[SM getScopes ${sessionId}] No active proxy.`); 
      return []; 
    }
    if (session.state !== SessionState.PAUSED) { 
      this.logger.warn(`[SM getScopes ${sessionId}] Session not paused. State: ${session.state}.`); 
      return []; 
    }
    
    try {
      this.logger.info(`[SM getScopes ${sessionId}] Sending DAP 'scopes' for frameId ${frameId}.`);
      const response = await session.proxyManager.sendDapRequest<DebugProtocol.ScopesResponse>('scopes', { frameId });
      this.logger.info(`[SM getScopes ${sessionId}] DAP 'scopes' response received. Body:`, response?.body);
      
      if (response && response.body && response.body.scopes) {
        this.logger.info(`[SM getScopes ${sessionId}] Parsed scopes:`, response.body.scopes.map(s => ({name: s.name, ref: s.variablesReference, expensive: s.expensive })));
        return response.body.scopes;
      }
      this.logger.warn(`[GetScopes] No scopes in response body for session ${sessionId}, frameId ${frameId}. Response:`, response);
      return [];
    } catch (error) {
      this.logger.error(`[SM getScopes ${sessionId}] Error getting scopes:`, error);
      return [];
    }
  }

  /**
   * Get local variables for the current or specified stack frame.
   * This is a convenience method that orchestrates getting stack trace,
   * scopes, and variables, then delegates to the adapter policy to extract
   * just the local variables.
   *
   * @param names Optional exact-match, case-sensitive filter (issue #237),
   * applied to the final extracted locals — the policy's scope traversal
   * still sees everything it needs to pick the right scopes.
   */
  async getLocalVariables(sessionId: string, includeSpecial: boolean = false, names?: string[]): Promise<{
    variables: Variable[];
    frame: { name: string; file: string; line: number } | null;
    scopeName: string | null;
    truncation?: VariableTruncationSummary;
  }> {
    const session = this._getSessionById(sessionId);
    this.logger.info(`[SM getLocalVariables ${sessionId}] Entered. includeSpecial: ${includeSpecial}, Current state: ${session.state}`);
    
    // Validate session state
    if (!session.proxyManager || !session.proxyManager.isRunning()) { 
      this.logger.warn(`[SM getLocalVariables ${sessionId}] No active proxy.`); 
      return { variables: [], frame: null, scopeName: null }; 
    }
    if (session.state !== SessionState.PAUSED) { 
      this.logger.warn(`[SM getLocalVariables ${sessionId}] Session not paused. State: ${session.state}.`); 
      return { variables: [], frame: null, scopeName: null }; 
    }
    
    try {
      // Step 1: Get stack trace
      const stackFrames = await this.getStackTrace(sessionId);
      if (!stackFrames || stackFrames.length === 0) {
        this.logger.warn(`[SM getLocalVariables ${sessionId}] No stack frames available.`);
        return { variables: [], frame: null, scopeName: null };
      }
      
      const topFrame = stackFrames[0];
      this.logger.info(`[SM getLocalVariables ${sessionId}] Top frame: ${topFrame.name} at ${topFrame.file}:${topFrame.line}`);
      
      // Step 2: Collect all scopes for all frames (may need multiple frames for closures)
      const scopesMap: Record<number, DebugProtocol.Scope[]> = {};
      for (const frame of stackFrames) {
        const scopes = await this.getScopes(sessionId, frame.id);
        if (scopes && scopes.length > 0) {
          scopesMap[frame.id] = scopes;
        }
      }
      
      // Step 3: Collect variables for all scopes — budget-aware (issue
      // #356): a JS attach's internal pause frame can expose scopes walking
      // into process/global, so stop issuing DAP requests once the per-call
      // variable budget is spent. Frames iterate top-first, so the frames
      // that matter (whose Local scope extractLocalVariables reads) are
      // fetched before the budget can run out. The `names` filter is pushed
      // down so an explicit request is never starved by the budget.
      const variablesMap: Record<number, Variable[]> = {};
      const truncationByScope = new Map<number, VariableTruncationSummary | undefined>();
      let fetchedCount = 0;
      let scopeFetchesSkipped = 0;
      const fetchBudget = maxVariablesPerCall();
      for (const frame of stackFrames) {
        const scopes = scopesMap[frame.id];
        if (!scopes) continue;
        for (const scope of scopes) {
          if (scope.variablesReference <= 0) continue;
          if (fetchedCount >= fetchBudget) {
            scopeFetchesSkipped++;
            continue;
          }
          const detailed = await this.getVariablesDetailed(sessionId, scope.variablesReference, names);
          truncationByScope.set(scope.variablesReference, detailed.truncation);
          fetchedCount += detailed.variables.length;
          if (detailed.variables.length > 0) {
            variablesMap[scope.variablesReference] = detailed.variables;
          }
        }
      }
      if (scopeFetchesSkipped > 0) {
        this.logger.info(
          `[SM getLocalVariables ${sessionId}] Skipped ${scopeFetchesSkipped} scope fetch(es) after hitting the ${fetchBudget}-variable budget.`
        );
      }
      
      // Step 4: Get the appropriate adapter policy
      const policy = this.selectPolicy(session.language);
      
      // Step 5: Extract local variables using the adapter policy
      let localVars: Variable[] = [];
      let scopeName: string | null = null;
      
      if (policy.extractLocalVariables) {
        localVars = policy.extractLocalVariables(stackFrames, scopesMap, variablesMap, includeSpecial);

        // Report the ACTUAL scope name the adapter returned, not the policy's
        // canonical name — adapters may annotate it (e.g. Delve's "Locals
        // (warning: optimized function)") and that annotation matters to the
        // caller. Fall back to the canonical name when no scope matches.
        const canonicalNames = policy.getLocalScopeName
          ? ([] as string[]).concat(policy.getLocalScopeName())
          : [];
        const topFrameScopes = scopesMap[topFrame.id] || [];
        const matchedScope = topFrameScopes.find(s =>
          canonicalNames.some(c => s.name === c || s.name.startsWith(c + ' '))
        );
        scopeName = matchedScope?.name ?? canonicalNames[0] ?? null;
      } else {
        // Fallback: use first non-global scope from top frame
        const topFrameScopes = scopesMap[topFrame.id] || [];
        const localScope = topFrameScopes.find(s => !s.name.toLowerCase().includes('global'));
        if (localScope) {
          localVars = variablesMap[localScope.variablesReference] || [];
          scopeName = localScope.name;
        }
      }
      
      // Attribute per-scope truncation to the scopes whose variables
      // actually reached the caller (issue #438): every policy returns
      // variablesMap[ref] at most .filter()ed, so object identity survives
      // extraction. Cuts in fan-out scopes the policy discarded
      // (Global/Closure) never reached the response and must not be
      // reported as cuts in it. Computed before the names filter so an
      // explicit-names request cannot break the attribution.
      const returnedVars = new Set(localVars);
      const contributingSummaries: Array<VariableTruncationSummary | undefined> = [];
      for (const [ref, vars] of Object.entries(variablesMap)) {
        if (vars.some(v => returnedVars.has(v))) {
          contributingSummaries.push(truncationByScope.get(Number(ref)));
        }
      }

      if (names) {
        localVars = localVars.filter(v => names.includes(v.name));
      }

      this.logger.info(`[SM getLocalVariables ${sessionId}] Found ${localVars.length} local variables.`);

      // Cap the final extracted list too (policies may merge several scopes)
      // and surface every truncation that reached this response.
      const cappedLocals = applyVariableCaps(localVars);
      const truncation = mergeTruncationSummaries([
        ...contributingSummaries,
        cappedLocals.truncation,
        scopeFetchesSkipped > 0
          ? { omittedCount: 0, valueTruncatedCount: 0, scopesSkipped: scopeFetchesSkipped }
          : undefined
      ]);

      return {
        variables: cappedLocals.variables,
        frame: {
          name: topFrame.name,
          file: topFrame.file,
          line: topFrame.line
        },
        scopeName,
        ...(truncation ? { truncation } : {})
      };
      
    } catch (error) {
      // Do not flatten failures (e.g. a stack trace that could not be
      // retrieved) into an empty-but-successful result (issue #124).
      this.logger.error(`[SM getLocalVariables ${sessionId}] Error getting local variables:`, error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }
}

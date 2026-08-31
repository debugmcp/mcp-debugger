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
  redactVariableValue,
  extractionFromScope
} from '@debugmcp/shared';
import { SessionManagerCore } from './session-manager-core.js';
import { DebugProtocol } from '@vscode/debugprotocol';
import {
  applyVariableCaps,
  mergeTruncationSummaries,
  maxVariablesPerCall,
  VariableTruncationSummary
} from './variable-caps.js';
import {
  FrameAnchorResolver,
  type StackTraceResult
} from './inspection/frame-anchor-resolver.js';

export type { StackTraceResult } from './inspection/frame-anchor-resolver.js';

/**
 * Stack trace frames plus filtering metadata (issue #346): how many frames the
 * adapter reported, how many the language policy hid, and whether the
 * kept-first-frame fallback fired because every frame was internal.
 */
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

  /** One anchor contract shared by stack, locals, and expression evaluation. */
  protected readonly frameAnchorResolver = (() => {
    const facade = () => this;
    return new FrameAnchorResolver({
      get logger() { return facade().logger; },
      tunables: {
        get pausedStackReadyTimeoutMs() { return facade().pausedStackReadyTimeoutMs; },
        get pausedStackReadyIntervalMs() { return facade().pausedStackReadyIntervalMs; }
      },
      getSession: (sessionId) => this._getSessionById(sessionId),
      selectPolicy: (language) => this.selectPolicy(language)
    });
  })();

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
    return (await this.frameAnchorResolver.resolve(sessionId, threadId, includeInternals)).frames;
  }

  /**
   * Stack trace plus filtering metadata. Guarantees a non-empty `frames` array
   * whenever the adapter reported any frames: if the language policy filters
   * every frame as internal (issue #346 — e.g. a goroutine paused entirely in
   * Go runtime frames), the top unfiltered frame is kept so the agent always
   * has a frameId to anchor scopes/evaluate, and `hiddenFrameCount` +
   * `allFramesInternal` let the response say what was hidden.
   *
   * Thread contract: `opts.ensureStackReady` is the caller's permission to
   * re-anchor — an empty stack then gets the bounded readiness retry and may
   * switch to a sibling thread that has frames (the implicit MCP path, which
   * resolved `threadId` itself). Without it, an explicitly requested thread
   * is never re-anchored: an empty answer is only *described* (issue #553).
   */
  async getStackTraceDetailed(
    sessionId: string,
    threadId?: number,
    includeInternals: boolean = false,
    opts?: { ensureStackReady?: boolean }
  ): Promise<StackTraceResult> {
    return this.frameAnchorResolver.resolve(sessionId, threadId, includeInternals, opts);
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
    /**
     * Explains any departure from "the top frame's local scope": the top
     * frame had no locals and a lower frame was anchored instead (issue
     * #468), and/or a sibling scope on the anchor frame supplied the
     * variables because the canonical local scope was empty (issue #548).
     * Both notes may apply; they are joined with '; '.
     */
    anchorNote?: string;
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
      const stackResult = await this.frameAnchorResolver.resolve(
        sessionId,
        undefined,
        false,
        { ensureStackReady: true }
      );
      const stackFrames = stackResult.frames;
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
      
      // Step 3: Collect variables frame-by-frame — budget-aware (issue
      // #356) and anchor-aware (issues #468/#594). Stop as soon as a frame
      // yields usable locals; walking every async/runtime frame after the
      // answer is already known is both wasteful and unsafe (an unrelated
      // lower-frame formatter can hang the entire inspection). The `names`
      // filter remains authoritative for the top frame, so explicit-name
      // requests never walk down to a caller.
      const variablesMap: Record<number, Variable[]> = {};
      const truncationByScope = new Map<number, VariableTruncationSummary | undefined>();
      let fetchedCount = 0;
      let scopeFetchesSkipped = 0;
      const fetchBudget = maxVariablesPerCall();
      const policy = this.selectPolicy(session.language);
      for (let frameIndex = 0; frameIndex < stackFrames.length; frameIndex++) {
        const frame = stackFrames[frameIndex];
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

        const framesAtAnchor = stackFrames.slice(frameIndex);
        const extraction = policy.extractLocalVariables
          ? policy.extractLocalVariables(
              framesAtAnchor,
              scopesMap,
              variablesMap,
              includeSpecial
            )
          : undefined;
        const fallbackHasVariables = !policy.extractLocalVariables && scopes.some(
          scope =>
            !scope.name.toLowerCase().includes('global') &&
            (variablesMap[scope.variablesReference]?.length ?? 0) > 0
        );
        if (
          names !== undefined ||
          (extraction?.variables.length ?? 0) > 0 ||
          fallbackHasVariables ||
          fetchedCount >= fetchBudget
        ) {
          break;
        }
      }
      if (scopeFetchesSkipped > 0) {
        this.logger.info(
          `[SM getLocalVariables ${sessionId}] Skipped ${scopeFetchesSkipped} scope fetch(es) after hitting the ${fetchBudget}-variable budget.`
        );
      }
      
      // Step 4: Extract local variables using the adapter policy. Policies
      // anchor to the first frame of the list they receive, so extraction is
      // parameterized by anchor: slicing the frame list re-anchors it.
      const extractAt = (frames: StackFrame[]): {
        localVars: Variable[];
        scopeRefs: number[];
        scopeName: string | null;
        scopeNote?: string;
      } => {
        const anchor = frames[0];
        if (policy.extractLocalVariables) {
          const extraction = policy.extractLocalVariables(frames, scopesMap, variablesMap, includeSpecial);

          // Report the ACTUAL scope name the adapter returned, not the policy's
          // canonical name — adapters may annotate it (e.g. Delve's "Locals
          // (warning: optimized function)") and that annotation matters to the
          // caller. Fall back to the canonical name when no scope matches.
          const canonicalNames = policy.getLocalScopeName
            ? ([] as string[]).concat(policy.getLocalScopeName())
            : [];
          const anchorScopes = scopesMap[anchor.id] || [];
          const matchesCanonicalName = (scopeName: string, canonicalName: string): boolean =>
            scopeName === canonicalName ||
            scopeName.startsWith(canonicalName + ' ') ||
            (canonicalName.endsWith(':') && scopeName.startsWith(canonicalName));
          // Rank by the policy's preference order, not the adapter's scope
          // order: an adapter listing e.g. "Closure (fn)" ahead of "Local"
          // must not make Closure the canonical scope and Local the
          // "fallback", or the note below would misreport every call.
          const canonicalScope = canonicalNames
            .map(canonicalName => anchorScopes.find(scope => matchesCanonicalName(scope.name, canonicalName)))
            .find((scope): scope is DebugProtocol.Scope => scope !== undefined);
          // The policy names the scopes it SELECTED. When the canonical scope
          // is among them it stays the reported one even if a sibling was
          // merged in ahead of it (js-debug's Block + Local, issue #558):
          // 'Local' with no note is the honest answer for a frame whose own
          // local scope took part — which is why a policy lists a selected
          // scope that happened to contribute no variables (all filtered, or
          // emptied by the `names` filter) rather than dropping it.
          // Otherwise the FIRST REF the policy listed is what the caller got;
          // read in scopeRefs order, not adapter order, because the policy's
          // order is the presentation order it promised.
          // No `variables.length > 0` guard: the contract is "no variables
          // implies no scopeRefs" (invariants 11/12, enforced by
          // extractionFromScope), so an empty result lists nothing to match.
          const contributingScope =
            canonicalScope && extraction.scopeRefs.includes(canonicalScope.variablesReference)
              ? canonicalScope
              : extraction.scopeRefs
                  .map(ref => anchorScopes.find(scope => scope.variablesReference === ref))
                  .find((scope): scope is DebugProtocol.Scope => scope !== undefined);
          const matchedScope = contributingScope ?? canonicalScope;
          const scopeNote = contributingScope && canonicalScope && contributingScope !== canonicalScope
            ? (
                `The ${canonicalScope.name} scope on frame '${anchor.name}' had no usable local variables; ` +
                `showing ${contributingScope.name} from the same frame instead`
              )
            : undefined;
          return {
            localVars: extraction.variables,
            scopeRefs: extraction.scopeRefs,
            scopeName: matchedScope?.name ?? canonicalNames[0] ?? null,
            ...(scopeNote ? { scopeNote } : {})
          };
        }
        // Fallback: use first non-global scope from the anchor frame
        const anchorScopes = scopesMap[anchor.id] || [];
        const localScope = anchorScopes.find(s => !s.name.toLowerCase().includes('global'));
        if (!localScope) {
          return { localVars: [], scopeRefs: [], scopeName: null };
        }
        // Built through the shared helper so this branch obeys the same
        // "no variables implies no scopeRefs" rule the policies do — naming a
        // scope that supplied nothing would let its truncation summary reach
        // a response none of its variables did (issue #438).
        const fallback = extractionFromScope(
          localScope,
          variablesMap[localScope.variablesReference] || []
        );
        return {
          localVars: fallback.variables,
          scopeRefs: fallback.scopeRefs,
          scopeName: localScope.name
        };
      };

      let anchorIndex = 0;
      let { localVars, scopeRefs, scopeName, scopeNote } = extractAt(stackFrames);

      // A pause inside a runtime/stdlib frame (blocking syscall, sleep) puts
      // an empty-locals frame on top while the user frame sits just below —
      // and its scopes are already fetched. Walk down to the first frame
      // that yields locals rather than returning an empty result the caller
      // cannot act on (issue #468). Skipped under an explicit `names` filter,
      // where "nothing matched in the top frame" is the honest answer.
      if (localVars.length === 0 && names === undefined) {
        for (let k = 1; k < stackFrames.length; k++) {
          const attempt = extractAt(stackFrames.slice(k));
          if (attempt.localVars.length > 0) {
            anchorIndex = k;
            localVars = attempt.localVars;
            scopeRefs = attempt.scopeRefs;
            scopeName = attempt.scopeName;
            scopeNote = attempt.scopeNote;
            this.logger.info(
              `[SM getLocalVariables ${sessionId}] Top frame '${topFrame.name}' had no locals; anchored to frame #${k} '${stackFrames[k].name}'.`
            );
            break;
          }
        }
      }
      const anchorFrame = stackFrames[anchorIndex];
      
      // Attribute per-scope truncation to the scopes the policy SELECTED
      // (issue #438): it names them in the extraction's scopeRefs, so nothing
      // has to be reconstructed from object identity. Cuts in the fan-out
      // scopes the policy discarded (Global/Closure, and every lower frame's)
      // never reached the response and must not be reported as cuts in it.
      // A selected scope that contributed no variables normally has no summary
      // either, so listing it to keep it nameable (issue #558) is free.
      // Read before the names filter so an explicit-names request cannot
      // break the attribution.
      const contributingSummaries: Array<VariableTruncationSummary | undefined> =
        scopeRefs.map(ref => truncationByScope.get(ref));

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

      const anchorNotes: string[] = stackResult.note ? [stackResult.note] : [];
      if (anchorIndex > 0) {
        anchorNotes.push(
          `Top frame '${topFrame.name}' has no local variables (runtime/stdlib frame); ` +
          `showing frame #${anchorIndex} '${anchorFrame.name}' instead`
        );
      }
      if (scopeNote) {
        anchorNotes.push(scopeNote);
      }

      return {
        variables: cappedLocals.variables,
        frame: {
          name: anchorFrame.name,
          file: anchorFrame.file,
          line: anchorFrame.line
        },
        scopeName,
        ...(anchorNotes.length > 0 ? { anchorNote: anchorNotes.join('; ') } : {}),
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

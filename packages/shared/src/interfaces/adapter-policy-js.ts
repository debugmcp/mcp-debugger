/**
 * JsDebugAdapterPolicy - policy for VS Code js-debug (pwa-node)
 *
 * Encodes js-debug specific multi-session behavior while preserving
 * generic DAP flow in core code.
 */
import type { DebugProtocol } from '@vscode/debugprotocol';
import * as path from 'path';
import type { AdapterPolicy, AdapterSpecificState, CommandHandling, LocalVariableExtraction, QueuedDapCommand, StopReasonContext } from './adapter-policy.js';
import { emptyLocalVariableExtraction, extractionFromScope, resolveExceptionFilters } from './adapter-policy.js';
import { SessionState } from '@debugmcp/shared';
import type { StackFrame, Variable } from '../models/index.js';
import { toSourceBreakpoint } from '../utils/to-source-breakpoint.js';
import type { DapClientBehavior, DapClientContext, ReverseRequestResult } from './dap-client-behavior.js';

/**
 * Every js-debug scope name this adapter knows, grouped by kind.
 *
 * Single source of truth for the two places that each used to hold their own
 * copy: the extractor's predicates and `getLocalScopeName()` (which the
 * session layer then matches against to name the reported scope). Commit
 * 4f469d71 shipped a false-note bug precisely because those two disagreed —
 * the extractor learned the exact `Block` name and the reported list did not.
 * A spec test asserts the list is exactly this table, flattened.
 *
 * A name ending in ':' matches as a prefix (`Block:loop`); every other name
 * matches exactly. Two historical spellings are matched by the predicates but
 * not spelled out here: `Closure (fn)` (the session layer's canonical
 * `name + ' '` rule covers it) and `module` in any other casing (the module
 * predicate compares case-insensitively).
 */
export const JS_SCOPE_KINDS = {
  local: ['Local', 'Locals', 'Local:'],
  block: ['Block', 'Catch Block', 'With Block', 'Block:'],
  closure: ['Closure', 'Closure:'],
  module: ['Script', 'Module', 'module']
} as const;

/** Exact match, or prefix match for a name written with a trailing ':'. */
function matchesScopeNames(scope: DebugProtocol.Scope, names: readonly string[]): boolean {
  return names.some(name =>
    name.endsWith(':') ? scope.name.startsWith(name) : scope.name === name
  );
}

const isLocalScope = (scope: DebugProtocol.Scope): boolean =>
  matchesScopeNames(scope, JS_SCOPE_KINDS.local);
/**
 * js-debug names a lexical block scope exactly 'Block' (and 'Catch Block' /
 * 'With Block'); only some legacy builds use the 'Block:<label>' form. That is
 * where `let`/`const` bindings declared inside a `for` body or a `catch (e)`
 * live (issue #558).
 */
const isBlockScope = (scope: DebugProtocol.Scope): boolean =>
  matchesScopeNames(scope, JS_SCOPE_KINDS.block);
/**
 * "Local-like" is local OR block: either proves the frame is a real
 * function/block frame rather than a top-level script frame, which is what the
 * Global gate turns on.
 */
const isLocalLikeScope = (scope: DebugProtocol.Scope): boolean =>
  isLocalScope(scope) || isBlockScope(scope);
const isClosureScope = (scope: DebugProtocol.Scope): boolean =>
  matchesScopeNames(scope, JS_SCOPE_KINDS.closure) || scope.name.startsWith('Closure ');
const isModuleScope = (scope: DebugProtocol.Scope): boolean =>
  matchesScopeNames(scope, JS_SCOPE_KINDS.module) || scope.name.toLowerCase() === 'module';
const JS_NO_LOCAL_SCOPE_NOTE =
  'This JavaScript frame exposes no Local or block scope, so get_local_variables intentionally returned no variables; use get_scopes with this frame ID, then get_variables for an explicit scope (for example Global).';

/**
 * JavaScript-specific adapter state
 */
export interface JsAdapterState extends AdapterSpecificState {
  initializeResponded: boolean;
  startSent: boolean;
  pendingCommands: QueuedDapCommand[];
}

/** A `node_modules` path *segment*, either separator (issue #655). */
const NODE_MODULES_SEGMENT = /[\\/]node_modules[\\/]/;

/** No source at all: the resolver's `<unknown_source>` placeholder or an empty path. */
function hasNoSource(filePath: string): boolean {
  return filePath === '' || filePath === '<unknown_source>';
}

export const JsDebugAdapterPolicy: AdapterPolicy = {
  name: 'js-debug',
  supportsLogPoints: true,
  // js-debug implements no DAP setFunctionBreakpoints (upstream out of scope,
  // vscode-js-debug#952), so ours are delivered out of band (issue #295): the
  // proxy's CdpFunctionBreakpointBridge resolves names over the child
  // session's requestCDPProxy WebSocket and arms V8's
  // Debugger.setBreakpointOnFunctionCall. The 'cdp' marker below routes
  // setFunctionBreakpoints to the bridge and tells the gate to ignore
  // js-debug's live supportsFunctionBreakpoints: false.
  supportsFunctionBreakpoints: true,
  functionBreakpointsVia: 'cdp',
  // Names in late-loaded modules stay verified:false by design and bind at
  // the next pause — unverified-at-launch is not a failure here (issue #308).
  functionBreakpointsBindLate: true,
  supportsReverseStartDebugging: true,
  childSessionStrategy: 'launchWithPendingTarget',
  buildChildStartArgs: (pendingId: string, parentConfig: Record<string, unknown>) => {
    const type = typeof parentConfig?.type === 'string' ? (parentConfig.type as string) : 'pwa-node';
    // Carry the parent's forwardable attach extras (localRoot/remoteRoot,
    // sourceMaps, skipFiles, …) into the child — source resolution happens
    // here, so this is where they take effect (issue #466). The orchestration
    // keys stay pinned/excluded: address/port/attachSimplePort would make the
    // child a second direct attach to the same inspector (the #124
    // fight-over-the-process failure), and stopOnEntry is consumed by
    // ChildSessionManager itself, not js-debug.
    const {
      request: _request,
      name: _name,
      __pendingTargetId: _pendingTargetId,
      host: _host,
      address: _address,
      port: _port,
      attachSimplePort: _attachSimplePort,
      attachExistingChildren: _attachExistingChildren,
      continueOnAttach: _continueOnAttach,
      stopOnEntry: _stopOnEntry,
      type: _type,
      ...parentExtras
    } = parentConfig ?? {};
    void _request; void _name; void _pendingTargetId; void _host; void _address;
    void _port; void _attachSimplePort; void _attachExistingChildren;
    void _continueOnAttach; void _stopOnEntry; void _type;
    return {
      command: 'attach',
      args: {
        ...parentExtras,
        type,
        request: 'attach',
        __pendingTargetId: pendingId,
        continueOnAttach: true  // js-debug requires true to work properly
      }
    };
  },
  isChildReadyEvent: (evt: DebugProtocol.Event): boolean => {
    // js-debug often signals readiness by posting a 'thread' event or an early 'stopped'.
    // Waiting on these ensures threads() will not be empty.
    return evt?.event === 'thread' || evt?.event === 'stopped';
  },

  /**
   * js-debug reports an explicit pause as reason 'step' with description
   * 'Paused' — the exact same body a genuine step produces, so the body alone
   * cannot distinguish them. Normalize to 'pause' only while a user-initiated
   * pause request is in flight. A step that happens to complete inside that
   * window is reported as 'pause', which matches what the user asked for.
   */
  normalizeStopReason: (
    reason: string,
    _body: DebugProtocol.StoppedEvent['body'] | undefined,
    context: StopReasonContext
  ): string | undefined => {
    if (reason === 'step' && context.pausePending) {
      return 'pause';
    }
    return undefined;
  },

  /**
   * Classify a frame as runtime/dependency glue rather than the user's code
   * (issue #655). Three rules, all path-based:
   *
   * 1. Node internals — `<node_internals>/…` (js-debug already rewrites
   *    `node:` URLs to that form; the bare `node:` prefix is kept as a
   *    belt-and-braces for other DAP servers and `source.name` fallbacks).
   * 2. Any `node_modules` path segment — pnpm's
   *    `node_modules/.pnpm/express@4/node_modules/express/…`, Windows
   *    `C:\app\node_modules\…`, and `file:///…/node_modules/…` URLs. A
   *    *segment* match, not a substring, so `/app/src/node_modules_helper.js`
   *    stays visible. Workspace packages are realpathed by Node, so a monorepo
   *    package linked under `node_modules/@scope/pkg` reports its real
   *    `packages/pkg/…` path and stays visible; only `--preserve-symlinks`
   *    hides it — the same rule launch already applies via `skipFiles`. A
   *    debuggee that *is* an installed package (`/usr/lib/node_modules/<pkg>`)
   *    becomes all-internal: the central issue-#346 fallback keeps frame 0 and
   *    the response note says so; `includeInternals: true` shows everything.
   * 3. js-debug's async separators — `await` / `Promise.then` /
   *    `bound-anonymous-fn` labels with no source at all and `line: 0`. A
   *    sourceless frame that still reports a line (an eval'd `VM123` script)
   *    is not matched.
   *
   * `frame.name` deliberately does not participate: `processTicksAndRejections`
   * carries a `<node_internals>` path (rule 1), the separators are rule 3, and
   * a name rule would only add false positives (a user function named `then`).
   * Unresolvable source-mapped frames (a relative `../src/x.ts` js-debug could
   * not find on disk) are NOT internal — they are the debuggee's own code and
   * are annotated with `unresolvedSource` by the frame resolver instead.
   */
  isInternalFrame: (frame: StackFrame): boolean => {
    const filePath = frame.file || '';
    if (filePath.includes('<node_internals>') || filePath.startsWith('node:')) {
      return true;
    }
    if (NODE_MODULES_SEGMENT.test(filePath)) {
      return true;
    }
    return hasNoSource(filePath) && (frame.line ?? 0) === 0;
  },

  /**
   * Filter stack frames to optionally remove Node.js internals and
   * dependency frames. No local first-frame fallback: the frame resolver in
   * the session layer restores the top frame for an all-internal stack and
   * sets `allFramesInternal` (issue #346); a fallback here used to mask that
   * flag and report "N-1 hidden" with the wrong note.
   */
  filterStackFrames: (frames: StackFrame[], includeInternals: boolean): StackFrame[] => {
    if (includeInternals) {
      return frames;
    }
    return frames.filter(frame => !JsDebugAdapterPolicy.isInternalFrame!(frame));
  },

  /**
   * Extract local variables for JavaScript, filtering out internals by default
   */
  extractLocalVariables: (
    stackFrames: StackFrame[],
    scopes: Record<number, DebugProtocol.Scope[]>,
    variables: Record<number, Variable[]>,
    includeSpecial: boolean = false
  ): LocalVariableExtraction => {
    // Get the top frame
    if (!stackFrames || stackFrames.length === 0) {
      return emptyLocalVariableExtraction();
    }
    
    const topFrame = stackFrames[0];
    const frameScopes = scopes[topFrame.id];
    
    if (!frameScopes || frameScopes.length === 0) {
      return emptyLocalVariableExtraction();
    }

    // Script/Module/Global-only frames have no local-variable contract.
    // Returning Global can dump hundreds of runtime bindings while labeling
    // them as locals; leave scope selection explicit instead (#595).
    if (!frameScopes.some(isLocalLikeScope)) {
      return emptyLocalVariableExtraction(JS_NO_LOCAL_SCOPE_NOTE);
    }
    
    const variablesForScope = (scope: DebugProtocol.Scope): Variable[] => {
      let scopeVariables = variables[scope.variablesReference] || [];

      // Filter out special variables unless requested. A scope containing
      // only these entries is still empty for normal local inspection, so
      // sibling scopes remain eligible (issue #548).
      if (!includeSpecial) {
        scopeVariables = scopeVariables.filter(v => {
          const name = v.name;

          // Skip 'this' unless explicitly requested
          if (name === 'this') {
            return false;
          }

          // Skip prototype chain variables
          if (name === '__proto__' || name === 'prototype') {
            return false;
          }

          // Skip internal V8/Node variables
          if (name.startsWith('[[') && name.endsWith(']]')) {
            return false;
          }

          // Skip debugger internals
          if (name.startsWith('$') || name.startsWith('_$')) {
            return false;
          }

          return true;
        });
      }

      return scopeVariables;
    };

    // The local-like group COLLECTS: a frame stopped inside a block has both
    // kinds of scope and either one alone is a wrong answer — reporting only
    // the block hides the function's parameters and outer locals, reporting
    // only the function hides the loop variable the user stopped to look at.
    // V8 lists block scopes innermost-first and ahead of Local, so taking them
    // in adapter order reads like the language's own shadowing rules
    // (issue #558). The later groups stay first-match fall-throughs.
    const collected: Variable[] = [];
    const collectedRefs: number[] = [];
    const seenRefs = new Set<number>();
    const collect = (scope: DebugProtocol.Scope): void => {
      // Two scopes can share a variablesReference; collecting it twice would
      // duplicate its variables and double-count its truncation.
      if (seenRefs.has(scope.variablesReference)) {
        return;
      }
      const scopeVariables = variablesForScope(scope);
      // A scope that supplied nothing is not a contributing scope: listing its
      // ref would misattribute another scope's truncation (issue #438).
      if (scopeVariables.length === 0) {
        return;
      }
      seenRefs.add(scope.variablesReference);
      // Push in a loop, not `push(...)`: a spread of a very large scope is a
      // call with that many arguments and blows the stack.
      for (const variable of scopeVariables) {
        collected.push(variable);
      }
      collectedRefs.push(scope.variablesReference);
    };

    const localScopes = frameScopes.filter(isLocalScope);
    for (const scope of frameScopes.filter(isLocalLikeScope)) {
      collect(scope);
    }
    // ESM top-level: js-debug gives a `for (let i...)` or `catch (e)` at module
    // top level a Block scope with NO Local scope beneath it, and the module's
    // own consts live in Script/Module. Before block scopes were recognised at
    // all, such a frame reported those module bindings; collecting only the
    // block would silently drop them. So when there is no Local scope, the
    // first Script/Module scope is the frame's base and joins the merge.
    if (localScopes.length === 0 && collectedRefs.length > 0) {
      // First module-like scope that has something to show, as the
      // fall-through below picks it.
      const baseScope = frameScopes.find(
        (scope) => isModuleScope(scope) && variablesForScope(scope).length > 0
      );
      if (baseScope) {
        collect(baseScope);
      }
    }
    if (collected.length > 0) {
      // Keep a Local scope that exists on the frame nameable even when it
      // contributed nothing — emptied by the `this`-only filter or by a
      // pushed-down `names` filter. Without its ref the session layer cannot
      // see that its canonical scope took part and reports the block with a
      // note blaming Local, which is not what happened (issue #558).
      for (const scope of localScopes) {
        if (!seenRefs.has(scope.variablesReference)) {
          seenRefs.add(scope.variablesReference);
          collectedRefs.push(scope.variablesReference);
        }
      }
      return { variables: collected, scopeRefs: collectedRefs };
    }

    // Nothing local-like had anything to show. js-debug can expose a genuinely
    // empty Local scope while the useful binding lives in Closure or Module on
    // the same frame; try those in usefulness order before the session layer
    // walks down to a caller.
    const fallbackGroups: Array<(scope: DebugProtocol.Scope) => boolean> = [
      isClosureScope,
      isModuleScope
    ];
    for (const matches of fallbackGroups) {
      for (const scope of frameScopes.filter(matches)) {
        const scopeVariables = variablesForScope(scope);
        if (scopeVariables.length > 0) {
          return extractionFromScope(scope, scopeVariables);
        }
      }
    }

    return emptyLocalVariableExtraction();
  },
  
  /**
   * Every scope name this adapter reads, in the preference order the session
   * layer uses to pick the scope it reports.
   *
   * Derived from JS_SCOPE_KINDS so it cannot drift from the extractor's
   * predicates. The order matters: 'Local' first means a frame with a Local
   * scope still reports 'Local' after the issue #558 block merge, while a
   * block-only frame (ESM top-level `for (let i...)`) matches its own block by
   * name rather than falling through to Module and drawing a note about a
   * scope that was never consulted.
   */
  getLocalScopeName: (): string[] => {
    return [
      ...JS_SCOPE_KINDS.local,
      ...JS_SCOPE_KINDS.block,
      ...JS_SCOPE_KINDS.closure,
      ...JS_SCOPE_KINDS.module
    ];
  },
  
  getDapAdapterConfiguration: () => {
    return {
      type: 'pwa-node'  // VS Code JavaScript/TypeScript debugger type
    };
  },
  
  resolveExecutablePath: (providedPath?: string) => {
    // JavaScript-specific executable path resolution
    // Priority: provided path > node executable
    if (providedPath) {
      return providedPath;
    }
    
    // Default to node executable  
    return 'node';
  },
  
  getDebuggerConfiguration: () => {
    return {
      // JavaScript debugger configuration for js-debug/pwa-node
      requiresStrictHandshake: true,  // js-debug requires strict initialization sequence
      skipConfigurationDone: false,
      supportsVariableType: true  // JavaScript debugger supports variable type information
    };
  },

  isSessionReady: (state: SessionState, options: { stopOnEntry?: boolean }) =>
    state === SessionState.PAUSED || (!options.stopOnEntry && state === SessionState.RUNNING),

  /**
   * js-debug attaches with continueOnAttach, so a running target stays
   * running; the SessionManager must issue an explicit pause for the PAUSED
   * state it reports after attach to be real (issue #124).
   */
  getAttachBehavior: () => ({ pauseAfterAttach: true }),

  /**
   * Perform JavaScript-specific handshake sequence for js-debug/pwa-node.
   * This includes the strict initialization sequence required by js-debug.
   */
  performHandshake: async (context) => {
    const { proxyManager: pm, sessionId, dapLaunchArgs, scriptPath, scriptArgs, breakpoints, launchConfig, breakOnExceptions } = context;

    if (!pm || !pm.isRunning()) {
      console.warn(
        `[JsDebugAdapterPolicy] performHandshake skipped: proxy manager not running for session ${sessionId}`
      );
      return;
    }

    // 1) initialize with supportsStartDebuggingRequest.
    // The 'initialized' listener is attached BEFORE the request goes out:
    // js-debug can emit the event before the initialize response is processed,
    // and a listener attached afterwards misses it and burns the full wait
    // window below (#242).
    let initializedSeen = false;
    let notifyInitialized: (() => void) | null = null;
    const onInitialized = (event: string) => {
      if (event === 'initialized') {
        initializedSeen = true;
        pm.removeListener('dap-event', onInitialized);
        notifyInitialized?.();
      }
    };
    pm.on('dap-event', onInitialized);

    try {
      console.info(`[JsDebugAdapterPolicy] [JS] Sending 'initialize' request`);
      await pm.sendDapRequest('initialize', {
        clientID: 'mcp',
        adapterID: 'javascript',
        linesStartAt1: true,
        columnsStartAt1: true,
        pathFormat: 'path',
        // CRITICAL: Tell js-debug we support multi-session for proper breakpoint handling
        supportsStartDebuggingRequest: true,
      });
    } catch (e) {
      console.warn(
        `[JsDebugAdapterPolicy] [JS] 'initialize' failed or deferred: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }

    // 2) wait for DAP 'initialized'. The timeout is armed only now so a slow
    // initialize round-trip does not consume the wait window.
    if (!initializedSeen) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          pm.removeListener('dap-event', onInitialized);
          console.warn(`[JsDebugAdapterPolicy] [JS] Timeout waiting for DAP 'initialized' event`);
          resolve();
        }, 10000);
        notifyInitialized = () => {
          clearTimeout(timer);
          resolve();
        };
      });
    }

    // 3) setExceptionBreakpoints + setBreakpoints
    try {
      const exceptionFilters = resolveExceptionFilters(JsDebugAdapterPolicy, breakOnExceptions);
      console.info(`[JsDebugAdapterPolicy] [JS] Sending 'setExceptionBreakpoints' ${JSON.stringify(exceptionFilters)}`);
      await pm.sendDapRequest('setExceptionBreakpoints', { filters: exceptionFilters });
    } catch (e) {
      console.warn(
        `[JsDebugAdapterPolicy] [JS] 'setExceptionBreakpoints' failed or unsupported: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }
    
    try {
      // Group queued breakpoints by file, mapping via the shared
      // toSourceBreakpoint so no per-breakpoint field is dropped (#235)
      const grouped: Map<string, DebugProtocol.SourceBreakpoint[]> = new Map();
      for (const breakpoint of breakpoints.values()) {
        const arr = grouped.get(breakpoint.file) || [];
        arr.push(toSourceBreakpoint(breakpoint));
        grouped.set(breakpoint.file, arr);
      }
      for (const [file, bps] of grouped) {
        console.info(
          `[JsDebugAdapterPolicy] [JS] Sending 'setBreakpoints' for ${file} (${bps.length})`
        );
        await pm.sendDapRequest('setBreakpoints', {
          source: { path: file },
          breakpoints: bps,
        });
      }
    } catch (e) {
      console.warn(
        `[JsDebugAdapterPolicy] [JS] 'setBreakpoints' failed: ${e instanceof Error ? e.message : String(e)}`
      );
    }

    // 4) configurationDone
    try {
      console.info(`[JsDebugAdapterPolicy] [JS] Sending 'configurationDone'`);
      await pm.sendDapRequest('configurationDone', {});
    } catch (e) {
      console.warn(
        `[JsDebugAdapterPolicy] [JS] 'configurationDone' failed or deferred: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }

    // 5) start debug target (attach if explicit attach+port; else launch using adapter policy)
    const a = (dapLaunchArgs || {}) as Record<string, unknown>;
    const baseLaunchConfig: Record<string, unknown> = launchConfig ? { ...launchConfig } : {};
    const baseRecord = baseLaunchConfig as Record<string, unknown>;

    const getPortValue = (value: unknown): number | undefined =>
      typeof value === 'number' && Number.isFinite(value) ? value : undefined;

    const type =
      typeof baseLaunchConfig.type === 'string'
        ? (baseLaunchConfig.type as string)
        : typeof a.type === 'string'
        ? (a.type as string)
        : 'pwa-node';

    const req =
      typeof baseLaunchConfig.request === 'string'
        ? (baseLaunchConfig.request as string)
        : typeof a.request === 'string'
        ? (a.request as string)
        : 'launch';

    const attachPort =
      getPortValue(baseRecord.attachSimplePort) ??
      getPortValue(baseRecord.port) ??
      getPortValue(a.attachSimplePort) ??
      getPortValue(a.port);

    if (req === 'attach' && typeof attachPort === 'number' && attachPort > 0) {
      // Explicit ATTACH flow (single parent session); avoid DI ambiguity.
      // Use the caller-provided host — previously hardcoded to 127.0.0.1,
      // which broke attaching to anything but local loopback (issue #124).
      const attachHost =
        typeof baseRecord.host === 'string' && (baseRecord.host as string).length > 0
          ? (baseRecord.host as string)
          : typeof a.host === 'string' && (a.host as string).length > 0
          ? (a.host as string)
          : '127.0.0.1';
      // NOTE: do not set attachSimplePort here. Combined with `port` it makes
      // js-debug attach to the same inspector twice (simple-attach delegate +
      // regular attach target); with continueOnAttach the two targets then
      // fight over the process — every pause is immediately resumed by the
      // other target and stackTrace fails with "Thread is not paused"
      // (observed empirically while fixing issue #124).
      // Caller-provided attach extras (localRoot/remoteRoot, sourceMaps,
      // skipFiles, …) are spread through so they reach js-debug — and, via the
      // recorded attach args, its child sessions (issue #466). The policy's
      // own keys stay on top: the #124 fight-over-the-process failure modes
      // live exactly in these knobs.
      const {
        attachSimplePort: _ignoredSimplePort,
        ...callerAttachExtras
      } = baseRecord;
      void _ignoredSimplePort;
      const attachArgs: Record<string, unknown> = {
        ...callerAttachExtras,
        type,
        request: 'attach',
        address: attachHost,
        port: attachPort,
        continueOnAttach: true,
        attachExistingChildren: true
      };
      // Carry the caller's stopOnEntry: js-debug itself ignores it, but
      // MinimalDapClient records the attach args and threads the intent into
      // child session creation (issue #124).
      const stopOnEntryValue =
        typeof baseRecord.stopOnEntry === 'boolean'
          ? (baseRecord.stopOnEntry as boolean)
          : typeof a.stopOnEntry === 'boolean'
          ? (a.stopOnEntry as boolean)
          : undefined;
      if (typeof stopOnEntryValue === 'boolean') {
        attachArgs.stopOnEntry = stopOnEntryValue;
      }
      // js-debug's pwa-node attach defaults autoAttachChildProcesses to true,
      // which bootloads every fork() of the inspected process into
      // waitForDebugger; with single-child adoption those forks wedge (#501).
      // The MCP path already defaults this off in transformAttachConfig; this
      // guard makes the policy self-contained for embedders that bypass the
      // adapter transform. A caller-supplied boolean is respected, sourced
      // like stopOnEntry above: launchConfig (via callerAttachExtras), then
      // dapLaunchArgs.
      if (typeof attachArgs.autoAttachChildProcesses !== 'boolean') {
        attachArgs.autoAttachChildProcesses =
          typeof a.autoAttachChildProcesses === 'boolean'
            ? (a.autoAttachChildProcesses as boolean)
            : false;
      }
      // Same self-containment for resolveSourceMapLocations (issue #655):
      // js-debug's attach defaults collapse it to null without a workspace
      // folder, applying every dependency's .js.map. The adapter transform
      // already sets launch's exclusion; keep it for embedders that bypass
      // the transform. Only an absent key is defaulted — an explicit null
      // ("resolve everywhere") is a caller decision.
      if (!('resolveSourceMapLocations' in attachArgs)) {
        attachArgs.resolveSourceMapLocations =
          'resolveSourceMapLocations' in a
            ? a.resolveSourceMapLocations
            : ['**', '!**/node_modules/**'];
      }
      try {
        console.info(`[JsDebugAdapterPolicy] [JS] Sending 'attach' to ${attachPort} (address=${attachHost})`);
        await pm.sendDapRequest('attach', attachArgs);
      } catch (e) {
        console.warn(`[JsDebugAdapterPolicy] [JS] 'attach' failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else {
      // LAUNCH flow (default for MCP). Use adapter-configured policy; do not add parent attach-by-port afterward
      try {
        if (typeof baseLaunchConfig.program !== 'string' || !baseLaunchConfig.program.length) {
          baseLaunchConfig.program = scriptPath;
        }

        if (
          (!Array.isArray(baseLaunchConfig.args) || baseLaunchConfig.args.length === 0) &&
          Array.isArray(scriptArgs) &&
          scriptArgs.length > 0
        ) {
          baseLaunchConfig.args = scriptArgs;
        }

        if (typeof baseLaunchConfig.cwd !== 'string' || !baseLaunchConfig.cwd.length) {
          baseLaunchConfig.cwd = scriptPath ? path.dirname(scriptPath) : process.cwd();
        }

        if (typeof baseLaunchConfig.stopOnEntry !== 'boolean' && typeof a?.stopOnEntry === 'boolean') {
          baseLaunchConfig.stopOnEntry = a.stopOnEntry;
        }

        if (typeof baseLaunchConfig.justMyCode !== 'boolean' && typeof a?.justMyCode === 'boolean') {
          baseLaunchConfig.justMyCode = a.justMyCode;
        }

        if (typeof baseLaunchConfig.console !== 'string') {
          baseLaunchConfig.console = 'internalConsole';
        }

        if (typeof baseLaunchConfig.outputCapture !== 'string') {
          baseLaunchConfig.outputCapture = 'std';
        }

        if (typeof baseLaunchConfig.smartStep !== 'boolean') {
          baseLaunchConfig.smartStep = true;
        }

        if (typeof baseLaunchConfig.pauseForSourceMap !== 'boolean') {
          baseLaunchConfig.pauseForSourceMap = true;
        }

        if (typeof baseLaunchConfig.runtimeExecutable !== 'string') {
          // Use process.execPath to ensure we use the same Node.js that's running this process
          baseLaunchConfig.runtimeExecutable = process.execPath;
        }

        const finalLaunchArgs: Record<string, unknown> = {
          ...baseLaunchConfig,
          type,
          request: req
        };

        if (typeof baseLaunchConfig.sourceMaps === 'boolean') {
          finalLaunchArgs.sourceMaps = baseLaunchConfig.sourceMaps;
        } else if (typeof a.sourceMaps === 'boolean') {
          finalLaunchArgs.sourceMaps = a.sourceMaps;
        }

        const resolvedOutFiles =
          Array.isArray(baseLaunchConfig.outFiles) && baseLaunchConfig.outFiles.length > 0
            ? baseLaunchConfig.outFiles
            : Array.isArray(a.outFiles) && a.outFiles.length > 0
            ? a.outFiles
            : undefined;
        if (resolvedOutFiles) {
          finalLaunchArgs.outFiles = resolvedOutFiles;
        }

        const resolvedSourcemapLocations =
          Array.isArray((baseLaunchConfig as Record<string, unknown>).resolveSourceMapLocations)
            ? (baseLaunchConfig as Record<string, unknown>).resolveSourceMapLocations
            : Array.isArray((a as Record<string, unknown>).resolveSourceMapLocations)
            ? (a as Record<string, unknown>).resolveSourceMapLocations
            : undefined;
        if (resolvedSourcemapLocations) {
          finalLaunchArgs.resolveSourceMapLocations = resolvedSourcemapLocations;
        }

        console.info(
          `[JsDebugAdapterPolicy] [JS] Sending 'launch' for program='${finalLaunchArgs.program}' cwd='${finalLaunchArgs.cwd}'`
        );
        await pm.sendDapRequest('launch', finalLaunchArgs);
      } catch (e) {
        console.warn(`[JsDebugAdapterPolicy] [JS] 'launch' failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Multi-session architecture handles everything from here
    console.info(`[JsDebugAdapterPolicy] [JS] Handshake complete. Multi-session architecture now handling debugging.`);
  },

  /**
   * JavaScript adapter requires command queueing for proper initialization
   */
  requiresCommandQueueing: (): boolean => true,

  /**
   * Determine if a command should be queued based on JavaScript-specific state
   */
  shouldQueueCommand: (command: string, state: AdapterSpecificState): CommandHandling => {
    const jsState = state as JsAdapterState;
    
    // Don't queue 'initialize' - it goes through immediately
    if (command === 'initialize') {
      return { shouldQueue: false, shouldDefer: false };
    }
    
    // Gate all non-'initialize' requests until initialize response is received
    if (!jsState.initializeResponded) {
      return {
        shouldQueue: true,
        shouldDefer: false,
        reason: `Queuing '${command}' until 'initialize' response (JS adapter)`
      };
    }
    
    // Configuration commands must wait for 'initialized' event
    const configCommands = new Set([
      'setBreakpoints',
      'setFunctionBreakpoints', 
      'setExceptionBreakpoints',
      'setDataBreakpoints',
      'setInstructionBreakpoints',
      'configurationDone'
    ]);
    
    if (!jsState.initialized && configCommands.has(command)) {
      return {
        shouldQueue: true,
        shouldDefer: false,
        reason: `Queuing '${command}' until 'initialized' event (JS adapter)`
      };
    }
    
    // If launch/attach arrives before configurationDone, ensure strict ordering
    if ((command === 'launch' || command === 'attach') && !jsState.configurationDone) {
      return {
        shouldQueue: true,
        shouldDefer: true, // Signal that we need to inject configurationDone first
        reason: `JS: deferring '${command}' until configurationDone (strict order)`
      };
    }
    
    // Command can proceed normally
    return { shouldQueue: false, shouldDefer: false };
  },

  /**
   * Process queued commands in JavaScript-specific order
   */
  processQueuedCommands: <T extends QueuedDapCommand>(
    typedCommands: T[]
  ): T[] => {
    // Group commands by type for proper ordering
    const isConfig = (cmd: string) => [
      'setBreakpoints',
      'setFunctionBreakpoints',
      'setExceptionBreakpoints',
      'setDataBreakpoints',
      'setInstructionBreakpoints'
    ].includes(cmd);
    
    const configs = typedCommands.filter(p => isConfig(p.dapCommand));
    const configDone = typedCommands.filter(p => p.dapCommand === 'configurationDone');
    const launches = typedCommands.filter(p => p.dapCommand === 'launch' || p.dapCommand === 'attach');
    const others = typedCommands.filter(p => 
      !isConfig(p.dapCommand) && 
      p.dapCommand !== 'configurationDone' && 
      p.dapCommand !== 'launch' && 
      p.dapCommand !== 'attach'
    );
    
    // JS (js-debug) strict order: configs -> configurationDone -> starts -> others
    return [...configs, ...configDone, ...launches, ...others];
  },

  /**
   * Create initial state for JavaScript adapter
   */
  createInitialState: (): AdapterSpecificState => {
    return {
      initialized: false,
      configurationDone: false,
      initializeResponded: false,
      startSent: false,
      pendingCommands: []
    } as JsAdapterState;
  },

  /**
   * Update state when a command is sent
   */
  updateStateOnCommand: (command: string, _args: unknown, state: AdapterSpecificState): void => {
    const jsState = state as JsAdapterState;
    
    if (command === 'configurationDone') {
      jsState.configurationDone = true;
    } else if (command === 'launch' || command === 'attach') {
      jsState.startSent = true;
    }
  },

  /**
   * Update state when a command response is received
   */
  updateStateOnResponse: (command: string, _response: unknown, state: AdapterSpecificState): void => {
    const jsState = state as JsAdapterState;
    if (command === 'initialize') {
      jsState.initializeResponded = true;
    }
  },

  /**
   * Update state when an event is received
   */
  updateStateOnEvent: (event: string, _body: unknown, state: AdapterSpecificState): void => {
    const jsState = state as JsAdapterState;
    
    if (event === 'initialized') {
      jsState.initialized = true;
    }
  },

  /**
   * Check if JavaScript adapter is initialized
   */
  isInitialized: (state: AdapterSpecificState): boolean => {
    const jsState = state as JsAdapterState;
    return jsState.initialized && jsState.initializeResponded;
  },

  /**
   * Check if JavaScript adapter is connected
   */
  isConnected: (state: AdapterSpecificState): boolean => {
    // For JavaScript, we consider it connected once initialize response is received
    const jsState = state as JsAdapterState;
    return jsState.initializeResponded;
  },

  /**
   * Check if this policy applies to the given adapter command
   */
  matchesAdapter: (adapterCommand: { command: string; args: string[] }): boolean => {
    // Check for js-debug or pwa-node in command or arguments
    const commandStr = adapterCommand.command.toLowerCase();
    const argsStr = adapterCommand.args.join(' ').toLowerCase();
    
    return commandStr.includes('js-debug') || 
           commandStr.includes('pwa-node') ||
           commandStr.includes('vsdebugserver') ||
           argsStr.includes('js-debug') ||
           argsStr.includes('pwa-node') ||
           argsStr.includes('vsdebugserver');
  },

  /**
   * JavaScript adapter has special initialization requirements
   */
  getInitializationBehavior: () => {
    return {
      deferConfigDone: true,          // Inject configurationDone before launch/attach when ordering requires it
      addRuntimeExecutable: true,      // Needs to add runtimeExecutable to launch args
      trackInitializeResponse: true,   // Must track initialize response separately
      requiresInitialStop: true,       // Must ensure initial stop after launch/attach
      defaultStopOnEntry: false,       // Default to false unless user explicitly requests
      // js-debug filter IDs ('all' = caught + uncaught)
      exceptionFilters: {
        uncaught: ['uncaught'],
        all: ['all']
      },
      // Launch sessions pause at uncaught exceptions by default (issue #244)
      defaultExceptionBreakMode: 'uncaught'
    };
  },

  /**
   * JavaScript-specific DAP client behaviors
   */
  getDapClientBehavior: (): DapClientBehavior => {
    return {
      // Handle reverse startDebugging requests
      handleReverseRequest: async (request: DebugProtocol.Request, context: DapClientContext): Promise<ReverseRequestResult> => {
        if (request.command === 'startDebugging') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const args: any = (request as any)?.arguments ?? {};
          const cfg = args?.configuration ?? {};
          const pendingId: string | undefined = cfg?.__pendingTargetId;
          
          // Send acknowledgment. The early success ack is correct: js-debug
          // ignores the response body — a pending target is resolved only by
          // a fresh DAP connection attaching with its __pendingTargetId.
          context.sendResponse(request, {});

          if (pendingId && typeof pendingId === 'string') {
            // Bookkeeping invariant (issues #249/#501): the id is added here,
            // before the adoption/release runs; MinimalDapClient removes it
            // again when adoption throws or the release fails, so a re-sent
            // startDebugging can retry. Adopted and released targets stay
            // recorded — both are settled server-side.
            if (!context.adoptedTargets.has(pendingId)) {
              context.adoptedTargets.add(pendingId);
              return {
                handled: true,
                createChildSession: true,
                childConfig: {
                  host: cfg.host || 'localhost',
                  port: cfg.port || 9229,
                  pendingId,
                  parentConfig: cfg
                }
              };
            }
          }
          return { handled: true }; // Handled but no child session
        } else if (request.command === 'runInTerminal') {
          // Acknowledge without spawning terminal
          context.sendResponse(request, {});
          return { handled: true };
        }
        return { handled: false };
      },
      
      // Commands that should be routed to child sessions
      childRoutedCommands: new Set([
        'threads',
        'pause',
        'continue',
        'next',
        'stepIn',
        'stepOut',
        'stackTrace',
        'scopes',
        'variables',
        'evaluate',
        'exceptionInfo',
        'loadedSources',
        'source',
        'setVariable',
        'setExpression',
        'restart',
        'disconnect',
        'terminate',
        'goto',
        'restartFrame',
        'stepBack',
        'reverseContinue'
      ]),
      
      // JavaScript-specific child session behaviors
      mirrorBreakpointsToChild: true,
      pauseAfterChildAttach: true,
      stackTraceRequiresChild: true,

      // Commands that must not fall back to the parent when no child session
      // is available: js-debug's root session acks 'pause' as a silent no-op,
      // so a fallen-through pause "succeeds" but no stop can ever land
      // (issue #513). 'threads' is deliberately NOT listed — the parent's
      // empty threads response is load-bearing for the attach verify loop.
      childRequiredCommands: new Set(['pause']),
      
      // Normalize adapter ID for initialize
      normalizeAdapterId: (requestedId: string): string => {
        if (requestedId.toLowerCase() === 'javascript') {
          return 'pwa-node';
        }
        return requestedId;
      },
      
      // Timeouts
      childInitTimeout: 12000,
      suppressPostAttachConfigDone: false  // Child session needs configurationDone
    };
  },

  /**
   * Get the configuration for spawning the JavaScript debug adapter (js-debug/pwa-node)
   */
  getAdapterSpawnConfig: (payload) => {
    // JavaScript should always have a custom adapter command
    // since js-debug/pwa-node isn't a simple executable
    if (payload.adapterCommand) {
      return {
        mode: 'spawn',
        command: payload.adapterCommand.command,
        args: payload.adapterCommand.args,
        host: payload.adapterHost,
        port: payload.adapterPort,
        logDir: payload.logDir,
        env: payload.adapterCommand.env
      };
    }

    // Fallback - this shouldn't normally happen for JavaScript
    // as js-debug requires specific setup
    console.warn('[JsDebugAdapterPolicy] No adapter command provided - JavaScript debugging may not work correctly');
    return undefined;
  }
};

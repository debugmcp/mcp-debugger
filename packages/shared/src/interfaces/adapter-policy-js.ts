/**
 * JsDebugAdapterPolicy - policy for VS Code js-debug (pwa-node)
 *
 * Encodes js-debug specific multi-session behavior while preserving
 * generic DAP flow in core code.
 */
import type { DebugProtocol } from '@vscode/debugprotocol';
import type { AdapterPolicy, AdapterSpecificState, CommandHandling } from './adapter-policy.js';
import { SessionState } from '@debugmcp/shared';
import type { StackFrame, Variable } from '../models/index.js';
import type { DapClientBehavior, DapClientContext, ReverseRequestResult } from './dap-client-behavior.js';

/**
 * JavaScript-specific adapter state
 */
export interface JsAdapterState extends AdapterSpecificState {
  initializeResponded: boolean;
  startSent: boolean;
  pendingCommands: Array<{ requestId: string; dapCommand: string; dapArgs?: unknown }>;
}

export const JsDebugAdapterPolicy: AdapterPolicy = {
  name: 'js-debug',
  supportsReverseStartDebugging: true,
  childSessionStrategy: 'launchWithPendingTarget',
  shouldDeferParentConfigDone: () => true,
  buildChildStartArgs: (pendingId: string, parentConfig: Record<string, unknown>) => {
    const type = typeof parentConfig?.type === 'string' ? (parentConfig.type as string) : 'pwa-node';
    return {
      command: 'attach',
      args: {
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
   * Check if a stack frame is a Node.js internal frame
   */
  isInternalFrame: (frame: StackFrame): boolean => {
    // Node.js internal frames are identified by <node_internals> in the path
    const filePath = frame.file || '';
    return filePath.includes('<node_internals>');
  },
  
  /**
   * Filter stack frames to optionally remove Node.js internals
   */
  filterStackFrames: (frames: StackFrame[], includeInternals: boolean): StackFrame[] => {
    // If including internals, return all frames
    if (includeInternals) {
      return frames;
    }
    
    // Filter out internal frames
    const filtered = frames.filter(frame => !JsDebugAdapterPolicy.isInternalFrame!(frame));
    
    // Edge case: If all frames were filtered out, keep at least the first frame
    if (filtered.length === 0 && frames.length > 0) {
      return [frames[0]];
    }
    
    return filtered;
  },

  /**
   * Extract local variables for JavaScript, filtering out internals by default
   */
  extractLocalVariables: (
    stackFrames: StackFrame[],
    scopes: Record<number, DebugProtocol.Scope[]>,
    variables: Record<number, Variable[]>,
    includeSpecial: boolean = false
  ): Variable[] => {
    // Get the top frame
    if (!stackFrames || stackFrames.length === 0) {
      return [];
    }
    
    const topFrame = stackFrames[0];
    const frameScopes = scopes[topFrame.id];
    
    if (!frameScopes || frameScopes.length === 0) {
      return [];
    }
    
    // Find the "Local" scope (JavaScript may use "Local", "Local: functionName", etc.)
    let localScope = frameScopes.find(scope => 
      scope.name === 'Local' || 
      scope.name === 'Locals' ||
      scope.name.startsWith('Local:') ||
      scope.name.startsWith('Block:')
    );
    
    // Fallback: when debugging top-level scripts, js-debug reports "Script" or "Global" scopes
    if (!localScope) {
      localScope = frameScopes.find(scope => 
        scope.name === 'Script' ||
        scope.name === 'Module' ||
        scope.name === 'module' ||
        scope.name.toLowerCase().includes('global')
      );
    }
    
    if (!localScope) {
      return [];
    }
    
    // Get the variables for this scope
    let localVars = variables[localScope.variablesReference] || [];
    
    // Filter out special variables unless requested
    if (!includeSpecial) {
      localVars = localVars.filter(v => {
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
    
    return localVars;
  },
  
  /**
   * JavaScript uses various local scope names
   */
  getLocalScopeName: (): string[] => {
    return ['Local', 'Local:', 'Block:', 'Script', 'Global'];
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
   * Perform JavaScript-specific handshake sequence for js-debug/pwa-node.
   * This includes the strict initialization sequence required by js-debug.
   */
  performHandshake: async (context) => {
    const { proxyManager, sessionId, dapLaunchArgs, scriptPath, scriptArgs, breakpoints } = context;
    
    // Type assertion for proxyManager since we use 'unknown' in the interface
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pm = proxyManager as any; // Will be IProxyManager in actual usage
    
    if (!pm || !pm.isRunning()) {
      console.warn(
        `[JsDebugAdapterPolicy] performHandshake skipped: proxy manager not running for session ${sessionId}`
      );
      return;
    }

    // 1) initialize with supportsStartDebuggingRequest
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

    // 2) wait for DAP 'initialized'
    await new Promise<void>((resolve) => {
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        console.warn(`[JsDebugAdapterPolicy] [JS] Timeout waiting for DAP 'initialized' event`);
        resolve();
      }, 10000);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const onHandler = (event: any) => {
        if (done) return;
        // Handle both event object and string formats
        const eventName = typeof event === 'string' ? event : event?.event;
        if (eventName === 'initialized') {
          done = true;
          clearTimeout(timer);
          pm.removeListener('dap-event', onHandler);
          resolve();
        }
      };
      pm.on('dap-event', onHandler);
    });

    // 3) setExceptionBreakpoints + setBreakpoints
    try {
      console.info(`[JsDebugAdapterPolicy] [JS] Sending 'setExceptionBreakpoints' []`);
      await pm.sendDapRequest('setExceptionBreakpoints', { filters: [] });
    } catch (e) {
      console.warn(
        `[JsDebugAdapterPolicy] [JS] 'setExceptionBreakpoints' failed or unsupported: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }
    
    try {
      // Group queued breakpoints by file
      const grouped: Map<string, Array<{ line: number; condition?: string }>> = new Map();
      for (const bp of breakpoints.values()) {
        // Type assertion for bp since it's 'unknown' in the interface
        const breakpoint = bp as { file: string; line: number; condition?: string };
        const arr = grouped.get(breakpoint.file) || [];
        arr.push({ line: breakpoint.line, condition: breakpoint.condition });
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
    const a = dapLaunchArgs || {};
    const type = typeof a.type === 'string' ? a.type : 'pwa-node';
    const req = typeof a.request === 'string' ? a.request : 'launch';
    const attachPort =
      typeof a?.attachSimplePort === 'number'
        ? a.attachSimplePort
        : typeof a?.port === 'number'
        ? a.port
        : undefined;

    if (req === 'attach' && typeof attachPort === 'number' && attachPort > 0) {
      // Explicit ATTACH flow (single parent session); avoid DI ambiguity
      try {
        console.info(`[JsDebugAdapterPolicy] [JS] Sending 'attach' to ${attachPort} (address=127.0.0.1)`);
        await pm.sendDapRequest('attach', {
          type,
          request: 'attach',
          address: '127.0.0.1',
          port: attachPort,
          continueOnAttach: true,
          attachExistingChildren: true,
          attachSimplePort: attachPort
        });
      } catch (e) {
        console.warn(`[JsDebugAdapterPolicy] [JS] 'attach' failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else {
      // LAUNCH flow (default for MCP). Use adapter-configured policy; do not add parent attach-by-port afterward
      try {
        // Dynamic import to avoid circular dependency issues
        const path = await import('path');
        const cwd =
          typeof a?.cwd === 'string' && a?.cwd
            ? (a?.cwd as string)
            : (scriptPath ? path.dirname(scriptPath) : process.cwd());
        const launchArgs: Record<string, unknown> = {
          type,
          request: 'launch',
          program: scriptPath,
          cwd,
          args: Array.isArray(scriptArgs) ? scriptArgs : [],
          stopOnEntry: a?.stopOnEntry ?? false,
          justMyCode: a?.justMyCode ?? true,
          console: 'internalConsole',
          outputCapture: 'std',
          smartStep: true,
          // Use process.execPath to ensure we use the same Node.js that's running this process
          runtimeExecutable: process.execPath
        };
        // Pass through runtime overrides if provided (allow override of our default)
        if (typeof a?.runtimeExecutable === 'string') {
          launchArgs.runtimeExecutable = a.runtimeExecutable;
        }
        if (Array.isArray(a?.runtimeArgs)) {
          launchArgs.runtimeArgs = a.runtimeArgs;
        }

        console.info(`[JsDebugAdapterPolicy] [JS] Sending 'launch' for program='${scriptPath}' cwd='${cwd}'`);
        await pm.sendDapRequest('launch', launchArgs);
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
  processQueuedCommands: (
    commands: unknown[]
  ): unknown[] => {
    // Cast to the expected type for internal processing
    const typedCommands = commands as Array<{ requestId: string; dapCommand: string; dapArgs?: unknown }>;
    
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
    
    if (command === 'initialize') {
      // Will mark initializeResponded when we get the response
    } else if (command === 'configurationDone') {
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
           commandStr.includes('vsDebugServer') ||
           argsStr.includes('js-debug') || 
           argsStr.includes('pwa-node') ||
           argsStr.includes('vsDebugServer');
  },

  /**
   * JavaScript adapter has special initialization requirements
   */
  getInitializationBehavior: () => {
    return {
      deferConfigDone: true,          // Must defer configurationDone until after launch/attach
      addRuntimeExecutable: true,      // Needs to add runtimeExecutable to launch args
      trackInitializeResponse: true,   // Must track initialize response separately
      requiresInitialStop: true        // Must ensure initial stop after launch/attach
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
          
          // Send acknowledgment
          context.sendResponse(request, {});
          
          if (pendingId && typeof pendingId === 'string') {
            // Check if not already adopted
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
      deferParentConfigDone: true,
      pauseAfterChildAttach: true,
      stackTraceRequiresChild: true,
      
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

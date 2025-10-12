/**
 * JsDebugAdapterPolicy - policy for VS Code js-debug (pwa-node)
 *
 * Encodes js-debug specific multi-session behavior while preserving
 * generic DAP flow in core code.
 */
import type { DebugProtocol } from '@vscode/debugprotocol';
import type { AdapterPolicy } from './adapter-policy.js';
import type { StackFrame, Variable } from '../models/index.js';

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
        continueOnAttach: false
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
    const localScope = frameScopes.find(scope => 
      scope.name === 'Local' || 
      scope.name === 'Locals' ||
      scope.name.startsWith('Local:') ||
      scope.name.startsWith('Block:')
    );
    
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
    return ['Local', 'Local:', 'Block:'];
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
  }
};

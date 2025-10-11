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
  }
};

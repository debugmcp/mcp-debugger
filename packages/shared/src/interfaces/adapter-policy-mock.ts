/**
 * MockAdapterPolicy - policy for Mock Debug Adapter (testing)
 *
 * Encodes mock adapter behaviors for testing purposes.
 */
import type { DebugProtocol } from '@vscode/debugprotocol';
import type { AdapterPolicy } from './adapter-policy.js';
import type { StackFrame, Variable } from '../models/index.js';

export const MockAdapterPolicy: AdapterPolicy = {
  name: 'mock',
  supportsReverseStartDebugging: false,
  childSessionStrategy: 'none',
  shouldDeferParentConfigDone: () => false,
  buildChildStartArgs: () => {
    throw new Error('MockAdapterPolicy does not support child sessions');
  },
  isChildReadyEvent: (evt: DebugProtocol.Event): boolean => {
    return evt?.event === 'initialized';
  },
  
  /**
   * Mock adapter doesn't need stack frame filtering
   */
  filterStackFrames: (frames: StackFrame[], includeInternals: boolean): StackFrame[] => {
    // Mock adapter returns all frames as-is
    return frames;
  },
  
  /**
   * Extract local variables for mock adapter (simple implementation)
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
    
    // Find the first scope (mock adapter has simple scopes)
    const localScope = frameScopes[0];
    
    if (!localScope) {
      return [];
    }
    
    // Return all variables for mock adapter
    return variables[localScope.variablesReference] || [];
  },
  
  /**
   * Mock adapter uses simple scope names
   */
  getLocalScopeName: (): string[] => {
    return ['Local', 'Locals'];
  },
  
  getDapAdapterConfiguration: () => {
    return {
      type: 'mock'  // Mock adapter type for testing
    };
  },
  
  resolveExecutablePath: (providedPath?: string) => {
    // Mock adapter doesn't need a real executable
    // Return 'mock' as a placeholder
    return providedPath || 'mock';
  },
  
  getDebuggerConfiguration: () => {
    return {
      // Mock adapter configuration for testing
      requiresStrictHandshake: false,
      skipConfigurationDone: false,
      supportsVariableType: false  // Mock adapter has simple variable support
    };
  }
};

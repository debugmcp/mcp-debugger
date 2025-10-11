/**
 * PythonAdapterPolicy - policy for Python Debug Adapter (debugpy)
 *
 * Encodes debugpy specific behaviors and variable handling logic.
 */
import type { DebugProtocol } from '@vscode/debugprotocol';
import type { AdapterPolicy } from './adapter-policy.js';
import type { StackFrame, Variable } from '../models/index.js';

export const PythonAdapterPolicy: AdapterPolicy = {
  name: 'python',
  supportsReverseStartDebugging: false,
  childSessionStrategy: 'none',
  shouldDeferParentConfigDone: () => false,
  buildChildStartArgs: () => {
    throw new Error('PythonAdapterPolicy does not support child sessions');
  },
  isChildReadyEvent: (evt: DebugProtocol.Event): boolean => {
    return evt?.event === 'initialized';
  },
  
  /**
   * Extract local variables for Python, filtering out special variables by default
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
    
    // Find the "Locals" scope (Python uses "Locals")
    const localScope = frameScopes.find(scope => 
      scope.name === 'Locals' || scope.name === 'Local'
    );
    
    if (!localScope) {
      return [];
    }
    
    // Get the variables for this scope
    let localVars = variables[localScope.variablesReference] || [];
    
    // Filter out special variables unless requested
    if (!includeSpecial) {
      localVars = localVars.filter(v => {
        // Filter out Python special/internal variables
        const name = v.name;
        
        // Skip special variables category
        if (name === 'special variables' || name === 'function variables') {
          return false;
        }
        
        // Skip dunder variables unless they're commonly used ones
        if (name.startsWith('__') && name.endsWith('__')) {
          // Keep common ones like __name__, __file__ if desired
          const keepDunders = ['__name__', '__file__', '__doc__'];
          return keepDunders.includes(name);
        }
        
        // Skip internal debugger variables
        if (name.startsWith('_pydev') || name === '_') {
          return false;
        }
        
        return true;
      });
    }
    
    return localVars;
  },
  
  /**
   * Python uses "Locals" for local variables scope
   */
  getLocalScopeName: (): string[] => {
    return ['Locals'];
  }
};

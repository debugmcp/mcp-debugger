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
  },
  
  getDapAdapterConfiguration: () => {
    return {
      type: 'debugpy'  // Python Debug Adapter Protocol type
    };
  },
  
  resolveExecutablePath: (providedPath?: string) => {
    // Python-specific executable path resolution
    // Priority: provided path > PYTHON_PATH env > default python command
    if (providedPath) {
      return providedPath;
    }
    
    // Check environment variable for Python path
    if (process.env.PYTHON_PATH) {
      return process.env.PYTHON_PATH;
    }
    
    // Default to 'python' command in PATH
    return 'python';
  },
  
  getDebuggerConfiguration: () => {
    return {
      // Python debugger configuration
      requiresStrictHandshake: false,
      skipConfigurationDone: false,
      supportsVariableType: true  // Python debugpy supports variable type information
    };
  },
  
  /**
   * Validate that a Python command is a real Python executable, not a Windows Store alias.
   * This validation is critical on Windows to avoid false positives.
   */
  validateExecutable: async (pythonCmd: string): Promise<boolean> => {
    // Import spawn dynamically to avoid issues in browser environments
    const { spawn } = await import('child_process');
    
    return new Promise((resolve) => {
      const child = spawn(pythonCmd, ['-c', 'import sys; sys.exit(0)'], {
        stdio: ['ignore', 'ignore', 'pipe'],
      });

      let stderrData = '';
      child.stderr?.on('data', (data) => {
        stderrData += data.toString();
      });

      child.on('error', () => resolve(false));
      child.on('exit', (code) => {
        const storeAlias =
          code === 9009 ||
          stderrData.includes('Microsoft Store') ||
          stderrData.includes('Windows Store') ||
          stderrData.includes('AppData\\Local\\Microsoft\\WindowsApps');
        if (storeAlias) {
          // Windows Store alias detected - not a valid Python
          resolve(false);
        } else {
          resolve(code === 0);
        }
      });
    });
  }
};

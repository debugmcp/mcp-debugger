/**
 * Python Adapter Factory
 * 
 * Factory for creating Python debug adapter instances.
 * Implements the adapter factory interface for dependency injection.
 * 
 * @since 2.0.0
 */
import { IDebugAdapter } from '../debug-adapter-interface.js';
import { IAdapterFactory, AdapterDependencies, AdapterMetadata, FactoryValidationResult } from '../adapter-registry-interface.js';
import { PythonDebugAdapter } from './python-debug-adapter.js';
import { DebugLanguage } from '../../session/models.js';
import { findPythonExecutable, getPythonVersion } from '../../utils/python-utils.js';
import { spawn } from 'child_process';

/**
 * Factory for creating Python debug adapters
 */
export class PythonAdapterFactory implements IAdapterFactory {
  /**
   * Create a new Python debug adapter instance
   */
  createAdapter(dependencies: AdapterDependencies): IDebugAdapter {
    return new PythonDebugAdapter(dependencies);
  }
  
  /**
   * Get metadata about the Python adapter
   */
  getMetadata(): AdapterMetadata {
    return {
      language: DebugLanguage.PYTHON,
      displayName: 'Python',
      version: '2.0.0',
      author: 'mcp-debugger team',
      description: 'Debug Python applications using debugpy',
      documentationUrl: 'https://github.com/debugmcp/mcp-debugger/docs/python',
      minimumDebuggerVersion: '1.0.0',
      fileExtensions: ['.py', '.pyw'],
      icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+PHBhdGggZmlsbD0iIzE5NzZEMiIgZD0iTTI0LjA0NywyLjAyOWMtMTMuMzM5LDAtMTMuOTcyLDUuNzk0LTEzLjk3Miw1Ljc5NGwwLjAxNSw2LjAyNGgxNC4yMjN2MS44MDdINi4wODNzLTkuNTkzLTEuMDg3LTkuNTkzLDEzLjk3M2MwLDE1LjA1OSw4LjM3MywxNC41MTgsOC4zNzMsMTQuNTE4aDQuOTk2di02Ljk4OHMtMC4yNjktNy44MzcsOC4yLTguMjI1YzguNDY5LTAuMzg5LDE0LjAyNC0wLjAzOSwxNC4wMjQtMC4wMzlzOC4xNTktMC4xMjksOC4zNTItOC4yMzhjMC4xOTItOC4xMSwwLjMxOS0xMy40MzYsMC4zMTktMTMuNDM2UzM3LjM4NiwyLjAyOSwyNC4wNDcsMi4wMjl6IE0xNy41MzYsNi44MDdjMS4yNzgsMCwyLjMxNCwxLjAzNiwyLjMxNCwyLjMxNGMwLDEuMjc5LTEuMDM2LDIuMzE0LTIuMzE0LDIuMzE0cy0yLjMxNC0xLjAzNi0yLjMxNC0yLjMxNEMxNS4yMjEsNy44NDMsMTYuMjU3LDYuODA3LDE3LjUzNiw2LjgwN3oiLz48cGF0aCBmaWxsPSIjRkZDMTA3IiBkPSJNMjMuOTUzLDQ1Ljk3MWMxMy4zMzksMCwxMy45NzItNS43OTQsMTMuOTcyLTUuNzk0bC0wLjAxNS02LjAyNEgyMy42ODd2LTEuODA3SDE0MS45MTdzOS41OTMsMS4wODcsOS41OTMtMTMuOTczYzAtMTUuMDU5LTguMzczLTE0LjUxOC04LjM3My0xNC41MThoLTQuOTk2djYuOTg4czAuMjY5LDcuODM3LTguMiw4LjIyNWMtOC40NjksMC4zODktMTQuMDI0LDAuMDM5LTE0LjAyNCwwLjAzOXMtOC4xNTksMC4xMjktOC4zNTIsOC4yMzhjLTAuMTkyLDguMTEtMC4zMTksMTMuNDM2LTAuMzE5LDEzLjQzNlMxMC42MTQsNDUuOTcxLDIzLjk1Myw0NS45NzF6IE0zMC40NjQsNDEuMTkzYy0xLjI3OCwwLTIuMzE0LTEuMDM2LTIuMzE0LTIuMzE0YzAtMS4yNzksMS4wMzYtMi4zMTQsMi4zMTQtMi4zMTRzMi4zMTQsMS4wMzYsMi4zMTQsMi4zMTRDMzIuNzc5LDQwLjE1NywzMS43NDMsNDEuMTkzLDMwLjQ2NCw0MS4xOTN6Ii8+PC9zdmc+'
    };
  }
  
  /**
   * Validate that the factory can create adapters in current environment
   */
  async validate(): Promise<FactoryValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let pythonPath: string | undefined;
    let pythonVersion: string | undefined;
    
    try {
      // Check Python executable
      pythonPath = await findPythonExecutable();
      
      // Check Python version
      pythonVersion = await getPythonVersion(pythonPath) || undefined;
      if (pythonVersion) {
        const [major, minor] = pythonVersion.split('.').map(Number);
        if (major < 3 || (major === 3 && minor < 7)) {
          errors.push(`Python 3.7 or higher required. Current version: ${pythonVersion}`);
        }
      } else {
        warnings.push('Could not determine Python version');
      }
      
      // Check debugpy installation
      const hasDebugpy = await this.checkDebugpyInstalled(pythonPath);
      if (!hasDebugpy) {
        errors.push('debugpy not installed. Run: pip install debugpy');
      }
      
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Python executable not found');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      details: {
        pythonPath,
        pythonVersion,
        pythonDetectionMethod: process.platform === 'win32' ? 'py launcher' : 'python3',
        platform: process.platform,
        timestamp: new Date().toISOString()
      }
    };
  }
  
  /**
   * Check if debugpy is installed
   */
  private checkDebugpyInstalled(pythonPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn(pythonPath, ['-c', 'import debugpy; print(debugpy.__version__)'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let output = '';
      child.stdout?.on('data', (data) => { output += data.toString(); });
      
      child.on('error', () => resolve(false));
      child.on('exit', (code) => {
        resolve(code === 0 && output.trim().length > 0);
      });
    });
  }
}

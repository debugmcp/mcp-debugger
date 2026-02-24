/**
 * Go Adapter Factory
 * 
 * Factory for creating Go debug adapter instances.
 * Implements the adapter factory interface for dependency injection.
 * 
 * @since 0.1.0
 */
import { IDebugAdapter } from '@debugmcp/shared';
import { IAdapterFactory, AdapterDependencies, AdapterMetadata, FactoryValidationResult } from '@debugmcp/shared';
import { GoDebugAdapter } from './go-debug-adapter.js';
import { DebugLanguage } from '@debugmcp/shared';
import { findGoExecutable, findDelveExecutable, getGoVersion, getDelveVersion, checkDelveDapSupport } from './utils/go-utils.js';

/**
 * Factory for creating Go debug adapters
 */
export class GoAdapterFactory implements IAdapterFactory {
  /**
   * Create a new Go debug adapter instance
   */
  createAdapter(dependencies: AdapterDependencies): IDebugAdapter {
    return new GoDebugAdapter(dependencies);
  }
  
  /**
   * Get metadata about the Go adapter
   */
  getMetadata(): AdapterMetadata {
    return {
      language: DebugLanguage.GO,
      displayName: 'Go',
      version: '0.1.0',
      author: 'mcp-debugger team',
      description: 'Debug Go applications using Delve (dlv)',
      documentationUrl: 'https://github.com/debugmcp/mcp-debugger/docs/go',
      minimumDebuggerVersion: '0.17.0',
      fileExtensions: ['.go'],
      // Go gopher icon in SVG format (base64 encoded)
      icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4Ij48cGF0aCBmaWxsPSIjMDBBREQ4IiBkPSJNNjQgMUM0MC44IDEgMTkgMTEuNyAxOSAyNS40YzAgNC4xIDIuNCA3LjggNy4xIDExLjFDMTUuNCAgNDAgNiA0Ny42IDYgNTYuNGMwIDEyLjUgMTguOCAyMS4xIDQzLjMgMjJWMTA5YzAgNC40IDYuNyA4IDE0LjcgOHMxNC43LTMuNiAxNC43LTh2LTMwLjZDMTAzLjIgNzcuNSAxMjIgNjguOSAxMjIgNTYuNGMwLTguOC05LjQtMTYuNC0yMC4xLTE5LjkgNC43LTMuMyA3LjEtNyA3LjEtMTEuMUMxMDkgMTEuNyA4Ny4yIDEgNjQgMXptMCAzYzIxLjIgMCA0MiA5LjUgNDIgMjEuNFM4NS4yIDQ2LjggNjQgNDYuOCAyMiAzNy4zIDIyIDI1LjRTNDIuOCA0IDY0IDR6Ii8+PC9zdmc+'
    };
  }
  
  /**
   * Validate that the factory can create adapters in current environment
   */
  async validate(): Promise<FactoryValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let goPath: string | undefined;
    let goVersion: string | undefined;
    let dlvPath: string | undefined;
    let dlvVersion: string | undefined;
    
    try {
      // Check Go executable
      goPath = await findGoExecutable();
      
      // Check Go version
      goVersion = await getGoVersion(goPath) || undefined;
      if (goVersion) {
        const [major, minor] = goVersion.split('.').map(Number);
        if (major < 1 || (major === 1 && minor < 18)) {
          errors.push(`Go 1.18 or higher required. Current version: ${goVersion}`);
        }
      } else {
        warnings.push('Could not determine Go version');
      }
      
      // Check Delve installation
      try {
        dlvPath = await findDelveExecutable();
        dlvVersion = await getDelveVersion(dlvPath) || undefined;
        
        const dapCheck = await checkDelveDapSupport(dlvPath);
        if (!dapCheck.supported) {
          const stderrHint = dapCheck.stderr ? ` (stderr: ${dapCheck.stderr})` : '';
          errors.push(`Delve does not support DAP mode. Update with: go install github.com/go-delve/delve/cmd/dlv@latest${stderrHint}`);
        }
      } catch {
        errors.push('Delve (dlv) not found. Install with: go install github.com/go-delve/delve/cmd/dlv@latest');
      }
      
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Go executable not found');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      details: {
        goPath,
        goVersion,
        dlvPath,
        dlvVersion,
        platform: process.platform,
        arch: process.arch,
        timestamp: new Date().toISOString()
      }
    };
  }
}

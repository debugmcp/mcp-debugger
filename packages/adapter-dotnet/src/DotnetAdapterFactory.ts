/**
 * .NET Adapter Factory
 *
 * Factory for creating .NET debug adapter instances.
 * Implements the adapter factory interface for dependency injection.
 *
 * @since 0.1.0
 */
import { IDebugAdapter } from '@debugmcp/shared';
import { IAdapterFactory, AdapterDependencies, AdapterMetadata, FactoryValidationResult } from '@debugmcp/shared';
import { DotnetDebugAdapter } from './DotnetDebugAdapter.js';
import { DebugLanguage } from '@debugmcp/shared';
import { findDotnetBackend } from './utils/dotnet-utils.js';

/**
 * Factory for creating .NET debug adapters
 */
export class DotnetAdapterFactory implements IAdapterFactory {
  /**
   * Create a new .NET debug adapter instance
   */
  createAdapter(dependencies: AdapterDependencies): IDebugAdapter {
    return new DotnetDebugAdapter(dependencies);
  }

  /**
   * Get metadata about the .NET adapter
   */
  getMetadata(): AdapterMetadata {
    return {
      language: DebugLanguage.DOTNET,
      displayName: '.NET/C#',
      version: '0.1.0',
      author: 'mcp-debugger team',
      description: 'Debug .NET applications using vsdbg or netcoredbg',
      documentationUrl: 'https://github.com/debugmcp/mcp-debugger/docs/dotnet',
      minimumDebuggerVersion: '1.0.0',
      fileExtensions: ['.cs', '.vb', '.fs'],
      icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+PHBhdGggZmlsbD0iIzY3MzhCNyIgZD0iTTI0IDRDMTIuOTU0IDQgNCA1LjgxOCA0IDguNTc0VjM5LjQyNkM0IDQyLjE4MiAxMi45NTQgNDQgMjQgNDRzMjAtMS44MTggMjAtNC41NzRWOC41NzRDNDQgNS44MTggMzUuMDQ2IDQgMjQgNHptMCA2YzguMjg0IDAgMTUgMS43OTEgMTUgNHMtNi43MTYgNC0xNSA0UzkgMTYuMjA5IDkgMTRzNi43MTYtNCAxNS00eiIvPjx0ZXh0IHg9IjI0IiB5PSIzMiIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPi5ORVQ8L3RleHQ+PC9zdmc+'
    };
  }

  /**
   * Validate that the factory can create adapters in current environment
   */
  async validate(): Promise<FactoryValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let debuggerPath: string | undefined;
    let backendType: string | undefined;

    try {
      const result = await findDotnetBackend();
      debuggerPath = result.path;
      backendType = result.backend;

      if (result.backend === 'netcoredbg') {
        warnings.push(
          'Using netcoredbg. For .NET Framework 4.8 support (NinjaTrader), install the C# extension in VS Code to get vsdbg.'
        );
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : '.NET debugger not found');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      details: {
        debuggerPath,
        backendType,
        platform: process.platform,
        timestamp: new Date().toISOString()
      }
    };
  }
}

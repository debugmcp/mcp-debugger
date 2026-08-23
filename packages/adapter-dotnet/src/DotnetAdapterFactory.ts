/**
 * .NET Adapter Factory
 *
 * Factory for creating .NET debug adapter instances using netcoredbg.
 * Implements the adapter factory interface for dependency injection.
 *
 * @since 0.2.0
 */
import { IDebugAdapter } from '@debugmcp/shared';
import { IAdapterFactory, AdapterDependencies, AdapterMetadata, FactoryValidationResult, ToolchainDescription } from '@debugmcp/shared';
import { toolchainComponent } from '@debugmcp/shared';
import { DotnetDebugAdapter } from './DotnetDebugAdapter.js';
import { DebugLanguage } from '@debugmcp/shared';
import { findNetcoredbgExecutable, getNetcoredbgVersion, getDotnetSdkVersion } from './utils/dotnet-utils.js';

/**
 * The details shape validate() emits and describeToolchain() reads — keeping
 * producer and consumer on one alias makes key renames compiler-checked
 * within this package (issue #435).
 */
type DotnetToolchainDetails = {
  debuggerPath?: string;
  backend: string;
  platform: string;
  timestamp: string;
};

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
      version: '0.2.0',
      author: 'mcp-debugger team',
      description: 'Debug .NET applications using netcoredbg (supports .NET Core and .NET Framework 4.8)',
      documentationUrl: 'https://github.com/debugmcp/mcp-debugger/docs/dotnet',
      minimumDebuggerVersion: '1.0.0',
      fileExtensions: ['.cs', '.vb', '.fs'],
      // Attach spawns netcoredbg locally
      modes: { launch: true, attach: 'spawn' },
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

    try {
      debuggerPath = await findNetcoredbgExecutable();
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'netcoredbg not found');
    }

    const details: DotnetToolchainDetails = {
      debuggerPath,
      backend: 'netcoredbg',
      platform: process.platform,
      timestamp: new Date().toISOString()
    };
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      details
    };
  }

  /**
   * Doctor row (issue #435): the version probes that used to live in the
   * doctor CLI's extras path run here instead, in parallel and best-effort —
   * a failed probe just leaves its cell field empty.
   */
  async describeToolchain(validation: FactoryValidationResult): Promise<ToolchainDescription> {
    const details = (validation.details ?? {}) as Partial<DotnetToolchainDetails>;
    const debuggerPath = details.debuggerPath;
    const [netcoredbgVersion, sdkVersion] = await Promise.all([
      debuggerPath ? getNetcoredbgVersion(debuggerPath).catch(() => null) : Promise.resolve(null),
      getDotnetSdkVersion().catch(() => null)
    ]);
    return {
      runtime: toolchainComponent({ label: '.NET SDK', version: sdkVersion ?? undefined }),
      backend: toolchainComponent({
        label: 'netcoredbg',
        path: debuggerPath,
        version: netcoredbgVersion ?? undefined
      })
    };
  }
}

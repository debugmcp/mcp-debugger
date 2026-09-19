/**
 * COBOL Adapter Factory (issue #759)
 */
import type { IDebugAdapter, IAdapterFactory, AdapterDependencies, AdapterMetadata, FactoryValidationResult, ToolchainDescription, DescribeToolchainOptions } from '@debugmcp/shared';
import { toolchainComponent, probeWithinBudget, DebugLanguage } from '@debugmcp/shared';
import { resolveCodeLLDBExecutableWithSource, getCodeLLDBVersion } from '@debugmcp/codelldb-common';
import { CobolDebugAdapter } from './cobol-debug-adapter.js';
import { findCobc, probeCobcVersion } from './build/index.js';

/** validate() writes it, describeToolchain() reads it — one alias keeps key renames compiler-checked (#435). */
type CobolToolchainDetails = {
  codelldbPath?: string;
  codelldbVersion?: string;
  codelldbSource?: string;
  cobcPath?: string;
  cobcVersion?: string;
  cobcConfigDir?: string;
  platform: string;
  arch: string;
  timestamp: string;
};

export class CobolAdapterFactory implements IAdapterFactory {
  createAdapter(dependencies: AdapterDependencies): IDebugAdapter {
    return new CobolDebugAdapter(dependencies);
  }

  getMetadata(): AdapterMetadata {
    return {
      language: DebugLanguage.COBOL,
      displayName: 'COBOL',
      version: '0.1.0',
      author: 'mcp-debugger team',
      description: 'Debug GnuCOBOL programs using CodeLLDB with COBOL-shaped variables',
      documentationUrl: 'https://github.com/debugmcp/mcp-debugger/docs/cobol',
      minimumDebuggerVersion: '1.0.0',
      fileExtensions: ['.cob', '.cbl', '.cobol', '.cpy'],
      // Attach-by-PID spawns the shim + vendored CodeLLDB locally (no compiler needed)
      modes: { launch: true, attach: 'spawn' }
    };
  }

  async validate(): Promise<FactoryValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let codelldbPath: string | undefined;
    let codelldbVersion: string | undefined;
    let codelldbSource: string | undefined;

    const resolvedCodelldb = await resolveCodeLLDBExecutableWithSource();
    if (!resolvedCodelldb) {
      errors.push('CodeLLDB not found. It normally ships via the @debugmcp/codelldb-* optional dependencies; set CODELLDB_PATH, or in a repo checkout run: pnpm install (vendors CodeLLDB)');
    } else {
      codelldbPath = resolvedCodelldb.path;
      codelldbSource = resolvedCodelldb.source;
      codelldbVersion = (await getCodeLLDBVersion()) || undefined;
    }

    const cobc = await findCobc();
    if (!cobc) {
      warnings.push('GnuCOBOL (cobc) not found. Prebuilt-executable debugging still works at the engine level; install GnuCOBOL 3.1.2+ (or set COBC_PATH) for source launch and COBOL-shaped variables.');
    }

    const details: CobolToolchainDetails = {
      codelldbPath,
      codelldbVersion,
      codelldbSource,
      cobcPath: cobc?.path,
      cobcVersion: cobc?.version ?? undefined,
      cobcConfigDir: cobc?.configDir,
      platform: process.platform,
      arch: process.arch,
      timestamp: new Date().toISOString()
    };
    return { valid: errors.length === 0, errors, warnings, details };
  }

  /**
   * Doctor row: the runtime cell is GnuCOBOL (cobc path + version), the backend
   * cell is CodeLLDB. Reuses validate()'s discovery; the banner probe runs inside
   * the advisory budget so the row never blanks on a slow toolchain.
   */
  async describeToolchain(validation: FactoryValidationResult, options?: DescribeToolchainOptions): Promise<ToolchainDescription> {
    const details = (validation.details ?? {}) as Partial<CobolToolchainDetails>;
    let cobcVersion = details.cobcVersion;
    if (details.cobcPath && !cobcVersion) {
      const banner = await probeWithinBudget(options?.timeoutMs, () => probeCobcVersion(details.cobcPath as string));
      cobcVersion = banner ?? undefined;
    }
    return {
      runtime: toolchainComponent({
        label: 'GnuCOBOL (cobc)',
        path: details.cobcPath,
        version: cobcVersion
      }),
      backend: toolchainComponent({
        label: 'CodeLLDB',
        path: details.codelldbPath,
        version: details.codelldbVersion,
        source: details.codelldbSource
      })
    };
  }
}

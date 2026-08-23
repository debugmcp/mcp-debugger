/**
 * C/C++ Adapter Factory
 *
 * Factory for creating C/C++ debug adapter instances.
 * Implements the adapter factory interface for dependency injection.
 */
import { IDebugAdapter } from '@debugmcp/shared';
import { IAdapterFactory, AdapterDependencies, AdapterMetadata, FactoryValidationResult, ToolchainDescription } from '@debugmcp/shared';
import { toolchainComponent } from '@debugmcp/shared';
import { CppDebugAdapter } from './cpp-debug-adapter.js';
import { DebugLanguage } from '@debugmcp/shared';
import { resolveCodeLLDBExecutableWithSource, getCodeLLDBVersion } from '@debugmcp/codelldb-common';
import { findAnyCompiler, getCompilerInfo } from './utils/compile-utils.js';

/**
 * The details shape validate() emits and describeToolchain() reads — keeping
 * producer and consumer on one alias makes key renames compiler-checked
 * within this package (issue #435).
 */
type CppToolchainDetails = {
  codelldbPath?: string;
  codelldbVersion?: string;
  codelldbSource?: string;
  compiler?: string;
  platform: string;
  arch: string;
  timestamp: string;
};

/**
 * Factory for creating C/C++ debug adapters
 */
export class CppAdapterFactory implements IAdapterFactory {
  /**
   * Create a new C/C++ debug adapter instance
   */
  createAdapter(dependencies: AdapterDependencies): IDebugAdapter {
    return new CppDebugAdapter(dependencies);
  }

  /**
   * Get metadata about the C/C++ adapter
   */
  getMetadata(): AdapterMetadata {
    return {
      language: DebugLanguage.CPP,
      displayName: 'C/C++',
      version: '0.1.0',
      author: 'mcp-debugger team',
      description: 'Debug C and C++ applications using CodeLLDB',
      documentationUrl: 'https://github.com/debugmcp/mcp-debugger/docs/cpp',
      minimumDebuggerVersion: '1.0.0',
      fileExtensions: ['.c', '.cpp', '.cc', '.cxx', '.h', '.hpp'],
      // Attach-by-PID spawns vendored CodeLLDB locally (no compiler needed)
      modes: { launch: true, attach: 'spawn' },
      icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4Ij48cGF0aCBmaWxsPSIjNjU5YWQyIiBkPSJNMTE1LjQgMzAuN2wtNDgtMjcuOWMtMS0uNS0yLjItLjgtMy40LS44cy0yLjQuMy0zLjQuOGwtNDggMjhjLTEuOSAxLjEtMy40IDMuNy0zLjQgNS45djU1LjdjMCAxLjEuMiAyLjMuOSAzLjRsLTEwNi42LTYyeiIvPjxwYXRoIGZpbGw9IiMwMDU5OWMiIGQ9Ik0xMC43IDk1LjNjLjUuOCAxLjIgMS41IDEuOSAxLjlsNDcuOSAyNy45YzEgLjUgMi4yLjggMy40LjhzMi40LS4zIDMuNC0uOGw0OC0yNy45YzEuOS0xLjEgMy40LTMuNyAzLjQtNS45di01NS43YzAtMS4xLS4yLTIuMy0uOS0zLjRsLTEwNy4xIDYzLjF6Ii8+PHBhdGggZmlsbD0iI2ZmZiIgZD0iTTg1LjMgNzYuMWMtNC4yIDcuNC0xMi4yIDEyLjQtMjEuMyAxMi40LTEzLjUgMC0yNC41LTExLTI0LjUtMjQuNXMxMS0yNC41IDI0LjUtMjQuNWM5LjEgMCAxNy4xIDUgMjEuMyAxMi41bDEzLTcuNWMtNi44LTExLjktMTkuNi0yMC0zNC4zLTIwLTIxLjggMC0zOS41IDE3LjctMzkuNSAzOS41czE3LjcgMzkuNSAzOS41IDM5LjVjMTQuNiAwIDI3LjQtOCAzNC4yLTE5LjhsLTEyLjktNy42eiIvPjwvc3ZnPg=='
    };
  }

  /**
   * Validate that the factory can create adapters in current environment
   */
  async validate(): Promise<FactoryValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let codelldbPath: string | undefined;
    let codelldbVersion: string | undefined;
    let codelldbSource: string | undefined;
    let compiler: string | undefined;

    // Check CodeLLDB — the only hard requirement
    const resolvedCodelldb = await resolveCodeLLDBExecutableWithSource();
    if (!resolvedCodelldb) {
      errors.push('CodeLLDB not found. It normally ships via the @debugmcp/codelldb-* optional dependencies; set CODELLDB_PATH, or in a repo checkout run: npm run build:adapter');
    } else {
      codelldbPath = resolvedCodelldb.path;
      codelldbSource = resolvedCodelldb.source;
      codelldbVersion = await getCodeLLDBVersion() || undefined;
    }

    // A compiler is only needed for source-file launch
    const foundCompiler = await findAnyCompiler();
    if (!foundCompiler) {
      warnings.push('No C/C++ compiler found. Prebuilt-binary debugging still works; install g++/clang++ for source-file launch.');
    } else {
      compiler = foundCompiler;
    }

    const details: CppToolchainDetails = {
      codelldbPath,
      codelldbVersion,
      codelldbSource,
      compiler,
      platform: process.platform,
      arch: process.arch,
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
   * Doctor row (issue #435): reuses the validate()-discovered compiler
   * command instead of re-probing the whole candidate list; the --version
   * banner already names the command, so the bare command only shows when no
   * banner was captured.
   */
  async describeToolchain(validation: FactoryValidationResult): Promise<ToolchainDescription> {
    const details = (validation.details ?? {}) as Partial<CppToolchainDetails>;
    let compilerVersion: string | undefined;
    if (details.compiler) {
      const info = await getCompilerInfo(details.compiler).catch(() => null);
      compilerVersion = info?.version ?? undefined;
    }
    return {
      runtime: toolchainComponent({
        label: 'C/C++ compiler',
        path: compilerVersion ? undefined : details.compiler,
        version: compilerVersion
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

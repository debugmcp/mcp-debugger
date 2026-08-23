/**
 * Re-export shim — the CodeLLDB resolver moved to @debugmcp/codelldb-common
 * (issue #324) so CodeLLDB-backed adapters share one vendored copy.
 *
 * This module keeps adapter-rust's historical import path and public surface
 * stable: package tests vi.mock this specifier, and index.ts re-exports from
 * here. Do not import @debugmcp/codelldb-common directly from adapter source —
 * route through this shim so the test mocks keep intercepting.
 */
export {
  DEFAULT_CODELLDB_VERSION,
  SUPPORTED_CODELLDB_PLATFORM_DIRS,
  getCodeLLDBPlatformDir,
  getCodeLLDBExecutableName,
  buildVendorCandidatePaths,
  resolveCodeLLDBExecutableSyncImpl,
  resolveCodeLLDBExecutable,
  resolveCodeLLDBExecutableWithSource,
  getCodeLLDBVersion
} from '@debugmcp/codelldb-common';
export type { CodeLLDBPlatformDir, CodeLLDBSource } from '@debugmcp/codelldb-common';

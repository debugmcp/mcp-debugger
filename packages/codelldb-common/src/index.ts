/**
 * @debugmcp/codelldb-common — shared CodeLLDB infrastructure for MCP Debugger
 *
 * Hosts the vendored CodeLLDB tree plus the resolver, binary-format detector,
 * and spawn glue used by every CodeLLDB-backed adapter (rust, cpp).
 *
 * @packageDocumentation
 */

export {
  DEFAULT_CODELLDB_VERSION,
  SUPPORTED_CODELLDB_PLATFORM_DIRS,
  getCodeLLDBPlatformDir,
  getCodeLLDBExecutableName,
  buildVendorCandidatePaths,
  resolveCodeLLDBExecutableSyncImpl,
  resolveCodeLLDBExecutable,
  getCodeLLDBVersion
} from './codelldb-resolver.js';
export type { CodeLLDBPlatformDir } from './codelldb-resolver.js';

export { detectBinaryFormat } from './binary-detector.js';
export type { BinaryInfo } from './binary-detector.js';

export {
  resolveTerminalKind,
  prepareCodelldbExecutablePath,
  buildCodeLLDBArgs,
  configurePythonEnvironment
} from './codelldb-command.js';
export type { CodeLLDBLogger, TerminalKindConfig } from './codelldb-command.js';

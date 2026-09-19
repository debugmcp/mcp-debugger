/**
 * @debugmcp/adapter-cobol - COBOL Debug Adapter for MCP Debugger (issue #759)
 *
 * GnuCOBOL programs debugged through the vendored CodeLLDB engine, with a DAP
 * shim that presents COBOL-shaped scopes, values and expressions built from the
 * compiler's own `-fdump=ALL` metadata.
 *
 * @packageDocumentation
 */

export { CobolDebugAdapter, COBOL_RUNTIME_ERROR_FILTER } from './cobol-debug-adapter.js';
export type { CobolLaunchConfig } from './cobol-debug-adapter.js';
export { CobolAdapterFactory } from './cobol-adapter-factory.js';
export * from './build/index.js';
export * from './manifest/index.js';
export * from './decoder/index.js';
export { COBOL_PRIVATE_KEY, SHIM_ENTRY_BASENAME, buildShimArgs, parseShimArgs } from './shim-protocol.js';
export type { CobolShimSessionOptions, CobolShimArgv } from './shim-protocol.js';

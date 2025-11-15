/**
 * @debugmcp/adapter-rust - Rust Debug Adapter for MCP Debugger
 * 
 * Provides Rust debugging support using CodeLLDB
 * 
 * @packageDocumentation
 */

export { RustDebugAdapter } from './rust-debug-adapter.js';
export { RustAdapterFactory } from './rust-adapter-factory.js';
export { resolveCodeLLDBPath, checkCargoInstallation } from './utils/rust-utils.js';
export { resolveCargoProject, getCargoTargets } from './utils/cargo-utils.js';
export { resolveCodeLLDBExecutable } from './utils/codelldb-resolver.js';
export { detectBinaryFormat } from './utils/binary-detector.js';
export type { BinaryInfo } from './utils/binary-detector.js';

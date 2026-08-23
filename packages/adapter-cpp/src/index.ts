/**
 * @debugmcp/adapter-cpp - C/C++ Debug Adapter for MCP Debugger
 *
 * Provides C and C++ debugging support using CodeLLDB
 * (shared infrastructure in @debugmcp/codelldb-common).
 *
 * @packageDocumentation
 */

export { CppDebugAdapter } from './cpp-debug-adapter.js';
export type { CppLaunchConfig, ToolchainValidationResult, MsvcBehavior } from './cpp-debug-adapter.js';
export { CppAdapterFactory } from './cpp-adapter-factory.js';
export {
  isCppSourceFile,
  dialectForSource,
  findCompiler,
  findAnyCompiler,
  getCompilerInfo,
  getDefaultOutputPath,
  needsRecompile,
  compileSourceFile
} from './utils/compile-utils.js';
export type { CompilerInfo } from './utils/compile-utils.js';

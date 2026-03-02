/**
 * Java Debug Adapter for mcp-debugger
 *
 * Provides Java debugging support using JDI bridge (JdiDapServer),
 * a single-file Java program that implements DAP over TCP using JDI directly.
 *
 * @packageDocumentation
 * @since 0.18.0
 */

export { JavaDebugAdapter } from './java-debug-adapter.js';
export { JavaAdapterFactory } from './java-adapter-factory.js';
export { findJavaExecutable, getJavaVersion, getJavaSearchPaths } from './utils/java-utils.js';
export { resolveJdiBridgeClassDir, ensureJdiBridgeCompiled } from './utils/jdi-resolver.js';

// Default export required by mcp-debugger dynamic loader
export default {
  name: 'java',
  factory: (await import('./java-adapter-factory.js')).JavaAdapterFactory
};

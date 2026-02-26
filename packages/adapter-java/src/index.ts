/**
 * Java Debug Adapter for mcp-debugger
 *
 * Provides Java debugging support using kotlin-debug-adapter (KDA),
 * a JDI-based DAP server that supports both Java and Kotlin debugging.
 *
 * @packageDocumentation
 * @since 0.18.0
 */

export { JavaDebugAdapter } from './java-debug-adapter.js';
export { JavaAdapterFactory } from './java-adapter-factory.js';
export { findJavaExecutable, getJavaVersion, getJavaSearchPaths } from './utils/java-utils.js';
export { resolveKDAExecutable, resolveKDALibDir } from './utils/kda-resolver.js';

// Default export required by mcp-debugger dynamic loader
export default {
  name: 'java',
  factory: (await import('./java-adapter-factory.js')).JavaAdapterFactory
};

/**
 * Java Debug Adapter for MCP Debugger
 *
 * Entry point for the Java debug adapter package.
 * Exports the adapter factory for dynamic loading by the adapter registry.
 *
 * @since 1.0.0
 */
export { JavaAdapterFactory } from './java-adapter-factory.js';
export { JavaDebugAdapter } from './java-debug-adapter.js';
export type { JavaLaunchConfig } from './java-debug-adapter.js';
export * from './utils/java-utils.js';
export { JdbParser } from './utils/jdb-parser.js';
export type {
  JdbStoppedEvent,
  JdbStackFrame,
  JdbVariable,
  JdbThread
} from './utils/jdb-parser.js';
export { JdbWrapper } from './utils/jdb-wrapper.js';
export type { JdbConfig, JdbBreakpoint } from './utils/jdb-wrapper.js';

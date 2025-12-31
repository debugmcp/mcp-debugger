/**
 * Go Debug Adapter for mcp-debugger
 * 
 * Provides Go debugging support using Delve (dlv) with native DAP protocol.
 * 
 * @packageDocumentation
 * @since 0.1.0
 */

export { GoDebugAdapter } from './go-debug-adapter.js';
export { GoAdapterFactory } from './go-adapter-factory.js';
export * from './utils/go-utils.js';

// Default export required by mcp-debugger dynamic loader
export default { 
  name: 'go', 
  factory: (await import('./go-adapter-factory.js')).GoAdapterFactory 
};

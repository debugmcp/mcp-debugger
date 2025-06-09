/**
 * DAP Proxy - Clean exports for testing and programmatic use
 * 
 * This file provides clean exports of the proxy functionality without any
 * auto-execution or environment detection. It allows tests and other code
 * to import and use the proxy components programmatically.
 */

// Re-export core functionality
export { ProxyRunner, detectExecutionMode, shouldAutoExecute } from './dap-proxy-core.js';
export type { ProxyRunnerOptions } from './dap-proxy-core.js';

// Re-export worker and related types
export { DapProxyWorker } from './dap-proxy-worker.js';
export type { 
  ProxyInitPayload, 
  DapCommandPayload, 
  TerminatePayload 
} from './dap-proxy-interfaces.js';

// Re-export dependencies for testing
export {
  createProductionDependencies,
  createConsoleLogger,
  setupGlobalErrorHandlers
} from './dap-proxy-dependencies.js';

// Re-export message parser
export { MessageParser } from './dap-proxy-message-parser.js';

// Re-export interfaces
export { ProxyState } from './dap-proxy-interfaces.js';
export type { ParentCommand } from './dap-proxy-interfaces.js';

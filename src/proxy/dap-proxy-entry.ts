/**
 * DAP Proxy Entry Point - Production auto-execution entry
 * 
 * This file is the production entry point for the DAP proxy worker process.
 * It handles environment detection and auto-starts the proxy runner.
 * 
 * Detection methods:
 * 1. Direct execution: Script run directly via node
 * 2. IPC presence: Spawned as child process with IPC channel
 * 3. Environment flag: DAP_PROXY_WORKER=true set by bootstrap
 */

import { ProxyRunner, detectExecutionMode, shouldAutoExecute } from './dap-proxy-core.js';
import { 
  createProductionDependencies, 
  createConsoleLogger
} from './dap-proxy-dependencies.js';

// Detect execution mode (pass this module's URL so the direct-run check
// compares the actual entry script, not dap-proxy-core's own module)
const executionMode = detectExecutionMode(process, import.meta.url);

console.error('[INFO] [Proxy Worker] Starting DAP Proxy worker process...');
console.error(`[INFO] [Proxy Worker] Detection results: directRun=${executionMode.isDirectRun}, hasIPC=${executionMode.hasIPC}, workerEnv=${executionMode.isWorkerEnv}`);
console.error('[INFO] [Proxy Worker] Node.js version:', process.version);
console.error(`[INFO] [Proxy Worker] Current working directory: ${process.cwd()}`);

// Auto-execute if running as worker (NO test environment checks!)
if (shouldAutoExecute(executionMode)) {
  console.error('[INFO] [Proxy Worker] Auto-executing proxy runner...');
  
  // Create dependencies and logger
  const dependencies = createProductionDependencies();
  const consoleLogger = createConsoleLogger();
  
  // Create and start runner
  const runner = new ProxyRunner(dependencies, consoleLogger);
  
  // Setup global error handlers
  runner.setupGlobalErrorHandlers(
    () => runner.stop(),
    () => runner.getWorker().getCurrentSessionId() ?? 'unknown'
  );

  // Start the runner
  runner.start().catch((error) => {
    consoleLogger.error('[Proxy Worker] Failed to start runner:', error);
    process.exit(1);
  });

  console.error('[INFO] [Proxy Worker] Ready to receive commands.');
} else {
  console.error('[INFO] [Proxy Worker] Not auto-executing (not running as worker).');
}

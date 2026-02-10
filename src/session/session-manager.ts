/**
 * Session manager for debug sessions, using ProxyManager for process management.
 * 
 * This class manages the lifecycle of debug sessions and delegates all child process
 * and DAP communication to ProxyManager instances. Each session has its own ProxyManager
 * that handles the debug proxy process.
 * 
 * This is the main composition of all session management functionality.
 */
import { SessionManagerOperations } from './session-manager-operations.js';

// Re-export types for convenience
export type { 
  SessionManagerDependencies, 
  SessionManagerConfig,
  CustomLaunchRequestArguments,
  DebugResult
} from './session-manager-core.js';

export type { EvaluateResult } from './session-manager-operations.js';

// Re-export the operations class for any direct usage needs
export { SessionManagerOperations } from './session-manager-operations.js';

/**
 * Main SessionManager class that composes all functionality
 */
export class SessionManager extends SessionManagerOperations {
  /**
   * Override handleAutoContinue to call the continue method.
   * TODO: Implement with proper session context - this method is called from
   * setupProxyEventHandlers where sessionId is available via closure, but this
   * override does not currently have access to it. Needs refactoring to accept
   * sessionId as a parameter or capture it from the event handler context.
   */
  protected async handleAutoContinue(): Promise<void> {
    throw new Error('handleAutoContinue not yet implemented: requires session context refactoring');
  }
}

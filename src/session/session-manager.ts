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
  protected async handleAutoContinue(sessionId: string): Promise<void> {
    this.logger.info(`[SessionManager] Auto-continuing session ${sessionId}`);
    const result = await this.continue(sessionId);
    if (!result.success) {
      this.logger.warn(`[SessionManager] Auto-continue failed for session ${sessionId}: ${result.error}`);
    }
  }
}

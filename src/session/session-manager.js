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
// Re-export the operations class for any direct usage needs
export { SessionManagerOperations } from './session-manager-operations.js';
/**
 * Main SessionManager class that composes all functionality
 */
export class SessionManager extends SessionManagerOperations {
    /**
     * Override handleAutoContinue to call the continue method
     */
    async handleAutoContinue() {
        // This method is called from event handlers where sessionId is in scope
        // For now, we'll throw an error since this needs to be implemented properly
        throw new Error('handleAutoContinue must be implemented with proper session context');
    }
}
//# sourceMappingURL=session-manager.js.map
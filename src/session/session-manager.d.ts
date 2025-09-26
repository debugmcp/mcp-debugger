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
export type { SessionManagerDependencies, SessionManagerConfig, CustomLaunchRequestArguments, DebugResult } from './session-manager-core.js';
export type { EvaluateResult } from './session-manager-operations.js';
export { SessionManagerOperations } from './session-manager-operations.js';
/**
 * Main SessionManager class that composes all functionality
 */
export declare class SessionManager extends SessionManagerOperations {
    /**
     * Override handleAutoContinue to call the continue method
     */
    protected handleAutoContinue(): Promise<void>;
}

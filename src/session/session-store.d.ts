import { DebugLanguage, SessionState, SessionLifecycleState, ExecutionState, DebugSessionInfo, Breakpoint } from '@debugmcp/shared';
/**
 * Parameters for creating a new debug session
 */
export interface CreateSessionParams {
    language: DebugLanguage;
    name?: string;
    executablePath?: string;
}
import { IProxyManager } from '../proxy/proxy-manager.js';
/**
 * Internal session representation with full details
 */
export interface ManagedSession extends DebugSessionInfo {
    executablePath?: string;
    proxyManager?: IProxyManager;
    breakpoints: Map<string, Breakpoint>;
    sessionLifecycle: SessionLifecycleState;
    executionState?: ExecutionState;
}
/**
 * SessionStore manages the lifecycle and state of debug sessions
 * without any external dependencies, making it highly testable.
 */
export declare class SessionStore {
    private sessions;
    /**
     * Creates a new debug session
     */
    createSession(params: CreateSessionParams): DebugSessionInfo;
    /**
     * Retrieves a session by ID
     */
    get(sessionId: string): ManagedSession | undefined;
    /**
     * Retrieves a session by ID, throwing if not found
     */
    getOrThrow(sessionId: string): ManagedSession;
    /**
     * Sets a session directly (for testing purposes)
     */
    set(sessionId: string, session: ManagedSession): void;
    /**
     * Updates session fields
     */
    update(sessionId: string, updates: Partial<ManagedSession>): void;
    /**
     * Updates only the session state
     */
    updateState(sessionId: string, newState: SessionState): void;
    /**
     * Removes a session
     */
    remove(sessionId: string): boolean;
    /**
     * Gets all sessions as DebugSessionInfo (public interface)
     */
    getAll(): DebugSessionInfo[];
    /**
     * Gets all sessions with full internal data
     */
    getAllManaged(): ManagedSession[];
    /**
     * Checks if a session exists
     */
    has(sessionId: string): boolean;
    /**
     * Gets the number of sessions
     */
    size(): number;
    /**
     * Clears all sessions
     */
    clear(): void;
}

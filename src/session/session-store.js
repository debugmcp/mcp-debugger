/**
 * SessionStore - Pure data management for debug sessions
 *
 * This class is extracted from SessionManager to handle all session
 * state management without external dependencies. This improves
 * testability and follows the Single Responsibility Principle.
 */
import { v4 as uuidv4 } from 'uuid';
import { DebugLanguage, SessionState, SessionLifecycleState } from '@debugmcp/shared';
// Platform-aware default Python command
const DEFAULT_PYTHON = process.platform === 'win32' ? 'python' : 'python3';
/**
 * SessionStore manages the lifecycle and state of debug sessions
 * without any external dependencies, making it highly testable.
 */
export class SessionStore {
    sessions = new Map();
    /**
     * Creates a new debug session
     */
    createSession(params) {
        const { language, name, executablePath } = params;
        const sessionId = uuidv4();
        const sessionName = name || `session-${sessionId.substring(0, 8)}`;
        // Validate language
        if (!Object.values(DebugLanguage).includes(language)) {
            throw new Error(`Language '${language}' is not supported. Only 'python' is currently implemented.`);
        }
        // For Python, provide a default if not specified. For Mock, leave undefined if not specified.
        let effectiveExecutablePath;
        if (language === DebugLanguage.PYTHON) {
            effectiveExecutablePath = executablePath || process.env.PYTHON_PATH || DEFAULT_PYTHON;
        }
        else {
            effectiveExecutablePath = executablePath;
        }
        const session = {
            id: sessionId,
            name: sessionName,
            language: language,
            state: SessionState.CREATED,
            createdAt: new Date(),
            updatedAt: new Date(),
            breakpoints: new Map(),
            executablePath: effectiveExecutablePath,
            proxyManager: undefined,
            // Initialize new state model
            sessionLifecycle: SessionLifecycleState.CREATED,
            executionState: undefined,
        };
        this.sessions.set(sessionId, session);
        return {
            id: sessionId,
            name: sessionName,
            language: session.language,
            state: session.state,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt
        };
    }
    /**
     * Retrieves a session by ID
     */
    get(sessionId) {
        return this.sessions.get(sessionId);
    }
    /**
     * Retrieves a session by ID, throwing if not found
     */
    getOrThrow(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Managed session not found: ${sessionId}`);
        }
        return session;
    }
    /**
     * Sets a session directly (for testing purposes)
     */
    set(sessionId, session) {
        this.sessions.set(sessionId, session);
    }
    /**
     * Updates session fields
     */
    update(sessionId, updates) {
        const session = this.getOrThrow(sessionId);
        Object.assign(session, updates);
        session.updatedAt = new Date();
    }
    /**
     * Updates only the session state
     */
    updateState(sessionId, newState) {
        const session = this.getOrThrow(sessionId);
        if (session.state !== newState) {
            session.state = newState;
            session.updatedAt = new Date();
        }
    }
    /**
     * Removes a session
     */
    remove(sessionId) {
        return this.sessions.delete(sessionId);
    }
    /**
     * Gets all sessions as DebugSessionInfo (public interface)
     */
    getAll() {
        return Array.from(this.sessions.values()).map(s => ({
            id: s.id,
            name: s.name,
            language: s.language,
            state: s.state,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt
        }));
    }
    /**
     * Gets all sessions with full internal data
     */
    getAllManaged() {
        return Array.from(this.sessions.values());
    }
    /**
     * Checks if a session exists
     */
    has(sessionId) {
        return this.sessions.has(sessionId);
    }
    /**
     * Gets the number of sessions
     */
    size() {
        return this.sessions.size;
    }
    /**
     * Clears all sessions
     */
    clear() {
        this.sessions.clear();
    }
}
//# sourceMappingURL=session-store.js.map
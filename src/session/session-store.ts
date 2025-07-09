/**
 * SessionStore - Pure data management for debug sessions
 * 
 * This class is extracted from SessionManager to handle all session
 * state management without external dependencies. This improves
 * testability and follows the Single Responsibility Principle.
 */
import { v4 as uuidv4 } from 'uuid';
import { 
  DebugLanguage, 
  SessionState,
  SessionLifecycleState,
  ExecutionState,
  DebugSessionInfo,
  Breakpoint 
} from './models.js';

// Platform-aware default Python command
const DEFAULT_PYTHON = process.platform === 'win32' ? 'python' : 'python3';

/**
 * Parameters for creating a new debug session
 */
export interface CreateSessionParams {
  language: DebugLanguage;
  name?: string;
  pythonPath?: string;  // @deprecated - use executablePath
  executablePath?: string;  // Language-agnostic executable path
}

import { IProxyManager } from '../proxy/proxy-manager.js';

/**
 * Internal session representation with full details
 */
export interface ManagedSession extends DebugSessionInfo {
  pythonPath?: string;  // @deprecated - use executablePath
  executablePath?: string;  // Language-agnostic executable path
  proxyManager?: IProxyManager;
  breakpoints: Map<string, Breakpoint>;
  // New state model fields
  sessionLifecycle: SessionLifecycleState;
  executionState?: ExecutionState;
}

/**
 * SessionStore manages the lifecycle and state of debug sessions
 * without any external dependencies, making it highly testable.
 */
export class SessionStore {
  private sessions: Map<string, ManagedSession> = new Map();

  /**
   * Creates a new debug session
   */
  createSession(params: CreateSessionParams): DebugSessionInfo {
    const { language, name, pythonPath, executablePath } = params;
    const sessionId = uuidv4();
    const sessionName = name || `session-${sessionId.substring(0, 8)}`;
    
    // Validate language
    if (!Object.values(DebugLanguage).includes(language)) {
      throw new Error(`Language '${language}' is not supported. Only 'python' is currently implemented.`);
    }
    
    // Use executablePath if provided, fall back to pythonPath for backward compatibility
    // For Python, provide a default if not specified. For Mock, leave undefined if not specified.
    let effectiveExecutablePath: string | undefined;
    if (language === DebugLanguage.PYTHON) {
      effectiveExecutablePath = executablePath || pythonPath || process.env.PYTHON_PATH || DEFAULT_PYTHON;
    } else {
      effectiveExecutablePath = executablePath || pythonPath;
    }
    
    const session: ManagedSession = {
      id: sessionId, 
      name: sessionName, 
      language: language, 
      state: SessionState.CREATED, 
      createdAt: new Date(), 
      updatedAt: new Date(), 
      breakpoints: new Map<string, Breakpoint>(), 
      pythonPath: effectiveExecutablePath,  // Keep for backward compatibility
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
  get(sessionId: string): ManagedSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Retrieves a session by ID, throwing if not found
   */
  getOrThrow(sessionId: string): ManagedSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Managed session not found: ${sessionId}`);
    }
    return session;
  }

  /**
   * Sets a session directly (for testing purposes)
   */
  set(sessionId: string, session: ManagedSession): void {
    this.sessions.set(sessionId, session);
  }

  /**
   * Updates session fields
   */
  update(sessionId: string, updates: Partial<ManagedSession>): void {
    const session = this.getOrThrow(sessionId);
    Object.assign(session, updates);
    session.updatedAt = new Date();
  }

  /**
   * Updates only the session state
   */
  updateState(sessionId: string, newState: SessionState): void {
    const session = this.getOrThrow(sessionId);
    if (session.state !== newState) {
      session.state = newState;
      session.updatedAt = new Date();
    }
  }

  /**
   * Removes a session
   */
  remove(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Gets all sessions as DebugSessionInfo (public interface)
   */
  getAll(): DebugSessionInfo[] {
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
  getAllManaged(): ManagedSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Checks if a session exists
   */
  has(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Gets the number of sessions
   */
  size(): number {
    return this.sessions.size;
  }

  /**
   * Clears all sessions
   */
  clear(): void {
    this.sessions.clear();
  }
}

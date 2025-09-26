/**
 * Container types and interfaces for dependency injection
 */
/**
 * Configuration for the dependency container
 */
export interface ContainerConfig {
    /**
     * Log level for the logger (e.g., 'debug', 'info', 'warn', 'error')
     */
    logLevel?: string;
    /**
     * Path to log file for persistent logging
     */
    logFile?: string;
    /**
     * Base directory for session logs
     */
    sessionLogDirBase?: string;
    /**
     * Additional logger options
     */
    loggerOptions?: {
        [key: string]: unknown;
    };
}
/**
 * Configuration specific to SessionManager
 */
export interface SessionManagerConfig {
    /**
     * Custom session store configuration if needed
     */
    sessionStore?: {
        maxSessions?: number;
        sessionTimeout?: number;
    };
    /**
     * Default DAP launch arguments
     */
    defaultDapLaunchArgs?: {
        stopOnEntry?: boolean;
        justMyCode?: boolean;
    };
}

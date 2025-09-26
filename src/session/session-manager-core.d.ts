/**
 * Core session management functionality including lifecycle, state management,
 * and event handling.
 */
import { SessionState, DebugLanguage, DebugSessionInfo } from '@debugmcp/shared';
import { SessionStore, ManagedSession } from './session-store.js';
import { DebugProtocol } from '@vscode/debugprotocol';
import { IFileSystem, INetworkManager, ILogger, IEnvironment } from '@debugmcp/shared';
import { ISessionStoreFactory } from '../factories/session-store-factory.js';
import { IProxyManager } from '../proxy/proxy-manager.js';
import { IProxyManagerFactory } from '../factories/proxy-manager-factory.js';
import { IDebugTargetLauncher } from '@debugmcp/shared';
import { IAdapterRegistry } from '@debugmcp/shared';
export interface CustomLaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
    stopOnEntry?: boolean;
    justMyCode?: boolean;
}
export interface DebugResult {
    success: boolean;
    state: SessionState;
    error?: string;
    data?: unknown;
}
/**
 * Complete dependencies for SessionManager
 */
export interface SessionManagerDependencies {
    fileSystem: IFileSystem;
    networkManager: INetworkManager;
    logger: ILogger;
    proxyManagerFactory: IProxyManagerFactory;
    sessionStoreFactory: ISessionStoreFactory;
    debugTargetLauncher: IDebugTargetLauncher;
    environment: IEnvironment;
    adapterRegistry: IAdapterRegistry;
}
/**
 * Configuration for SessionManager
 */
export interface SessionManagerConfig {
    logDirBase?: string;
    defaultDapLaunchArgs?: Partial<CustomLaunchRequestArguments>;
    dryRunTimeoutMs?: number;
}
/**
 * Core session management functionality
 */
export declare class SessionManagerCore {
    protected sessionStore: SessionStore;
    protected logDirBase: string;
    protected logger: ILogger;
    protected fileSystem: IFileSystem;
    protected networkManager: INetworkManager;
    protected environment: IEnvironment;
    protected proxyManagerFactory: IProxyManagerFactory;
    protected sessionStoreFactory: ISessionStoreFactory;
    protected debugTargetLauncher: IDebugTargetLauncher;
    adapterRegistry: IAdapterRegistry;
    protected defaultDapLaunchArgs: Partial<CustomLaunchRequestArguments>;
    protected dryRunTimeoutMs: number;
    protected sessionEventHandlers: WeakMap<ManagedSession, Map<string, (...args: unknown[]) => void>>;
    /**
     * Constructor with full dependency injection
     */
    constructor(config: SessionManagerConfig, dependencies: SessionManagerDependencies);
    createSession(params: {
        language: DebugLanguage;
        name?: string;
        executablePath?: string;
    }): Promise<DebugSessionInfo>;
    protected findFreePort(): Promise<number>;
    protected _getSessionById(sessionId: string): ManagedSession;
    protected _updateSessionState(session: ManagedSession, newState: SessionState): void;
    getSession(sessionId: string): ManagedSession | undefined;
    getAllSessions(): DebugSessionInfo[];
    closeSession(sessionId: string): Promise<boolean>;
    closeAllSessions(): Promise<void>;
    protected setupProxyEventHandlers(session: ManagedSession, proxyManager: IProxyManager, effectiveLaunchArgs: Partial<CustomLaunchRequestArguments>): void;
    protected cleanupProxyEventHandlers(session: ManagedSession, proxyManager: IProxyManager): void;
    /**
     * @internal - This is for testing only, do not use in production
     */
    _testOnly_cleanupProxyEventHandlers(session: ManagedSession, proxyManager: IProxyManager): void;
    protected handleAutoContinue(): Promise<void>;
}

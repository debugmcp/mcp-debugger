/**
 * ProxyManager - Handles spawning and communication with debug proxy processes
 */
import { EventEmitter } from 'events';
import { DebugProtocol } from '@vscode/debugprotocol';
import { IFileSystem, ILogger } from '@debugmcp/shared';
import { IProxyProcessLauncher } from '@debugmcp/shared';
import { ProxyConfig } from './proxy-config.js';
import { IDebugAdapter } from '@debugmcp/shared';
/**
 * Events emitted by ProxyManager
 */
export interface ProxyManagerEvents {
    'stopped': (threadId: number, reason: string, data?: DebugProtocol.StoppedEvent['body']) => void;
    'continued': () => void;
    'terminated': () => void;
    'exited': () => void;
    'initialized': () => void;
    'error': (error: Error) => void;
    'exit': (code: number | null, signal?: string) => void;
    'dry-run-complete': (command: string, script: string) => void;
    'adapter-configured': () => void;
    'dap-event': (event: string, body: unknown) => void;
}
/**
 * Interface for proxy managers
 */
export interface IProxyManager extends EventEmitter {
    start(config: ProxyConfig): Promise<void>;
    stop(): Promise<void>;
    sendDapRequest<T extends DebugProtocol.Response>(command: string, args?: unknown): Promise<T>;
    isRunning(): boolean;
    getCurrentThreadId(): number | null;
    on<K extends keyof ProxyManagerEvents>(event: K, listener: ProxyManagerEvents[K]): this;
    emit<K extends keyof ProxyManagerEvents>(event: K, ...args: Parameters<ProxyManagerEvents[K]>): boolean;
}
/**
 * Concrete implementation of ProxyManager
 */
export declare class ProxyManager extends EventEmitter implements IProxyManager {
    private adapter;
    private proxyProcessLauncher;
    private fileSystem;
    private logger;
    private proxyProcess;
    private sessionId;
    private currentThreadId;
    private pendingDapRequests;
    private isInitialized;
    private isDryRun;
    private adapterConfigured;
    private dapState;
    private stderrBuffer;
    constructor(adapter: IDebugAdapter | null, // Optional adapter for language-agnostic support
    proxyProcessLauncher: IProxyProcessLauncher, fileSystem: IFileSystem, logger: ILogger);
    start(config: ProxyConfig): Promise<void>;
    stop(): Promise<void>;
    sendDapRequest<T extends DebugProtocol.Response>(command: string, args?: unknown): Promise<T>;
    isRunning(): boolean;
    getCurrentThreadId(): number | null;
    private findProxyScript;
    private sendCommand;
    private setupEventHandlers;
    private handleProxyMessage;
    private handleDapResponse;
    private handleDapEvent;
    private handleStatusMessage;
    private handleProxyExit;
    private cleanup;
}

/**
 * Core types for the functional DAP handling
 */
import { DebugProtocol } from '@vscode/debugprotocol';
/**
 * Pending request information (pure data, no timeout logic)
 */
export interface PendingRequest {
    readonly requestId: string;
    readonly command: string;
    readonly seq: number;
    readonly timestamp: number;
}
/**
 * Immutable state representation for a DAP session
 */
export interface DAPSessionState {
    readonly sessionId: string;
    readonly initialized: boolean;
    readonly adapterConfigured: boolean;
    readonly currentThreadId?: number;
    readonly pendingRequests: ReadonlyMap<string, PendingRequest>;
}
/**
 * Commands that the functional core can emit (but not execute)
 */
export type DAPCommand = {
    type: 'sendToClient';
    message: DebugProtocol.Response | DebugProtocol.Event;
} | {
    type: 'sendToProxy';
    command: Record<string, unknown>;
} | {
    type: 'log';
    level: 'info' | 'error' | 'warn' | 'debug';
    message: string;
    data?: unknown;
} | {
    type: 'emitEvent';
    event: string;
    args: unknown[];
} | {
    type: 'killProcess';
};
/**
 * Result of processing a DAP message
 */
export interface DAPProcessingResult {
    commands: DAPCommand[];
    newState?: DAPSessionState;
}
/**
 * Message types from proxy (matching current ProxyManager implementation)
 */
export type ProxyStatusMessage = {
    type: 'status';
    sessionId: string;
    status: 'proxy_minimal_ran_ipc_test';
    message?: string;
} | {
    type: 'status';
    sessionId: string;
    status: 'dry_run_complete';
    command: string;
    script: string;
    data?: unknown;
} | {
    type: 'status';
    sessionId: string;
    status: 'adapter_configured_and_launched';
    data?: unknown;
} | {
    type: 'status';
    sessionId: string;
    status: 'adapter_exited' | 'dap_connection_closed' | 'terminated';
    code?: number | null;
    signal?: NodeJS.Signals | null;
    data?: unknown;
};
export type ProxyDapEventMessage = {
    type: 'dapEvent';
    sessionId: string;
    event: string;
    body?: unknown;
    data?: unknown;
};
export type ProxyDapResponseMessage = {
    type: 'dapResponse';
    sessionId: string;
    requestId: string;
    success: boolean;
    response?: DebugProtocol.Response;
    body?: unknown;
    error?: string;
    data?: unknown;
};
export type ProxyErrorMessage = {
    type: 'error';
    sessionId: string;
    message: string;
    data?: unknown;
};
export type ProxyMessage = ProxyStatusMessage | ProxyDapEventMessage | ProxyDapResponseMessage | ProxyErrorMessage;

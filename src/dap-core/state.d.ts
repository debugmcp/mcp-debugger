/**
 * Pure functions for DAP state management
 */
import { DAPSessionState, PendingRequest } from './types.js';
/**
 * Create initial state for a DAP session
 */
export declare function createInitialState(sessionId: string): DAPSessionState;
/**
 * Mark session as initialized
 */
export declare function setInitialized(state: DAPSessionState, initialized: boolean): DAPSessionState;
/**
 * Mark adapter as configured
 */
export declare function setAdapterConfigured(state: DAPSessionState, configured: boolean): DAPSessionState;
/**
 * Update current thread ID
 */
export declare function setCurrentThreadId(state: DAPSessionState, threadId: number | undefined): DAPSessionState;
/**
 * Add a pending request
 */
export declare function addPendingRequest(state: DAPSessionState, request: PendingRequest): DAPSessionState;
/**
 * Remove a pending request
 */
export declare function removePendingRequest(state: DAPSessionState, requestId: string): DAPSessionState;
/**
 * Get a pending request by ID
 */
export declare function getPendingRequest(state: DAPSessionState, requestId: string): PendingRequest | undefined;
/**
 * Clear all pending requests
 */
export declare function clearPendingRequests(state: DAPSessionState): DAPSessionState;
/**
 * Apply multiple state updates at once
 */
export declare function updateState(state: DAPSessionState, updates: Partial<Omit<DAPSessionState, 'sessionId' | 'pendingRequests'>>): DAPSessionState;

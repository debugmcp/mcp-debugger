/**
 * Pure functions for DAP state management
 */
import { DAPSessionState, PendingRequest } from './types.js';

/**
 * Create initial state for a DAP session
 */
export function createInitialState(sessionId: string): DAPSessionState {
  return {
    sessionId,
    initialized: false,
    adapterConfigured: false,
    currentThreadId: undefined,
    pendingRequests: new Map()
  };
}

/**
 * Mark session as initialized
 */
export function setInitialized(state: DAPSessionState, initialized: boolean): DAPSessionState {
  return {
    ...state,
    initialized
  };
}

/**
 * Mark adapter as configured
 */
export function setAdapterConfigured(state: DAPSessionState, configured: boolean): DAPSessionState {
  return {
    ...state,
    adapterConfigured: configured
  };
}

/**
 * Update current thread ID
 */
export function setCurrentThreadId(state: DAPSessionState, threadId: number | undefined): DAPSessionState {
  return {
    ...state,
    currentThreadId: threadId
  };
}

/**
 * Add a pending request
 */
export function addPendingRequest(
  state: DAPSessionState, 
  request: PendingRequest
): DAPSessionState {
  const newRequests = new Map(state.pendingRequests);
  newRequests.set(request.requestId, request);
  
  return {
    ...state,
    pendingRequests: newRequests
  };
}

/**
 * Remove a pending request
 */
export function removePendingRequest(
  state: DAPSessionState,
  requestId: string
): DAPSessionState {
  const newRequests = new Map(state.pendingRequests);
  newRequests.delete(requestId);
  
  return {
    ...state,
    pendingRequests: newRequests
  };
}

/**
 * Get a pending request by ID
 */
export function getPendingRequest(
  state: DAPSessionState,
  requestId: string
): PendingRequest | undefined {
  return state.pendingRequests.get(requestId);
}

/**
 * Clear all pending requests
 */
export function clearPendingRequests(state: DAPSessionState): DAPSessionState {
  return {
    ...state,
    pendingRequests: new Map()
  };
}

/**
 * Apply multiple state updates at once
 */
export function updateState(
  state: DAPSessionState,
  updates: Partial<Omit<DAPSessionState, 'sessionId' | 'pendingRequests'>>
): DAPSessionState {
  return {
    ...state,
    ...updates
  };
}

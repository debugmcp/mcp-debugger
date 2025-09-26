/**
 * Create initial state for a DAP session
 */
export function createInitialState(sessionId) {
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
export function setInitialized(state, initialized) {
    return {
        ...state,
        initialized
    };
}
/**
 * Mark adapter as configured
 */
export function setAdapterConfigured(state, configured) {
    return {
        ...state,
        adapterConfigured: configured
    };
}
/**
 * Update current thread ID
 */
export function setCurrentThreadId(state, threadId) {
    return {
        ...state,
        currentThreadId: threadId
    };
}
/**
 * Add a pending request
 */
export function addPendingRequest(state, request) {
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
export function removePendingRequest(state, requestId) {
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
export function getPendingRequest(state, requestId) {
    return state.pendingRequests.get(requestId);
}
/**
 * Clear all pending requests
 */
export function clearPendingRequests(state) {
    return {
        ...state,
        pendingRequests: new Map()
    };
}
/**
 * Apply multiple state updates at once
 */
export function updateState(state, updates) {
    return {
        ...state,
        ...updates
    };
}
//# sourceMappingURL=state.js.map
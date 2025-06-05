/**
 * Unit tests for DAP core state management
 */
import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  setInitialized,
  setAdapterConfigured,
  setCurrentThreadId,
  addPendingRequest,
  removePendingRequest,
  getPendingRequest,
  clearPendingRequests,
  updateState
} from '../../../src/dap-core/state.js';
import { PendingRequest } from '../../../src/dap-core/types.js';

describe('DAP Core State', () => {
  describe('createInitialState', () => {
    it('should create initial state with correct defaults', () => {
      const state = createInitialState('test-session-123');
      
      expect(state.sessionId).toBe('test-session-123');
      expect(state.initialized).toBe(false);
      expect(state.adapterConfigured).toBe(false);
      expect(state.currentThreadId).toBeUndefined();
      expect(state.pendingRequests.size).toBe(0);
    });
  });

  describe('setInitialized', () => {
    it('should update initialized flag', () => {
      const state = createInitialState('test');
      const newState = setInitialized(state, true);
      
      expect(newState.initialized).toBe(true);
      // Ensure immutability
      expect(state.initialized).toBe(false);
    });
  });

  describe('setAdapterConfigured', () => {
    it('should update adapterConfigured flag', () => {
      const state = createInitialState('test');
      const newState = setAdapterConfigured(state, true);
      
      expect(newState.adapterConfigured).toBe(true);
      expect(state.adapterConfigured).toBe(false);
    });
  });

  describe('setCurrentThreadId', () => {
    it('should update current thread ID', () => {
      const state = createInitialState('test');
      const newState = setCurrentThreadId(state, 42);
      
      expect(newState.currentThreadId).toBe(42);
      expect(state.currentThreadId).toBeUndefined();
    });

    it('should clear current thread ID when undefined', () => {
      const state = setCurrentThreadId(createInitialState('test'), 42);
      const newState = setCurrentThreadId(state, undefined);
      
      expect(newState.currentThreadId).toBeUndefined();
    });
  });

  describe('pending requests', () => {
    const request: PendingRequest = {
      requestId: 'req-123',
      command: 'threads',
      seq: 1,
      timestamp: Date.now()
    };

    it('should add pending request', () => {
      const state = createInitialState('test');
      const newState = addPendingRequest(state, request);
      
      expect(newState.pendingRequests.size).toBe(1);
      expect(newState.pendingRequests.get('req-123')).toEqual(request);
      // Ensure immutability
      expect(state.pendingRequests.size).toBe(0);
    });

    it('should get pending request', () => {
      const state = addPendingRequest(createInitialState('test'), request);
      
      expect(getPendingRequest(state, 'req-123')).toEqual(request);
      expect(getPendingRequest(state, 'non-existent')).toBeUndefined();
    });

    it('should remove pending request', () => {
      let state = createInitialState('test');
      state = addPendingRequest(state, request);
      state = addPendingRequest(state, { ...request, requestId: 'req-456' });
      
      const newState = removePendingRequest(state, 'req-123');
      
      expect(newState.pendingRequests.size).toBe(1);
      expect(newState.pendingRequests.has('req-123')).toBe(false);
      expect(newState.pendingRequests.has('req-456')).toBe(true);
      // Ensure immutability
      expect(state.pendingRequests.size).toBe(2);
    });

    it('should clear all pending requests', () => {
      let state = createInitialState('test');
      state = addPendingRequest(state, request);
      state = addPendingRequest(state, { ...request, requestId: 'req-456' });
      
      const newState = clearPendingRequests(state);
      
      expect(newState.pendingRequests.size).toBe(0);
      expect(state.pendingRequests.size).toBe(2);
    });
  });

  describe('updateState', () => {
    it('should apply multiple updates at once', () => {
      const state = createInitialState('test');
      const newState = updateState(state, {
        initialized: true,
        adapterConfigured: true,
        currentThreadId: 5
      });
      
      expect(newState.initialized).toBe(true);
      expect(newState.adapterConfigured).toBe(true);
      expect(newState.currentThreadId).toBe(5);
      // sessionId and pendingRequests should remain unchanged
      expect(newState.sessionId).toBe('test');
      expect(newState.pendingRequests).toBe(state.pendingRequests);
    });
  });

  describe('immutability', () => {
    it('should never mutate the original state', () => {
      const originalState = createInitialState('test');
      const frozen = Object.freeze(originalState);
      
      // These operations should not throw if immutable
      expect(() => setInitialized(frozen, true)).not.toThrow();
      expect(() => setAdapterConfigured(frozen, true)).not.toThrow();
      expect(() => setCurrentThreadId(frozen, 1)).not.toThrow();
      expect(() => updateState(frozen, { initialized: true })).not.toThrow();
    });

    it('should create new Map instances for pending requests', () => {
      const state1 = createInitialState('test');
      const state2 = addPendingRequest(state1, {
        requestId: 'req-1',
        command: 'test',
        seq: 1,
        timestamp: Date.now()
      });
      
      expect(state1.pendingRequests).not.toBe(state2.pendingRequests);
      expect(state1.pendingRequests.size).toBe(0);
      expect(state2.pendingRequests.size).toBe(1);
    });
  });
});

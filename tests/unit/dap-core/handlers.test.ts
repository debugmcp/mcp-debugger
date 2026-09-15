/**
 * Unit tests for DAP core message handlers
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  handleProxyMessage,
  isValidProxyMessage,
  createInitialState,
  DAPSessionState,
  ProxyStatusMessage,
  ProxyErrorMessage,
  ProxyDapEventMessage
} from '../../../src/dap-core/index.js';

describe('DAP Core Handlers', () => {
  describe('handleProxyMessage', () => {
    let state: DAPSessionState;
    
    beforeEach(() => {
      state = createInitialState('test-session-123');
    });

    describe('session validation', () => {
      it('should reject messages with mismatched session ID', () => {
        const message: ProxyStatusMessage = {
          type: 'status',
          sessionId: 'wrong-session',
          status: 'proxy_minimal_ran_ipc_test'
        };
        
        const result = handleProxyMessage(state, message);
        
        expect(result.commands).toHaveLength(1);
        expect(result.commands[0]).toEqual({
          type: 'log',
          level: 'warn',
          message: 'Session ID mismatch. Expected test-session-123, got wrong-session'
        });
        expect(result.newState).toBeUndefined();
      });
    });

    /**
     * Status messages carry STATE TRANSITIONS only (issue #713).
     *
     * ProxyManager's imperative handleStatusMessage owns every status-derived
     * side effect — the logging, the emits and their latches (the initialized
     * latch, the #258 exit latch), the kill on the IPC probe. The core used to
     * push its own copies, so the consumer had to skip them wholesale; it now
     * returns commands for no status at all, and the consumer executes
     * whatever it does return.
     */
    describe('status messages (Phase 1)', () => {
      const statusMessage = (
        status: ProxyStatusMessage['status'],
        extra: Partial<ProxyStatusMessage> = {}
      ): ProxyStatusMessage => ({
        type: 'status',
        sessionId: 'test-session-123',
        status,
        ...extra
      } as ProxyStatusMessage);

      it('issues no commands for any status', () => {
        const statuses: Array<ProxyStatusMessage['status']> = [
          'proxy_minimal_ran_ipc_test',
          'init_received',
          'dry_run_complete',
          'adapter_connected',
          'adapter_configured_and_launched',
          'adapter_exited',
          'dap_connection_closed',
          'terminated'
        ];

        for (const status of statuses) {
          expect(handleProxyMessage(state, statusMessage(status)).commands).toEqual([]);
        }
      });

      it('marks the session initialized on adapter_connected', () => {
        const result = handleProxyMessage(state, statusMessage('adapter_connected'));

        expect(result.commands).toEqual([]);
        expect(result.newState?.initialized).toBe(true);
      });

      it('records adapter_configured_and_launched, initializing when not yet initialized', () => {
        const result = handleProxyMessage(state, statusMessage('adapter_configured_and_launched'));

        expect(result.commands).toEqual([]);
        expect(result.newState?.adapterConfigured).toBe(true);
        expect(result.newState?.initialized).toBe(true);
      });

      it('leaves an already-initialized session initialized', () => {
        state = { ...state, initialized: true };

        const result = handleProxyMessage(state, statusMessage('adapter_configured_and_launched'));

        expect(result.commands).toEqual([]);
        expect(result.newState?.adapterConfigured).toBe(true);
        expect(result.newState?.initialized).toBe(true);
      });

      it('does not transition state for the lifecycle statuses the imperative handler owns', () => {
        const statuses: Array<ProxyStatusMessage['status']> = [
          'proxy_minimal_ran_ipc_test',
          'init_received',
          'dry_run_complete',
          'adapter_exited',
          'dap_connection_closed',
          'terminated'
        ];

        for (const status of statuses) {
          expect(handleProxyMessage(state, statusMessage(status)).newState).toBeUndefined();
        }
      });
    });

    describe('error messages (Phase 1)', () => {
      it('should handle error messages', () => {
        const message: ProxyErrorMessage = {
          type: 'error',
          sessionId: 'test-session-123',
          message: 'Connection failed',
          data: { details: 'Network error' }
        };
        
        const result = handleProxyMessage(state, message);
        
        expect(result.commands).toHaveLength(2);
        expect(result.commands[0]).toEqual({
          type: 'log',
          level: 'error',
          message: '[ProxyManager] Proxy error: Connection failed'
        });
        expect(result.commands[1]).toEqual({
          type: 'emitEvent',
          event: 'error',
          args: [new Error('Connection failed')]
        });
      });
    });

    describe('DAP events (Phase 2)', () => {
      it('should handle stopped event and update thread ID', () => {
        const message: ProxyDapEventMessage = {
          type: 'dapEvent',
          sessionId: 'test-session-123',
          event: 'stopped',
          body: { threadId: 42, reason: 'breakpoint', allThreadsStopped: true }
        };
        
        const result = handleProxyMessage(state, message);
        
        expect(result.commands).toHaveLength(2);
        expect(result.commands[0]).toEqual({
          type: 'log',
          level: 'info',
          message: '[ProxyManager] DAP event: stopped',
          data: message.body
        });
        expect(result.commands[1]).toEqual({
          type: 'emitEvent',
          event: 'stopped',
          args: [42, 'breakpoint', message.body]
        });
        
        // Check state update
        expect(result.newState?.currentThreadId).toBe(42);
      });

      it('should handle stopped event without thread ID', () => {
        const message: ProxyDapEventMessage = {
          type: 'dapEvent',
          sessionId: 'test-session-123',
          event: 'stopped',
          body: { reason: 'pause' }
        };
        
        const result = handleProxyMessage(state, message);
        
        expect(result.commands[1]).toEqual({
          type: 'emitEvent',
          event: 'stopped',
          args: [undefined, 'pause', message.body]
        });
        
        // State should not be updated
        expect(result.newState).toBe(state);
      });

      it('should handle continued event', () => {
        const message: ProxyDapEventMessage = {
          type: 'dapEvent',
          sessionId: 'test-session-123',
          event: 'continued',
          body: { threadId: 1, allThreadsContinued: true }
        };
        
        const result = handleProxyMessage(state, message);
        
        expect(result.commands[1]).toEqual({
          type: 'emitEvent',
          event: 'continued',
          args: []
        });
      });

      it('should handle terminated event', () => {
        const message: ProxyDapEventMessage = {
          type: 'dapEvent',
          sessionId: 'test-session-123',
          event: 'terminated'
        };
        
        const result = handleProxyMessage(state, message);
        
        expect(result.commands[1]).toEqual({
          type: 'emitEvent',
          event: 'terminated',
          args: []
        });
      });

      it('should handle exited event', () => {
        const message: ProxyDapEventMessage = {
          type: 'dapEvent',
          sessionId: 'test-session-123',
          event: 'exited',
          body: { exitCode: 0 }
        };
        
        const result = handleProxyMessage(state, message);
        
        expect(result.commands[1]).toEqual({
          type: 'emitEvent',
          event: 'exited',
          args: []
        });
      });

      it('should forward unknown DAP events', () => {
        const message: ProxyDapEventMessage = {
          type: 'dapEvent',
          sessionId: 'test-session-123',
          event: 'custom',
          body: { data: 'test' }
        };
        
        const result = handleProxyMessage(state, message);
        
        expect(result.commands[1]).toEqual({
          type: 'emitEvent',
          event: 'dap-event' as any,
          args: ['custom', { data: 'test' }]
        });
      });
    });

    describe('unknown message types', () => {
      it('should log warning for unknown message type', () => {
        const message = {
          type: 'unknown',
          sessionId: 'test-session-123',
          data: 'test'
        } as any;
        
        const result = handleProxyMessage(state, message);
        
        expect(result.commands).toHaveLength(1);
        expect(result.commands[0]).toEqual({
          type: 'log',
          level: 'warn',
          message: 'Unknown message type',
          data: message
        });
      });
    });
  });

  describe('isValidProxyMessage', () => {
    it('should validate correct messages', () => {
      const validMessages = [
        { type: 'status', sessionId: 'test', status: 'test' },
        { type: 'error', sessionId: 'test', message: 'error' },
        { type: 'dapEvent', sessionId: 'test', event: 'stopped' },
        { type: 'dapResponse', sessionId: 'test', requestId: '123' }
      ];
      
      validMessages.forEach(msg => {
        expect(isValidProxyMessage(msg)).toBe(true);
      });
    });

    it('should reject invalid messages', () => {
      const invalidMessages = [
        null,
        undefined,
        'string',
        123,
        [],
        {},
        { type: 'status' }, // missing sessionId
        { sessionId: 'test' }, // missing type
        { type: 123, sessionId: 'test' }, // wrong type
        { type: 'status', sessionId: 123 } // wrong sessionId type
      ];
      
      invalidMessages.forEach(msg => {
        expect(isValidProxyMessage(msg)).toBe(false);
      });
    });
  });
});

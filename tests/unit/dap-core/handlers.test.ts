/**
 * Unit tests for DAP core message handlers
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  handleProxyMessage,
  isValidProxyMessage,
  createInitialState,
  DAPSessionState,
  ProxyMessage,
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

    describe('status messages (Phase 1)', () => {
      it('should handle proxy_minimal_ran_ipc_test', () => {
        const message: ProxyStatusMessage = {
          type: 'status',
          sessionId: 'test-session-123',
          status: 'proxy_minimal_ran_ipc_test',
          message: 'IPC test successful'
        };
        
        const result = handleProxyMessage(state, message);
        
        expect(result.commands).toHaveLength(2);
        expect(result.commands[0]).toEqual({
          type: 'log',
          level: 'info',
          message: '[ProxyManager] IPC test message received'
        });
        expect(result.commands[1]).toEqual({
          type: 'killProcess'
        });
        expect(result.newState).toBeUndefined();
      });

      it('should handle dry_run_complete', () => {
        const message: ProxyStatusMessage = {
          type: 'status',
          sessionId: 'test-session-123',
          status: 'dry_run_complete',
          command: 'python test.py --debug',
          script: 'test.py'
        };
        
        const result = handleProxyMessage(state, message);
        
        expect(result.commands).toHaveLength(2);
        expect(result.commands[0]).toEqual({
          type: 'log',
          level: 'info',
          message: '[ProxyManager] Dry run complete'
        });
        expect(result.commands[1]).toEqual({
          type: 'emitEvent',
          event: 'dry-run-complete',
          args: ['python test.py --debug', 'test.py']
        });
      });

      it('should handle adapter_configured_and_launched when not initialized', () => {
        const message: ProxyStatusMessage = {
          type: 'status',
          sessionId: 'test-session-123',
          status: 'adapter_configured_and_launched'
        };
        
        const result = handleProxyMessage(state, message);
        
        expect(result.commands).toHaveLength(3);
        expect(result.commands[0]).toEqual({
          type: 'log',
          level: 'info',
          message: '[ProxyManager] Adapter configured and launched'
        });
        expect(result.commands[1]).toEqual({
          type: 'emitEvent',
          event: 'adapter-configured',
          args: []
        });
        expect(result.commands[2]).toEqual({
          type: 'emitEvent',
          event: 'initialized',
          args: []
        });
        
        // Check state updates
        expect(result.newState?.initialized).toBe(true);
        expect(result.newState?.adapterConfigured).toBe(true);
      });

      it('should handle adapter_configured_and_launched when already initialized', () => {
        state = { ...state, initialized: true };
        
        const message: ProxyStatusMessage = {
          type: 'status',
          sessionId: 'test-session-123',
          status: 'adapter_configured_and_launched'
        };
        
        const result = handleProxyMessage(state, message);
        
        // Should not emit 'initialized' event again
        expect(result.commands).toHaveLength(2);
        expect(result.commands[1].type).toBe('emitEvent');
        expect((result.commands[1] as any).event).toBe('adapter-configured');
      });

      it('should handle adapter exit statuses', () => {
        const statuses: Array<ProxyStatusMessage['status']> = [
          'adapter_exited',
          'dap_connection_closed',
          'terminated'
        ];
        
        statuses.forEach(status => {
          const message: ProxyStatusMessage = {
            type: 'status',
            sessionId: 'test-session-123',
            status: status as any,
            code: 1,
            signal: 'SIGTERM' as any
          };
          
          const result = handleProxyMessage(state, message);
          
          expect(result.commands).toHaveLength(2);
          expect(result.commands[0]).toEqual({
            type: 'log',
            level: 'info',
            message: `[ProxyManager] Status: ${status}`
          });
          expect(result.commands[1]).toEqual({
            type: 'emitEvent',
            event: 'exit',
            args: [1, 'SIGTERM']
          });
        });
      });

      it('should use default code when missing', () => {
        const message: ProxyStatusMessage = {
          type: 'status',
          sessionId: 'test-session-123',
          status: 'adapter_exited'
        };
        
        const result = handleProxyMessage(state, message);
        
        expect(result.commands[1]).toEqual({
          type: 'emitEvent',
          event: 'exit',
          args: [1, undefined]
        });
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

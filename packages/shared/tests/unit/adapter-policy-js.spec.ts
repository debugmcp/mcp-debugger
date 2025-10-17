import { describe, it, expect } from 'vitest';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { JsDebugAdapterPolicy } from '../../src/interfaces/adapter-policy-js.js';

function createStackFrame(id: number, file: string): DebugProtocol.StackFrame & { file?: string } {
  return {
    id,
    name: `frame-${id}`,
    line: 1,
    column: 1,
    file,
  };
}

describe('JsDebugAdapterPolicy', () => {
  describe('buildChildStartArgs', () => {
    it('builds attach command with pending target id', () => {
      const args = JsDebugAdapterPolicy.buildChildStartArgs('pending-1', { type: 'pwa-node' });
      expect(args.command).toBe('attach');
      expect(args.args).toMatchObject({
        request: 'attach',
        __pendingTargetId: 'pending-1',
        continueOnAttach: true,
      });
    });
  });

  describe('filterStackFrames', () => {
    it('filters out internal frames but keeps first when all removed', () => {
      const frames = [
        createStackFrame(1, '<node_internals>/lib.js'),
        createStackFrame(2, '/workspace/app.js'),
      ];
      const filtered = JsDebugAdapterPolicy.filterStackFrames!(frames, false);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(2);

      const allInternal = [createStackFrame(3, '<node_internals>/timer.js')];
      const fallback = JsDebugAdapterPolicy.filterStackFrames!(allInternal, false);
      expect(fallback).toHaveLength(1);
      expect(fallback[0].id).toBe(3);
    });
  });

  describe('extractLocalVariables', () => {
    const frame = createStackFrame(1, '/workspace/app.js');

    it('returns empty array when no frames', () => {
      const result = JsDebugAdapterPolicy.extractLocalVariables!([], {}, {});
      expect(result).toEqual([]);
    });

    it('filters out special variables by default', () => {
      const scopes: Record<number, DebugProtocol.Scope[]> = {
        1: [
          {
            name: 'Locals',
            variablesReference: 100,
            expensive: false,
          },
        ],
      };
      const vars: Record<number, DebugProtocol.Variable[]> = {
        100: [
          { name: 'this', value: 'ignored', variablesReference: 0 },
          { name: '__proto__', value: 'ignored', variablesReference: 0 },
          { name: 'value', value: '42', variablesReference: 0 },
        ],
      };
      const result = JsDebugAdapterPolicy.extractLocalVariables!([frame], scopes, vars);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('value');
    });

    it('includes special variables when requested', () => {
      const scopes: Record<number, DebugProtocol.Scope[]> = {
        1: [
          {
            name: 'Local',
            variablesReference: 200,
            expensive: false,
          },
        ],
      };
      const vars: Record<number, DebugProtocol.Variable[]> = {
        200: [
          { name: 'this', value: 'context', variablesReference: 0 },
          { name: 'value', value: '42', variablesReference: 0 },
        ],
      };
      const result = JsDebugAdapterPolicy.extractLocalVariables!([frame], scopes, vars, true);
      expect(result).toHaveLength(2);
    });
  });

  describe('command queueing', () => {
    it('does not queue initialize', () => {
      const state = JsDebugAdapterPolicy.createInitialState();
      const result = JsDebugAdapterPolicy.shouldQueueCommand!('initialize', state);
      expect(result.shouldQueue).toBe(false);
    });

    it('queues commands until initialize response received', () => {
      const state = JsDebugAdapterPolicy.createInitialState();
      const result = JsDebugAdapterPolicy.shouldQueueCommand!('threads', state);
      expect(result.shouldQueue).toBe(true);
      expect(result.shouldDefer).toBe(false);
    });

    it('defers launch until configurationDone sent', () => {
      const state = JsDebugAdapterPolicy.createInitialState() as any;
      state.initializeResponded = true;
      state.configurationDone = false;

      const result = JsDebugAdapterPolicy.shouldQueueCommand!('launch', state);
      expect(result.shouldQueue).toBe(true);
      expect(result.shouldDefer).toBe(true);
    });

    it('processQueuedCommands orders configuration, configDone, start, others', () => {
      const commands = [
        { requestId: '1', dapCommand: 'launch' },
        { requestId: '2', dapCommand: 'setBreakpoints' },
        { requestId: '3', dapCommand: 'configurationDone' },
        { requestId: '4', dapCommand: 'threads' },
      ];
      const ordered = JsDebugAdapterPolicy.processQueuedCommands!(commands) as typeof commands;
      expect(ordered.map(c => c.dapCommand)).toEqual([
        'setBreakpoints',
        'configurationDone',
        'launch',
        'threads',
      ]);
    });
  });

  describe('state helpers', () => {
    it('updates state on commands and events', () => {
      const state = JsDebugAdapterPolicy.createInitialState() as any;
      JsDebugAdapterPolicy.updateStateOnCommand!('launch', undefined, state);
      expect(state.startSent).toBe(true);

      JsDebugAdapterPolicy.updateStateOnEvent!('initialized', undefined, state);
      expect(state.initialized).toBe(true);

      state.initializeResponded = true;
      expect(JsDebugAdapterPolicy.isConnected!(state)).toBe(true);
      expect(JsDebugAdapterPolicy.isInitialized!(state)).toBe(true);
    });
  });

  describe('matchesAdapter', () => {
    it('matches commands containing js-debug tokens', () => {
      expect(
        JsDebugAdapterPolicy.matchesAdapter!({
          command: '/usr/bin/node',
          args: ['/app/vendor/js-debug/vsDebugServer.cjs', '5678'],
        }),
      ).toBe(true);

      expect(
        JsDebugAdapterPolicy.matchesAdapter!({
          command: '/usr/bin/python',
          args: ['--version'],
        }),
      ).toBe(false);
    });
  });

  describe('getInitializationBehavior', () => {
    it('enables configuration deferral and runtime executable injection', () => {
      const behavior = JsDebugAdapterPolicy.getInitializationBehavior!();
      expect(behavior.deferConfigDone).toBe(true);
      expect(behavior.addRuntimeExecutable).toBe(true);
    });
  });

  describe('DAP client behavior', () => {
    it('normalizes adapter id and handles reverse start debugging request', async () => {
      const behavior = JsDebugAdapterPolicy.getDapClientBehavior!();
      expect(behavior.normalizeAdapterId?.('javascript')).toBe('pwa-node');

      const responses: DebugProtocol.Response[] = [];
      const context = {
        adoptedTargets: new Set<string>(),
        sendResponse: (_req: DebugProtocol.Request, res: DebugProtocol.Response) => {
          responses.push(res);
        },
      };

      const request: DebugProtocol.Request = {
        seq: 1,
        type: 'request',
        command: 'startDebugging',
        arguments: {
          configuration: { __pendingTargetId: 'child-1', host: '127.0.0.1', port: 9229 },
        },
      };

      const result = await behavior.handleReverseRequest!(request, context as any);
      expect(responses).toHaveLength(1);
      expect(result?.handled).toBe(true);
      expect(result?.createChildSession).toBe(true);
      expect(result?.childConfig?.pendingId).toBe('child-1');
    });
  });

  describe('getAdapterSpawnConfig', () => {
    it('returns spawn configuration when adapterCommand provided', () => {
      const spawn = JsDebugAdapterPolicy.getAdapterSpawnConfig!({
        adapterCommand: {
          command: '/usr/bin/node',
          args: ['vsDebugServer.cjs', '5678', '127.0.0.1'],
          env: { NODE_OPTIONS: '--max-old-space-size=4096' },
        },
        adapterHost: '127.0.0.1',
        adapterPort: 5678,
        logDir: '/tmp/session',
      });

      expect(spawn).toMatchObject({
        command: '/usr/bin/node',
        args: ['vsDebugServer.cjs', '5678', '127.0.0.1'],
        host: '127.0.0.1',
        port: 5678,
        logDir: '/tmp/session',
      });
    });
  });
});

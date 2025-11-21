import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { EventEmitter } from 'events';
import { RustAdapterPolicy } from '../../src/interfaces/adapter-policy-rust.js';
import { SessionState } from '@debugmcp/shared';

const accessMock = vi.fn<[], Promise<void>>();
const spawnMock = vi.fn();

vi.mock('fs/promises', () => ({
  access: accessMock,
  constants: { F_OK: 0 }
}));

vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process');
  return {
    ...actual,
    spawn: (...args: Parameters<typeof actual.spawn>) => spawnMock(...args)
  };
});

const setPlatform = (platform: NodeJS.Platform, arch: NodeJS.Architecture = process.arch) => {
  const originalPlatform = process.platform;
  const originalArch = process.arch;
  Object.defineProperty(process, 'platform', { value: platform, configurable: true });
  Object.defineProperty(process, 'arch', { value: arch, configurable: true });
  return () => {
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    Object.defineProperty(process, 'arch', { value: originalArch, configurable: true });
  };
};

describe('RustAdapterPolicy', () => {
  beforeEach(() => {
    accessMock.mockReset();
    spawnMock.mockReset();
  });

  afterEach(() => {
    delete process.env.CARGO_PATH;
  });

  describe('extractLocalVariables', () => {
    const frame: DebugProtocol.StackFrame = {
      id: 1,
      name: 'main',
      line: 1,
      column: 1
    };

    it('filters debugger internals by default', () => {
      const scopes: Record<number, DebugProtocol.Scope[]> = {
        1: [{ name: 'Locals', variablesReference: 42, expensive: false }]
      };
      const vars: Record<number, DebugProtocol.Variable[]> = {
        42: [
          { name: '$__internal', value: 'skip', variablesReference: 0 },
          { name: '_lldb_internal', value: 'skip', variablesReference: 0 },
          { name: 'app', value: 'value', variablesReference: 0 }
        ]
      };
      const filtered = RustAdapterPolicy.extractLocalVariables!([frame], scopes, vars);
      expect(filtered.map(v => v.name)).toEqual(['app']);
    });

    it('returns special variables when includeSpecial is true', () => {
      const scopes: Record<number, DebugProtocol.Scope[]> = {
        1: [{ name: 'Local', variablesReference: 7, expensive: false }]
      };
      const vars: Record<number, DebugProtocol.Variable[]> = {
        7: [
          { name: '__lldb_internal', value: 'one', variablesReference: 0 },
          { name: 'regular', value: 'two', variablesReference: 0 }
        ]
      };
      const result = RustAdapterPolicy.extractLocalVariables!([frame], scopes, vars, true);
      expect(result).toHaveLength(2);
    });
  });

  it('resolves executable path using inputs and env', () => {
    expect(RustAdapterPolicy.resolveExecutablePath!('/custom/bin')).toBe('/custom/bin');

    process.env.CARGO_PATH = '/env/cargo';
    expect(RustAdapterPolicy.resolveExecutablePath!()).toBe('/env/cargo');

    delete process.env.CARGO_PATH;
    expect(RustAdapterPolicy.resolveExecutablePath!()).toBeUndefined();
  });

  describe('validateExecutable', () => {
    const createChild = () => {
      const child = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
      };
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      return child;
    };

    it('returns true when binary exists and reports version', async () => {
      accessMock.mockResolvedValue();
      spawnMock.mockImplementation(() => {
        const child = createChild();
        setTimeout(() => {
          child.stdout.emit('data', 'codelldb 1.0.0');
          child.emit('exit', 0);
        }, 0);
        return child;
      });

      await expect(RustAdapterPolicy.validateExecutable!('/tmp/codelldb')).resolves.toBe(true);
      expect(spawnMock).toHaveBeenCalledWith('/tmp/codelldb', ['--version'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });
    });

    it('returns false when spawn fails', async () => {
      accessMock.mockResolvedValue();
      spawnMock.mockImplementation(() => {
        const child = createChild();
        setTimeout(() => child.emit('error', new Error('missing')), 0);
        return child;
      });

      await expect(RustAdapterPolicy.validateExecutable!('/tmp/bad')).resolves.toBe(false);
    });

    it('returns false when executable missing', async () => {
      accessMock.mockRejectedValue(new Error('no access'));
      await expect(RustAdapterPolicy.validateExecutable!('/missing')).resolves.toBe(false);
      expect(spawnMock).not.toHaveBeenCalled();
    });
  });

  it('updates adapter state via commands and events', () => {
    const state = RustAdapterPolicy.createInitialState!();
    RustAdapterPolicy.updateStateOnCommand!('configurationDone', undefined, state);
    expect((state as any).configurationDone).toBe(true);

    RustAdapterPolicy.updateStateOnEvent!('initialized', undefined, state);
    expect(RustAdapterPolicy.isInitialized!(state)).toBe(true);
    expect(RustAdapterPolicy.isConnected!(state)).toBe(true);
  });

  it('never queues commands', () => {
    const result = RustAdapterPolicy.shouldQueueCommand!();
    expect(result.shouldQueue).toBe(false);
    expect(result.shouldDefer).toBe(false);
  });

  it('matches CodeLLDB adapter invocations', () => {
    const match = RustAdapterPolicy.matchesAdapter!({
      command: '/opt/codelldb/adapter/codelldb',
      args: ['--port', '4000']
    });
    const noMatch = RustAdapterPolicy.matchesAdapter!({
      command: '/usr/bin/python',
      args: ['--version']
    });

    expect(match).toBe(true);
    expect(noMatch).toBe(false);
  });

  describe('getAdapterSpawnConfig', () => {
    it('returns custom adapter command when provided', () => {
      const config = RustAdapterPolicy.getAdapterSpawnConfig!({
        adapterCommand: { command: 'custom', args: ['--flag'], env: { ONE: '1' } },
        adapterHost: '127.0.0.1',
        adapterPort: 4444,
        logDir: '/tmp/logs'
      });

      expect(config.command).toBe('custom');
      expect(config.args).toEqual(['--flag']);
      expect(config.env?.ONE).toBe('1');
    });

    it('builds vendored codelldb command per platform', () => {
      const restore = setPlatform('win32');
      const config = RustAdapterPolicy.getAdapterSpawnConfig!({
        adapterHost: '127.0.0.1',
        adapterPort: 9000,
        logDir: '/tmp/logs'
      });

      expect(config.command).toMatch(/vendor\/codelldb\/win32-x64\/adapter\/codelldb\.exe$/);
      expect(config.args).toEqual(['--port', '9000']);
      expect(config.env?.LLDB_USE_NATIVE_PDB_READER).toBe('1');
      restore();
    });
  });

  it('handles reverse requests via DAP client behavior', async () => {
    const behavior = RustAdapterPolicy.getDapClientBehavior!();
    const responses: DebugProtocol.Response[] = [];
    const context = {
      sendResponse: (_req: DebugProtocol.Request, response: DebugProtocol.Response) => {
        responses.push(response);
      }
    } as any;

    const request: DebugProtocol.Request = {
      seq: 1,
      type: 'request',
      command: 'runInTerminal',
      arguments: {}
    };

    const result = await behavior.handleReverseRequest!(request, context);
    expect(result.handled).toBe(true);
    expect(responses).toHaveLength(1);
  });

  it('indicates session readiness only when paused', () => {
    const ready = RustAdapterPolicy.isSessionReady!(SessionState.PAUSED);
    const notReady = RustAdapterPolicy.isSessionReady!(SessionState.RUNNING);
    expect(ready).toBe(true);
    expect(notReady).toBe(false);
  });

  it('throws when building child session args', () => {
    expect(() => RustAdapterPolicy.buildChildStartArgs!()).toThrow();
  });
});

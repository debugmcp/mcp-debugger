import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DotnetAdapterPolicy } from '../../../packages/shared/src/interfaces/adapter-policy-dotnet.js';
import { SessionState } from '@debugmcp/shared';

describe('DotnetAdapterPolicy', () => {
  let originalNetcoredbgPath: string | undefined;

  beforeEach(() => {
    originalNetcoredbgPath = process.env.NETCOREDBG_PATH;
  });

  afterEach(() => {
    if (originalNetcoredbgPath === undefined) {
      delete process.env.NETCOREDBG_PATH;
    } else {
      process.env.NETCOREDBG_PATH = originalNetcoredbgPath;
    }
  });

  // ===== Identity =====

  it('has name "dotnet"', () => {
    expect(DotnetAdapterPolicy.name).toBe('dotnet');
  });

  it('does not support reverse start debugging', () => {
    expect(DotnetAdapterPolicy.supportsReverseStartDebugging).toBe(false);
  });

  it('has child session strategy "none"', () => {
    expect(DotnetAdapterPolicy.childSessionStrategy).toBe('none');
  });

  // ===== Child sessions =====

  it('rejects child session support', () => {
    expect(() => DotnetAdapterPolicy.buildChildStartArgs('', {})).toThrow(/does not support child sessions/);
  });

  it('shouldDeferParentConfigDone returns false', () => {
    expect(DotnetAdapterPolicy.shouldDeferParentConfigDone()).toBe(false);
  });

  it('isChildReadyEvent returns true for initialized event', () => {
    expect(DotnetAdapterPolicy.isChildReadyEvent({ event: 'initialized', seq: 1, type: 'event' } as any)).toBe(true);
  });

  it('isChildReadyEvent returns false for other events', () => {
    expect(DotnetAdapterPolicy.isChildReadyEvent({ event: 'stopped', seq: 1, type: 'event' } as any)).toBe(false);
  });

  // ===== Local variable extraction =====

  it('extracts local variables from Locals scope', () => {
    const frames = [{ id: 1 }];
    const scopes = {
      1: [{ name: 'Locals', variablesReference: 10 }]
    };
    const variables = {
      10: [
        { name: 'x', value: '42' },
        { name: 'y', value: 'hello' }
      ]
    };

    const locals = DotnetAdapterPolicy.extractLocalVariables(
      frames as any, scopes as any, variables as any
    );

    expect(locals).toEqual([
      { name: 'x', value: '42' },
      { name: 'y', value: 'hello' }
    ]);
  });

  it('filters compiler-generated variables by default', () => {
    const frames = [{ id: 1 }];
    const scopes = {
      1: [{ name: 'Locals', variablesReference: 10 }]
    };
    const variables = {
      10: [
        { name: 'x', value: '42' },
        { name: '<>c__DisplayClass0_0', value: '{...}' },
        { name: 'CS$<>8__locals1', value: '{...}' },
        { name: '$VB$Local_myVar', value: '10' },
        { name: '<>t__builder', value: '{...}' },
        { name: '<>s__1', value: '0' },
        { name: 'realVar', value: 'keep' }
      ]
    };

    const locals = DotnetAdapterPolicy.extractLocalVariables(
      frames as any, scopes as any, variables as any
    );

    expect(locals).toEqual([
      { name: 'x', value: '42' },
      { name: 'realVar', value: 'keep' }
    ]);
  });

  it('includes compiler-generated variables when includeSpecial is true', () => {
    const frames = [{ id: 1 }];
    const scopes = {
      1: [{ name: 'Locals', variablesReference: 10 }]
    };
    const variables = {
      10: [
        { name: 'x', value: '42' },
        { name: '<>c__DisplayClass0_0', value: '{...}' }
      ]
    };

    const locals = DotnetAdapterPolicy.extractLocalVariables(
      frames as any, scopes as any, variables as any, true
    );

    expect(locals).toHaveLength(2);
  });

  it('returns empty array when no stack frames', () => {
    const locals = DotnetAdapterPolicy.extractLocalVariables(
      [], {} as any, {} as any
    );
    expect(locals).toEqual([]);
  });

  it('returns empty array when no scopes for frame', () => {
    const locals = DotnetAdapterPolicy.extractLocalVariables(
      [{ id: 1 }] as any, {} as any, {} as any
    );
    expect(locals).toEqual([]);
  });

  it('returns empty array when scopes array is empty', () => {
    const locals = DotnetAdapterPolicy.extractLocalVariables(
      [{ id: 1 }] as any, { 1: [] } as any, {} as any
    );
    expect(locals).toEqual([]);
  });

  it('returns empty array when no Locals scope found', () => {
    const locals = DotnetAdapterPolicy.extractLocalVariables(
      [{ id: 1 }] as any,
      { 1: [{ name: 'Globals', variablesReference: 10 }] } as any,
      { 10: [{ name: 'x', value: '1' }] } as any
    );
    expect(locals).toEqual([]);
  });

  it('returns empty array when variables for scope are missing', () => {
    const locals = DotnetAdapterPolicy.extractLocalVariables(
      [{ id: 1 }] as any,
      { 1: [{ name: 'Locals', variablesReference: 99 }] } as any,
      {} as any
    );
    expect(locals).toEqual([]);
  });

  // ===== Scope and configuration =====

  it('getLocalScopeName returns ["Locals"]', () => {
    expect(DotnetAdapterPolicy.getLocalScopeName()).toEqual(['Locals']);
  });

  it('getDapAdapterConfiguration returns coreclr type', () => {
    expect(DotnetAdapterPolicy.getDapAdapterConfiguration()).toEqual({ type: 'coreclr' });
  });

  it('getDebuggerConfiguration returns expected values', () => {
    const config = DotnetAdapterPolicy.getDebuggerConfiguration();
    expect(config.requiresStrictHandshake).toBe(false);
    expect(config.skipConfigurationDone).toBe(false);
    expect(config.supportsVariableType).toBe(true);
  });

  // ===== Executable resolution =====

  it('resolves executable from provided path', () => {
    expect(DotnetAdapterPolicy.resolveExecutablePath('/custom/netcoredbg')).toBe('/custom/netcoredbg');
  });

  it('resolves executable from NETCOREDBG_PATH env var', () => {
    process.env.NETCOREDBG_PATH = '/env/netcoredbg';
    expect(DotnetAdapterPolicy.resolveExecutablePath()).toBe('/env/netcoredbg');
  });

  it('defaults to "netcoredbg" when no path or env var', () => {
    delete process.env.NETCOREDBG_PATH;
    expect(DotnetAdapterPolicy.resolveExecutablePath()).toBe('netcoredbg');
  });

  // ===== Session readiness =====

  it('isSessionReady returns true only when PAUSED', () => {
    expect(DotnetAdapterPolicy.isSessionReady(SessionState.PAUSED)).toBe(true);
    expect(DotnetAdapterPolicy.isSessionReady(SessionState.RUNNING)).toBe(false);
    expect(DotnetAdapterPolicy.isSessionReady(SessionState.IDLE)).toBe(false);
  });

  // ===== Command queueing =====

  it('does not require command queueing', () => {
    expect(DotnetAdapterPolicy.requiresCommandQueueing()).toBe(false);
  });

  it('shouldQueueCommand returns shouldQueue false', () => {
    const result = DotnetAdapterPolicy.shouldQueueCommand();
    expect(result.shouldQueue).toBe(false);
    expect(result.shouldDefer).toBe(false);
  });

  // ===== State management =====

  it('creates initial state with initialized and configurationDone false', () => {
    const state = DotnetAdapterPolicy.createInitialState();
    expect(state.initialized).toBe(false);
    expect(state.configurationDone).toBe(false);
  });

  it('updateStateOnCommand sets configurationDone', () => {
    const state = DotnetAdapterPolicy.createInitialState();
    DotnetAdapterPolicy.updateStateOnCommand('configurationDone', {}, state);
    expect(state.configurationDone).toBe(true);
  });

  it('updateStateOnCommand ignores other commands', () => {
    const state = DotnetAdapterPolicy.createInitialState();
    DotnetAdapterPolicy.updateStateOnCommand('continue', {}, state);
    expect(state.configurationDone).toBe(false);
  });

  it('updateStateOnEvent sets initialized on initialized event', () => {
    const state = DotnetAdapterPolicy.createInitialState();
    DotnetAdapterPolicy.updateStateOnEvent('initialized', {}, state);
    expect(state.initialized).toBe(true);
  });

  it('updateStateOnEvent ignores other events', () => {
    const state = DotnetAdapterPolicy.createInitialState();
    DotnetAdapterPolicy.updateStateOnEvent('stopped', {}, state);
    expect(state.initialized).toBe(false);
  });

  it('isInitialized reflects state', () => {
    const state = DotnetAdapterPolicy.createInitialState();
    expect(DotnetAdapterPolicy.isInitialized(state)).toBe(false);
    state.initialized = true;
    expect(DotnetAdapterPolicy.isInitialized(state)).toBe(true);
  });

  it('isConnected reflects initialized state', () => {
    const state = DotnetAdapterPolicy.createInitialState();
    expect(DotnetAdapterPolicy.isConnected(state)).toBe(false);
    state.initialized = true;
    expect(DotnetAdapterPolicy.isConnected(state)).toBe(true);
  });

  // ===== Adapter matching =====

  it('matches adapter command containing netcoredbg', () => {
    expect(DotnetAdapterPolicy.matchesAdapter({
      command: '/path/to/netcoredbg', args: ['--interpreter=vscode']
    })).toBe(true);
  });

  it('matches adapter args containing netcoredbg', () => {
    expect(DotnetAdapterPolicy.matchesAdapter({
      command: 'node', args: ['netcoredbg-bridge.js', '/path/to/netcoredbg']
    })).toBe(true);
  });

  it('matches adapter args containing dotnet', () => {
    expect(DotnetAdapterPolicy.matchesAdapter({
      command: 'node', args: ['dotnet-debug-adapter.js']
    })).toBe(true);
  });

  it('does not match unrelated adapter commands', () => {
    expect(DotnetAdapterPolicy.matchesAdapter({
      command: 'python', args: ['-m', 'debugpy.adapter']
    })).toBe(false);
  });

  // ===== Initialization behavior =====

  it('getInitializationBehavior returns sendAttachBeforeInitialized false', () => {
    const behavior = DotnetAdapterPolicy.getInitializationBehavior();
    expect(behavior.sendAttachBeforeInitialized).toBe(false);
  });

  it('getInitializationBehavior has sendLaunchBeforeConfig true (netcoredbg sends initialized before launch)', () => {
    const behavior = DotnetAdapterPolicy.getInitializationBehavior();
    expect(behavior.sendLaunchBeforeConfig).toBe(true);
  });

  // ===== DAP client behavior =====

  it('getDapClientBehavior returns expected defaults', () => {
    const behavior = DotnetAdapterPolicy.getDapClientBehavior();
    expect(behavior.mirrorBreakpointsToChild).toBe(false);
    expect(behavior.deferParentConfigDone).toBe(false);
    expect(behavior.pauseAfterChildAttach).toBe(false);
    expect(behavior.suppressPostAttachConfigDone).toBe(false);
    expect(behavior.childInitTimeout).toBe(5000);
  });

  it('getDapClientBehavior handles runInTerminal reverse request', async () => {
    const behavior = DotnetAdapterPolicy.getDapClientBehavior();
    const sendResponse = vi.fn();
    const context = { sendResponse } as any;
    const request = { command: 'runInTerminal', seq: 1, type: 'request' } as any;

    const result = await behavior.handleReverseRequest(request, context);

    expect(result.handled).toBe(true);
    expect(sendResponse).toHaveBeenCalledWith(request, {});
  });

  it('getDapClientBehavior does not handle unknown reverse requests', async () => {
    const behavior = DotnetAdapterPolicy.getDapClientBehavior();
    const context = { sendResponse: vi.fn() } as any;
    const request = { command: 'unknown', seq: 1, type: 'request' } as any;

    const result = await behavior.handleReverseRequest(request, context);

    expect(result.handled).toBe(false);
  });

  // ===== Stack frame filtering =====

  it('filterStackFrames removes frames without source file', () => {
    const frames = [
      { id: 1, name: 'MyMethod', file: '/app/Program.cs', line: 10, column: 0 },
      { id: 2, name: 'System.Runtime.CompilerServices.TaskAwaiter', file: '', line: 0, column: 0 },
      { id: 3, name: 'UserCode', file: '/app/Helper.cs', line: 20, column: 0 }
    ];

    const filtered = DotnetAdapterPolicy.filterStackFrames!(frames as any, false);

    expect(filtered).toHaveLength(2);
    expect(filtered[0].name).toBe('MyMethod');
    expect(filtered[1].name).toBe('UserCode');
  });

  it('filterStackFrames removes System.* and Microsoft.* frames', () => {
    const frames = [
      { id: 1, name: 'MyApp.Main', file: '/app/Program.cs', line: 10, column: 0 },
      { id: 2, name: 'System.Threading.Tasks.Task.Execute', file: '/dotnet/task.cs', line: 1, column: 0 },
      { id: 3, name: 'Microsoft.Extensions.Hosting.Host', file: '/dotnet/host.cs', line: 1, column: 0 }
    ];

    const filtered = DotnetAdapterPolicy.filterStackFrames!(frames as any, false);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('MyApp.Main');
  });

  it('filterStackFrames returns all frames when includeInternals is true', () => {
    const frames = [
      { id: 1, name: 'MyMethod', file: '/app/Program.cs', line: 10, column: 0 },
      { id: 2, name: 'System.Runtime.Something', file: '', line: 0, column: 0 }
    ];

    const filtered = DotnetAdapterPolicy.filterStackFrames!(frames as any, true);

    expect(filtered).toHaveLength(2);
  });

  // ===== isInternalFrame =====

  it('isInternalFrame returns true for frames without source', () => {
    expect(DotnetAdapterPolicy.isInternalFrame!({ id: 1, name: 'Test', file: '', line: 0, column: 0 } as any)).toBe(true);
  });

  it('isInternalFrame returns true for System.* frames', () => {
    expect(DotnetAdapterPolicy.isInternalFrame!({ id: 1, name: 'System.Threading.Thread.Start', file: '/a.cs', line: 1, column: 0 } as any)).toBe(true);
  });

  it('isInternalFrame returns true for Microsoft.* frames', () => {
    expect(DotnetAdapterPolicy.isInternalFrame!({ id: 1, name: 'Microsoft.Extensions.DI.Resolve', file: '/a.cs', line: 1, column: 0 } as any)).toBe(true);
  });

  it('isInternalFrame returns false for user frames', () => {
    expect(DotnetAdapterPolicy.isInternalFrame!({ id: 1, name: 'MyApp.DoWork', file: '/app/Worker.cs', line: 10, column: 0 } as any)).toBe(false);
  });

  // ===== Adapter spawn config =====

  it('getAdapterSpawnConfig uses adapterCommand when provided', () => {
    const payload = {
      adapterCommand: { command: 'node', args: ['bridge.js'], env: { FOO: 'bar' } },
      adapterHost: '127.0.0.1',
      adapterPort: 9876,
      logDir: '/logs'
    };

    const config = DotnetAdapterPolicy.getAdapterSpawnConfig!(payload as any);

    expect(config.command).toBe('node');
    expect(config.args).toEqual(['bridge.js']);
    expect(config.host).toBe('127.0.0.1');
    expect(config.port).toBe(9876);
    expect(config.env).toEqual({ FOO: 'bar' });
  });

  it('getAdapterSpawnConfig falls back to direct netcoredbg', () => {
    const payload = {
      executablePath: '/path/to/netcoredbg',
      adapterHost: '127.0.0.1',
      adapterPort: 5678,
      logDir: '/logs'
    };

    const config = DotnetAdapterPolicy.getAdapterSpawnConfig!(payload as any);

    expect(config.command).toBe('/path/to/netcoredbg');
    expect(config.args).toContain('--interpreter=vscode');
    expect(config.args).toContain('--server=5678');
  });

  it('getAdapterSpawnConfig uses default netcoredbg when no executable specified', () => {
    const payload = {
      adapterHost: '127.0.0.1',
      adapterPort: 4444,
      logDir: '/logs'
    };

    const config = DotnetAdapterPolicy.getAdapterSpawnConfig!(payload as any);

    expect(config.command).toBe('netcoredbg');
  });

  // ===== validateExecutable =====

  describe('validateExecutable', () => {
    it('resolves true for a command that exists and exits 0', async () => {
      // node --version always exits 0 with output
      const result = await DotnetAdapterPolicy.validateExecutable!(process.execPath);
      expect(result).toBe(true);
    }, 10000);

    it('resolves false for a command that does not exist', async () => {
      const result = await DotnetAdapterPolicy.validateExecutable!('nonexistent_command_that_does_not_exist_12345');
      expect(result).toBe(false);
    }, 10000);
  });
});

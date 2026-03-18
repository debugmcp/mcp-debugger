import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GoAdapterPolicy } from '../../../packages/shared/src/interfaces/adapter-policy-go.js';
import { SessionState } from '@debugmcp/shared';

describe('GoAdapterPolicy', () => {
  let originalDlvPath: string | undefined;

  beforeEach(() => {
    originalDlvPath = process.env.DLV_PATH;
  });

  afterEach(() => {
    if (originalDlvPath === undefined) {
      delete process.env.DLV_PATH;
    } else {
      process.env.DLV_PATH = originalDlvPath;
    }
  });

  // ===== Identity =====

  it('has name "go"', () => {
    expect(GoAdapterPolicy.name).toBe('go');
  });

  it('does not support reverse start debugging', () => {
    expect(GoAdapterPolicy.supportsReverseStartDebugging).toBe(false);
  });

  it('has child session strategy "none"', () => {
    expect(GoAdapterPolicy.childSessionStrategy).toBe('none');
  });

  // ===== Child sessions =====

  it('rejects child session support', () => {
    expect(() => GoAdapterPolicy.buildChildStartArgs('', {})).toThrow(/does not support child sessions/);
  });

  it('shouldDeferParentConfigDone returns false', () => {
    expect(GoAdapterPolicy.shouldDeferParentConfigDone()).toBe(false);
  });

  it('isChildReadyEvent returns true for initialized event', () => {
    expect(GoAdapterPolicy.isChildReadyEvent({ event: 'initialized', seq: 1, type: 'event' } as any)).toBe(true);
  });

  it('isChildReadyEvent returns false for other events', () => {
    expect(GoAdapterPolicy.isChildReadyEvent({ event: 'stopped', seq: 1, type: 'event' } as any)).toBe(false);
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

    const locals = GoAdapterPolicy.extractLocalVariables(
      frames as any, scopes as any, variables as any
    );

    expect(locals).toEqual([
      { name: 'x', value: '42' },
      { name: 'y', value: 'hello' }
    ]);
  });

  it('also accepts "Local" scope name', () => {
    const frames = [{ id: 1 }];
    const scopes = {
      1: [{ name: 'Local', variablesReference: 10 }]
    };
    const variables = {
      10: [{ name: 'x', value: '1' }]
    };

    const locals = GoAdapterPolicy.extractLocalVariables(
      frames as any, scopes as any, variables as any
    );

    expect(locals).toEqual([{ name: 'x', value: '1' }]);
  });

  it('filters underscore-prefixed variables but keeps blank identifier _', () => {
    const frames = [{ id: 1 }];
    const scopes = {
      1: [{ name: 'Locals', variablesReference: 10 }]
    };
    const variables = {
      10: [
        { name: 'x', value: '42' },
        { name: '_internal', value: 'hidden' },
        { name: '__dunder', value: 'hidden' },
        { name: '_', value: 'blank' }
      ]
    };

    const locals = GoAdapterPolicy.extractLocalVariables(
      frames as any, scopes as any, variables as any
    );

    expect(locals).toEqual([
      { name: 'x', value: '42' },
      { name: '_', value: 'blank' }
    ]);
  });

  it('includes all variables when includeSpecial is true', () => {
    const frames = [{ id: 1 }];
    const scopes = {
      1: [{ name: 'Locals', variablesReference: 10 }]
    };
    const variables = {
      10: [
        { name: 'x', value: '42' },
        { name: '_internal', value: 'hidden' }
      ]
    };

    const locals = GoAdapterPolicy.extractLocalVariables(
      frames as any, scopes as any, variables as any, true
    );

    expect(locals).toHaveLength(2);
  });

  it('returns empty array when no stack frames', () => {
    const locals = GoAdapterPolicy.extractLocalVariables(
      [], {} as any, {} as any
    );
    expect(locals).toEqual([]);
  });

  it('returns empty array when no scopes for frame', () => {
    const locals = GoAdapterPolicy.extractLocalVariables(
      [{ id: 1 }] as any, {} as any, {} as any
    );
    expect(locals).toEqual([]);
  });

  it('returns empty array when scopes array is empty', () => {
    const locals = GoAdapterPolicy.extractLocalVariables(
      [{ id: 1 }] as any, { 1: [] } as any, {} as any
    );
    expect(locals).toEqual([]);
  });

  it('returns empty array when no Locals scope found', () => {
    const locals = GoAdapterPolicy.extractLocalVariables(
      [{ id: 1 }] as any,
      { 1: [{ name: 'Globals', variablesReference: 10 }] } as any,
      { 10: [{ name: 'x', value: '1' }] } as any
    );
    expect(locals).toEqual([]);
  });

  it('returns empty array when variables for scope are missing', () => {
    const locals = GoAdapterPolicy.extractLocalVariables(
      [{ id: 1 }] as any,
      { 1: [{ name: 'Locals', variablesReference: 99 }] } as any,
      {} as any
    );
    expect(locals).toEqual([]);
  });

  // ===== Scope and configuration =====

  it('getLocalScopeName returns ["Locals", "Arguments"]', () => {
    expect(GoAdapterPolicy.getLocalScopeName()).toEqual(['Locals', 'Arguments']);
  });

  it('getDapAdapterConfiguration returns dlv-dap type', () => {
    expect(GoAdapterPolicy.getDapAdapterConfiguration()).toEqual({ type: 'dlv-dap' });
  });

  it('getDebuggerConfiguration returns expected values', () => {
    const config = GoAdapterPolicy.getDebuggerConfiguration();
    expect(config.requiresStrictHandshake).toBe(false);
    expect(config.skipConfigurationDone).toBe(false);
    expect(config.supportsVariableType).toBe(true);
  });

  // ===== Executable resolution =====

  it('resolves executable from provided path', () => {
    expect(GoAdapterPolicy.resolveExecutablePath('/custom/dlv')).toBe('/custom/dlv');
  });

  it('resolves executable from DLV_PATH env var', () => {
    process.env.DLV_PATH = '/env/dlv';
    expect(GoAdapterPolicy.resolveExecutablePath()).toBe('/env/dlv');
  });

  it('defaults to "dlv" when no path or env var', () => {
    delete process.env.DLV_PATH;
    expect(GoAdapterPolicy.resolveExecutablePath()).toBe('dlv');
  });

  // ===== Session readiness =====

  it('isSessionReady returns true only when PAUSED', () => {
    expect(GoAdapterPolicy.isSessionReady(SessionState.PAUSED)).toBe(true);
    expect(GoAdapterPolicy.isSessionReady(SessionState.RUNNING)).toBe(false);
    expect(GoAdapterPolicy.isSessionReady(SessionState.IDLE)).toBe(false);
  });

  // ===== Command queueing =====

  it('does not require command queueing', () => {
    expect(GoAdapterPolicy.requiresCommandQueueing()).toBe(false);
  });

  it('shouldQueueCommand returns shouldQueue false', () => {
    const result = GoAdapterPolicy.shouldQueueCommand();
    expect(result.shouldQueue).toBe(false);
    expect(result.shouldDefer).toBe(false);
  });

  // ===== State management =====

  it('creates initial state with initialized and configurationDone false', () => {
    const state = GoAdapterPolicy.createInitialState();
    expect(state.initialized).toBe(false);
    expect(state.configurationDone).toBe(false);
  });

  it('updateStateOnCommand sets configurationDone', () => {
    const state = GoAdapterPolicy.createInitialState();
    GoAdapterPolicy.updateStateOnCommand('configurationDone', {}, state);
    expect(state.configurationDone).toBe(true);
  });

  it('updateStateOnCommand ignores other commands', () => {
    const state = GoAdapterPolicy.createInitialState();
    GoAdapterPolicy.updateStateOnCommand('continue', {}, state);
    expect(state.configurationDone).toBe(false);
  });

  it('updateStateOnEvent sets initialized on initialized event', () => {
    const state = GoAdapterPolicy.createInitialState();
    GoAdapterPolicy.updateStateOnEvent('initialized', {}, state);
    expect(state.initialized).toBe(true);
  });

  it('updateStateOnEvent ignores other events', () => {
    const state = GoAdapterPolicy.createInitialState();
    GoAdapterPolicy.updateStateOnEvent('stopped', {}, state);
    expect(state.initialized).toBe(false);
  });

  it('isInitialized reflects state', () => {
    const state = GoAdapterPolicy.createInitialState();
    expect(GoAdapterPolicy.isInitialized(state)).toBe(false);
    state.initialized = true;
    expect(GoAdapterPolicy.isInitialized(state)).toBe(true);
  });

  it('isConnected reflects initialized state', () => {
    const state = GoAdapterPolicy.createInitialState();
    expect(GoAdapterPolicy.isConnected(state)).toBe(false);
    state.initialized = true;
    expect(GoAdapterPolicy.isConnected(state)).toBe(true);
  });

  // ===== Adapter matching =====

  it('matches adapter command "dlv"', () => {
    expect(GoAdapterPolicy.matchesAdapter({
      command: 'dlv', args: ['dap']
    })).toBe(true);
  });

  it('matches adapter command path ending with /dlv', () => {
    expect(GoAdapterPolicy.matchesAdapter({
      command: '/usr/local/bin/dlv', args: ['dap']
    })).toBe(true);
  });

  it('matches adapter args containing "dlv dap"', () => {
    expect(GoAdapterPolicy.matchesAdapter({
      command: 'some-wrapper', args: ['dlv dap', '--listen=:0']
    })).toBe(true);
  });

  it('matches adapter args containing "delve"', () => {
    expect(GoAdapterPolicy.matchesAdapter({
      command: 'some-wrapper', args: ['run', 'delve']
    })).toBe(true);
  });

  it('does not match unrelated adapter commands', () => {
    expect(GoAdapterPolicy.matchesAdapter({
      command: 'python', args: ['-m', 'debugpy.adapter']
    })).toBe(false);
  });

  // ===== Initialization behavior =====

  it('getInitializationBehavior returns expected defaults', () => {
    const behavior = GoAdapterPolicy.getInitializationBehavior();
    expect(behavior.deferConfigDone).toBe(false);
    expect(behavior.defaultStopOnEntry).toBe(false);
    expect(behavior.sendLaunchBeforeConfig).toBe(true);
  });

  // ===== DAP client behavior =====

  it('getDapClientBehavior returns expected defaults', () => {
    const behavior = GoAdapterPolicy.getDapClientBehavior();
    expect(behavior.mirrorBreakpointsToChild).toBe(false);
    expect(behavior.deferParentConfigDone).toBe(false);
    expect(behavior.pauseAfterChildAttach).toBe(false);
    expect(behavior.suppressPostAttachConfigDone).toBe(false);
    expect(behavior.childInitTimeout).toBe(5000);
  });

  it('getDapClientBehavior handles runInTerminal reverse request', async () => {
    const behavior = GoAdapterPolicy.getDapClientBehavior();
    const sendResponse = vi.fn();
    const context = { sendResponse } as any;
    const request = { command: 'runInTerminal', seq: 1, type: 'request' } as any;

    const result = await behavior.handleReverseRequest!(request, context);

    expect(result.handled).toBe(true);
    expect(sendResponse).toHaveBeenCalledWith(request, {});
  });

  it('getDapClientBehavior does not handle unknown reverse requests', async () => {
    const behavior = GoAdapterPolicy.getDapClientBehavior();
    const context = { sendResponse: vi.fn() } as any;
    const request = { command: 'unknown', seq: 1, type: 'request' } as any;

    const result = await behavior.handleReverseRequest!(request, context);

    expect(result.handled).toBe(false);
  });

  // ===== Stack frame filtering =====

  it('filterStackFrames removes runtime and testing frames', () => {
    const frames = [
      { id: 1, name: 'main.Run', file: '/app/main.go', line: 10, column: 0 },
      { id: 2, name: 'runtime.goexit', file: '/usr/local/go/src/runtime/asm_amd64.s', line: 1, column: 0 },
      { id: 3, name: 'testing.tRunner', file: '/usr/local/go/src/testing/testing.go', line: 1, column: 0 },
      { id: 4, name: 'helper.Do', file: '/app/helper.go', line: 20, column: 0 }
    ];

    const filtered = GoAdapterPolicy.filterStackFrames!(frames as any, false);

    expect(filtered).toHaveLength(2);
    expect(filtered[0].name).toBe('main.Run');
    expect(filtered[1].name).toBe('helper.Do');
  });

  it('filterStackFrames returns all frames when includeInternals is true', () => {
    const frames = [
      { id: 1, name: 'main.Run', file: '/app/main.go', line: 10, column: 0 },
      { id: 2, name: 'runtime.goexit', file: '/usr/local/go/src/runtime/asm_amd64.s', line: 1, column: 0 }
    ];

    const filtered = GoAdapterPolicy.filterStackFrames!(frames as any, true);

    expect(filtered).toHaveLength(2);
  });

  it('filterStackFrames handles frames with empty file path', () => {
    const frames = [
      { id: 1, name: 'main.Run', file: '/app/main.go', line: 10, column: 0 },
      { id: 2, name: 'unknown', file: '', line: 0, column: 0 }
    ];

    const filtered = GoAdapterPolicy.filterStackFrames!(frames as any, false);

    // Empty file path does not match /runtime/ or /testing/, so it's kept
    expect(filtered).toHaveLength(2);
  });

  // ===== isInternalFrame =====

  it('isInternalFrame returns true for runtime frames', () => {
    expect(GoAdapterPolicy.isInternalFrame!({ id: 1, name: 'runtime.goexit', file: '/usr/local/go/src/runtime/asm.s', line: 1, column: 0 } as any)).toBe(true);
  });

  it('isInternalFrame returns true for testing frames', () => {
    expect(GoAdapterPolicy.isInternalFrame!({ id: 1, name: 'testing.tRunner', file: '/usr/local/go/src/testing/testing.go', line: 1, column: 0 } as any)).toBe(true);
  });

  it('isInternalFrame returns false for user frames', () => {
    expect(GoAdapterPolicy.isInternalFrame!({ id: 1, name: 'main.Run', file: '/app/main.go', line: 10, column: 0 } as any)).toBe(false);
  });

  // ===== Adapter spawn config =====

  it('getAdapterSpawnConfig uses adapterCommand when provided', () => {
    const payload = {
      adapterCommand: { command: 'custom-dlv', args: ['dap'], env: { GOPATH: '/go' } },
      adapterHost: '127.0.0.1',
      adapterPort: 9876,
      logDir: '/logs'
    };

    const config = GoAdapterPolicy.getAdapterSpawnConfig!(payload as any);

    expect(config.command).toBe('custom-dlv');
    expect(config.args).toEqual(['dap']);
    expect(config.host).toBe('127.0.0.1');
    expect(config.port).toBe(9876);
    expect(config.env).toEqual({ GOPATH: '/go' });
  });

  it('getAdapterSpawnConfig builds default dlv dap command', () => {
    const payload = {
      executablePath: '/usr/local/bin/dlv',
      adapterHost: '127.0.0.1',
      adapterPort: 5678,
      logDir: '/logs'
    };

    const config = GoAdapterPolicy.getAdapterSpawnConfig!(payload as any);

    expect(config.command).toBe('/usr/local/bin/dlv');
    expect(config.args).toContain('dap');
    expect(config.args).toContain('--listen');
    expect(config.args).toContain('127.0.0.1:5678');
    expect(config.args).toContain('--log');
    expect(config.args).toContain('--log-dest');
    expect(config.args).toContain('/logs');
  });

  it('getAdapterSpawnConfig defaults to "dlv" when no executable specified', () => {
    const payload = {
      adapterHost: '127.0.0.1',
      adapterPort: 4444,
      logDir: '/logs'
    };

    const config = GoAdapterPolicy.getAdapterSpawnConfig!(payload as any);

    expect(config.command).toBe('dlv');
  });

  // ===== validateExecutable =====

  describe('validateExecutable', () => {
    it('resolves true for a command that exists and exits 0', async () => {
      // validateExecutable runs `command version` — git supports `git version`
      const result = await GoAdapterPolicy.validateExecutable!('git');
      expect(result).toBe(true);
    }, 10000);

    it('resolves false for a command that does not exist', async () => {
      const result = await GoAdapterPolicy.validateExecutable!('nonexistent_command_that_does_not_exist_12345');
      expect(result).toBe(false);
    }, 10000);
  });
});

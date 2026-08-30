import { describe, it, expect } from 'vitest';
import type { DebugProtocol } from '@vscode/debugprotocol';
import * as path from 'path';
import { CppAdapterPolicy } from '../../src/interfaces/adapter-policy-cpp.js';
import type { StopReasonContext } from '../../src/interfaces/adapter-policy.js';
import { SessionState } from '@debugmcp/shared';

const baseContext: StopReasonContext = {
  pausePending: false,
  lineBreakpointCount: 0,
  functionBreakpointCount: 0
};

describe('CppAdapterPolicy', () => {
  it('identifies as the cpp policy with LLDB capabilities', () => {
    expect(CppAdapterPolicy.name).toBe('cpp');
    expect(CppAdapterPolicy.supportsLogPoints).toBe(true);
    expect(CppAdapterPolicy.supportsFunctionBreakpoints).toBe(true);
    expect(CppAdapterPolicy.supportsReverseStartDebugging).toBe(false);
    expect(CppAdapterPolicy.childSessionStrategy).toBe('none');
    expect(CppAdapterPolicy.getDapAdapterConfiguration!()).toEqual({ type: 'lldb' });
  });

  // Unlike Rust (issue #303), a bare 'main' in C/C++ IS the user's function —
  // no CRT-trampoline hint must fire.
  it('does not define a function-breakpoint name hint', () => {
    expect(CppAdapterPolicy.functionBreakpointNameHint).toBeUndefined();
  });

  describe('normalizeStopReason (shared CodeLLDB quirks)', () => {
    const normalize = CppAdapterPolicy.normalizeStopReason!;

    it("relabels internal-breakpoint hits disjoint from user breakpoints as 'exception'", () => {
      const result = normalize(
        'breakpoint',
        { reason: 'breakpoint', hitBreakpointIds: [99] },
        { ...baseContext, userBreakpointIds: new Set([1, 2]) }
      );
      expect(result).toBe('exception');
    });

    it("relabels all-function-breakpoint hits as 'function breakpoint'", () => {
      const result = normalize(
        'breakpoint',
        { reason: 'breakpoint', hitBreakpointIds: [5] },
        {
          ...baseContext,
          userBreakpointIds: new Set([5]),
          functionBreakpointIds: new Set([5])
        }
      );
      expect(result).toBe('function breakpoint');
    });

    it('keeps the raw reason when hit ids are missing', () => {
      expect(
        normalize('breakpoint', { reason: 'breakpoint' }, { ...baseContext, userBreakpointIds: new Set([1]) })
      ).toBeUndefined();
    });

    it("maps SIGSTOP exception stops to 'pause'", () => {
      expect(
        normalize('exception', { reason: 'exception', description: 'signal SIGSTOP' }, baseContext)
      ).toBe('pause');
    });

    it("maps Windows 0x80000003 to 'pause' only while a pause is pending", () => {
      const body = { reason: 'exception', description: 'Exception 0x80000003 encountered at address 0x7ff6' };
      expect(normalize('exception', body, baseContext)).toBeUndefined();
      expect(normalize('exception', body, { ...baseContext, pausePending: true })).toBe('pause');
    });
  });

  describe('extractLocalVariables (shared LLDB scope handling)', () => {
    const frame: DebugProtocol.StackFrame = { id: 1, name: 'main', line: 1, column: 1 };

    it('reads the Local/Locals scope and filters LLDB internals', () => {
      const scopes: Record<number, DebugProtocol.Scope[]> = {
        1: [{ name: 'Local', variablesReference: 9, expensive: false }]
      };
      const vars: Record<number, DebugProtocol.Variable[]> = {
        9: [
          { name: '$0', value: 'skip', variablesReference: 0 },
          { name: '__vec_ptr', value: 'skip', variablesReference: 0 },
          { name: 'count', value: '42', variablesReference: 0 }
        ]
      };
      const filtered = CppAdapterPolicy.extractLocalVariables!([frame], scopes, vars);
      expect(filtered.variables.map((v) => v.name)).toEqual(['count']);
      // The scope that supplied them is named, so the session layer can
      // report the adapter's own label and attribute truncation to it.
      expect(filtered.scopeRefs).toEqual([9]);
    });
  });

  describe('getInitializationBehavior (C++ exception filters)', () => {
    it('sends attach before the initialized event (CodeLLDB emits initialized only after launch/attach)', () => {
      const behavior = CppAdapterPolicy.getInitializationBehavior!();
      expect(behavior.sendAttachBeforeInitialized).toBe(true);
    });

    it("maps 'uncaught' to no filters and 'all' to cpp_throw", () => {
      const behavior = CppAdapterPolicy.getInitializationBehavior!();
      // LLDB has no uncaught-only C++ filter: cpp_throw fires on EVERY throw,
      // and an uncaught exception reaches std::terminate -> SIGABRT, which
      // LLDB stops on natively. So the 'uncaught' launch default sends no
      // filters at all instead of the noisy cpp_throw.
      expect(behavior.exceptionFilters?.uncaught).toEqual([]);
      expect(behavior.exceptionFilters?.all).toEqual(['cpp_throw']);
      expect(behavior.defaultExceptionBreakMode).toBe('uncaught');
    });
  });

  describe('getAdapterSpawnConfig', () => {
    const payload = {
      executablePath: '',
      adapterHost: '127.0.0.1',
      adapterPort: 4711,
      logDir: '/tmp/logs',
      scriptPath: 'main.cpp'
    };

    it('uses a provided adapterCommand verbatim with win32 stdio forwarding', () => {
      const config = CppAdapterPolicy.getAdapterSpawnConfig!(
        {
          ...payload,
          adapterCommand: { command: 'C:/vendor/codelldb.exe', args: ['--port', '4711'], env: { FOO: '1' } }
        },
        'win32',
        'x64'
      );
      expect(config).toMatchObject({
        mode: 'spawn',
        command: 'C:/vendor/codelldb.exe',
        args: ['--port', '4711'],
        port: 4711
      });
      expect((config as { forwardStdio?: unknown }).forwardStdio).toEqual({});
    });

    it('omits stdio forwarding on POSIX', () => {
      const config = CppAdapterPolicy.getAdapterSpawnConfig!(
        { ...payload, adapterCommand: { command: 'codelldb', args: [] } },
        'linux',
        'x64'
      );
      expect((config as { forwardStdio?: unknown }).forwardStdio).toBeUndefined();
    });

    it('falls back to the shared codelldb-common vendor tree', () => {
      const config = CppAdapterPolicy.getAdapterSpawnConfig!(payload, 'linux', 'x64');
      expect(config).toBeDefined();
      const command = (config as { command: string }).command;
      expect(command).toContain(path.join('packages', 'codelldb-common', 'vendor', 'codelldb', 'linux-x64'));
    });

    it('enables the native PDB reader in the win32 fallback env', () => {
      const config = CppAdapterPolicy.getAdapterSpawnConfig!(payload, 'win32', 'x64');
      const env = (config as { env?: NodeJS.ProcessEnv }).env;
      expect(env?.LLDB_USE_NATIVE_PDB_READER).toBe('1');
    });

    it('defaults platform/arch to the host when omitted', () => {
      const config = CppAdapterPolicy.getAdapterSpawnConfig!(payload);
      expect((config as { command: string }).command).toBeTruthy();
      expect((config as { args: string[] }).args).toEqual(['--port', '4711']);
    });
  });

  describe('matchesAdapter', () => {
    it('matches CodeLLDB command shapes', () => {
      expect(CppAdapterPolicy.matchesAdapter!({ command: '/opt/codelldb', args: [] })).toBe(true);
      expect(CppAdapterPolicy.matchesAdapter!({ command: 'node', args: ['debugpy'] })).toBe(false);
    });
  });

  it('reports session ready when paused', () => {
    expect(CppAdapterPolicy.isSessionReady!(SessionState.PAUSED)).toBe(true);
    expect(CppAdapterPolicy.isSessionReady!(SessionState.RUNNING)).toBe(false);
  });

  it('throws when building child session args', () => {
    expect(() => CppAdapterPolicy.buildChildStartArgs!('pending-1', {})).toThrow(
      'CppAdapterPolicy does not support child sessions'
    );
  });

  it("treats only 'initialized' as the child-ready event", () => {
    const event = (name: string): DebugProtocol.Event => ({ seq: 1, type: 'event', event: name });
    expect(CppAdapterPolicy.isChildReadyEvent!(event('initialized'))).toBe(true);
    expect(CppAdapterPolicy.isChildReadyEvent!(event('stopped'))).toBe(false);
  });

  it('reads locals from the shared LLDB scope names', () => {
    expect(CppAdapterPolicy.getLocalScopeName!()).toEqual(['Local', 'Locals']);
  });

  it('resolves executable path from inputs only, deferring to the adapter otherwise', () => {
    expect(CppAdapterPolicy.resolveExecutablePath!('/custom/codelldb')).toBe('/custom/codelldb');
    // CODELLDB_PATH env var is handled in codelldb-resolver.ts, not here
    expect(CppAdapterPolicy.resolveExecutablePath!()).toBeUndefined();
  });

  it('reports CodeLLDB debugger capabilities', () => {
    expect(CppAdapterPolicy.getDebuggerConfiguration!()).toEqual({
      requiresStrictHandshake: false,
      skipConfigurationDone: false,
      supportsVariableType: true,
      supportsValueFormat: true,
      supportsMemoryReferences: true
    });
  });

  it('never queues commands', () => {
    expect(CppAdapterPolicy.requiresCommandQueueing!()).toBe(false);
    const handling = CppAdapterPolicy.shouldQueueCommand!('next', CppAdapterPolicy.createInitialState!());
    expect(handling).toEqual({
      shouldQueue: false,
      shouldDefer: false,
      reason: 'C++/CodeLLDB adapter does not queue commands'
    });
  });

  it('tracks initialization state via the shared LLDB state helpers', () => {
    const state = CppAdapterPolicy.createInitialState!();
    expect(CppAdapterPolicy.isInitialized!(state)).toBe(false);
    CppAdapterPolicy.updateStateOnEvent!('initialized', undefined, state);
    expect(CppAdapterPolicy.isInitialized!(state)).toBe(true);
    CppAdapterPolicy.updateStateOnCommand!('configurationDone', undefined, state);
    expect(state.configurationDone).toBe(true);
  });

  describe('stack frame filtering (issue #369)', () => {
    const frame = (name: string, file: string, id = 1) =>
      ({ id, name, file, line: 1, column: 1 });

    const cases: Array<{ desc: string; name: string; file: string; internal: boolean }> = [
      { desc: 'LLDB-synthesized unnamed symbol', name: '___lldb_unnamed_symbol123', file: '<unknown_source>', internal: true },
      { desc: 'unnamed symbol with leading @ sigil', name: '@___lldb_unnamed_symbol3688', file: '<unknown_source>', internal: true },
      { desc: 'glibc __GI_ alias', name: '__GI___clock_nanosleep', file: '../sysdeps/unix/sysv/linux/clock_nanosleep.c', internal: true },
      { desc: 'syscall wrapper without source', name: 'clock_nanosleep', file: '<unknown_source>', internal: true },
      { desc: 'syscall wrapper with empty source', name: 'nanosleep', file: '', internal: true },
      { desc: 'syscall wrapper under system path', name: 'epoll_wait', file: '/usr/lib/x86_64-linux-gnu/libc.so.6', internal: true },
      { desc: 'libc start under glibc build path', name: '__libc_start_main', file: './nptl/libc_start_call_main.c', internal: true },
      { desc: 'CRT entry point without source', name: '_start', file: '<unknown_source>', internal: true },
      { desc: 'user function NAMED nanosleep with workspace source', name: 'nanosleep', file: '/home/user/project/src/timing.cpp', internal: false },
      { desc: 'user function named select with workspace source', name: 'select', file: '/home/user/project/src/picker.cpp', internal: false },
      { desc: 'normal user frame', name: 'busy_wait()', file: '/home/user/project/pause_test.cpp', internal: false },
      { desc: 'plain user main', name: 'main', file: '/home/user/project/main.cpp', internal: false },
      { desc: 'user frame with no source but non-matching name', name: 'stripped_user_fn', file: '<unknown_source>', internal: false },
    ];

    it.each(cases)('isInternalFrame: $desc -> $internal', ({ name, file, internal }) => {
      expect(CppAdapterPolicy.isInternalFrame!(frame(name, file))).toBe(internal);
    });

    it('filterStackFrames hides internal frames and keeps user frames in order', () => {
      const frames = [
        frame('busy_wait()', '/home/user/project/pause_test.cpp', 1),
        frame('__GI___clock_nanosleep', '../sysdeps/unix/sysv/linux/clock_nanosleep.c', 2),
        frame('main', '/home/user/project/pause_test.cpp', 3),
        frame('__libc_start_main', '<unknown_source>', 4),
        frame('_start', '<unknown_source>', 5),
      ];
      const filtered = CppAdapterPolicy.filterStackFrames!(frames, false);
      expect(filtered.map((f) => f.id)).toEqual([1, 3]);
    });

    it('filterStackFrames returns every frame when includeInternals is set', () => {
      const frames = [
        frame('@___lldb_unnamed_symbol3688', '<unknown_source>', 1),
        frame('__libc_start_main', '<unknown_source>', 2),
      ];
      expect(CppAdapterPolicy.filterStackFrames!(frames, true)).toEqual(frames);
    });

    it('filterStackFrames has no empty-result fallback of its own (central #346 guarantee)', () => {
      const frames = [
        frame('@___lldb_unnamed_symbol3688', '<unknown_source>', 1),
        frame('__libc_start_main', '<unknown_source>', 2),
      ];
      expect(CppAdapterPolicy.filterStackFrames!(frames, false)).toEqual([]);
    });
  });
});

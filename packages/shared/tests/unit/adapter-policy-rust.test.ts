import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { EventEmitter } from 'events';
import { RustAdapterPolicy } from '../../src/interfaces/adapter-policy-rust.js';
import type { StopReasonContext } from '../../src/interfaces/adapter-policy.js';
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

describe('RustAdapterPolicy', () => {
  beforeEach(() => {
    accessMock.mockReset();
    spawnMock.mockReset();
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
      expect(filtered.variables.map(v => v.name)).toEqual(['app']);
      expect(filtered.scopeRefs).toEqual([42]);
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
      expect(result.variables).toHaveLength(2);
    });
  });

  // A bare 'main' resolves to the C runtime's entry point on rust targets
  // (issue #303); the hint fires only for that exact name.
  describe('functionBreakpointNameHint', () => {
    const hint = RustAdapterPolicy.functionBreakpointNameHint!;

    it("warns for the exact bare name 'main'", () => {
      expect(hint('main')).toMatch(/C runtime/);
      expect(hint('main')).toContain('my_crate::main');
    });

    it('stays silent for qualified and other bare names', () => {
      expect(hint('hello_world::main')).toBeUndefined();
      expect(hint('compute')).toBeUndefined();
      expect(hint('MyStruct::new')).toBeUndefined();
    });
  });

  describe('normalizeStopReason', () => {
    const normalize = RustAdapterPolicy.normalizeStopReason!;
    const ctx = (partial: Partial<StopReasonContext> = {}): StopReasonContext => ({
      pausePending: false,
      lineBreakpointCount: 0,
      functionBreakpointCount: 0,
      ...partial
    });

    it('maps SIGSTOP exception in description to pause', () => {
      expect(
        normalize('exception', { reason: 'exception', description: 'signal SIGSTOP' }, ctx())
      ).toBe('pause');
    });

    it('maps SIGSTOP exception in text to pause', () => {
      expect(
        normalize('exception', { reason: 'exception', text: 'Process stopped by SIGSTOP' }, ctx())
      ).toBe('pause');
    });

    it('leaves real exceptions untouched even while a pause is pending', () => {
      expect(
        normalize('exception', { reason: 'exception', description: 'signal SIGSEGV' }, ctx({ pausePending: true }))
      ).toBeUndefined();
      expect(
        normalize('exception', { reason: 'exception', text: 'panicked at src/main.rs:3' }, ctx({ pausePending: true }))
      ).toBeUndefined();
    });

    it('maps a detail-less exception to pause only when a pause is pending', () => {
      expect(normalize('exception', { reason: 'exception' }, ctx({ pausePending: true }))).toBe('pause');
      expect(normalize('exception', undefined, ctx({ pausePending: true }))).toBe('pause');
      expect(normalize('exception', { reason: 'exception' }, ctx())).toBeUndefined();
    });

    // Windows delivers a user-initiated pause via DebugBreakProcess: the
    // injected break-in thread raises EXCEPTION_BREAKPOINT (0x80000003),
    // reported by CodeLLDB as an exception stop (issue #275).
    it('maps the Windows break-in exception to pause while a pause is pending', () => {
      expect(
        normalize(
          'exception',
          { reason: 'exception', description: 'Exception 0x80000003 encountered at address 0x7ffe8b4dd7bd' },
          ctx({ pausePending: true })
        )
      ).toBe('pause');
    });

    it('keeps a break-in exception when no pause is in flight (__debugbreak in user code)', () => {
      expect(
        normalize(
          'exception',
          { reason: 'exception', description: 'Exception 0x80000003 encountered at address 0x7ffe8b4dd7bd' },
          ctx()
        )
      ).toBeUndefined();
    });

    it('never touches step or pause reasons', () => {
      expect(normalize('step', { reason: 'step' }, ctx())).toBeUndefined();
      expect(normalize('pause', { reason: 'pause' }, ctx({ pausePending: true }))).toBeUndefined();
    });

    // Panic stops arrive as reason 'breakpoint' because CodeLLDB implements
    // the rust_panic filter as an internal breakpoint (issue #260). Live
    // capture (Windows/GNU, CodeLLDB 1.11.8): the stopped body carries only
    // {allThreadsStopped, hitBreakpointIds, reason, threadId} — no
    // description/text — so the discriminator is hitBreakpointIds disjoint
    // from the session's known user-breakpoint adapter ids.
    describe('panic breakpoint stops (issue #260)', () => {
      it('maps a breakpoint stop with no user breakpoints to exception', () => {
        expect(
          normalize(
            'breakpoint',
            { reason: 'breakpoint', hitBreakpointIds: [1] },
            ctx({ userBreakpointIds: new Set<number>() })
          )
        ).toBe('exception');
      });

      it('maps a breakpoint stop with ids disjoint from user breakpoints to exception', () => {
        expect(
          normalize(
            'breakpoint',
            { reason: 'breakpoint', hitBreakpointIds: [2] },
            ctx({ userBreakpointIds: new Set([1]) })
          )
        ).toBe('exception');
      });

      it('keeps a genuine user breakpoint hit as breakpoint', () => {
        expect(
          normalize(
            'breakpoint',
            { reason: 'breakpoint', hitBreakpointIds: [1] },
            ctx({ userBreakpointIds: new Set([1]) })
          )
        ).toBeUndefined();
      });

      it('keeps the stop when any hit id matches a user breakpoint', () => {
        expect(
          normalize(
            'breakpoint',
            { reason: 'breakpoint', hitBreakpointIds: [2, 1] },
            ctx({ userBreakpointIds: new Set([1]) })
          )
        ).toBeUndefined();
      });

      it('keeps breakpoint stops without hitBreakpointIds (mislabeled step guard, issue #255)', () => {
        expect(
          normalize(
            'breakpoint',
            { reason: 'breakpoint' },
            ctx({ userBreakpointIds: new Set<number>() })
          )
        ).toBeUndefined();
        expect(
          normalize(
            'breakpoint',
            { reason: 'breakpoint', hitBreakpointIds: [] },
            ctx({ userBreakpointIds: new Set<number>() })
          )
        ).toBeUndefined();
        expect(normalize('breakpoint', undefined, ctx({ userBreakpointIds: new Set<number>() }))).toBeUndefined();
      });

      it('keeps breakpoint stops when user breakpoint ids are unknown', () => {
        // No userBreakpointIds in context = the session's breakpoint
        // bookkeeping is incomplete; the disjoint inference is unsafe.
        expect(
          normalize('breakpoint', { reason: 'breakpoint', hitBreakpointIds: [2] }, ctx())
        ).toBeUndefined();
      });
    });

    // CodeLLDB reports function-breakpoint hits as plain 'breakpoint'
    // (issue #302); relabel when the hit ids are all known fn-bp ids.
    describe('function breakpoint stops (issue #302)', () => {
      it('relabels a pure function-breakpoint hit', () => {
        expect(
          normalize(
            'breakpoint',
            { reason: 'breakpoint', hitBreakpointIds: [5] },
            ctx({
              userBreakpointIds: new Set([1, 5]),
              functionBreakpointIds: new Set([5]),
              lineBreakpointCount: 1,
              functionBreakpointCount: 1
            })
          )
        ).toBe('function breakpoint');
      });

      it('still maps a panic to exception when fn-bp ids are in the user union', () => {
        // The union including fn-bp ids must not weaken the panic
        // discriminator: hit id 9 belongs to neither kind.
        expect(
          normalize(
            'breakpoint',
            { reason: 'breakpoint', hitBreakpointIds: [9] },
            ctx({
              userBreakpointIds: new Set([1, 5]),
              functionBreakpointIds: new Set([5]),
              lineBreakpointCount: 1,
              functionBreakpointCount: 1
            })
          )
        ).toBe('exception');
      });

      it('keeps a mixed line+function hit as breakpoint', () => {
        expect(
          normalize(
            'breakpoint',
            { reason: 'breakpoint', hitBreakpointIds: [1, 5] },
            ctx({
              userBreakpointIds: new Set([1, 5]),
              functionBreakpointIds: new Set([5]),
              lineBreakpointCount: 1,
              functionBreakpointCount: 1
            })
          )
        ).toBeUndefined();
      });

      it('does not relabel when fn-bp id bookkeeping is incomplete', () => {
        expect(
          normalize(
            'breakpoint',
            { reason: 'breakpoint', hitBreakpointIds: [5] },
            ctx({
              userBreakpointIds: new Set([5]),
              functionBreakpointCount: 1
            })
          )
        ).toBeUndefined();
      });

      it('keeps a plain line-breakpoint hit as breakpoint', () => {
        expect(
          normalize(
            'breakpoint',
            { reason: 'breakpoint', hitBreakpointIds: [1] },
            ctx({
              userBreakpointIds: new Set([1]),
              functionBreakpointIds: new Set<number>(),
              lineBreakpointCount: 1
            })
          )
        ).toBeUndefined();
      });
    });
  });

  it('resolves executable path using inputs and env', () => {
    expect(RustAdapterPolicy.resolveExecutablePath!('/custom/bin')).toBe('/custom/bin');

    // Without a provided path, defers to adapter (returns undefined)
    // CODELLDB_PATH env var is handled in codelldb-resolver.ts, not here
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
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
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
    expect(RustAdapterPolicy.requiresCommandQueueing!()).toBe(false);
    const result = RustAdapterPolicy.shouldQueueCommand!();
    expect(result.shouldQueue).toBe(false);
    expect(result.shouldDefer).toBe(false);
  });

  it("treats only 'initialized' as the child-ready event", () => {
    const event = (name: string): DebugProtocol.Event => ({ seq: 1, type: 'event', event: name });
    expect(RustAdapterPolicy.isChildReadyEvent!(event('initialized'))).toBe(true);
    expect(RustAdapterPolicy.isChildReadyEvent!(event('stopped'))).toBe(false);
  });

  it('reads locals from the shared LLDB scope names', () => {
    expect(RustAdapterPolicy.getLocalScopeName!()).toEqual(['Local', 'Locals']);
  });

  it('uses the CodeLLDB adapter type', () => {
    expect(RustAdapterPolicy.getDapAdapterConfiguration!()).toEqual({ type: 'lldb' });
  });

  it('reports CodeLLDB debugger capabilities', () => {
    expect(RustAdapterPolicy.getDebuggerConfiguration!()).toEqual({
      requiresStrictHandshake: false,
      skipConfigurationDone: false,
      supportsVariableType: true,
      supportsValueFormat: true,
      supportsMemoryReferences: true
    });
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
      const config = RustAdapterPolicy.getAdapterSpawnConfig!({
        adapterHost: '127.0.0.1',
        adapterPort: 9000,
        logDir: '/tmp/logs'
      }, 'win32', 'x64');

      const normalizedCommand = config.command.replace(/\\/g, '/');
      expect(normalizedCommand).toMatch(/vendor\/codelldb\/win32-x64\/adapter\/codelldb\.exe$/);
      expect(config.args).toEqual(['--port', '9000']);
      expect(config.env?.LLDB_USE_NATIVE_PDB_READER).toBe('1');
    });

    it('opts into adapter-stdio forwarding on win32 only (issue #223)', () => {
      // Windows: LLDB's console mode lets the debuggee inherit the adapter
      // process's stdio — forwarding is the only way output reaches get_output.
      const win = RustAdapterPolicy.getAdapterSpawnConfig!({
        adapterHost: '127.0.0.1',
        adapterPort: 9000,
        logDir: '/tmp/logs'
      }, 'win32', 'x64');
      expect(win.forwardStdio).toEqual({});

      const winCustom = RustAdapterPolicy.getAdapterSpawnConfig!({
        adapterCommand: { command: 'custom', args: [] },
        adapterHost: '127.0.0.1',
        adapterPort: 9000,
        logDir: '/tmp/logs'
      }, 'win32', 'x64');
      expect(winCustom.forwardStdio).toEqual({});

      // POSIX: CodeLLDB emits DAP output events itself (LLDB holds the pipes)
      const linux = RustAdapterPolicy.getAdapterSpawnConfig!({
        adapterHost: '127.0.0.1',
        adapterPort: 9000,
        logDir: '/tmp/logs'
      }, 'linux', 'x64');
      expect(linux.forwardStdio).toBeUndefined();
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

  describe('stack frame filtering (issue #369)', () => {
    const frame = (name: string, file: string, id = 1) =>
      ({ id, name, file, line: 1, column: 1 });

    const cases: Array<{ desc: string; name: string; file: string; internal: boolean }> = [
      { desc: 'LLDB-synthesized unnamed symbol', name: '___lldb_unnamed_symbol123', file: '<unknown_source>', internal: true },
      { desc: 'unnamed symbol with leading @ sigil', name: '@___lldb_unnamed_symbol3688', file: '<unknown_source>', internal: true },
      { desc: 'glibc __GI_ alias', name: '__GI___clock_nanosleep', file: '../sysdeps/unix/sysv/linux/clock_nanosleep.c', internal: true },
      { desc: 'glibc __GI_ alias without source', name: '__GI___clock_nanosleep', file: '<unknown_source>', internal: true },
      { desc: 'syscall wrapper without source', name: 'clock_nanosleep', file: '<unknown_source>', internal: true },
      { desc: 'syscall wrapper with empty source', name: 'nanosleep', file: '', internal: true },
      { desc: 'syscall wrapper under system path', name: 'poll', file: '/usr/lib/debug/libc.so.6', internal: true },
      { desc: 'libc start under glibc build path', name: '__libc_start_main', file: './nptl/libc_start_call_main.c', internal: true },
      { desc: 'CRT entry point without source', name: '_start', file: '<unknown_source>', internal: true },
      { desc: 'clone3 without source', name: 'clone3', file: '<unknown_source>', internal: true },
      { desc: 'user function NAMED nanosleep with workspace source', name: 'nanosleep', file: '/home/user/project/src/timing.rs', internal: false },
      { desc: 'user function named read with workspace source', name: 'read', file: '/home/user/project/src/io.rs', internal: false },
      { desc: 'normal user frame', name: 'app::run', file: '/home/user/project/src/main.rs', internal: false },
      { desc: 'rust std frame with /rustc/ source but non-wrapper name', name: 'std::thread::sleep', file: '/rustc/abc123/library/std/src/thread/mod.rs', internal: false },
      { desc: 'user frame with no source but non-matching name', name: 'stripped_user_fn', file: '<unknown_source>', internal: false },
    ];

    it.each(cases)('isInternalFrame: $desc -> $internal', ({ name, file, internal }) => {
      expect(RustAdapterPolicy.isInternalFrame!(frame(name, file))).toBe(internal);
    });

    it('filterStackFrames hides internal frames and keeps user frames in order', () => {
      const frames = [
        frame('app::run', '/home/user/project/src/main.rs', 1),
        frame('__GI___clock_nanosleep', '../sysdeps/unix/sysv/linux/clock_nanosleep.c', 2),
        frame('main', '/home/user/project/src/main.rs', 3),
        frame('__libc_start_main', '<unknown_source>', 4),
        frame('_start', '<unknown_source>', 5),
      ];
      const filtered = RustAdapterPolicy.filterStackFrames!(frames, false);
      expect(filtered.map((f) => f.id)).toEqual([1, 3]);
    });

    it('filterStackFrames returns every frame when includeInternals is set', () => {
      const frames = [
        frame('@___lldb_unnamed_symbol3688', '<unknown_source>', 1),
        frame('__libc_start_main', '<unknown_source>', 2),
      ];
      expect(RustAdapterPolicy.filterStackFrames!(frames, true)).toEqual(frames);
    });

    it('filterStackFrames has no empty-result fallback of its own (central #346 guarantee)', () => {
      const frames = [
        frame('@___lldb_unnamed_symbol3688', '<unknown_source>', 1),
        frame('__libc_start_main', '<unknown_source>', 2),
      ];
      expect(RustAdapterPolicy.filterStackFrames!(frames, false)).toEqual([]);
    });
  });
});

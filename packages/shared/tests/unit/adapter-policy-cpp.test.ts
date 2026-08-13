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
      expect(filtered.map((v) => v.name)).toEqual(['count']);
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

  it('tracks initialization state via the shared LLDB state helpers', () => {
    const state = CppAdapterPolicy.createInitialState!();
    expect(CppAdapterPolicy.isInitialized!(state)).toBe(false);
    CppAdapterPolicy.updateStateOnEvent!('initialized', undefined, state);
    expect(CppAdapterPolicy.isInitialized!(state)).toBe(true);
    CppAdapterPolicy.updateStateOnCommand!('configurationDone', undefined, state);
    expect(state.configurationDone).toBe(true);
  });
});

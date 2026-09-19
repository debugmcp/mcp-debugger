/**
 * CobolAdapterPolicy (issue #759): the COBOL-specific behaviour layered on the
 * shared LLDB helpers — data-division scopes as "locals", generated-C and
 * libcob frames as plumbing, and the shim's argv as the adapter signature.
 * Cross-policy invariants live in adapter-policy-contract.test.ts.
 */
import { describe, it, expect } from 'vitest';
import type { DebugProtocol } from '@vscode/debugprotocol';
import {
  CobolAdapterPolicy,
  COBOL_SCOPE_NAMES,
  COBOL_RUNTIME_ERROR_FILTER,
  DebugLanguage,
  SessionState,
  getPolicyForLanguage,
  type AdapterSpawnPayload,
  type StackFrame,
  type Variable
} from '@debugmcp/shared';
import {
  extractCobolLocalVariables,
  isCobolInternalFrame,
  filterCobolStackFrames,
  matchesCobolShimCommand
} from '../../../packages/shared/src/interfaces/adapter-policy-cobol.js';

const v = (name: string, value: string): Variable => ({ name, value, type: 'PIC X', expandable: false });
const frame = (id: number, name: string, file: string, line = 1): StackFrame => ({ id, name, file, line });
const scope = (name: string, variablesReference: number): DebugProtocol.Scope => ({ name, variablesReference, expensive: false });

describe('CobolAdapterPolicy identity and pins', () => {
  it('is the policy the language map returns for cobol', () => {
    expect(getPolicyForLanguage('cobol')).toBe(CobolAdapterPolicy);
    expect(getPolicyForLanguage(DebugLanguage.COBOL)).toBe(CobolAdapterPolicy);
  });

  it('is named cobol and runs without child sessions or command queueing', () => {
    expect(CobolAdapterPolicy.name).toBe('cobol');
    expect(CobolAdapterPolicy.childSessionStrategy).toBe('none');
    expect(CobolAdapterPolicy.supportsReverseStartDebugging).toBe(false);
    expect(CobolAdapterPolicy.requiresCommandQueueing()).toBe(false);
    expect(CobolAdapterPolicy.shouldQueueCommand()).toMatchObject({ shouldQueue: false, shouldDefer: false });
    expect(() => CobolAdapterPolicy.buildChildStartArgs()).toThrow(/does not support child sessions/);
  });

  it('pins the measured CodeLLDB noDebug behaviour and the M3-deferred breakpoint kinds', () => {
    expect(CobolAdapterPolicy.honoursNoDebug).toBe(true);
    expect(CobolAdapterPolicy.supportsLogPoints).toBe(false);
    expect(CobolAdapterPolicy.supportsFunctionBreakpoints).toBe(false);
  });

  it('names the four data-division scopes as the local scopes, as a fresh array each call', () => {
    expect(CobolAdapterPolicy.getLocalScopeName()).toEqual(['WORKING-STORAGE', 'LOCAL-STORAGE', 'LINKAGE', 'FILE']);
    expect(CobolAdapterPolicy.getLocalScopeName()).toEqual([...COBOL_SCOPE_NAMES]);
    expect(CobolAdapterPolicy.getLocalScopeName()).not.toBe(CobolAdapterPolicy.getLocalScopeName());
  });

  it('advertises the single cobol_runtime_error filter for both uncaught and all', () => {
    const behaviour = CobolAdapterPolicy.getInitializationBehavior();
    expect(COBOL_RUNTIME_ERROR_FILTER).toBe('cobol_runtime_error');
    expect(behaviour.exceptionFilters).toEqual({
      uncaught: ['cobol_runtime_error'],
      all: ['cobol_runtime_error']
    });
    expect(behaviour.defaultExceptionBreakMode).toBe('uncaught');
    expect(behaviour.sendAttachBeforeInitialized).toBe(true);
  });

  it('is an lldb-typed adapter that is ready when paused', () => {
    expect(CobolAdapterPolicy.getDapAdapterConfiguration()).toEqual({ type: 'lldb' });
    expect(CobolAdapterPolicy.isSessionReady(SessionState.PAUSED)).toBe(true);
    expect(CobolAdapterPolicy.isSessionReady(SessionState.RUNNING)).toBe(false);
    expect(CobolAdapterPolicy.isSessionReady(SessionState.READY)).toBe(false);
    expect(CobolAdapterPolicy.getDebuggerConfiguration()).toMatchObject({
      requiresStrictHandshake: false,
      skipConfigurationDone: false,
      supportsMemoryReferences: true
    });
  });

  it('treats initialized as the child-ready event', () => {
    expect(CobolAdapterPolicy.isChildReadyEvent({ type: 'event', event: 'initialized', seq: 1 })).toBe(true);
    expect(CobolAdapterPolicy.isChildReadyEvent({ type: 'event', event: 'stopped', seq: 1 })).toBe(false);
  });

  it('defers executable resolution to the adapter unless a path is given', () => {
    expect(CobolAdapterPolicy.resolveExecutablePath('/opt/gnucobol/bin/cobc')).toBe('/opt/gnucobol/bin/cobc');
    expect(CobolAdapterPolicy.resolveExecutablePath()).toBeUndefined();
  });
});

describe('getAdapterSpawnConfig', () => {
  it('spawns the adapterCommand verbatim — the shim owns the engine', () => {
    const payload: AdapterSpawnPayload = {
      executablePath: '/opt/gnucobol/bin/cobc',
      adapterHost: '127.0.0.1',
      adapterPort: 4711,
      logDir: '/tmp/logs',
      scriptPath: '/work/hello.cob',
      adapterCommand: {
        command: process.execPath,
        args: ['/pkg/dist/shim/cobol-shim.js', '--port', '4711', '--', '/vendor/adapter/codelldb'],
        env: { COB_CONFIG_DIR: '/opt/gnucobol/share/gnucobol/config' }
      }
    };

    const config = CobolAdapterPolicy.getAdapterSpawnConfig(payload, 'linux', 'x64');

    expect(config).toMatchObject({
      mode: 'spawn',
      command: process.execPath,
      args: ['/pkg/dist/shim/cobol-shim.js', '--port', '4711', '--', '/vendor/adapter/codelldb'],
      host: '127.0.0.1',
      port: 4711,
      logDir: '/tmp/logs',
      env: { COB_CONFIG_DIR: '/opt/gnucobol/share/gnucobol/config' }
    });
  });
});

describe('matchesCobolShimCommand', () => {
  it('recognises the shim entry in the adapter argv', () => {
    expect(matchesCobolShimCommand({ command: 'node', args: ['/pkg/dist/shim/cobol-shim.js', '--port', '1'] })).toBe(true);
    expect(matchesCobolShimCommand({ command: 'node', args: ['C:\\pkg\\dist\\shim\\cobol-shim.cjs'] })).toBe(true);
    expect(matchesCobolShimCommand({ command: 'node', args: ['/pkg/dist/shim/COBOL-SHIM.JS'] })).toBe(true);
    expect(matchesCobolShimCommand({ command: 'node', args: ['--port', '1', '/x/cobol-shim'] })).toBe(true);
  });

  it('does not match a bare CodeLLDB command (rust/cpp shape) or a look-alike', () => {
    expect(matchesCobolShimCommand({ command: '/vendor/adapter/codelldb', args: ['--port', '1'] })).toBe(false);
    expect(matchesCobolShimCommand({ command: 'node', args: ['/pkg/dist/shim/cobol-shim.js.map'] })).toBe(false);
    expect(matchesCobolShimCommand({ command: 'node', args: [] })).toBe(false);
  });

  it('is what the policy exposes as matchesAdapter', () => {
    expect(CobolAdapterPolicy.matchesAdapter).toBe(matchesCobolShimCommand);
  });
});

describe('isCobolInternalFrame', () => {
  it('keeps a frame mapped to COBOL source, even one whose symbol is cob_-prefixed', () => {
    expect(isCobolInternalFrame(frame(1, 'HELLO_', '/work/hello.cob', 12))).toBe(false);
    expect(isCobolInternalFrame(frame(1, 'cob_x', '/work/hello.cob', 12))).toBe(false);
    expect(isCobolInternalFrame(frame(1, 'SUB_', 'C:\\work\\sub.CBL', 3))).toBe(false);
    expect(isCobolInternalFrame(frame(1, 'MAIN_', '/work/inc/rec.cpy', 3))).toBe(false);
    expect(isCobolInternalFrame(frame(1, 'MAIN_', '/work/inc/rec.copy', 3))).toBe(false);
    expect(isCobolInternalFrame(frame(1, 'MAIN_', '/work/main.cobol', 3))).toBe(false);
  });

  it('hides CRT / libc entry frames the way every LLDB policy does', () => {
    expect(isCobolInternalFrame(frame(9, '@__libc_start_main', ''))).toBe(true);
    expect(isCobolInternalFrame(frame(9, '@_start', '<unknown_source>'))).toBe(true);
    expect(isCobolInternalFrame(frame(9, '@__libc_start_call_main', ''))).toBe(true);
    expect(isCobolInternalFrame(frame(9, '___lldb_unnamed_symbol1234', ''))).toBe(true);
  });

  it('hides libcob runtime frames (cob_*) that have no COBOL source', () => {
    expect(isCobolInternalFrame(frame(2, 'cob_runtime_error', '/build/libcob/common.c'))).toBe(true);
    expect(isCobolInternalFrame(frame(2, 'cob_check_subscript', ''))).toBe(true);
    expect(isCobolInternalFrame(frame(2, '@cob_init', '<unknown_source>'))).toBe(true);
    expect(isCobolInternalFrame(frame(2, 'cob_display', 'C:\\msys64\\mingw64\\lib\\libcob\\termio.c'))).toBe(true);
  });

  it('hides frames in the generated C, including the entry wrapper and main', () => {
    const generated = '/work/.debug-mcp/cobol/hello/abc123/hello.c';
    expect(isCobolInternalFrame(frame(3, 'main', generated))).toBe(true);
    expect(isCobolInternalFrame(frame(3, 'HELLO', generated))).toBe(true);
    expect(isCobolInternalFrame(frame(3, 'HELLO_', generated))).toBe(true);
    expect(isCobolInternalFrame(frame(3, 'HELLO_', `${generated}.l.h`))).toBe(true);
    expect(isCobolInternalFrame(frame(3, 'main', 'C:\\work\\.debug-mcp\\cobol\\hello\\abc123\\hello.C'))).toBe(true);
  });

  it('hides frames in every generated header too: .c.h, .c.l.h and the .c.l<N>.h of nested programs', () => {
    const generated = '/work/.debug-mcp/cobol/calls/abc123/sub.c';
    expect(isCobolInternalFrame(frame(3, 'SUB_', `${generated}.h`))).toBe(true);
    expect(isCobolInternalFrame(frame(3, 'SUB_', `${generated}.l.h`))).toBe(true);
    expect(isCobolInternalFrame(frame(3, 'SUB_', `${generated}.l2.h`))).toBe(true);
    expect(isCobolInternalFrame(frame(3, 'SUB_', `${generated}.l12.h`))).toBe(true);
    expect(isCobolInternalFrame(frame(3, 'SUB_', 'C:\\work\\.debug-mcp\\cobol\\calls\\abc123\\SUB.C.L.H'))).toBe(true);
    // Not generated: a plain header, or anything COBOL.
    expect(isCobolInternalFrame(frame(3, 'helper', '/work/helper.h'))).toBe(false);
    expect(isCobolInternalFrame(frame(3, 'SUB_', '/work/sub.cob'))).toBe(false);
    expect(isCobolInternalFrame(frame(3, 'SUB_', '/work/sub.cpy'))).toBe(false);
  });

  it('keeps a non-COBOL, non-generated user frame (a C helper linked in)', () => {
    expect(isCobolInternalFrame(frame(4, 'helper', '/work/helper.cpp'))).toBe(false);
    expect(isCobolInternalFrame(frame(4, 'helper', '/work/helper.rs'))).toBe(false);
  });
});

describe('filterCobolStackFrames', () => {
  const frames: StackFrame[] = [
    frame(1, 'HELLO_', '/work/hello.cob', 12),
    frame(2, 'cob_runtime_error', '/build/libcob/common.c'),
    frame(3, 'HELLO', '/work/.debug-mcp/cobol/hello/abc123/hello.c'),
    frame(4, 'main', '/work/.debug-mcp/cobol/hello/abc123/hello.c'),
    frame(5, '@__libc_start_main', '')
  ];

  it('returns every frame when internals are requested', () => {
    expect(filterCobolStackFrames(frames, true)).toBe(frames);
  });

  it('drops the plumbing and keeps the COBOL frame otherwise', () => {
    expect(filterCobolStackFrames(frames, false)).toEqual([frames[0]]);
  });

  it('is what the policy exposes as filterStackFrames / isInternalFrame', () => {
    expect(CobolAdapterPolicy.filterStackFrames).toBe(filterCobolStackFrames);
    expect(CobolAdapterPolicy.isInternalFrame).toBe(isCobolInternalFrame);
  });
});

describe('extractCobolLocalVariables', () => {
  const frames = [frame(1, 'HELLO_', '/work/hello.cob', 12), frame(2, 'main', '/work/hello.c')];

  it('concatenates the data-division scopes of the top frame in the reported order with plural scopeRefs', () => {
    const scopes = {
      1: [scope('WORKING-STORAGE', 10), scope('LOCAL-STORAGE', 20), scope('LINKAGE', 30), scope('Local', 90), scope('Registers', 91)]
    };
    const variables = {
      10: [v('WS-COUNT', '0001'), v('WS-NAME', 'ADA')],
      20: [v('LS-TMP', ' ')],
      30: [v('LK-ARG', '42')],
      90: [v('b_8', '0x1234')],
      91: [v('rip', '0x0')]
    };

    const extraction = extractCobolLocalVariables(frames, scopes, variables);

    expect(extraction).toEqual({
      variables: [v('WS-COUNT', '0001'), v('WS-NAME', 'ADA'), v('LS-TMP', ' '), v('LK-ARG', '42')],
      scopeRefs: [10, 20, 30]
    });
    expect(extraction).not.toHaveProperty('note');
  });

  it('skips a data-division scope that has no variables, so scopeRefs only names contributors', () => {
    const scopes = { 1: [scope('WORKING-STORAGE', 10), scope('LINKAGE', 30)] };
    const variables = { 10: [v('WS-A', '1')], 30: [] };

    expect(extractCobolLocalVariables(frames, scopes, variables)).toEqual({
      variables: [v('WS-A', '1')],
      scopeRefs: [10]
    });
  });

  it('returns an empty extraction without a note when the COBOL scopes exist but are all empty', () => {
    const scopes = { 1: [scope('WORKING-STORAGE', 10), scope('LOCAL-STORAGE', 20)] };

    const extraction = extractCobolLocalVariables(frames, scopes, { 10: [], 20: [] });

    expect(extraction).toEqual({ variables: [], scopeRefs: [] });
  });

  it('returns an empty extraction with a note when the frame has no COBOL scopes at all', () => {
    const scopes = { 1: [scope('Local', 90), scope('Static', 92)] };

    const extraction = extractCobolLocalVariables(frames, scopes, { 90: [v('b_8', '0x1'), v('i', '3')] });

    expect(extraction.variables).toEqual([]);
    expect(extraction.scopeRefs).toEqual([]);
    expect(extraction.note).toMatch(/No COBOL data division scopes at this frame/);
  });

  it('returns the plain empty extraction (no note) when no scopes were fetched for the top frame', () => {
    // Contract shared with every policy: nothing read means nothing to explain.
    expect(extractCobolLocalVariables(frames, {}, {})).toEqual({ variables: [], scopeRefs: [] });
    expect(extractCobolLocalVariables(frames, { 1: [] }, {})).toEqual({ variables: [], scopeRefs: [] });
  });

  it('returns an empty extraction with no note when there are no frames', () => {
    expect(extractCobolLocalVariables([], { 1: [scope('WORKING-STORAGE', 10)] }, { 10: [v('X', '1')] }))
      .toEqual({ variables: [], scopeRefs: [] });
  });

  it('only looks at the top frame, never a deeper COBOL frame', () => {
    const scopes = { 2: [scope('WORKING-STORAGE', 10)] };
    const swapped = [frames[1], frames[0]];

    expect(extractCobolLocalVariables(frames, scopes, { 10: [v('X', '1')] }).variables).toEqual([]);
    expect(extractCobolLocalVariables(swapped, scopes, { 10: [v('X', '1')] })).toEqual({ variables: [v('X', '1')], scopeRefs: [10] });
  });

  it('is what the policy exposes as extractLocalVariables', () => {
    expect(CobolAdapterPolicy.extractLocalVariables).toBe(extractCobolLocalVariables);
  });
});

/**
 * DartAdapterPolicy — what the proxy needs to know about the Dart/Flutter SDK DAP servers.
 *
 * Pins come from the #790 spike: conditional breakpoints and logpoints yes; function
 * breakpoints, hit conditions, exceptionInfo, setVariable no; exception filters `All` /
 * `Unhandled`; `noDebug` honoured; `initialized` arrives right behind the initialize response so
 * launch goes out before configurationDone; scopes `Locals` / `Globals` (+ `Exceptions`);
 * `<asynchronous gap>` label frames; the adapter is reached through the stdio bridge.
 */
import { describe, expect, it } from 'vitest';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { DartAdapterPolicy, DebugLanguage, getPolicyForLanguage, resolveExceptionFilters } from '../../src/index.js';
import type { AdapterSpawnPayload, StackFrame, Variable } from '../../src/index.js';

const frame = (id: number, name: string, file?: string, extra: Partial<StackFrame> = {}): StackFrame => ({ id, name, line: 1, column: 1, file, ...extra } as StackFrame);

describe('DartAdapterPolicy', () => {
  it('is the policy for the dart language', () => {
    expect(getPolicyForLanguage(DebugLanguage.DART)).toBe(DartAdapterPolicy);
    expect(DartAdapterPolicy.name).toBe('dart');
  });

  it('pins the measured capabilities', () => {
    expect(DartAdapterPolicy.supportsLogPoints).toBe(true);
    expect(DartAdapterPolicy.supportsFunctionBreakpoints).toBe(false);
    expect(DartAdapterPolicy.honoursNoDebug).toBe(true);
    expect(DartAdapterPolicy.childSessionStrategy).toBe('none');
    expect(DartAdapterPolicy.requiresCommandQueueing()).toBe(false);
  });

  it('declares the entry-stop shape: the adapter\'s own entry stop is noise, main( is the entry', () => {
    expect(DartAdapterPolicy.suppressesAdapterEntryStop).toBe(true);
    const src = "import 'dart:io';\n\nFuture<void> main(List<String> args) async {\n  print('x');\n}\n";
    expect(DartAdapterPolicy.entryBreakpointLine(src)).toBe(3);
    expect(DartAdapterPolicy.entryBreakpointLine('void main() => runApp(const App());\n')).toBe(1);
    expect(DartAdapterPolicy.entryBreakpointLine('// no entry here\nclass A {}\n')).toBeUndefined();
    expect(DartAdapterPolicy.entryBreakpointLine('final remains = 1; // "main(" in a comment should not count\nvoid main() {}\n')).toBe(2);
  });

  it('blanks string literals without backtracking: escaped quotes, an unterminated literal, both quote kinds', () => {
    // `main(` inside a literal never counts, whatever the escaping.
    expect(DartAdapterPolicy.entryBreakpointLine('final s = "main(\\" main(";\nvoid main() {}\n')).toBe(2);
    expect(DartAdapterPolicy.entryBreakpointLine("final s = 'it\\'s main(';\nvoid main() {}\n")).toBe(2);
    // An unterminated literal made of thousands of escaped quotes (CodeQL's polynomial-ReDoS
    // shape for the former backreference regex) is handled, and the next line still wins.
    const hostile = 'final s = "' + '\\"'.repeat(20_000) + ';\nvoid main() {}\n';
    expect(DartAdapterPolicy.entryBreakpointLine(hostile)).toBe(2);
  });

  it('maps break-on-exception modes to the SDK filter ids', () => {
    expect(resolveExceptionFilters(DartAdapterPolicy, 'uncaught')).toEqual(['Unhandled']);
    expect(resolveExceptionFilters(DartAdapterPolicy, 'all')).toEqual(['All']);
    expect(resolveExceptionFilters(DartAdapterPolicy, 'none')).toEqual([]);
    expect(DartAdapterPolicy.getInitializationBehavior().defaultExceptionBreakMode).toBe('uncaught');
    // The Dart adapters answer `launch` only after configurationDone (measured), like debugpy:
    // the worker must configure while the launch is pending, never wait for its response first.
    expect(DartAdapterPolicy.getInitializationBehavior().sendLaunchBeforeConfig).toBeFalsy();
    // Same for attach: the adapter answers it after configurationDone, so attach goes out first
    // and the configuration phase runs while it is pending (debugpy's attach-first flow).
    expect(DartAdapterPolicy.getInitializationBehavior().sendAttachBeforeInitialized).toBe(true);
  });

  it('spawns whatever command the adapter built (the stdio bridge) and matches on its name', () => {
    const payload: AdapterSpawnPayload = {
      adapterCommand: { command: 'node', args: ['C:\\x\\dap-stdio-bridge.js', '--port', '1', '--', 'dart.exe', 'debug_adapter'], env: { FLUTTER_ROOT: 'C:\\src\\flutter' } },
      adapterHost: '127.0.0.1', adapterPort: 1, logDir: 'C:\\logs', executablePath: 'dart', scriptPath: 'C:\\p\\bin\\app.dart',
    };
    const cfg = DartAdapterPolicy.getAdapterSpawnConfig(payload);
    expect(cfg).toMatchObject({ mode: 'spawn', command: 'node', host: '127.0.0.1', port: 1, env: { FLUTTER_ROOT: 'C:\\src\\flutter' } });
    expect(DartAdapterPolicy.matchesAdapter({ command: 'node', args: ['C:\\x\\dap-stdio-bridge.js'] })).toBe(true);
    expect(DartAdapterPolicy.matchesAdapter({ command: '', args: [] })).toBe(false);
  });

  it('refuses to guess a spawn config without an adapter command', () => {
    const bare: AdapterSpawnPayload = { adapterHost: '127.0.0.1', adapterPort: 1, logDir: 'x', executablePath: 'dart', scriptPath: 'x.dart' };
    expect(() => DartAdapterPolicy.getAdapterSpawnConfig(bare)).toThrow(/bridge/);
  });

  it('extracts locals from the Locals scope of the top frame', () => {
    const frames = [frame(1, 'main', 'C:\\p\\bin\\app.dart'), frame(2, '_delayEntrypointInvocation', 'C:\\sdk\\isolate_patch.dart')];
    const scopes: Record<number, DebugProtocol.Scope[]> = { 1: [{ name: 'Locals', variablesReference: 10, expensive: false }, { name: 'Globals', variablesReference: 11, expensive: false }] };
    const vars: Record<number, Variable[]> = { 10: [{ name: 'answer', value: '42', type: 'int', expandable: false }], 11: [] };
    const r = DartAdapterPolicy.extractLocalVariables(frames, scopes, vars);
    expect(r.variables.map((v) => v.name)).toEqual(['answer']);
    expect(r.scopeRefs).toEqual([10]);
    expect(DartAdapterPolicy.getLocalScopeName()).toEqual(['Locals']);
  });

  it('treats <asynchronous gap> label frames and SDK-internal frames as non-user frames', () => {
    const gap = frame(2, '<asynchronous gap>', undefined, { presentationHint: 'label' } as Partial<StackFrame>);
    const sdk = frame(3, '_RawReceivePort._handleMessage', 'C:\\sdk\\dart-sdk\\lib\\_internal\\vm\\lib\\isolate_patch.dart');
    const user = frame(1, 'main', 'C:\\p\\bin\\app.dart');
    expect(DartAdapterPolicy.isAsyncBoundaryFrame(gap)).toBe(true);
    expect(DartAdapterPolicy.isInternalFrame(sdk)).toBe(true);
    expect(DartAdapterPolicy.isInternalFrame(user)).toBe(false);
    expect(DartAdapterPolicy.filterStackFrames([user, gap, sdk], false).map((f) => f.id)).toEqual([1]);
    expect(DartAdapterPolicy.filterStackFrames([user, gap, sdk], true)).toHaveLength(3);
  });

  it('answers runInTerminal reverse requests (never expected) and asks for a pause after attach', async () => {
    const sent: unknown[] = [];
    const result = await DartAdapterPolicy.getDapClientBehavior().handleReverseRequest!(
      { seq: 1, type: 'request', command: 'runInTerminal' } as DebugProtocol.Request,
      { sendResponse: (_req: DebugProtocol.Request, body: unknown) => { sent.push(body); } } as unknown as Parameters<NonNullable<ReturnType<typeof DartAdapterPolicy.getDapClientBehavior>['handleReverseRequest']>>[1],
    );
    expect(result.handled).toBe(true);
    expect(sent).toHaveLength(1);
    expect(DartAdapterPolicy.getAttachBehavior()).toEqual({ pauseAfterAttach: true });
  });
});

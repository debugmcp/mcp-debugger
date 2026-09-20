/**
 * The `cobol_runtime_error` exception filter: initialize patch, the function
 * breakpoint union behind it, the relabelled stop, exceptionInfo, and the
 * noDebug refusal; plus launch's private block and manifest loading.
 */
import { describe, expect, it, afterEach } from 'vitest';
import path from 'node:path';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { engineError, installMemory } from './fake-engine.js';
import { helloManifest, helloMemory } from './fixtures.js';
import { bringUp, frame, startShim, stopWithFrames, type Harness } from './harness.js';

const ROOT = path.resolve('/work/cobol/examples');
const HELLO_COB = path.join(ROOT, 'hello.cob');
const HELLO_C = path.join(ROOT, 'build', 'hello.c');

describe('cobol shim exceptions and launch', () => {
  let h: Harness | undefined;

  afterEach(async () => {
    await h?.cleanup();
    h = undefined;
  });

  it('patches the initialize response and remembers the engine capabilities', async () => {
    h = await startShim({
      engineSetup: (engine) =>
        engine.on('initialize', () => ({
          supportsConfigurationDoneRequest: true,
          supportsFunctionBreakpoints: true,
          supportsSetVariable: true,
          supportsLogPoints: true,
          exceptionBreakpointFilters: [{ filter: 'cpp_throw', label: 'C++: on throw' }]
        }))
    });
    const response = await h.client.request('initialize', {});
    const caps = response.body as DebugProtocol.Capabilities;
    expect(caps.supportsConfigurationDoneRequest).toBe(true);
    expect(caps.exceptionBreakpointFilters).toEqual([
      { filter: 'cobol_runtime_error', label: 'COBOL: runtime error (libcob cob_runtime_error)', default: true }
    ]);
    expect(caps.supportsExceptionInfoRequest).toBe(true);
    expect(caps.supportsFunctionBreakpoints).toBe(true);
    expect(caps.supportsLogPoints).toBe(true);
    expect(caps.supportsSetVariable).toBe(false);
  });

  it('strips __cobol from launch, forwards the rest (noDebug, env, preRunCommands) and loads the manifests', async () => {
    h = await startShim({ manifests: [helloManifest(ROOT)], argv: { manifestDirs: [] }, engineSetup: (engine) => installMemory(engine, helloMemory()) });
    await bringUp(h, { noDebug: true, env: { A: '1' }, preRunCommands: ['settings set x y'] });
    const launch = h.engine.received('launch')[0].arguments as Record<string, unknown>;
    expect(launch).toEqual({ program: '/work/hello', noDebug: true, env: { A: '1' }, preRunCommands: ['settings set x y'] });
    expect(launch).not.toHaveProperty('__cobol');
    await stopWithFrames(h, [frame(1, 'HELLO_', HELLO_COB, 32)]);
    const scopes = ((await h.client.request('scopes', { frameId: 1 })).body as DebugProtocol.ScopesResponse['body']).scopes;
    expect(scopes[0].name).toBe('WORKING-STORAGE');
    expect(h.logs.some((line) => line.includes('loaded manifest') && line.includes('HELLO'))).toBe(true);
  });

  it('setExceptionBreakpoints: strips the filter, arms the function breakpoint union and re-inserts the response entry', async () => {
    h = await startShim({
      engineSetup: (engine) => {
        engine.on('setExceptionBreakpoints', (args: DebugProtocol.SetExceptionBreakpointsArguments) => ({
          breakpoints: args.filters.map(() => ({ verified: true }))
        }));
        engine.on('setFunctionBreakpoints', (args: DebugProtocol.SetFunctionBreakpointsArguments) => ({
          breakpoints: args.breakpoints.map((bp, i) => ({ id: 100 + i, verified: bp.name !== 'cob_runtime_error', message: bp.name === 'cob_runtime_error' ? 'pending' : undefined }))
        }));
      }
    });
    await bringUp(h);
    const response = await h.client.request('setExceptionBreakpoints', { filters: ['cpp_throw', 'cobol_runtime_error'] });
    expect(response.success).toBe(true);
    expect(response.body).toEqual({
      breakpoints: [{ verified: true }, { verified: false, message: 'pending' }]
    });
    expect(h.engine.received('setExceptionBreakpoints')[0].arguments).toEqual({ filters: ['cpp_throw'] });
    const union = h.engine.received('setFunctionBreakpoints');
    expect(union).toHaveLength(1);
    expect(union[0].arguments).toEqual({ breakpoints: [{ name: 'cob_runtime_error' }] });
    // The union is sent before the client's response goes out.
    const order = h.engine.requests.map((r) => r.command);
    expect(order.indexOf('setFunctionBreakpoints')).toBeGreaterThan(order.indexOf('setExceptionBreakpoints'));

    // Disarming re-sends the union without the hook.
    await h.client.request('setExceptionBreakpoints', { filters: [] });
    expect(h.engine.received('setFunctionBreakpoints')[1].arguments).toEqual({ breakpoints: [] });
  });

  it('setFunctionBreakpoints: appends the hook when armed and trims the response to the user list', async () => {
    h = await startShim({
      engineSetup: (engine) => {
        engine.on('setFunctionBreakpoints', (args: DebugProtocol.SetFunctionBreakpointsArguments) => ({
          breakpoints: args.breakpoints.map((_bp, i) => ({ id: 200 + i, verified: true }))
        }));
      }
    });
    await bringUp(h);
    await h.client.request('setExceptionBreakpoints', { filters: ['cobol_runtime_error'] });
    const response = await h.client.request('setFunctionBreakpoints', { breakpoints: [{ name: 'main' }, { name: 'HELLO' }] });
    expect((response.body as DebugProtocol.SetFunctionBreakpointsResponse['body']).breakpoints).toEqual([
      { id: 200, verified: true },
      { id: 201, verified: true }
    ]);
    const sent = h.engine.received('setFunctionBreakpoints').at(-1)!.arguments as DebugProtocol.SetFunctionBreakpointsArguments;
    expect(sent.breakpoints.map((b) => b.name)).toEqual(['main', 'HELLO', 'cob_runtime_error']);
    // A later re-arm replays the user's list.
    await h.client.request('setExceptionBreakpoints', { filters: ['cobol_runtime_error'] });
    const replay = h.engine.received('setFunctionBreakpoints').at(-1)!.arguments as DebugProtocol.SetFunctionBreakpointsArguments;
    expect(replay.breakpoints.map((b) => b.name)).toEqual(['main', 'HELLO', 'cob_runtime_error']);
  });

  it('tolerates a union answered without a breakpoints array', async () => {
    h = await startShim({ engineSetup: (engine) => engine.on('setFunctionBreakpoints', () => ({})) });
    await bringUp(h);
    const response = await h.client.request('setExceptionBreakpoints', { filters: ['cobol_runtime_error'] });
    expect(response.success).toBe(true);
    expect(h.logs.some((line) => line.includes('transform failed'))).toBe(false);
    expect(h.logs.some((line) => line.includes('armed (id unknown'))).toBe(true);
  });

  it('tolerates the noDebug refusal of the function breakpoint union', async () => {
    h = await startShim({
      engineSetup: (engine) => {
        engine.on('setFunctionBreakpoints', () => engineError('Internal debugger error: Not supported in noDebug mode.'));
      }
    });
    await bringUp(h, { noDebug: true });
    const response = await h.client.request('setExceptionBreakpoints', { filters: ['cobol_runtime_error'] });
    expect(response.success).toBe(true);
    expect(h.logs.some((line) => line.includes('Not supported in noDebug mode'))).toBe(true);
  });

  it.each([
    ['linux', 'x64', '$rdi'],
    ['win32', 'x64', '$rcx'],
    ['darwin', 'arm64', '$x0']
  ] as const)('relabels the runtime-error stop as an exception with the format string from %s/%s (%s)', async (platform, arch, register) => {
    h = await startShim({
      manifests: [helloManifest(ROOT)],
      platform,
      arch,
      engineSetup: (engine) => {
        engine.on('setFunctionBreakpoints', (args: DebugProtocol.SetFunctionBreakpointsArguments) => ({
          breakpoints: args.breakpoints.map((_bp, i) => ({ id: 300 + i, verified: false }))
        }));
        engine.on('evaluate', (args: { expression: string }) =>
          args.expression === `/nat (const char*)${register}`
            ? { result: `0x00007ffff7a1e2c0 "subscript of '%s' out of bounds: %d"`, type: 'const char *', variablesReference: 0 }
            : engineError('nope')
        );
      }
    });
    await bringUp(h);
    await h.client.request('setExceptionBreakpoints', { filters: ['cobol_runtime_error'] });
    const frames = [
      frame(1, 'cob_runtime_error', undefined, 0),
      frame(2, 'cob_check_subscript', undefined, 0),
      frame(3, 'cob_check_subscript_inline', path.join(ROOT, 'build', 'hello.c.l.h'), 40),
      frame(4, 'HELLO_', HELLO_C, 139),
      frame(5, 'HELLO', HELLO_C, 220),
      frame(6, 'main', HELLO_C, 250)
    ];
    const seen = await stopWithFrames(h, frames, { reason: 'breakpoint', hitBreakpointIds: [300] });
    const stopped = h.client.events('stopped')[0];
    expect(stopped.body).toMatchObject({ reason: 'exception', description: 'COBOL runtime error', text: "subscript of '%s' out of bounds: %d" });
    expect(stopped.body).not.toHaveProperty('hitBreakpointIds');
    expect(h.engine.received('evaluate')[0].arguments).toMatchObject({ frameId: 1, context: 'variables' });
    expect(seen[3].name).toBe('HELLO: 0000-MAIN [hello.c:139]');
    expect(seen[3].line).toBe(34);

    const info = await h.client.request('exceptionInfo', { threadId: 1 });
    expect(info.success).toBe(true);
    expect(info.body).toEqual({
      exceptionId: 'cobol_runtime_error',
      description: "subscript of '%s' out of bounds: %d",
      breakMode: 'always',
      details: { message: "subscript of '%s' out of bounds: %d" }
    });
  });

  it('leaves a user breakpoint stop alone and forwards exceptionInfo outside a runtime-error stop', async () => {
    h = await startShim({
      manifests: [helloManifest(ROOT)],
      engineSetup: (engine) => {
        engine.on('setFunctionBreakpoints', () => ({ breakpoints: [{ id: 300, verified: false }] }));
        engine.on('exceptionInfo', () => ({ exceptionId: 'engine', breakMode: 'always' }));
      }
    });
    await bringUp(h);
    await h.client.request('setExceptionBreakpoints', { filters: ['cobol_runtime_error'] });
    await stopWithFrames(h, [frame(1, 'HELLO_', HELLO_COB, 32)], { reason: 'breakpoint', hitBreakpointIds: [7] });
    expect(h.client.events('stopped')[0].body).toMatchObject({ reason: 'breakpoint', hitBreakpointIds: [7] });
    const info = await h.client.request('exceptionInfo', { threadId: 1 });
    expect(info.body).toEqual({ exceptionId: 'engine', breakMode: 'always' });
  });
});

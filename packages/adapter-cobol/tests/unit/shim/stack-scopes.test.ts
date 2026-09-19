/**
 * stackTrace annotation (program/paragraph labels, generated-C remap) and the
 * synthetic COBOL scopes.
 */
import { describe, expect, it, afterEach } from 'vitest';
import path from 'node:path';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { installMemory } from './fake-engine.js';
import { callsManifest, callsMemory, helloManifest } from './fixtures.js';
import { bringUp, frame, startShim, stopWithFrames, type Harness } from './harness.js';

const ROOT = path.resolve('/work/cobol/examples');
const HELLO_COB = path.join(ROOT, 'hello.cob');
const HELLO_C = path.join(ROOT, 'build', 'hello.c');
const MAIN_C = path.join(ROOT, 'build', 'main.c');
const SUB_COB = path.join(ROOT, 'calls', 'sub.cob');

function scopesOf(response: DebugProtocol.Response): DebugProtocol.Scope[] {
  return (response.body as DebugProtocol.ScopesResponse['body']).scopes;
}

describe('cobol shim stackTrace and scopes', () => {
  let h: Harness | undefined;

  afterEach(async () => {
    await h?.cleanup();
    h = undefined;
  });

  it('labels COBOL frames "<PROGRAM-ID>: <paragraph>" and leaves entry wrapper, main and CRT frames alone', async () => {
    h = await startShim({ manifests: [helloManifest(ROOT)] });
    await bringUp(h);
    const frames = await stopWithFrames(h, [
      frame(1, 'HELLO_', HELLO_COB, 38),
      frame(2, 'HELLO', HELLO_C, 220),
      frame(3, 'main', HELLO_C, 250),
      frame(4, '@__libc_start_main', undefined, 0)
    ]);
    expect(frames.map((f) => f.name)).toEqual(['HELLO: 1000-INIT', 'HELLO', 'main', '@__libc_start_main']);
    expect(frames[0].source?.path).toBe(HELLO_COB);
    expect(frames[0].line).toBe(38);
  });

  it('maps a generated-C location of the body function back to the COBOL line via the line map', async () => {
    h = await startShim({ manifests: [helloManifest(ROOT)] });
    await bringUp(h);
    const frames = await stopWithFrames(h, [frame(1, 'HELLO_', HELLO_C, 133), frame(2, 'main', HELLO_C, 250)]);
    expect(frames[0].name).toBe('HELLO: 0000-MAIN [hello.c:133]');
    expect(frames[0].line).toBe(32);
    expect(frames[0].source?.path).toBe(path.normalize(HELLO_COB));
    expect(frames[0].source?.name).toBe('hello.cob');
    expect(frames[1].name).toBe('main');
    expect(frames[1].line).toBe(250);
  });

  it('matches Windows-style engine paths against the manifest case-insensitively with normalised separators', async () => {
    h = await startShim({ manifests: [helloManifest('C:/work/cobol/examples')] });
    await bringUp(h);
    const frames = await stopWithFrames(h, [frame(1, 'HELLO_', 'c:\\Work\\COBOL\\examples\\HELLO.cob', 33)]);
    expect(frames[0].name).toBe('HELLO: 0000-MAIN');
  });

  it('serves WORKING-STORAGE scope for a COBOL frame and forwards scopes for other frames', async () => {
    h = await startShim({
      manifests: [helloManifest(ROOT)],
      engineSetup: (engine) => engine.on('scopes', () => ({ scopes: [{ name: 'Local', variablesReference: 12, expensive: false }] }))
    });
    await bringUp(h);
    await stopWithFrames(h, [frame(1, 'HELLO_', HELLO_COB, 32), frame(2, 'main', HELLO_C, 250)]);
    const cobol = scopesOf(await h.client.request('scopes', { frameId: 1 }));
    expect(cobol.map((s) => s.name)).toEqual(['WORKING-STORAGE']);
    expect(cobol[0].namedVariables).toBe(9);
    expect(cobol[0].variablesReference).toBeGreaterThanOrEqual(1 << 30);
    expect(h.engine.received('scopes')).toHaveLength(0);

    const native = scopesOf(await h.client.request('scopes', { frameId: 2 }));
    expect(native.map((s) => s.name)).toEqual(['Local']);
    expect(h.engine.received('scopes')).toHaveLength(1);
  });

  it('adds LOCAL-STORAGE and LINKAGE only when the program has them, and appends engine scopes under --engine-scopes', async () => {
    h = await startShim({
      manifests: [callsManifest(ROOT)],
      argv: { engineScopes: true },
      engineSetup: (engine) => {
        installMemory(engine, callsMemory());
        engine.on('scopes', () => ({ scopes: [{ name: 'Local', variablesReference: 12, expensive: false }, { name: 'Static', variablesReference: 13, expensive: true }] }));
      }
    });
    await bringUp(h);
    await stopWithFrames(h, [frame(1, 'CALLSUB_', SUB_COB, 15), frame(2, 'CALLMAIN_', MAIN_C, 139)]);
    const sub = scopesOf(await h.client.request('scopes', { frameId: 1 }));
    expect(sub.map((s) => s.name)).toEqual(['WORKING-STORAGE', 'LOCAL-STORAGE', 'LINKAGE', 'Local', 'Static']);
    expect(sub[0].namedVariables).toBe(0);
    expect(sub[1].namedVariables).toBe(2);
    expect(sub[2].namedVariables).toBe(1);
    const main = scopesOf(await h.client.request('scopes', { frameId: 2 }));
    expect(main.map((s) => s.name)).toEqual(['WORKING-STORAGE', 'Local', 'Static']);
  });

  it('refetches the stack once for a frameId it has not seen this generation', async () => {
    const frames = [frame(1, 'HELLO_', HELLO_COB, 32), frame(2, 'main', HELLO_C, 250)];
    h = await startShim({
      manifests: [helloManifest(ROOT)],
      engineSetup: (engine) => {
        engine.on('stackTrace', () => ({ stackFrames: frames, totalFrames: 2 }));
        engine.on('scopes', () => ({ scopes: [{ name: 'Local', variablesReference: 12, expensive: false }] }));
      }
    });
    await bringUp(h);
    h.engine.emit('stopped', { reason: 'breakpoint', threadId: 1 });
    await h.client.nextEvent('stopped');
    // No client stackTrace yet: the shim must ask the engine itself.
    const cobol = scopesOf(await h.client.request('scopes', { frameId: 1 }));
    expect(cobol.map((s) => s.name)).toEqual(['WORKING-STORAGE']);
    expect(h.engine.received('stackTrace')).toHaveLength(1);
    expect(h.engine.received('stackTrace')[0].arguments).toMatchObject({ threadId: 1, startFrame: 0, levels: 64 });
    // Still unknown after the refetch: forwarded.
    const unknown = await h.client.request('scopes', { frameId: 99 });
    expect(scopesOf(unknown).map((s) => s.name)).toEqual(['Local']);
  });
});

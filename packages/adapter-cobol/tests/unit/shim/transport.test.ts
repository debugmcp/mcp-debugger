/**
 * Verbatim forwarding, seq remapping, the reverse-request mirror, the ordered
 * output queue and internal-timeout degradation — the transport contract every
 * COBOL feature sits on.
 */
import { describe, expect, it, afterEach } from 'vitest';
import path from 'node:path';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { installMemory } from './fake-engine.js';
import { helloManifest, helloMemory } from './fixtures.js';
import { bringUp, frame, startShim, stopWithFrames, tick, type Harness } from './harness.js';

const ROOT = path.resolve('/work/cobol/examples');
const HELLO_COB = path.join(ROOT, 'hello.cob');

describe('cobol shim transport', () => {
  let h: Harness | undefined;

  afterEach(async () => {
    await h?.cleanup();
    h = undefined;
  });

  it('forwards unknown requests verbatim and lands each response on the right request_seq', async () => {
    h = await startShim({
      engineSetup: (engine) => {
        engine.on('threads', () => ({ threads: [{ id: 7, name: 'worker' }] }));
        engine.on('source', (args: { sourceReference: number }) => ({ content: `src-${args.sourceReference}` }));
      }
    });
    const [threads, source] = await Promise.all([h.client.request('threads', {}), h.client.request('source', { sourceReference: 9 })]);
    expect(threads.success).toBe(true);
    expect((threads.body as { threads: Array<{ id: number }> }).threads[0].id).toBe(7);
    expect((source.body as { content: string }).content).toBe('src-9');
    expect(h.engine.received('source')[0].arguments).toEqual({ sourceReference: 9 });
  });

  it('never lets shim-originated and client requests collide on the engine seq', async () => {
    h = await startShim({ manifests: [helloManifest(ROOT)], engineSetup: (engine) => installMemory(engine, helloMemory()) });
    await bringUp(h);
    const frames = await stopWithFrames(h, [frame(1000, 'HELLO_', HELLO_COB, 32), frame(1001, 'main', undefined, 0)]);
    expect(frames[0].name).toBe('HELLO: 0000-MAIN');
    const scopes = await h.client.request('scopes', { frameId: 1000 });
    const ws = (scopes.body as DebugProtocol.ScopesResponse['body']).scopes[0];
    // The shim's variables reply needs internal evaluate + readMemory while the client also asks for threads.
    const [variables, threads] = await Promise.all([
      h.client.request('variables', { variablesReference: ws.variablesReference }),
      h.client.request('threads', {})
    ]);
    expect(variables.success).toBe(true);
    expect(threads.success).toBe(true);
    expect(threads.command).toBe('threads');
    const seqs = h.engine.requests.map((r) => r.seq);
    expect(new Set(seqs).size).toBe(seqs.length);
    for (let i = 1; i < seqs.length; i++) {
      expect(seqs[i]).toBeGreaterThan(seqs[i - 1]);
    }
  });

  it('mirrors reverse requests: the client answers runInTerminal and the engine sees its own seq', async () => {
    h = await startShim();
    h.client.onReverseRequest = (request) => (request.command === 'runInTerminal' ? { processId: 77 } : {});
    const response = await h.engine.sendRequest('runInTerminal', { kind: 'integrated', args: ['a.out'] });
    expect(response.success).toBe(true);
    expect((response.body as { processId: number }).processId).toBe(77);
    const seen = h.client.received.find((m) => m.type === 'request') as DebugProtocol.Request;
    expect(seen.command).toBe('runInTerminal');
    expect(seen.arguments).toEqual({ kind: 'integrated', args: ['a.out'] });
  });

  it('holds later engine messages behind a shim reply still being computed (ordered output queue)', async () => {
    h = await startShim({ manifests: [helloManifest(ROOT)], engineSetup: (engine) => installMemory(engine, helloMemory()) });
    await bringUp(h);
    await stopWithFrames(h, [frame(1000, 'HELLO_', HELLO_COB, 32)]);
    const scopes = await h.client.request('scopes', { frameId: 1000 });
    const ws = (scopes.body as DebugProtocol.ScopesResponse['body']).scopes[0];
    h.engine.hold();
    const pending = h.client.request('variables', { variablesReference: ws.variablesReference });
    await h.engine.waitForRequest('evaluate');
    h.engine.emit('output', { category: 'stdout', output: 'late\n' });
    await tick(60);
    expect(h.client.events('output')).toHaveLength(0);
    h.engine.release();
    const variables = await pending;
    expect(variables.success).toBe(true);
    await h.client.nextEvent('output');
    const kinds = h.client.received.slice(-2).map((m) => m.type);
    expect(kinds).toEqual(['response', 'event']);
  });

  it('degrades one value to <unavailable: timeout> when the engine never answers an internal request', async () => {
    h = await startShim({
      manifests: [helloManifest(ROOT)],
      timing: { engineRequestTimeoutMs: 150 },
      engineSetup: (engine) => {
        installMemory(engine, helloMemory());
        const memoryEvaluate = engine.handler('evaluate')!;
        engine.on('evaluate', (args: { expression: string }, request) =>
          args.expression.includes('b_19') ? new Promise(() => undefined) : memoryEvaluate(args, request)
        );
      }
    });
    await bringUp(h);
    await stopWithFrames(h, [frame(1000, 'HELLO_', HELLO_COB, 32)]);
    const scopes = await h.client.request('scopes', { frameId: 1000 });
    const ws = (scopes.body as DebugProtocol.ScopesResponse['body']).scopes[0];
    const variables = await h.client.request('variables', { variablesReference: ws.variablesReference });
    expect(variables.success).toBe(true);
    const list = (variables.body as DebugProtocol.VariablesResponse['body']).variables;
    expect(list.find((v) => v.name === 'WS-SCALED')?.value).toBe('<unavailable: timeout>');
    expect(list.find((v) => v.name === 'WS-GROUP')?.value).not.toContain('unavailable');
  });
});

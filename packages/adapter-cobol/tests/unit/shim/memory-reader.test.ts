import { describe, expect, it, vi } from 'vitest';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { MemoryReader } from '../../../src/shim/memory-reader.js';
import { SessionState } from '../../../src/shim/session-state.js';
import { NOOP_LOGGER } from '../../../src/shim/logger.js';
import { helloManifest } from './fixtures.js';

function setup() {
  const state = new SessionState({ manifestDirs: [], engineScopes: false, refCheck: 'strict' }, NOOP_LOGGER);
  state.registry.addManifest(helloManifest('/work/first'));
  const entry = state.registry.programs[0];
  const root = entry.program.items[0];
  let bytes = '0000001';
  const request = vi.fn(async (command: string): Promise<DebugProtocol.Response> => ({
    seq: 0, request_seq: 0, type: 'response', command, success: true,
    body: command === 'evaluate' ? { result: '4096' } : { data: Buffer.from(bytes).toString('base64') }
  }));
  return { state, entry, root, request, reader: new MemoryReader({ request }, state, NOOP_LOGGER), setBytes: (value: string) => { bytes = value; } };
}

describe('root address lifetime', () => {
  it('shares static evaluations across frames and stops but refreshes memory each stop', async () => {
    const { reader, state, entry, root, request, setBytes } = setup();
    await reader.readItemBytes(1, entry, root, []);
    state.bumpGeneration('continued');
    state.bumpGeneration('stopped');
    setBytes('0000002');
    const result = await reader.readItemBytes(99, entry, root, []);
    expect(result.ok && Buffer.from(result.bytes).toString()).toBe('0000002');
    expect(request.mock.calls.map(([command]) => command)).toEqual(['evaluate', 'readMemory', 'readMemory']);
    state.invalidateProcess('module');
    await reader.rootAddress(99, entry, root);
    expect(request.mock.calls.filter(([command]) => command === 'evaluate')).toHaveLength(2);
  });

  it.each(['local', 'linkage', 'register', 'based', 'external'] as const)('keeps %s addresses scoped to a frame and stop', async kind => {
    const { reader, state, entry, root, request } = setup();
    if (kind === 'based' || kind === 'external') root.flags[kind] = true;
    else root.storage.kind = kind;
    await reader.rootAddress(1, entry, root);
    await reader.rootAddress(1, entry, root);
    await reader.rootAddress(2, entry, root);
    state.bumpGeneration('stopped');
    await reader.rootAddress(1, entry, root);
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('separates identical b_N symbols in different compilation units, programs and offsets', async () => {
    const { reader, state, entry, root, request } = setup();
    state.registry.addManifest(helloManifest('/work/second'));
    await reader.rootAddress(1, entry, root);
    await reader.rootAddress(1, state.registry.programs[1], root);
    await reader.rootAddress(1, { ...entry, program: { ...entry.program, programId: 'OTHER' } }, root);
    await reader.rootAddress(1, entry, { ...root, offset: 8 });
    expect(request).toHaveBeenCalledTimes(4);
  });

  it.each([undefined, '0', 'unavailable'])('retries unsuccessful static evaluations (%s)', async result => {
    const { reader, entry, root, request } = setup();
    request.mockResolvedValueOnce({ seq: 0, request_seq: 0, type: 'response', command: 'evaluate', success: result !== undefined, body: { result } });
    expect((await reader.rootAddress(1, entry, root)).ok).toBe(false);
    expect(await reader.rootAddress(1, entry, root)).toEqual({ ok: true, address: 4096n });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does not let an old pending failure evict a new process address', async () => {
    const { reader, state, entry, root, request } = setup();
    let release!: (response: DebugProtocol.Response) => void;
    request.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const old = reader.rootAddress(1, entry, root);
    state.invalidateProcess('process');
    await reader.rootAddress(1, entry, root);
    release({ seq: 0, request_seq: 0, type: 'response', command: 'evaluate', success: false });
    await old;
    await reader.rootAddress(1, entry, root);
    expect(request).toHaveBeenCalledTimes(2);
  });
});

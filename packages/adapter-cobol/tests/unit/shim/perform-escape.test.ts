import { describe, expect, it, vi } from 'vitest';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { PerformEscapeWatch, generatedLineAt } from '../../../src/shim/perform-escape.js';
import type { ProgramEntry } from '../../../src/shim/manifest-registry.js';
import { helloManifest } from './fixtures.js';

function setup() {
  const manifest = helloManifest('/work');
  const entry: ProgramEntry = { manifest, program: manifest.programs[0], sourceKey: '/work/hello.cob' };
  entry.program.controlFlow = {
    hasGoto: true,
    ranges: [{ labelId: 5, startCLine: 200, endCLine: 249 }, { labelId: 6, startCLine: 250, endCLine: 299 }],
    performs: [{ callCLine: 120, returnCLine: 140, endCLine: 149, startLabel: 5, endLabel: 6 }]
  };
  const request = vi.fn(async (_command: string, raw?: unknown): Promise<DebugProtocol.Response> => {
    const args = raw as { expression: string };
    const result = args.expression.includes('return_address_ptr') ? '4096' : args.expression.includes('perform_through') ? '6' : args.expression.includes('ResolveLoadAddress') ? '128' : '260';
    return { seq: 1, type: 'response', request_seq: 1, command: 'evaluate', success: true, body: { result } };
  });
  const engine = { request };
  return { entry, request, engine, watch: new PerformEscapeWatch(engine, entry) };
}

describe('PERFORM range escape tracking', () => {
  it('uses the live THRU label when GCC attributes a shared return block to a different PERFORM', async () => {
    const { entry, watch } = setup();
    entry.program.controlFlow!.performs = [
      { callCLine: 120, returnCLine: 140, endCLine: 149, startLabel: 5, endLabel: 5 },
      { callCLine: 220, returnCLine: 240, endCLine: 249, startLabel: 6, endLabel: 6 }
    ];
    expect(await watch.inspect(1, 2, 260)).toBe('inside');
    expect(await watch.inspect(1, 2, 210)).toBe('escaped');
  });

  it('refuses ambiguous THRU starts when the PC cannot identify the call', async () => {
    const { entry, watch, request } = setup();
    entry.program.controlFlow!.performs.push({ callCLine: 300, returnCLine: 320, endCLine: 325, startLabel: 6, endLabel: 6 });
    request.mockImplementation(async (_command, raw) => {
      const expression = (raw as { expression: string }).expression;
      return { seq: 1, type: 'response', request_seq: 1, command: 'evaluate', success: true,
        body: { result: expression.includes('return_address_ptr') ? '4096' : expression.includes('perform_through') ? '6' : '999' } };
    });
    expect(await watch.inspect(1, 1, 260)).toBe('unavailable');
  });

  it('surfaces unavailable storage after an engine closes during the stack reads', async () => {
    const { watch, request } = setup();
    request.mockRejectedValue(new Error('engine closed'));
    expect(await watch.inspect(1, 1)).toBe('unavailable');
  });
  it('keeps the full THRU range active, catches an escape and permits the normal return', async () => {
    const { watch, request } = setup();
    expect(await watch.inspect(1, 1, 125)).toBe('inside'); // push before goto
    expect(await watch.inspect(1, 1, 205)).toBe('inside');
    expect(await watch.inspect(1, 1)).toBe('inside'); // second THRU paragraph
    expect(await watch.inspect(1, 1, 305)).toBe('escaped');
    expect(await watch.inspect(1, 1, 141)).toBe('inside'); // return before frame_ptr--
    expect(request.mock.calls.filter(([, args]) => (args as { expression: string }).expression.includes('ResolveLoadAddress'))).toHaveLength(1);
  });

  it('refreshes a frame reused for another PERFORM return address', async () => {
    const { watch, request } = setup();
    expect(await watch.inspect(1, 1, 205)).toBe('inside');
    request.mockResolvedValueOnce({ seq: 1, type: 'response', request_seq: 1, command: 'evaluate', success: true, body: { result: '8192' } });
    expect(await watch.inspect(1, 1, 125)).toBe('inside');
    expect(request.mock.calls.filter(([, args]) => (args as { expression: string }).expression.includes('ResolveLoadAddress'))).toHaveLength(2);
  });

  it('does not guess bounds or PCs when metadata or engine reads are incomplete', async () => {
    const a = setup(); delete a.entry.program.controlFlow;
    expect(await a.watch.inspect(1, 1)).toBe('unavailable');
    const b = setup(); b.entry.program.controlFlow!.performs = [];
    expect(await b.watch.inspect(1, 1)).toBe('unavailable');
    const c = setup(); c.entry.program.controlFlow!.ranges = [];
    expect(await c.watch.inspect(1, 1)).toBe('unavailable');
    const d = setup();
    d.request.mockResolvedValue({ seq: 1, type: 'response', request_seq: 1, command: 'evaluate', success: false });
    expect(await d.watch.inspect(1, 1)).toBe('unavailable');
    const e = setup();
    expect(await e.watch.inspect(1, 1, 205)).toBe('inside');
    e.request.mockResolvedValueOnce({ seq: 1, type: 'response', request_seq: 1, command: 'evaluate', success: true, body: { result: '4096' } });
    e.request.mockResolvedValueOnce({ seq: 1, type: 'response', request_seq: 1, command: 'evaluate', success: true, body: { result: '6' } });
    e.request.mockRejectedValueOnce(new Error('closed'));
    expect(await e.watch.inspect(1, 1)).toBe('unavailable');
  });

  it('selects the exact PC row with bounded read-only debugger queries and rejects invalid results', async () => {
    const { request, engine, entry } = setup();
    expect(await generatedLineAt(engine, entry, 12)).toBe(260);
    expect(request.mock.calls[0][1]).toMatchObject({ frameId: 12, expression: expect.stringContaining('GetStartAddress().GetLoadAddress(lldb.target) == pc') });
    expect(request.mock.calls[0][1]).toMatchObject({ expression: expect.stringContaining('ix + 16') });
    request.mockResolvedValue({ seq: 1, type: 'response', request_seq: 1, command: 'evaluate', success: true, body: { result: '0' } });
    expect(await generatedLineAt(engine, entry, 12, 4096n)).toBeUndefined();
    request.mockRejectedValue(new Error('closed'));
    expect(await generatedLineAt(engine, entry, 12)).toBeUndefined();
  });
});

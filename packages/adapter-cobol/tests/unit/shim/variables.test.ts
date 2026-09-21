/**
 * `variables` over the shim's references: sections, groups, tables, ODO,
 * LINKAGE, paging, staleness and the reference band guard.
 */
import { describe, expect, it, afterEach } from 'vitest';
import path from 'node:path';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { installMemory } from './fake-engine.js';
import { callsManifest, callsMemory, helloManifest, helloMemory } from './fixtures.js';
import { bringUp, frame, startShim, stopWithFrames, waitFor, type Harness } from './harness.js';

const ROOT = path.resolve('/work/cobol/examples');
const HELLO_COB = path.join(ROOT, 'hello.cob');
const SUB_COB = path.join(ROOT, 'calls', 'sub.cob');

type Vars = DebugProtocol.Variable[];

function varsOf(response: DebugProtocol.Response): Vars {
  expect(response.success).toBe(true);
  return (response.body as DebugProtocol.VariablesResponse['body']).variables;
}

async function helloWorkingStorage(h: Harness): Promise<{ scope: DebugProtocol.Scope; vars: Vars }> {
  const scopes = (await h.client.request('scopes', { frameId: 1 })).body as DebugProtocol.ScopesResponse['body'];
  const scope = scopes.scopes[0];
  const vars = varsOf(await h.client.request('variables', { variablesReference: scope.variablesReference }));
  return { scope, vars };
}

describe('cobol shim variables', () => {
  let h: Harness | undefined;

  afterEach(async () => {
    await h?.cleanup();
    h = undefined;
  });

  async function startHello(): Promise<Harness> {
    const harness = await startShim({ manifests: [helloManifest(ROOT)], engineSetup: (engine) => installMemory(engine, helloMemory()) });
    await bringUp(harness);
    await stopWithFrames(harness, [frame(1, 'HELLO_', HELLO_COB, 32)]);
    return harness;
  }

  it('lists the section roots decoded, 88s beside their parent and REDEFINES as a typed sibling', async () => {
    h = await startHello();
    const { vars } = await helloWorkingStorage(h);
    expect(vars.map((v) => v.name)).toEqual(['WS-SCALED', 'WS-GROUP', 'WS-TABLE', 'WS-COUNT', 'WS-ODO', 'WS-RAW', 'WS-ALT', 'WS-IDX', 'WS-DUP']);
    const scaled = vars[0];
    expect(scaled.value).toBe('-123.45');
    expect(scaled.type).toBe('PIC S9(5)V99');
    expect(scaled.variablesReference).toBe(0);
    expect(scaled.evaluateName).toBe('WS-SCALED');
    expect(scaled.memoryReference).toBe('0x7ff000001000');
    const alt = vars.find((v) => v.name === 'WS-ALT')!;
    expect(alt.type).toBe('PIC 9(8) REDEFINES WS-RAW');
    expect(alt.value).toBe('1234');
    expect(vars.find((v) => v.name === 'WS-RAW')!.value).toBe('"00001234"');
    expect(vars.find((v) => v.name === 'WS-IDX')!.value).toBe('2');
    // One address evaluation and one record read per root: nine roots, WS-RAW/WS-ALT share b_38 —
    // plus the PERFORM-depth read the stack trace made at the stop (M3).
    expect(h.engine.received('evaluate')).toHaveLength(9);
    expect(h.engine.received('readMemory')).toHaveLength(8);
  });

  it('expands a group into its subordinates with the 88 conditions evaluated against their parent', async () => {
    h = await startHello();
    const { vars } = await helloWorkingStorage(h);
    const group = vars.find((v) => v.name === 'WS-GROUP')!;
    expect(group.type).toBe('GROUP (25 bytes)');
    expect(group.namedVariables).toBe(3);
    const children = varsOf(await h.client.request('variables', { variablesReference: group.variablesReference }));
    expect(children.map((v) => [v.name, v.value])).toEqual([
      ['WS-ID', '42'],
      ['WS-NAME', '"ALICE               "'],
      ['WS-STATUS', '"A"'],
      ['WS-STATUS-ACTIVE', 'true'],
      ['WS-STATUS-CLOSED', 'false']
    ]);
    expect(children[3].type).toBe('88-level of WS-STATUS');
    expect(children[1].evaluateName).toBe('WS-NAME OF WS-GROUP');
    expect(children[1].memoryReference).toBe('0x7ff000002004');
    // The group's record was read once; the children came from the cache.
    expect(h.engine.received('readMemory').filter((r) => (r.arguments as { memoryReference: string }).memoryReference === '0x7ff000002000')).toHaveLength(1);
  });

  it('presents OCCURS as a table with indexedVariables and pages NAME(i) elements', async () => {
    h = await startHello();
    const { vars } = await helloWorkingStorage(h);
    const table = vars.find((v) => v.name === 'WS-TABLE')!;
    const [entry] = varsOf(await h.client.request('variables', { variablesReference: table.variablesReference }));
    expect(entry.name).toBe('WS-ENTRY');
    expect(entry.value).toBe('OCCURS 5');
    expect(entry.indexedVariables).toBe(5);
    expect(entry.type).toBe('GROUP (4 bytes) OCCURS 5');
    const page = varsOf(await h.client.request('variables', { variablesReference: entry.variablesReference, start: 1, count: 2 }));
    expect(page.map((v) => v.name)).toEqual(['WS-ENTRY(2)', 'WS-ENTRY(3)']);
    expect(page[0].evaluateName).toBe('WS-ENTRY OF WS-TABLE(2)');
    const [amount] = varsOf(await h.client.request('variables', { variablesReference: page[1].variablesReference }));
    expect(amount.name).toBe('WS-AMOUNT');
    expect(amount.value).toBe('300');
    expect(amount.evaluateName).toBe('WS-AMOUNT OF WS-ENTRY OF WS-TABLE(3)');
    expect(amount.memoryReference).toBe('0x7ff000003008');
    const all = varsOf(await h.client.request('variables', { variablesReference: entry.variablesReference }));
    expect(all).toHaveLength(5);
  });

  it('sizes an OCCURS DEPENDING ON table by the live depending value, clamped to its bounds', async () => {
    h = await startHello();
    const { vars } = await helloWorkingStorage(h);
    const odo = vars.find((v) => v.name === 'WS-ODO')!;
    const [items] = varsOf(await h.client.request('variables', { variablesReference: odo.variablesReference }));
    expect(items.value).toBe('OCCURS 3 (1 TO 9 DEPENDING ON WS-COUNT)');
    expect(items.indexedVariables).toBe(3);
    const elements = varsOf(await h.client.request('variables', { variablesReference: items.variablesReference }));
    expect(elements.map((v) => v.value)).toEqual(['"A"', '"B"', '"C"']);
  });

  it('reports a LINKAGE record whose pointer is NULL as not passed, and reads LOCAL-STORAGE off cob_local_ptr', async () => {
    h = await startShim({ manifests: [callsManifest(ROOT)], engineSetup: (engine) => installMemory(engine, callsMemory({ linkageNull: true })) });
    await bringUp(h);
    await stopWithFrames(h, [frame(1, 'CALLSUB_', SUB_COB, 15)]);
    const scopes = ((await h.client.request('scopes', { frameId: 1 })).body as DebugProtocol.ScopesResponse['body']).scopes;
    const linkage = varsOf(await h.client.request('variables', { variablesReference: scopes.find((s) => s.name === 'LINKAGE')!.variablesReference }));
    expect(linkage[0].name).toBe('LK-ARG-REC');
    expect(linkage[0].value).toBe('<unavailable: not passed (NULL)>');
    const local = varsOf(await h.client.request('variables', { variablesReference: scopes.find((s) => s.name === 'LOCAL-STORAGE')!.variablesReference }));
    expect(local.map((v) => [v.name, v.value])).toEqual([
      ['LS-WORK', '0'],
      ['LS-TAG', '"LOCAL "']
    ]);
    expect(h.engine.received('evaluate').map((r) => (r.arguments as { expression: string }).expression)).toContain('/nat (unsigned long long)(cob_local_ptr + 4)');
  });

  it('answers a reference from an earlier stop with a stale error', async () => {
    h = await startHello();
    const { scope } = await helloWorkingStorage(h);
    h.engine.emit('continued', { threadId: 1 });
    await h.client.nextEvent('continued');
    const stale = await h.client.request('variables', { variablesReference: scope.variablesReference });
    expect(stale.success).toBe(false);
    expect(stale.message).toBe('Variables reference is stale (program has resumed)');
  });

  it.each(['launch', 'attach', 'process', 'module', 'terminated', 'exited'])('invalidates static addresses on %s', async signal => {
    h = await startHello();
    await helloWorkingStorage(h);
    const addressReads = () => h!.engine.received('evaluate').filter(request =>
      (request.arguments as { expression: string }).expression === '/nat (unsigned long long)(b_19)').length;
    expect(addressReads()).toBe(1);
    if (signal === 'launch' || signal === 'attach') await h.client.request(signal, { program: '/work/hello' });
    else {
      h.engine.emit(signal, {});
      await h.client.nextEvent(signal);
    }
    await stopWithFrames(h, [frame(1, 'HELLO_', HELLO_COB, 32)]);
    await helloWorkingStorage(h);
    expect(addressReads()).toBe(2);
  });

  it('REF_BAND_COLLISION under --ref-check strict is fatal (exit 2)', async () => {
    h = await startShim({
      manifests: [helloManifest(ROOT)],
      argv: { refCheck: 'strict' },
      engineSetup: (engine) => engine.on('variables', () => ({ variables: [{ name: 'x', value: '1', variablesReference: (1 << 30) + 5 }] }))
    });
    await bringUp(h);
    h.client.fire('variables', { variablesReference: 12 });
    await waitFor(() => h!.exitCodes.length > 0, 3000, 'fatal exit');
    expect(h.exitCodes).toEqual([2]);
    expect(h.logs.some((line) => line.includes('REF_BAND_COLLISION'))).toBe(true);
  });

  it('REF_BAND_COLLISION under --ref-check warn only logs', async () => {
    h = await startShim({
      manifests: [helloManifest(ROOT)],
      argv: { refCheck: 'warn' },
      engineSetup: (engine) => engine.on('variables', () => ({ variables: [{ name: 'x', value: '1', variablesReference: (1 << 30) + 5 }] }))
    });
    await bringUp(h);
    const response = await h.client.request('variables', { variablesReference: 12 });
    expect(response.success).toBe(true);
    expect(h.exitCodes).toEqual([]);
    expect(h.logs.some((line) => line.includes('REF_BAND_COLLISION'))).toBe(true);
  });

  it('marks setVariable on a COBOL item as unsupported and forwards it for engine refs', async () => {
    h = await startHello();
    const { scope } = await helloWorkingStorage(h);
    const refused = await h.client.request('setVariable', { variablesReference: scope.variablesReference, name: 'WS-SCALED', value: '1' });
    expect(refused.success).toBe(false);
    expect(refused.message).toBe('Not supported for COBOL data items yet');
    const forwarded = await h.client.request('setVariable', { variablesReference: 12, name: 'b_17', value: '1' });
    expect(forwarded.success).toBe(true);
    expect(h.engine.received('setVariable')).toHaveLength(1);
  });
});

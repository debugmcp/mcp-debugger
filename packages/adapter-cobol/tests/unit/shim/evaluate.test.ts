/**
 * `evaluate` in COBOL terms: every grammar form, ambiguity, the engine
 * fall-through, `/nat` passthrough and the walk-up from a non-COBOL frame.
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

type Body = DebugProtocol.EvaluateResponse['body'];

describe('cobol shim evaluate', () => {
  let h: Harness | undefined;

  afterEach(async () => {
    await h?.cleanup();
    h = undefined;
  });

  async function startHello(): Promise<Harness> {
    const harness = await startShim({
      manifests: [helloManifest(ROOT)],
      engineSetup: (engine) =>
        installMemory(engine, helloMemory(), (args: { expression: string }) =>
          args.expression === 'b_19' ? { result: '"001234u"', type: 'cob_u8_t[7]', variablesReference: 0 } : engineError(`use of undeclared identifier '${args.expression}'`)
        )
    });
    await bringUp(harness);
    await stopWithFrames(harness, [frame(1, 'HELLO_', HELLO_COB, 32), frame(2, 'main', HELLO_C, 250)]);
    return harness;
  }

  async function evaluate(expression: string, frameId: number | undefined = 1): Promise<DebugProtocol.Response> {
    return h!.client.request('evaluate', { expression, frameId, context: 'repl' });
  }

  function body(response: DebugProtocol.Response): Body {
    expect(response.success).toBe(true);
    return response.body as Body;
  }

  it('resolves plain, qualified and case-insensitive names', async () => {
    h = await startHello();
    expect(body(await evaluate('WS-SCALED'))).toMatchObject({ result: '-123.45', type: 'PIC S9(5)V99', variablesReference: 0, memoryReference: '0x7ff000001000' });
    expect(body(await evaluate('ws-name of ws-group')).result).toBe('"ALICE               "');
    expect(body(await evaluate('WS-ID IN WS-DUP')).result).toBe('7');
    const group = body(await evaluate('WS-GROUP'));
    expect(group.variablesReference).toBeGreaterThanOrEqual(1 << 30);
    expect(group.namedVariables).toBe(3);
  });

  it('lists the candidates of an ambiguous name', async () => {
    h = await startHello();
    const response = await evaluate('WS-ID');
    expect(response.success).toBe(false);
    expect(response.message).toBe("'WS-ID' is ambiguous in program HELLO: WS-ID OF WS-GROUP, WS-ID OF WS-DUP. Qualify it (NAME OF GROUP).");
  });

  it('subscripts by literal, by a numeric item with an offset, and rejects wrong arity and range', async () => {
    h = await startHello();
    expect(body(await evaluate('WS-AMOUNT(3)')).result).toBe('300');
    expect(body(await evaluate('WS-AMOUNT OF WS-ENTRY(WS-IDX + 1)')).result).toBe('300');
    expect(body(await evaluate('WS-AMOUNT(WS-IDX - 1)')).result).toBe('100');
    const table = body(await evaluate('WS-ENTRY'));
    expect(table.result).toBe('OCCURS 5');
    expect(table.indexedVariables).toBe(5);
    const tooMany = await evaluate('WS-AMOUNT(1, 2)');
    expect(tooMany.success).toBe(false);
    expect(tooMany.message).toContain('has 1 dimension(s); 2 subscripts given');
    const range = await evaluate('WS-AMOUNT(6)');
    expect(range.success).toBe(false);
    expect(range.message).toContain('out of range 1..5: 6');
    const scalar = await evaluate('WS-SCALED(1)');
    expect(scalar.success).toBe(false);
    expect(scalar.message).toContain('is not a table');
  });

  it('applies reference modification', async () => {
    h = await startHello();
    const named = body(await evaluate('WS-NAME OF WS-GROUP(2:3)'));
    expect(named.result).toBe('"LIC"');
    expect(named.type).toBe('PIC X(3) (WS-NAME OF WS-GROUP(2:3))');
    expect(named.memoryReference).toBe('0x7ff000002005');
    expect(body(await evaluate('WS-RAW(5:)')).result).toBe('"1234"');
    const bad = await evaluate('WS-RAW(9:1)');
    expect(bad.success).toBe(false);
    expect(bad.message).toContain('outside WS-RAW (1..8)');
  });

  it('answers LENGTH OF, ADDRESS OF and the /hex /raw /addr /len views', async () => {
    h = await startHello();
    expect(body(await evaluate('LENGTH OF WS-GROUP')).result).toBe('25');
    expect(body(await evaluate('ADDRESS OF WS-NAME OF WS-GROUP')).result).toBe('0x7ff000002004');
    expect(body(await evaluate('/hex WS-SCALED')).result).toBe('0x30303132333475');
    expect(body(await evaluate('/raw WS-STATUS')).result).toBe('"A"');
    expect(body(await evaluate('/addr WS-AMOUNT(2)')).result).toBe('0x7ff000003004 (4 bytes)');
    expect(body(await evaluate('/len WS-TABLE')).result).toBe('20');
  });

  it('evaluates a level-88 condition name', async () => {
    h = await startHello();
    expect(body(await evaluate('WS-STATUS-ACTIVE'))).toMatchObject({ result: 'true', type: '88-level of WS-STATUS' });
    expect(body(await evaluate('WS-STATUS-CLOSED')).result).toBe('false');
  });

  it('falls through to the engine for unknown names and merges both failures into one error', async () => {
    h = await startHello();
    const native = body(await evaluate('b_19'));
    expect(native.result).toBe('"001234u"');
    const both = await evaluate('WS-NOPE');
    expect(both.success).toBe(false);
    expect(both.message).toBe("'WS-NOPE' is not a data item of program HELLO and native evaluation failed: use of undeclared identifier 'WS-NOPE'. Use /nat for C expressions.");
    const arithmetic = await evaluate('1 + 2');
    expect(arithmetic.success).toBe(false);
    expect(arithmetic.message).toContain("'1 + 2' is not a COBOL data reference and native evaluation failed");
  });

  it('forwards /nat /py /se /cmd expressions verbatim', async () => {
    h = await startHello();
    h.engine.on('evaluate', (args: { expression: string }) => ({ result: `echo:${args.expression}`, variablesReference: 0 }));
    expect(body(await evaluate('/nat WS-SCALED')).result).toBe('echo:/nat WS-SCALED');
    expect(body(await evaluate('/py 1+1')).result).toBe('echo:/py 1+1');
    expect(h.engine.received('evaluate').slice(-2).map((r) => (r.arguments as { context: string }).context)).toEqual(['repl', 'repl']);
  });

  it('walks up from a non-COBOL frame to the nearest COBOL frame and says so', async () => {
    h = await startShim({ manifests: [helloManifest(ROOT)], engineSetup: (engine) => installMemory(engine, helloMemory()) });
    await bringUp(h);
    await stopWithFrames(h, [
      frame(10, 'cob_runtime_error', undefined, 0),
      frame(11, 'cob_check_subscript', undefined, 0),
      frame(12, 'HELLO_', HELLO_C, 139),
      frame(13, 'main', HELLO_C, 250)
    ]);
    const walked = body(await h.client.request('evaluate', { expression: 'WS-SCALED', frameId: 10 }));
    expect(walked.result).toBe('-123.45 (evaluated in frame #2 HELLO: 0000-MAIN [hello.c:139])');
    expect(h.engine.received('evaluate')[0].arguments).toMatchObject({ frameId: 12, context: 'variables' });
    const global = body(await h.client.request('evaluate', { expression: 'WS-COUNT' }));
    expect(global.result).toBe('3 (evaluated in frame #2 HELLO: 0000-MAIN [hello.c:139])');
  });

  it('refuses setExpression on a COBOL name and forwards it otherwise', async () => {
    h = await startHello();
    const refused = await h.client.request('setExpression', { expression: 'WS-SCALED', value: '1', frameId: 1 });
    expect(refused.success).toBe(false);
    expect(refused.message).toBe('Not supported for COBOL data items yet');
    const forwarded = await h.client.request('setExpression', { expression: 'b_19[0]', value: '1', frameId: 1 });
    expect(forwarded.success).toBe(true);
  });
});

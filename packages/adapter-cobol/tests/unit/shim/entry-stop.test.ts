import { afterEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { entryStopLocation } from '../../../src/shim/entry-stop.js';
import { ManifestRegistry } from '../../../src/shim/manifest-registry.js';
import { bringUp, frame, recordingLogger, startShim, stopWithFrames, type Harness } from './harness.js';
import { helloManifest } from './fixtures.js';
import { engineError } from './fake-engine.js';

const ROOT = path.resolve('/work/entry');
const SOURCE = path.join(ROOT, 'hello.cob');
const COPY = path.join(ROOT, 'first.cpy');
function manifest() {
  const m = helloManifest(ROOT);
  m.programs[0].entryLine = 31;
  m.programs[0].procedure.statements = [{ sourceFileId: 1, line: 20, verb: 'DISPLAY' }, { sourceFileId: 1, line: 32, verb: 'MOVE' }];
  return m;
}

describe('COBOL entry selection', () => {
  it('selects the primary source before unrelated modules and uses a COPY entry after DECLARATIVES', () => {
    const m = manifest();
    m.programs[0].isMain = false;
    m.sources.push({ id: 2, path: COPY, kind: 'copybook' });
    m.programs[0].entryStatement = { sourceFileId: 2, line: 1, verb: 'MOVE' };
    const other = helloManifest(path.join(ROOT, 'module'));
    other.programs[0].programId = 'OTHER';
    const registry = new ManifestRegistry(recordingLogger([]));
    registry.addManifest(other); registry.addManifest(m);
    expect(entryStopLocation(registry, { entrySource: SOURCE })).toEqual({ path: COPY, line: 1 });
    expect(entryStopLocation(registry, { entryProgram: 'hello' })).toEqual({ path: COPY, line: 1 });
  });

  it('rejects ambiguous roots and falls back to entryLine in older manifests', () => {
    const registry = new ManifestRegistry(recordingLogger([]));
    registry.addManifest(manifest());
    expect(entryStopLocation(registry)).toEqual({ path: SOURCE, line: 32 });
    registry.addManifest(helloManifest(path.join(ROOT, 'other')));
    expect(entryStopLocation(registry)).toBeUndefined();
    expect(entryStopLocation(registry, { entryProgram: 'missing' })).toBeUndefined();
  });
});

describe('COBOL entry stop routing', () => {
  let h: Harness | undefined;
  afterEach(async () => { await h?.cleanup(); h = undefined; });

  async function launch(options: { pending?: boolean; noDebug?: boolean } = {}) {
    h = await startShim({ manifests: [manifest()], engineSetup: engine => {
      engine.on('setBreakpoints', (args: DebugProtocol.SetBreakpointsArguments) => ({
        breakpoints: (args.breakpoints ?? []).map(bp => ({ id: bp.line, line: bp.line, verified: !options.pending }))
      }));
    } });
    await bringUp(h, { stopOnEntry: true, noDebug: options.noDebug });
    return h;
  }

  it.each([false, true])('arms before configurationDone, including a pending cobcrun source (pending=%s)', async pending => {
    const h = await launch({ pending });
    expect(h.engine.received('launch')[0].arguments).toMatchObject({ stopOnEntry: false });
    expect((await h.client.request('configurationDone')).success).toBe(true);
    const order = h.engine.requests.map(request => request.command);
    expect(order.indexOf('setBreakpoints')).toBeLessThan(order.indexOf('configurationDone'));
    await stopWithFrames(h, [frame(1, 'HELLO_', SOURCE, 32)], { hitBreakpointIds: [32] });
    expect(h.client.events('stopped')[0].body).toMatchObject({ reason: 'entry', description: 'COBOL program entry' });
    expect(h.client.events('stopped')[0].body).not.toHaveProperty('hitBreakpointIds');
    expect(h.engine.received('setBreakpoints').at(-1)?.arguments).toMatchObject({ breakpoints: [] });
    h.engine.emit('breakpoint', { reason: 'removed', breakpoint: { id: 32, verified: true } });
    await h.client.request('threads');
    expect(h.client.events('breakpoint')).toHaveLength(0);
  });

  it('preserves user breakpoints across entry arming and disarming; their reason wins', async () => {
    const h = await launch();
    await h.client.request('setBreakpoints', { source: { path: SOURCE }, breakpoints: [{ line: 32 }, { line: 34 }] });
    await h.client.request('setFunctionBreakpoints', { breakpoints: [] });
    await h.client.request('configurationDone');
    await stopWithFrames(h, [frame(1, 'HELLO_', SOURCE, 32)], { hitBreakpointIds: [32] });
    expect(h.client.events('stopped')[0].body).toMatchObject({ reason: 'breakpoint', hitBreakpointIds: [32] });
    expect(h.engine.received('setBreakpoints').at(-1)?.arguments).toMatchObject({ breakpoints: [{ line: 32 }, { line: 34 }] });
  });

  it.each(['exception', 'pause'])('an earlier %s is presented immediately and cancels the entry stop', async reason => {
    const h = await launch();
    await h.client.request('configurationDone');
    await stopWithFrames(h, [frame(1, 'runtime', undefined, 0)], { reason });
    expect(h.client.events('stopped')[0].body).toMatchObject({ reason });
    expect(h.engine.received('continue')).toHaveLength(0);
    expect(h.engine.received('setBreakpoints').at(-1)?.arguments).toMatchObject({ breakpoints: [] });
  });

  it('logs an entry-line logpoint once and keeps the process stopped', async () => {
    const h = await launch();
    await h.client.request('setBreakpoints', { source: { path: SOURCE }, breakpoints: [{ line: 32, logMessage: 'entry log' }] });
    await h.client.request('configurationDone');
    await stopWithFrames(h, [frame(1, 'HELLO_', SOURCE, 32)], { hitBreakpointIds: [32] });
    expect(h.client.events('output').map(event => event.body)).toContainEqual({ category: 'console', output: 'entry log\n' });
    expect(h.engine.received('continue')).toHaveLength(0);
  });

  it('does not arm for noDebug or attach, and labels missing metadata fallback', async () => {
    const h = await launch({ noDebug: true });
    await h.client.request('configurationDone');
    expect(h.engine.received('setBreakpoints')).toHaveLength(0);
    await h.client.request('attach', { pid: 123, stopOnEntry: true });
    expect(h.engine.received('attach')[0].arguments).toMatchObject({ stopOnEntry: true });
  });

  it('fails configuration instead of silently running when the engine refuses the entry stop', async () => {
    const h = await launch();
    h.engine.on('setBreakpoints', () => engineError('no debug target'));
    const result = await h.client.request('configurationDone');
    expect(result.success).toBe(false);
    expect(result.message).toContain('cannot arm COBOL entry stop');
    expect(h.engine.received('configurationDone')).toHaveLength(0);
  });
});

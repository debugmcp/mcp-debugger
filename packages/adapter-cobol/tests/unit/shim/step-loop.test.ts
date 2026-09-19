/**
 * The step loop: raw engine steps land on generated-C lines and DATA DIVISION
 * lines; the shim keeps stepping until a COBOL statement, and the client sees
 * exactly one response and one final `stopped`.
 */
import { describe, expect, it, afterEach } from 'vitest';
import path from 'node:path';
import type { DebugProtocol } from '@vscode/debugprotocol';
import type { FakeEngine } from './fake-engine.js';
import { callsManifest, helloManifest } from './fixtures.js';
import { bringUp, frame, startShim, tick, type Harness } from './harness.js';
import { MAX_STEP_ITERATIONS, STEP_BOUND_DESCRIPTION } from '../../../src/shim/router.js';

const ROOT = path.resolve('/work/cobol/examples');
const HELLO_COB = path.join(ROOT, 'hello.cob');
const HELLO_C = path.join(ROOT, 'build', 'hello.c');
const MAIN_COB = path.join(ROOT, 'calls', 'main.cob');
const SUB_COB = path.join(ROOT, 'calls', 'sub.cob');
const SUB_C = path.join(ROOT, 'build', 'sub.c');
const SUB_LH = path.join(ROOT, 'build', 'sub.c.l.h');

interface ScriptedStop {
  frame: DebugProtocol.StackFrame;
  stopped?: Partial<DebugProtocol.StoppedEvent['body']>;
}

/**
 * Every step command the engine receives advances to the next scripted stop and emits it;
 * `stackTrace` reports the frame of the current stop. Runs out → the last stop repeats.
 */
function scriptSteps(engine: FakeEngine, stops: ScriptedStop[], startIndex = -1): { commands: string[] } {
  let index = startIndex;
  const commands: string[] = [];
  const step = (command: string) => () => {
    commands.push(command);
    index = Math.min(index + 1, stops.length - 1);
    const stop = stops[index];
    setImmediate(() => engine.emit('stopped', { reason: 'step', threadId: 1, allThreadsStopped: true, ...stop.stopped }));
    return {};
  };
  engine.on('next', step('next'));
  engine.on('stepIn', step('stepIn'));
  engine.on('stepOut', step('stepOut'));
  engine.on('stackTrace', () => ({ stackFrames: [{ ...stops[Math.max(index, 0)].frame }], totalFrames: 1 }));
  return { commands };
}

describe('cobol shim step loop', () => {
  let h: Harness | undefined;

  afterEach(async () => {
    await h?.cleanup();
    h = undefined;
  });

  it('next: swallows the generated-C stops and forwards exactly one stopped on the next COBOL line', async () => {
    let script: { commands: string[] } | undefined;
    h = await startShim({
      manifests: [helloManifest(ROOT)],
      engineSetup: (engine) => {
        script = scriptSteps(engine, [
          { frame: frame(1, 'HELLO_', HELLO_COB, 32) },
          { frame: frame(1, 'HELLO_', HELLO_C, 127) },
          { frame: frame(1, 'HELLO_', HELLO_C, 131) },
          { frame: frame(1, 'HELLO_', HELLO_COB, 33) }
        ], 0);
      }
    });
    await bringUp(h);
    const response = await h.client.request('next', { threadId: 1 });
    expect(response.success).toBe(true);
    const stopped = await h.client.nextEvent('stopped');
    expect(stopped.body).toMatchObject({ reason: 'step', threadId: 1 });
    await tick(50);
    expect(h.client.events('stopped')).toHaveLength(1);
    expect(h.client.events('continued')).toHaveLength(0);
    expect(script!.commands).toEqual(['next', 'next', 'next']);
    // The client's stack after the stop shows the COBOL line.
    const frames = ((await h.client.request('stackTrace', { threadId: 1 })).body as DebugProtocol.StackTraceResponse['body']).stackFrames;
    expect(frames[0].line).toBe(33);
    expect(frames[0].name).toBe('HELLO: 0000-MAIN');
  });

  it('a breakpoint hit mid-loop ends the loop and surfaces as a breakpoint stop', async () => {
    let script: { commands: string[] } | undefined;
    h = await startShim({
      manifests: [helloManifest(ROOT)],
      engineSetup: (engine) => {
        script = scriptSteps(engine, [
          { frame: frame(1, 'HELLO_', HELLO_COB, 32) },
          { frame: frame(1, 'HELLO_', HELLO_C, 127) },
          { frame: frame(1, 'HELLO_', HELLO_COB, 37), stopped: { reason: 'breakpoint', hitBreakpointIds: [3] } }
        ], 0);
      }
    });
    await bringUp(h);
    await h.client.request('next', { threadId: 1 });
    const stopped = await h.client.nextEvent('stopped');
    expect(stopped.body).toMatchObject({ reason: 'breakpoint', hitBreakpointIds: [3] });
    expect(script!.commands).toEqual(['next', 'next']);
  });

  it('stepOut: one engine stepOut, then next until a COBOL statement of the caller', async () => {
    let script: { commands: string[] } | undefined;
    h = await startShim({
      manifests: [callsManifest(ROOT)],
      engineSetup: (engine) => {
        script = scriptSteps(engine, [
          { frame: frame(1, 'CALLSUB_', SUB_COB, 16) },
          { frame: frame(2, 'CALLSUB', SUB_C, 60) },
          { frame: frame(3, 'CALLMAIN_', path.join(ROOT, 'build', 'main.c'), 139) },
          { frame: frame(3, 'CALLMAIN_', MAIN_COB, 14) }
        ], 0);
      }
    });
    await bringUp(h);
    await h.client.request('stepOut', { threadId: 1 });
    const stopped = await h.client.nextEvent('stopped');
    expect(stopped.body).toMatchObject({ reason: 'step' });
    expect(script!.commands).toEqual(['stepOut', 'next', 'next']);
  });

  it('stepIn: keeps stepping in through the callee entry and its DATA DIVISION initialisation', async () => {
    let script: { commands: string[] } | undefined;
    h = await startShim({
      manifests: [callsManifest(ROOT)],
      engineSetup: (engine) => {
        script = scriptSteps(engine, [
          { frame: frame(1, 'CALLMAIN_', MAIN_COB, 13) },
          { frame: frame(2, 'CALLSUB', SUB_C, 40) },
          { frame: frame(3, 'CALLSUB_module_init', SUB_LH, 12) },
          { frame: frame(4, 'CALLSUB_', SUB_COB, 5) },
          { frame: frame(4, 'CALLSUB_', SUB_COB, 6) },
          { frame: frame(4, 'CALLSUB_', SUB_COB, 15) }
        ], 0);
      }
    });
    await bringUp(h);
    await h.client.request('stepIn', { threadId: 1 });
    await h.client.nextEvent('stopped');
    // A `next` here would step over the CALL; LLDB keeps `stepIn` out of libcob by itself.
    expect(script!.commands).toEqual(['stepIn', 'stepIn', 'stepIn', 'stepIn', 'stepIn']);
    const frames = ((await h.client.request('stackTrace', { threadId: 1 })).body as DebugProtocol.StackTraceResponse['body']).stackFrames;
    expect(frames[0].name).toBe('CALLSUB: 0000-SUB-MAIN');
    expect(frames[0].line).toBe(15);
  });

  it('gives up after the iteration bound and says so in the forwarded stopped', async () => {
    let script: { commands: string[] } | undefined;
    h = await startShim({
      manifests: [helloManifest(ROOT)],
      engineSetup: (engine) => {
        script = scriptSteps(engine, [{ frame: frame(1, 'HELLO_', HELLO_COB, 32) }, { frame: frame(1, 'HELLO_', HELLO_C, 127) }], 0);
      }
    });
    await bringUp(h);
    await h.client.request('next', { threadId: 1 });
    const stopped = await h.client.nextEvent('stopped', 15_000);
    expect(stopped.body).toMatchObject({ reason: 'step', description: STEP_BOUND_DESCRIPTION });
    expect(script!.commands).toHaveLength(MAX_STEP_ITERATIONS);
    expect(h.client.events('stopped')).toHaveLength(1);
  }, 20_000);

  it('a stop on a different thread is not the loop\'s to swallow', async () => {
    h = await startShim({
      manifests: [helloManifest(ROOT)],
      engineSetup: (engine) => {
        scriptSteps(engine, [{ frame: frame(1, 'HELLO_', HELLO_COB, 32) }, { frame: frame(1, 'HELLO_', HELLO_C, 127), stopped: { threadId: 2 } }], 0);
      }
    });
    await bringUp(h);
    await h.client.request('next', { threadId: 1 });
    const stopped = await h.client.nextEvent('stopped');
    expect(stopped.body).toMatchObject({ threadId: 2 });
  });
});

/**
 * The file a Java stop reports, through a real server, the real JDI bridge
 * and a real JVM (issue #1138).
 *
 * JDI names a frame's source relative to its source root (`com/acme/App.java`,
 * or a bare `PauseTest.java` in the default package). The bridge used to know
 * a class's path only from a line breakpoint set on that class, so every other
 * stop (a pause, a function breakpoint, a step into another class) answered
 * with a name no tool could open, and with no `context`.
 *
 * The bridge now resolves that relative name under the source roots the
 * session knows:
 *   a launch: the caller's `sourcePaths`, the program's and the working
 *     directory's ancestors, the classpath's directories;
 *   an attach: the caller's `sourcePaths`;
 *   either: the root a line breakpoint's path proves (the path's tail is the
 *     class's package path, so what precedes it is where the tree starts).
 *
 * The fixture is a small tree built per run, with two classes named `Helper`
 * in different packages: a path learnt for one must never answer for the
 * other.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startStdioClient, type StdioClientHandle, type ToolAnswer } from '../../../test-utils/helpers/mcp-stdio-client.js';

interface Frame { name: string; file: string; line: number }
type StopAnswer = ToolAnswer & { pending?: boolean; location?: { file: string; line: number }; context?: { lineContent?: string } };
type StackAnswer = ToolAnswer & { stackFrames: Frame[] };
type ContextAnswer = ToolAnswer & { lineContent?: string };

const APP = [
  'package com.acme;',
  '',
  'public class App {',
  '    public static void main(String[] args) throws InterruptedException {',
  '        int n = 0;',
  '        while (true) {',
  '            n = Helper.tick(n);',
  '            n = com.acme.other.Helper.tock(n);',
  '            Thread.sleep(100);',
  '        }',
  '    }',
  '}',
  ''
].join('\n');
/** `n = Helper.tick(n);` */
const TICK_CALL_LINE = 7;

/** `tick` returns on line 5. */
const HELPER = [
  'package com.acme;',
  '',
  'public class Helper {',
  '    public static int tick(int n) {',
  '        return n + 1;',
  '    }',
  '}',
  ''
].join('\n');
const TICK_RETURN_LINE = 5;

/** Line 5 of this file holds no statement, so a breakpoint on line 5 of the other Helper.java has nothing to bind to here. */
const OTHER_HELPER = [
  'package com.acme.other;',
  '',
  'public class Helper {',
  '    // Nothing runs on the first lines of this class: the method starts',
  '    // further down than the other Helper\'s does.',
  '    //',
  '    public static int tock(int n) {',
  '        return n - 1;',
  '    }',
  '}',
  ''
].join('\n');

/** Paths compare by what they name: separators and (on Windows) case aside. */
function samePath(actual: string | undefined, expected: string): boolean {
  if (typeof actual !== 'string') return false;
  const fold = (value: string): string => {
    const normal = path.normalize(value);
    return process.platform === 'win32' ? normal.toLowerCase() : normal;
  };
  return fold(actual) === fold(expected);
}

describe('The file a Java stop reports (issue #1138) @requires-java', () => {
  let root: string;
  let sourceRoot: string;
  let classes: string;
  let appSource: string;
  let helperSource: string;
  let otherHelperSource: string;
  let server: StdioClientHandle | undefined;
  let jvm: ChildProcess | undefined;

  beforeAll(() => {
    // realpath: the JVM and the bridge report the path they resolve, and the
    // temp directory is a symlink on macOS.
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'java-stop-source-')));
    sourceRoot = path.join(root, 'src');
    classes = path.join(root, 'out');
    appSource = path.join(sourceRoot, 'com', 'acme', 'App.java');
    helperSource = path.join(sourceRoot, 'com', 'acme', 'Helper.java');
    otherHelperSource = path.join(sourceRoot, 'com', 'acme', 'other', 'Helper.java');
    fs.mkdirSync(path.dirname(otherHelperSource), { recursive: true });
    fs.mkdirSync(classes, { recursive: true });
    fs.writeFileSync(appSource, APP);
    fs.writeFileSync(helperSource, HELPER);
    fs.writeFileSync(otherHelperSource, OTHER_HELPER);
    execFileSync('javac', ['-g', '-d', classes, appSource, helperSource, otherHelperSource], { windowsHide: true });
  }, 120_000);

  afterEach(async () => {
    await server?.close();
    server = undefined;
    jvm?.kill();
    jvm = undefined;
  });

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });

  /** The fixture under a JDWP agent on a port the JVM picks; resolves with that port. */
  function startJvmWaitingForDebugger(): Promise<number> {
    const child = spawn(
      'java',
      ['-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=127.0.0.1:0', '-cp', classes, 'com.acme.App'],
      // Its own working directory, away from the sources: the attach must not
      // find them by where the JVM happens to run.
      { cwd: classes, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    jvm = child;
    return new Promise<number>((resolve, reject) => {
      let seen = '';
      const timer = setTimeout(() => reject(new Error(`the JVM never announced its JDWP port: ${seen}`)), 30_000);
      const read = (chunk: Buffer): void => {
        seen += chunk.toString();
        const match = /Listening for transport dt_socket at address: (\d+)/.exec(seen);
        if (match) {
          clearTimeout(timer);
          resolve(Number(match[1]));
        }
      };
      child.stdout?.on('data', read);
      child.stderr?.on('data', read);
      child.once('error', (error) => { clearTimeout(timer); reject(error); });
      child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`the JVM exited (${code}) before announcing its port: ${seen}`)); });
    });
  }

  async function launchByClassName(client: StdioClientHandle): Promise<void> {
    const launch = await client.call<StopAnswer>('start_debugging', {
      scriptPath: appSource,
      adapterLaunchConfig: { program: 'com.acme.App', classpath: classes },
      dapLaunchArgs: { stopOnEntry: false }
    });
    expect(launch, JSON.stringify(launch)).toMatchObject({ success: true, state: 'running' });
  }

  async function pause(client: StdioClientHandle): Promise<StopAnswer> {
    let paused = await client.call<StopAnswer>('pause_execution', {});
    if (paused.pending) {
      paused = await client.call<StopAnswer>('wait_for_stop', { timeout: 20_000 });
    }
    expect(paused, JSON.stringify(paused)).toMatchObject({ success: true, state: 'paused' });
    return paused;
  }

  async function resumeToStop(client: StdioClientHandle): Promise<StopAnswer> {
    let stop = await client.call<StopAnswer>('continue_execution', {});
    if (stop.state !== 'paused') {
      stop = await client.call<StopAnswer>('wait_for_stop', { timeout: 20_000 });
    }
    expect(stop, JSON.stringify(stop)).toMatchObject({ success: true, state: 'paused' });
    return stop;
  }

  it('a pause in a class with no breakpoint answers the path of its source, and that path opens', async () => {
    server = await startStdioClient({ name: 'java-stop-source-pause' });
    await server.createSession('java', 'java-stop-source-pause');
    await launchByClassName(server);

    const paused = await pause(server);
    const shown = JSON.stringify(paused);
    // Before the fix: "com/acme/App.java", and no context.
    expect(samePath(paused.location?.file, appSource), shown).toBe(true);
    expect(paused.context?.lineContent, shown).toContain('Thread.sleep(100)');

    const context = await server.call<ContextAnswer>('get_source_context', { file: paused.location?.file, line: paused.location?.line });
    expect(context, JSON.stringify(context)).toMatchObject({ success: true });

    const stack = await server.call<StackAnswer>('get_stack_trace', {});
    expect(stack.stackFrames.some((frame) => samePath(frame.file, appSource)), JSON.stringify(stack)).toBe(true);
  }, 120_000);

  it('a function-breakpoint stop answers its own class\'s file, also when a same-named class in another package has a breakpoint set by path', async () => {
    server = await startStdioClient({ name: 'java-stop-source-function' });
    await server.createSession('java', 'java-stop-source-function');
    const armed = await server.call('set_breakpoint', { function: 'com.acme.other.Helper.tock' });
    expect(armed, JSON.stringify(armed)).toMatchObject({ success: true });
    // The path the bridge learns for a class called `Helper`: com.acme's.
    const line = await server.call('set_breakpoint', { file: helperSource, line: TICK_RETURN_LINE });
    expect(line, JSON.stringify(line)).toMatchObject({ success: true });

    const launch = await server.call<StopAnswer>('start_debugging', {
      scriptPath: appSource,
      adapterLaunchConfig: { program: 'com.acme.App', classpath: classes },
      dapLaunchArgs: { stopOnEntry: false }
    });
    expect(launch, JSON.stringify(launch)).toMatchObject({ success: true });
    let stop = launch.state === 'paused' ? launch : await server.call<StopAnswer>('wait_for_stop', { timeout: 20_000 });

    // The loop calls tick, then tock: the first stop is the line breakpoint.
    expect(stop, JSON.stringify(stop)).toMatchObject({ success: true, state: 'paused' });
    expect(samePath(stop.location?.file, helperSource), JSON.stringify(stop)).toBe(true);
    expect(stop.location?.line).toBe(TICK_RETURN_LINE);

    stop = await resumeToStop(server);
    const shown = JSON.stringify(stop);
    // com.acme.other.Helper, in its own file: not the other Helper's path.
    expect(samePath(stop.location?.file, otherHelperSource), shown).toBe(true);
    expect(stop.context?.lineContent, shown).toContain('return n - 1');
  }, 120_000);

  it('an attach that names no source root answers the relative name until a line breakpoint\'s path shows where the tree starts', async () => {
    const port = await startJvmWaitingForDebugger();
    server = await startStdioClient({ name: 'java-stop-source-attach' });
    await server.createSession('java', 'java-stop-source-attach');
    const attached = await server.call<StopAnswer>('attach_to_process', { port, host: '127.0.0.1' });
    expect(attached, JSON.stringify(attached)).toMatchObject({ success: true });

    const paused = attached.state === 'paused' ? attached : await pause(server);
    // Nothing told the session where this JVM's sources are: the name JDI
    // has, as before.
    expect(paused.location?.file?.replace(/\\/g, '/'), JSON.stringify(paused)).toBe('com/acme/App.java');

    // A line breakpoint in App, on the call to Helper.tick. (Not in a Helper:
    // a path breakpoint on one of two same-named classes is issue #1158.)
    const line = await server.call('set_breakpoint', { file: appSource, line: TICK_CALL_LINE });
    expect(line, JSON.stringify(line)).toMatchObject({ success: true });
    const stop = await resumeToStop(server);
    expect(samePath(stop.location?.file, appSource), JSON.stringify(stop)).toBe(true);
    expect(stop.location?.line).toBe(TICK_CALL_LINE);

    // The breakpoint's path ends in com/acme/App.java, so the tree starts at
    // what precedes it. A step into a class no breakpoint names lands in a
    // file found under that root. Before: "com/acme/Helper.java".
    let stepped = await server.call<StopAnswer>('step_into', {});
    if (stepped.pending) {
      stepped = await server.call<StopAnswer>('wait_for_stop', { timeout: 20_000 });
    }
    const shown = JSON.stringify(stepped);
    expect(stepped, shown).toMatchObject({ success: true, state: 'paused' });
    expect(samePath(stepped.location?.file, helperSource), shown).toBe(true);
    expect(stepped.location?.line).toBe(TICK_RETURN_LINE);
    expect(stepped.context?.lineContent, shown).toContain('return n + 1');

    // And the frame that was answered by its relative name while no root was
    // known is found now too: the lookup is not remembered past a new root.
    const stack = await server.call<StackAnswer>('get_stack_trace', {});
    const caller = stack.stackFrames.find((frame) => frame.name.includes('App.main'));
    expect(caller, JSON.stringify(stack)).toBeDefined();
    expect(samePath(caller?.file, appSource), JSON.stringify(stack)).toBe(true);
  }, 120_000);

  it('an attach that names the source root in sourcePaths answers the path at once', async () => {
    const port = await startJvmWaitingForDebugger();
    server = await startStdioClient({ name: 'java-stop-source-attach-roots' });
    await server.createSession('java', 'java-stop-source-attach-roots');
    const attached = await server.call<StopAnswer>('attach_to_process', { port, host: '127.0.0.1', sourcePaths: [sourceRoot] });
    expect(attached, JSON.stringify(attached)).toMatchObject({ success: true });

    const paused = attached.state === 'paused' ? attached : await pause(server);
    const shown = JSON.stringify(paused);
    expect(samePath(paused.location?.file, appSource), shown).toBe(true);
    expect(paused.context?.lineContent, shown).toContain('Thread.sleep(100)');
  }, 120_000);
});

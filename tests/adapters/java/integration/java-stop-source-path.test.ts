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
 *     directory (and, for a class in a package, their ancestors), the
 *     classpath's directories;
 *   an attach: the caller's `sourcePaths`;
 *   either: the root a line breakpoint's path proves (the path's tail is the
 *     class's package path, so what precedes it is where the tree starts).
 *
 * The fixture is a small tree built per run:
 *   src/com/acme/{App,Helper,Clock}.java and src/com/acme/other/Helper.java:
 *     two classes named `Helper` in different packages, because a path learnt
 *     for one must never answer for the other;
 *   odd/Stray.java, which declares `package org.stray` but sits in no
 *     package-shaped directory;
 *   flat/{Solo,Duo}.java in the default package.
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
  '            n = Clock.now(n);',
  '            n = org.stray.Stray.go(n);',
  '            Thread.sleep(100);',
  '        }',
  '    }',
  '}',
  ''
].join('\n');

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

/** The only class of its name: a path breakpoint on it is clear of issue #1158. `now` returns on line 5. */
const CLOCK = [
  'package com.acme;',
  '',
  'public class Clock {',
  '    public static int now(int n) {',
  '        return n;',
  '    }',
  '}',
  ''
].join('\n');
const CLOCK_RETURN_LINE = 5;

/** Declares a package and sits outside any directory shaped like it. `go` returns on line 5. */
const STRAY = [
  'package org.stray;',
  '',
  'public class Stray {',
  '    public static int go(int n) {',
  '        return n;',
  '    }',
  '}',
  ''
].join('\n');
const STRAY_RETURN_LINE = 5;

const SOLO = [
  'public class Solo {',
  '    public static void main(String[] args) throws InterruptedException {',
  '        int n = 0;',
  '        while (true) {',
  '            n = Duo.spin(n);',
  '            Thread.sleep(100);',
  '        }',
  '    }',
  '}',
  ''
].join('\n');

/** `spin` returns on line 3. */
const DUO = [
  'public class Duo {',
  '    public static int spin(int n) {',
  '        return n + 1;',
  '    }',
  '}',
  ''
].join('\n');
const SPIN_RETURN_LINE = 3;

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
  let clockSource: string;
  let straySource: string;
  let soloSource: string;
  let duoSource: string;
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
    clockSource = path.join(sourceRoot, 'com', 'acme', 'Clock.java');
    straySource = path.join(root, 'odd', 'Stray.java');
    soloSource = path.join(root, 'flat', 'Solo.java');
    duoSource = path.join(root, 'flat', 'Duo.java');
    for (const [file, text] of [
      [appSource, APP], [helperSource, HELPER], [otherHelperSource, OTHER_HELPER], [clockSource, CLOCK],
      [straySource, STRAY], [soloSource, SOLO], [duoSource, DUO]
    ]) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, text);
    }
    fs.mkdirSync(classes, { recursive: true });
    execFileSync(
      'javac',
      ['-g', '-d', classes, appSource, helperSource, otherHelperSource, clockSource, straySource, soloSource, duoSource],
      { windowsHide: true }
    );
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

  /** A fixture program under a JDWP agent on a port the JVM picks; resolves with that port. */
  function startJvmWaitingForDebugger(mainClass = 'com.acme.App'): Promise<number> {
    const child = spawn(
      'java',
      ['-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=127.0.0.1:0', '-cp', classes, mainClass],
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

  async function connect(name: string): Promise<StdioClientHandle> {
    server = await startStdioClient({ name });
    await server.createSession('java', name);
    return server;
  }

  /** Launch `com.acme.App` by class name; `extra` goes into adapterLaunchConfig. */
  async function launchApp(client: StdioClientHandle, scriptPath: string, extra: Record<string, unknown> = {}): Promise<StopAnswer> {
    const launch = await client.call<StopAnswer>('start_debugging', {
      scriptPath,
      adapterLaunchConfig: { program: 'com.acme.App', classpath: classes, ...extra },
      dapLaunchArgs: { stopOnEntry: false }
    });
    expect(launch, JSON.stringify(launch)).toMatchObject({ success: true });
    return launch;
  }

  async function attach(client: StdioClientHandle, port: number, extra: Record<string, unknown> = {}): Promise<void> {
    const attached = await client.call<StopAnswer>('attach_to_process', { port, host: '127.0.0.1', ...extra });
    expect(attached, JSON.stringify(attached)).toMatchObject({ success: true });
    if (attached.state !== 'paused') {
      await pause(client);
    }
  }

  async function pause(client: StdioClientHandle): Promise<StopAnswer> {
    let paused = await client.call<StopAnswer>('pause_execution', {});
    if (paused.pending) {
      paused = await client.call<StopAnswer>('wait_for_stop', { timeout: 20_000 });
    }
    expect(paused, JSON.stringify(paused)).toMatchObject({ success: true, state: 'paused' });
    return paused;
  }

  /**
   * One frame of the paused thread, by its method. A pause lands wherever the
   * program is: nearly always in the sleep, now and then inside a helper. The
   * loop's own frame is on the stack either way, so the cases read that frame
   * rather than the stop's top one.
   */
  async function frameOf(client: StdioClientHandle, method: string): Promise<Frame> {
    const stack = await client.call<StackAnswer>('get_stack_trace', {});
    const frame = stack.stackFrames.find((entry) => entry.name.includes(method));
    expect(frame, JSON.stringify(stack)).toBeDefined();
    return frame as Frame;
  }

  async function topFrameName(client: StdioClientHandle): Promise<string> {
    const stack = await client.call<StackAnswer>('get_stack_trace', {});
    return stack.stackFrames[0]?.name ?? '';
  }

  async function resumeToStop(client: StdioClientHandle): Promise<StopAnswer> {
    let stop = await client.call<StopAnswer>('continue_execution', {});
    if (stop.state !== 'paused') {
      stop = await client.call<StopAnswer>('wait_for_stop', { timeout: 20_000 });
    }
    expect(stop, JSON.stringify(stop)).toMatchObject({ success: true, state: 'paused' });
    return stop;
  }

  async function setLineBreakpoint(client: StdioClientHandle, file: string, line: number): Promise<void> {
    const set = await client.call('set_breakpoint', { file, line });
    expect(set, JSON.stringify(set)).toMatchObject({ success: true });
  }

  const relative = (file: string): string => file.replace(/\\/g, '/');

  describe('a launch', () => {
    it('a pause in a class with no breakpoint answers the path of its source, and that path opens', async () => {
      const client = await connect('java-stop-source-pause');
      const launch = await launchApp(client, appSource);
      expect(launch.state).toBe('running');

      const paused = await pause(client);
      const shown = JSON.stringify(paused);
      // Before the fix: "com/acme/App.java" (or a helper's relative name), and no context.
      expect(path.isAbsolute(paused.location?.file ?? ''), shown).toBe(true);
      expect(fs.existsSync(paused.location?.file ?? ''), shown).toBe(true);
      expect(paused.context?.lineContent, shown).toBeDefined();

      const main = await frameOf(client, 'App.main');
      expect(samePath(main.file, appSource), JSON.stringify(main)).toBe(true);
      const context = await client.call<ContextAnswer>('get_source_context', { file: main.file, line: main.line });
      expect(context, JSON.stringify(context)).toMatchObject({ success: true });
    }, 120_000);

    it('a pause in a default-package class answers the path of its source too', async () => {
      // The issue's own row. The program is the source file, so its directory
      // is where the launch points.
      const client = await connect('java-stop-source-default-package');
      const launch = await client.call<StopAnswer>('start_debugging', {
        scriptPath: soloSource,
        adapterLaunchConfig: { classpath: classes },
        dapLaunchArgs: { stopOnEntry: false }
      });
      expect(launch, JSON.stringify(launch)).toMatchObject({ success: true, state: 'running' });
      await pause(client);

      const main = await frameOf(client, 'Solo.main');
      expect(samePath(main.file, soloSource), JSON.stringify(main)).toBe(true);
    }, 120_000);

    it('a function-breakpoint stop answers its own class\'s file, also when a same-named class in another package has a breakpoint set by path', async () => {
      const client = await connect('java-stop-source-function');
      const armed = await client.call('set_breakpoint', { function: 'com.acme.other.Helper.tock' });
      expect(armed, JSON.stringify(armed)).toMatchObject({ success: true });
      // The path the bridge keeps for a class called `Helper`: com.acme's.
      await setLineBreakpoint(client, helperSource, TICK_RETURN_LINE);

      const launch = await launchApp(client, appSource);
      let stop = launch.state === 'paused' ? launch : await client.call<StopAnswer>('wait_for_stop', { timeout: 20_000 });
      expect(stop, JSON.stringify(stop)).toMatchObject({ success: true, state: 'paused' });

      // Which class the path breakpoint binds to, and so whether it stops
      // first, is issue #1158's and not asserted here: resume until the stop
      // is the function breakpoint in com.acme.other.Helper, and read that
      // stop's file.
      const inTock = async (): Promise<boolean> => (await topFrameName(client)).includes('com.acme.other.Helper.tock');
      for (let resumes = 0; resumes < 4 && !(await inTock()); resumes++) {
        stop = await resumeToStop(client);
      }
      const shown = JSON.stringify(stop);
      expect(await inTock(), shown).toBe(true);
      expect(samePath(stop.location?.file, otherHelperSource), shown).toBe(true);
      expect(stop.context?.lineContent, shown).toContain('return n - 1');
    }, 120_000);

    it('a file that declares a package but sits outside a directory shaped like it is still the one its breakpoint named', async () => {
      // No root holds org/stray/Stray.java. The breakpoint's own path is the
      // only candidate for the class, as it was before source roots existed.
      const client = await connect('java-stop-source-stray');
      await setLineBreakpoint(client, straySource, STRAY_RETURN_LINE);

      const launch = await launchApp(client, appSource);
      const stop = launch.state === 'paused' ? launch : await client.call<StopAnswer>('wait_for_stop', { timeout: 20_000 });
      const shown = JSON.stringify(stop);
      expect(stop, shown).toMatchObject({ success: true, state: 'paused' });
      expect(await topFrameName(client)).toContain('org.stray.Stray.go');
      expect(samePath(stop.location?.file, straySource), shown).toBe(true);
      expect(stop.location?.line).toBe(STRAY_RETURN_LINE);
    }, 120_000);

    it('names the source root in adapterLaunchConfig.sourcePaths, and finds a file its other roots do not hold', async () => {
      // The class is named, not a file, and the JVM runs in the classes
      // directory: neither the program, the working directory's ancestors nor
      // the classpath lead to src/. Only the root the caller names does.
      const client = await connect('java-stop-source-launch-roots');
      const launch = await launchApp(client, path.join(classes, 'com', 'acme', 'App.class'), { cwd: classes, sourcePaths: [sourceRoot] });
      expect(launch.state).toBe('running');
      await pause(client);

      const main = await frameOf(client, 'App.main');
      expect(samePath(main.file, appSource), JSON.stringify(main)).toBe(true);
    }, 120_000);

    it('the same launch without sourcePaths answers the relative name: no root is guessed', async () => {
      const client = await connect('java-stop-source-launch-no-roots');
      const launch = await launchApp(client, path.join(classes, 'com', 'acme', 'App.class'), { cwd: classes });
      expect(launch.state).toBe('running');
      await pause(client);

      const main = await frameOf(client, 'App.main');
      expect(relative(main.file), JSON.stringify(main)).toBe('com/acme/App.java');
    }, 120_000);

    it('a default-package class is not matched to a file of its name in a directory above the launch', async () => {
      // Lone.class has no source where the launch points. An unrelated
      // Lone.java sits two directories above the working directory, where the
      // climb for package roots reaches: it must not be answered as the
      // class's source.
      const gen = path.join(root, 'gen');
      const run = path.join(root, 'run', 'deep');
      fs.mkdirSync(gen, { recursive: true });
      fs.mkdirSync(run, { recursive: true });
      const lone = path.join(gen, 'Lone.java');
      fs.writeFileSync(lone, [
        'public class Lone {',
        '    public static void main(String[] args) throws InterruptedException {',
        '        while (true) {',
        '            Thread.sleep(100);',
        '        }',
        '    }',
        '}',
        ''
      ].join('\n'));
      execFileSync('javac', ['-g', '-d', classes, lone], { windowsHide: true });
      fs.renameSync(lone, path.join(root, 'Lone.java.moved'));
      fs.writeFileSync(path.join(root, 'Lone.java'), '// an unrelated file that happens to be called Lone.java\n');

      const client = await connect('java-stop-source-bare-name');
      const launch = await client.call<StopAnswer>('start_debugging', {
        scriptPath: path.join(classes, 'Lone.class'),
        adapterLaunchConfig: { program: 'Lone', classpath: classes, cwd: run },
        dapLaunchArgs: { stopOnEntry: false }
      });
      expect(launch, JSON.stringify(launch)).toMatchObject({ success: true, state: 'running' });
      await pause(client);

      const main = await frameOf(client, 'Lone.main');
      expect(main.file, JSON.stringify(main)).toBe('Lone.java');
    }, 120_000);
  });

  describe('an attach', () => {
    it('that names no source root answers the relative name until a line breakpoint\'s path shows where the tree starts', async () => {
      const port = await startJvmWaitingForDebugger();
      const client = await connect('java-stop-source-attach');
      await attach(client, port);

      // Nothing told the session where this JVM's sources are: the name JDI
      // has, as before. This lookup is also what the bridge remembers.
      const unresolved = await frameOf(client, 'App.main');
      expect(relative(unresolved.file), JSON.stringify(unresolved)).toBe('com/acme/App.java');

      // A line breakpoint in Clock (the only class of its name: a path
      // breakpoint on one of two same-named classes is issue #1158).
      await setLineBreakpoint(client, clockSource, CLOCK_RETURN_LINE);
      const stop = await resumeToStop(client);
      const shown = JSON.stringify(stop);
      expect(await topFrameName(client)).toContain('Clock.now');
      expect(samePath(stop.location?.file, clockSource), shown).toBe(true);
      expect(stop.context?.lineContent, shown).toContain('return n;');

      // The breakpoint's path ends in com/acme/Clock.java, so the tree starts
      // at what precedes it. App has no breakpoint and was answered by its
      // relative name a moment ago: it is found under that root now, so the
      // earlier miss is not remembered past a new root.
      const caller = await frameOf(client, 'App.main');
      expect(samePath(caller.file, appSource), JSON.stringify(caller)).toBe(true);
    }, 120_000);

    it('to a default-package program learns its directory the same way', async () => {
      const port = await startJvmWaitingForDebugger('Solo');
      const client = await connect('java-stop-source-attach-default-package');
      await attach(client, port);

      const unresolved = await frameOf(client, 'Solo.main');
      expect(unresolved.file, JSON.stringify(unresolved)).toBe('Solo.java');

      await setLineBreakpoint(client, duoSource, SPIN_RETURN_LINE);
      await resumeToStop(client);
      expect(await topFrameName(client)).toContain('Duo.spin');

      // The root a breakpoint shows serves bare file names as well.
      const caller = await frameOf(client, 'Solo.main');
      expect(samePath(caller.file, soloSource), JSON.stringify(caller)).toBe(true);
    }, 120_000);

    it('that names the source root in sourcePaths answers the path at once', async () => {
      const port = await startJvmWaitingForDebugger();
      const client = await connect('java-stop-source-attach-roots');
      await attach(client, port, { sourcePaths: [sourceRoot] });

      const main = await frameOf(client, 'App.main');
      expect(samePath(main.file, appSource), JSON.stringify(main)).toBe(true);
      const context = await client.call<ContextAnswer>('get_source_context', { file: main.file, line: main.line });
      expect(context, JSON.stringify(context)).toMatchObject({ success: true });
    }, 120_000);
  });
});

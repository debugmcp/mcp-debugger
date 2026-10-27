/**
 * Shared helpers for the Dart e2e suites: find a Dart SDK the way the adapter does (PATH, env,
 * Flutter's bundled copy, the winget install dir), resolve the example project's packages once,
 * and locate `// BP-NAME` marker lines so moving a line never breaks an assertion.
 */
import { spawn, spawnSync, type ChildProcess } from 'child_process';
import { existsSync, readFileSync, readdirSync, realpathSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import which from 'which';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');
export const DART_EXAMPLES_DIR = path.join(ROOT, 'examples', 'dart');
export const DART_PROBE_DIR = path.join(DART_EXAMPLES_DIR, 'dart_probe');

const EXE = process.platform === 'win32' ? 'dart.exe' : 'dart';

function candidates(): string[] {
  const out: string[] = [];
  const env = process.env;
  for (const key of ['DART_SDK', 'DART_PATH']) if (env[key]) out.push(path.join(env[key]!, 'bin', EXE));
  for (const key of ['FLUTTER_ROOT', 'FLUTTER_PATH']) if (env[key]) out.push(path.join(env[key]!, 'bin', 'cache', 'dart-sdk', 'bin', EXE));
  const onPath = which.sync('dart', { nothrow: true });
  if (onPath) out.push(onPath);
  if (process.platform === 'win32') {
    const pkgs = path.join(env.LOCALAPPDATA ?? '', 'Microsoft', 'WinGet', 'Packages');
    if (env.LOCALAPPDATA && existsSync(pkgs)) {
      for (const d of readdirSync(pkgs)) if (d.startsWith('Google.DartSDK_')) out.push(path.join(pkgs, d, 'dart-sdk', 'bin', EXE));
    }
    out.push('C:\\src\\flutter\\bin\\cache\\dart-sdk\\bin\\dart.exe', 'C:\\tools\\dart-sdk\\bin\\dart.exe');
  } else {
    out.push('/usr/lib/dart/bin/dart', '/opt/flutter/bin/cache/dart-sdk/bin/dart', path.join(env.HOME ?? '', 'flutter', 'bin', 'cache', 'dart-sdk', 'bin', 'dart'));
  }
  return out;
}

let cachedDart: string | null | undefined;

/** The Dart executable the tests spawn targets with; null when none is installed. */
export function findDartSync(): string | null {
  if (cachedDart !== undefined) return cachedDart;
  cachedDart = candidates().find((p) => p && existsSync(p)) ?? null;
  return cachedDart;
}

export function hasDartToolchain(): boolean {
  return findDartSync() !== null;
}

/** Environment for spawning Dart targets: puts the SDK's bin dir first on PATH. */
export function dartEnv(): NodeJS.ProcessEnv {
  const dart = findDartSync();
  if (!dart) return { ...process.env };
  const bin = path.dirname(dart);
  const sep = process.platform === 'win32' ? ';' : ':';
  return { ...process.env, PATH: `${bin}${sep}${process.env.PATH ?? ''}` };
}

let pubGetDone = false;

/** `dart pub get` for examples/dart/dart_probe, once per test process. */
export function prepareDartProbe(): void {
  if (pubGetDone) return;
  const dart = findDartSync();
  if (!dart) throw new Error('No Dart SDK found for the examples');
  if (!existsSync(path.join(DART_PROBE_DIR, '.dart_tool', 'package_config.json'))) {
    const r = spawnSync(dart, ['pub', 'get'], { cwd: DART_PROBE_DIR, encoding: 'utf8', env: dartEnv(), windowsHide: true });
    if (r.status !== 0) throw new Error(`dart pub get failed: ${r.stderr || r.stdout}`);
  }
  pubGetDone = true;
}

/** 1-based line of a `// BP-<marker>` comment in an example file. */
export function bpLine(file: string, marker: string): number {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const idx = lines.findIndex((l) => l.includes(`// BP-${marker}`));
  if (idx < 0) throw new Error(`marker BP-${marker} not found in ${file}`);
  return idx + 1;
}

// ---- Flutter ------------------------------------------------------------------------------------

export const FLUTTER_PROBE_DIR = path.join(DART_EXAMPLES_DIR, 'flutter_probe');

const FLUTTER_LAUNCHER = process.platform === 'win32' ? 'flutter.bat' : 'flutter';

function flutterRootCandidates(): string[] {
  const out: string[] = [];
  const env = process.env;
  for (const key of ['FLUTTER_ROOT', 'FLUTTER_PATH']) if (env[key]) out.push(env[key]!);
  const onPath = which.sync('flutter', { nothrow: true });
  if (onPath) {
    // Package managers (Homebrew, asdf, fvm) put a symlink on PATH; the checkout is where it points.
    let real = onPath;
    try { real = realpathSync(onPath); } catch { /* keep the symlink path */ }
    out.push(path.resolve(path.dirname(real), '..'));
  }
  if (process.platform === 'win32') {
    out.push('C:\\src\\flutter', 'C:\\flutter', path.join(env.LOCALAPPDATA ?? '', 'flutter'));
  } else {
    out.push('/opt/flutter', path.join(env.HOME ?? '', 'flutter'), path.join(env.HOME ?? '', 'development', 'flutter'), '/usr/local/flutter');
  }
  return out;
}

let cachedFlutterRoot: string | null | undefined;

/**
 * A Flutter checkout; on Windows one with a warm tool cache (the adapter spawns the tool snapshot
 * there instead of flutter.bat), elsewhere bin/flutter builds the cache itself. Null when none.
 */
export function findFlutterRootSync(): string | null {
  if (cachedFlutterRoot !== undefined) return cachedFlutterRoot;
  cachedFlutterRoot = flutterRootCandidates().find((root) =>
    root && existsSync(path.join(root, 'bin', FLUTTER_LAUNCHER))
      && (process.platform !== 'win32' || existsSync(path.join(root, 'bin', 'cache', 'flutter_tools.snapshot')))
  ) ?? null;
  return cachedFlutterRoot;
}

export function hasFlutterToolchain(): boolean {
  return findFlutterRootSync() !== null;
}

/**
 * The Flutter tool as a spawnable argv: on Windows the bundled dart.exe on the tool snapshot (the
 * adapter's own bypass — Node cannot spawn flutter.bat without a shell), elsewhere bin/flutter.
 */
export function flutterToolArgv(root: string, args: string[]): { command: string; args: string[]; env: NodeJS.ProcessEnv } {
  const env = { ...process.env, FLUTTER_ROOT: root };
  if (process.platform !== 'win32') return { command: path.join(root, 'bin', 'flutter'), args, env };
  return {
    command: path.join(root, 'bin', 'cache', 'dart-sdk', 'bin', 'dart.exe'),
    args: [`--packages=${path.join(root, 'packages', 'flutter_tools', '.dart_tool', 'package_config.json')}`, path.join(root, 'bin', 'cache', 'flutter_tools.snapshot'), ...args],
    env,
  };
}

function runFlutter(root: string, args: string[], cwd: string, timeoutMs = 300_000): { status: number | null; stdout: string; out: string } {
  const argv = flutterToolArgv(root, args);
  const r = spawnSync(argv.command, argv.args, { cwd, encoding: 'utf8', env: argv.env, windowsHide: true, timeout: timeoutMs });
  const stdout = r.stdout ?? '';
  return { status: r.status, stdout, out: `${stdout}${r.stderr ?? ''}` };
}

/** A `flutter run --machine` started outside the debugger (issue #882): the app a session attaches to. */
export interface FlutterRunMachine {
  /** The tool's `app.debugPort` URI (`params.wsUri`) once reported; null before. */
  readonly wsUri: string | null;
  readonly appId: string | null;
  /** The tool process is still running — and with it, the app it started. */
  readonly alive: boolean;
  readonly child: ChildProcess;
  /** The params of the next `<event>` on the machine stream, or null after `timeoutMs`. */
  waitFor(event: string, timeoutMs: number): Promise<Record<string, unknown> | null>;
  /** `app.stop` through the tool, then end the tool process. */
  stop(): Promise<void>;
}

/**
 * Start the probe app the way a developer terminal or an IDE does — `flutter run -d <device>
 * --machine` — so a test can attach to an app the debugger did not launch. The JSON-RPC stream
 * on stdout carries `app.start`, `app.debugPort` (the tool's own DDS URI) and `app.started`; the
 * tool's plain text goes to the same stream and is skipped.
 */
export function flutterRunMachine(deviceId: string, cwd = FLUTTER_PROBE_DIR, target = FLUTTER_EXAMPLES.main): FlutterRunMachine {
  const root = findFlutterRootSync();
  if (!root) throw new Error('No Flutter SDK found for the examples');
  const argv = flutterToolArgv(root, ['run', '-d', deviceId, '--machine', '-t', target]);
  const child = spawn(argv.command, argv.args, { cwd, env: argv.env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let wsUri: string | null = null;
  let appId: string | null = null;
  const waiters: Array<{ event: string; resolve: (params: Record<string, unknown> | null) => void }> = [];
  const alive = () => child.exitCode === null && child.signalCode === null;
  // A tool that dies (device offline, a signal) answers every pending wait at once, not after
  // the wait's own timeout; its stdin may already be gone when stop() writes to it.
  child.once('exit', () => { for (const w of waiters.splice(0)) w.resolve(null); });
  child.stdin!.on('error', () => { /* the tool is gone; stop() checks alive() first */ });
  let rest = '';
  child.stdout!.on('data', (chunk: Buffer) => {
    rest += chunk.toString();
    let nl: number;
    while ((nl = rest.indexOf('\n')) >= 0) {
      const line = rest.slice(0, nl).replace(/\r$/, '');
      rest = rest.slice(nl + 1);
      if (!line.startsWith('[{')) continue;
      let message: { event?: string; params?: Record<string, unknown> } | undefined;
      try { [message] = JSON.parse(line) as Array<typeof message>; } catch { continue; }
      if (!message?.event) continue;
      const params = message.params ?? {};
      if (message.event === 'app.start' || message.event === 'app.debugPort') appId = typeof params.appId === 'string' ? params.appId : appId;
      if (message.event === 'app.debugPort' && typeof params.wsUri === 'string') wsUri = params.wsUri;
      for (const w of [...waiters]) {
        if (w.event === message.event) { waiters.splice(waiters.indexOf(w), 1); w.resolve(params); }
      }
    }
  });
  child.stderr!.on('data', () => { /* the tool's warnings; the test reads the app's state through the server */ });
  return {
    get wsUri() { return wsUri; },
    get appId() { return appId; },
    get alive() { return alive(); },
    child,
    waitFor(event, timeoutMs) {
      if (!alive()) return Promise.resolve(null);
      return new Promise((resolve) => {
        const timer = setTimeout(() => { const i = waiters.indexOf(w); if (i >= 0) { waiters.splice(i, 1); resolve(null); } }, timeoutMs);
        const w = { event, resolve: (params: Record<string, unknown> | null) => { clearTimeout(timer); resolve(params); } };
        waiters.push(w);
      });
    },
    async stop() {
      if (!alive()) return;
      if (appId) child.stdin!.write(`${JSON.stringify([{ id: 1, method: 'app.stop', params: { appId } }])}\n`);
      await new Promise<void>((resolve) => {
        const t = setTimeout(() => { child.kill(); resolve(); }, 5000);
        child.once('exit', () => { clearTimeout(t); resolve(); });
      });
    },
  };
}

let flutterProbePrepared = false;

/**
 * Generate the probe's platform folders (not committed) and resolve its packages, once per test
 * process: `flutter create --platforms=<the host desktop, ios on macOS, web> .` then
 * `flutter pub get`. Only the folders that are missing are generated, so a checkout made before
 * a platform's case existed (no `web/`, no `ios/`) catches up without being regenerated.
 */
export function prepareFlutterProbe(): void {
  if (flutterProbePrepared) return;
  const root = findFlutterRootSync();
  if (!root) throw new Error('No Flutter SDK found for the examples');
  const platforms = process.platform === 'win32' ? ['windows', 'web'] : process.platform === 'darwin' ? ['macos', 'ios', 'web'] : ['linux', 'web'];
  const missing = platforms.filter((p) => !existsSync(path.join(FLUTTER_PROBE_DIR, p)));
  if (missing.length > 0) {
    const r = runFlutter(root, ['create', `--platforms=${missing.join(',')}`, '--project-name', 'flutter_probe', '.'], FLUTTER_PROBE_DIR);
    if (r.status !== 0) throw new Error(`flutter create --platforms=${missing.join(',')} failed: ${r.out}`);
  }
  if (!existsSync(path.join(FLUTTER_PROBE_DIR, '.dart_tool', 'package_config.json'))) {
    const r = runFlutter(root, ['pub', 'get'], FLUTTER_PROBE_DIR);
    if (r.status !== 0) throw new Error(`flutter pub get failed: ${r.out}`);
  }
  flutterProbePrepared = true;
}

/** One row of `flutter devices --machine`, the fields the helpers select on. */
export interface FlutterDevice { id: string; name?: string; targetPlatform?: string; emulator?: boolean }

let cachedDevices: FlutterDevice[] | undefined;

/**
 * The devices `flutter devices --machine` reports on this box (cached); empty without Flutter.
 * An iOS simulator is listed only while it is booted, under its UDID, with `targetPlatform: ios`
 * and `emulator: true`, so the list is enough to pick one without a second `simctl` probe.
 */
export function flutterDevices(): FlutterDevice[] {
  if (cachedDevices) return cachedDevices;
  const root = findFlutterRootSync();
  if (!root) return (cachedDevices = []);
  const r = runFlutter(root, ['devices', '--machine'], DART_EXAMPLES_DIR, 120_000);
  try {
    // stdout only: the tool's warnings (`[!] adb …`, startup-lock notices) go to stderr and would
    // follow the array.
    const start = r.stdout.indexOf('[');
    const list = JSON.parse(r.stdout.slice(start)) as Array<Record<string, unknown>>;
    cachedDevices = list
      .filter((d): d is Record<string, unknown> & { id: string } => typeof d.id === 'string')
      .map((d) => ({
        id: d.id,
        ...(typeof d.name === 'string' ? { name: d.name } : {}),
        ...(typeof d.targetPlatform === 'string' ? { targetPlatform: d.targetPlatform } : {}),
        ...(typeof d.emulator === 'boolean' ? { emulator: d.emulator } : {}),
      }));
  } catch {
    cachedDevices = [];
  }
  return cachedDevices;
}

/** Device ids `flutter devices --machine` reports on this box (cached); empty without Flutter. */
export function flutterDeviceIds(): string[] {
  return flutterDevices().map((d) => d.id);
}

/**
 * The desktop device id for this OS, when `flutter devices` lists it and it can actually run an
 * app: `flutter devices` lists `linux` on a headless runner too, where `flutter run -d linux`
 * dies for want of a display and the GTK toolchain (measured on CI's ubuntu lane), so Linux needs
 * a DISPLAY/WAYLAND_DISPLAY; `MCP_SKIP_FLUTTER_DESKTOP=1` skips the desktop cases anywhere.
 */
export function flutterDesktopDeviceId(): string | null {
  if (process.env.MCP_SKIP_FLUTTER_DESKTOP === '1') return null;
  if (process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) return null;
  const want = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macos' : 'linux';
  return flutterDeviceIds().includes(want) ? want : null;
}

/**
 * The browser device for a Flutter web run: `chrome` when `flutter devices` lists it (the SDK
 * finds Chrome on PATH or through CHROME_EXECUTABLE), null with `MCP_SKIP_FLUTTER_WEB=1`. The
 * cases run it headless (`--web-browser-flag=--headless=new`), so no display is needed:
 * measured at the same first-stop time as a windowed Chrome (~22 s, issue #790).
 */
export function flutterWebDeviceId(): string | null {
  if (process.env.MCP_SKIP_FLUTTER_WEB === '1') return null;
  return flutterDeviceIds().includes('chrome') ? 'chrome' : null;
}

// ---- Android ------------------------------------------------------------------------------------

export const FLUTTER_PROBE_PACKAGE = 'com.example.flutter_probe';

/** `adb` from ANDROID_SDK_ROOT / ANDROID_HOME / PATH; null when none. */
export function adbPath(): string | null {
  const exe = process.platform === 'win32' ? 'adb.exe' : 'adb';
  for (const key of ['ANDROID_SDK_ROOT', 'ANDROID_HOME']) {
    const root = process.env[key];
    if (root && existsSync(path.join(root, 'platform-tools', exe))) return path.join(root, 'platform-tools', exe);
  }
  const onPath = which.sync('adb', { nothrow: true });
  if (onPath) return onPath;
  // Android Studio's default SDK locations, the ones flutter_tools probes too.
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
  const defaults = process.platform === 'win32'
    ? [path.join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk')]
    : process.platform === 'darwin'
      ? [path.join(home, 'Library', 'Android', 'sdk')]
      : [path.join(home, 'Android', 'Sdk')];
  for (const sdk of defaults) {
    const candidate = path.join(sdk, 'platform-tools', exe);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function adb(args: string[], timeoutMs = 120_000): { status: number | null; stdout: string; out: string } {
  const exe = adbPath();
  if (!exe) return { status: null, stdout: '', out: '' };
  const r = spawnSync(exe, args, { encoding: 'utf8', windowsHide: true, timeout: timeoutMs });
  const stdout = r.stdout ?? '';
  // adb reports install failures on stderr (`adb: failed to install …`).
  return { status: r.status, stdout, out: `${stdout}${r.stderr ?? ''}` };
}

let cachedEmulator: string | null | undefined;

/**
 * An Android emulator that is booted (`adb devices` says `device`, not `offline`) and that
 * `flutter devices` lists; null otherwise, and with `MCP_SKIP_FLUTTER_ANDROID=1`. Booting one is
 * the opt-in: `flutter emulators --launch <id>` (headless flags in docs/dart/spike-notes.md).
 */
export function flutterEmulatorDeviceId(): string | null {
  if (cachedEmulator !== undefined) return cachedEmulator;
  if (process.env.MCP_SKIP_FLUTTER_ANDROID === '1' || !adbPath()) return (cachedEmulator = null);
  // Flutter's own list first: no emulator there means no adb server to start for nothing.
  const emulators = flutterDeviceIds().filter((id) => id.startsWith('emulator-'));
  if (emulators.length === 0) return (cachedEmulator = null);
  const online = new Set(
    adb(['devices']).stdout.split(/\r?\n/).map((l) => l.trim().split(/\s+/)).filter((p) => p.length === 2 && p[1] === 'device').map((p) => p[0])
  );
  cachedEmulator = emulators.find((id) => online.has(id)) ?? null;
  return cachedEmulator;
}

/**
 * Before a launch: stop the probe app and drop the port forwards that belong to this emulator.
 * `flutter run` force-stops and reinstalls on its own (android_device.dart `startApp`), so the
 * stop only matters for an instance a previous test left behind; the forwards are removed one by
 * one from `adb forward --list` because `adb forward --remove-all` is host-wide and would take
 * other tools' forwards with it.
 */
export function resetAndroidApp(deviceId: string): void {
  adb(['-s', deviceId, 'shell', 'am', 'force-stop', FLUTTER_PROBE_PACKAGE], 30_000);
  for (const line of adb(['forward', '--list'], 30_000).stdout.split(/\r?\n/)) {
    const [serial, local] = line.trim().split(/\s+/);
    if (serial === deviceId && local) adb(['-s', deviceId, 'forward', '--remove', local], 30_000);
  }
}

let androidPrepared = false;

/** The `--target-platform` matching the device's ABI, so the warm-up builds what `flutter run` will run. */
function androidTargetPlatform(deviceId: string): string {
  const abi = adb(['-s', deviceId, 'shell', 'getprop', 'ro.product.cpu.abi'], 30_000).stdout.trim();
  if (abi.startsWith('arm64')) return 'android-arm64';
  if (abi.startsWith('armeabi')) return 'android-arm';
  return 'android-x64';
}

/**
 * Generate the probe's `android/` folder, build the debug APK for the device's ABI once and
 * install it. `flutter run` stops, builds and installs on its own every time, so what this buys
 * the timed launches is a warm Gradle and dependency cache (the spike measured 425 s cold, 6–45 s
 * warm) and the first-ever `pm install` out of the way; the first `flutter run` after a fresh
 * install was seen to end without a stop once. A stale `android/` is not regenerated: delete it.
 */
export function prepareFlutterAndroid(deviceId: string): void {
  if (androidPrepared) return;
  prepareFlutterProbe();
  const root = findFlutterRootSync();
  if (!root) throw new Error('No Flutter SDK found for the examples');
  if (!existsSync(path.join(FLUTTER_PROBE_DIR, 'android'))) {
    const r = runFlutter(root, ['create', '--platforms=android', '--project-name', 'flutter_probe', '.'], FLUTTER_PROBE_DIR);
    if (r.status !== 0) throw new Error(`flutter create --platforms=android failed: ${r.out}`);
  }
  const built = runFlutter(root, ['build', 'apk', '--debug', '--target-platform', androidTargetPlatform(deviceId)], FLUTTER_PROBE_DIR, 900_000);
  if (built.status !== 0) {
    throw new Error(`flutter build apk --debug failed (a stale examples/dart/flutter_probe/android can be deleted and regenerated): ${built.out}`);
  }
  const apk = path.join(FLUTTER_PROBE_DIR, 'build', 'app', 'outputs', 'flutter-apk', 'app-debug.apk');
  let installed = adb(['-s', deviceId, 'install', '-r', '-t', apk], 180_000);
  if (installed.status !== 0) {
    // An older signature or version on the device (INSTALL_FAILED_UPDATE_INCOMPATIBLE): the way
    // flutter_tools handles it too — uninstall once and retry.
    adb(['-s', deviceId, 'uninstall', FLUTTER_PROBE_PACKAGE], 60_000);
    installed = adb(['-s', deviceId, 'install', '-r', '-t', apk], 180_000);
    if (installed.status !== 0) throw new Error(`adb install failed: ${installed.out}`);
  }
  androidPrepared = true;
}

// ---- iOS ----------------------------------------------------------------------------------------

let cachedIosSimulator: string | null | undefined;

/**
 * A booted iOS simulator, by the UDID `flutter devices` lists it under (`targetPlatform: ios`,
 * `emulator: true`; the tool lists booted simulators only, from `xcrun simctl list devices
 * booted`). An iPhone is preferred over an iPad. Null off macOS, with none booted, and with
 * `MCP_SKIP_FLUTTER_IOS=1`. Booting one is the opt-in: `xcrun simctl boot "<name or udid>"` or
 * `open -a Simulator`. Host-only: no CI lane runs it.
 */
export function iosSimulatorDeviceId(): string | null {
  if (cachedIosSimulator !== undefined) return cachedIosSimulator;
  if (process.platform !== 'darwin' || process.env.MCP_SKIP_FLUTTER_IOS === '1') return (cachedIosSimulator = null);
  const sims = flutterDevices().filter((d) => d.targetPlatform === 'ios' && d.emulator === true);
  cachedIosSimulator = (sims.find((d) => d.name?.includes('iPhone')) ?? sims[0])?.id ?? null;
  return cachedIosSimulator;
}

let iosPrepared = false;

/**
 * Build the debug app for the simulator once ahead of the timed cases (`flutter build ios
 * --simulator --debug`). `flutter run` builds, installs and launches on its own every time, so
 * this only warms xcodebuild's derived data the way prepareFlutterAndroid warms Gradle; the cold
 * build (minutes) is recorded in docs/dart/spike-notes.md, not paid inside a launch ceiling. A
 * stale `ios/` is not regenerated: delete it.
 */
export function prepareFlutterIosSimulator(): void {
  if (iosPrepared) return;
  prepareFlutterProbe();
  const root = findFlutterRootSync();
  if (!root) throw new Error('No Flutter SDK found for the examples');
  const built = runFlutter(root, ['build', 'ios', '--simulator', '--debug'], FLUTTER_PROBE_DIR, 900_000);
  if (built.status !== 0) {
    throw new Error(`flutter build ios --simulator --debug failed (a stale examples/dart/flutter_probe/ios can be deleted and regenerated): ${built.out}`);
  }
  iosPrepared = true;
}

export const FLUTTER_EXAMPLES = {
  main: path.join(FLUTTER_PROBE_DIR, 'lib', 'main.dart'),
  widgetTest: path.join(FLUTTER_PROBE_DIR, 'test', 'widget_test.dart'),
  integrationTest: path.join(FLUTTER_PROBE_DIR, 'integration_test', 'app_test.dart'),
} as const;

export const DART_EXAMPLES = {
  hello: path.join(DART_EXAMPLES_DIR, 'hello.dart'),
  app: path.join(DART_PROBE_DIR, 'bin', 'app.dart'),
  pause: path.join(DART_PROBE_DIR, 'bin', 'pause.dart'),
  throws: path.join(DART_PROBE_DIR, 'bin', 'throws.dart'),
  mathTest: path.join(DART_PROBE_DIR, 'test', 'math_test.dart'),
} as const;

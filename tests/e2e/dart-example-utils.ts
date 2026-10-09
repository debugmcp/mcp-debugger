/**
 * Shared helpers for the Dart e2e suites: find a Dart SDK the way the adapter does (PATH, env,
 * Flutter's bundled copy, the winget install dir), resolve the example project's packages once,
 * and locate `// BP-NAME` marker lines so moving a line never breaks an assertion.
 */
import { spawnSync } from 'child_process';
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

let flutterProbePrepared = false;

/**
 * Generate the probe's platform folders (not committed) and resolve its packages, once per test
 * process: `flutter create --platforms=windows,web .` then `flutter pub get`.
 */
export function prepareFlutterProbe(): void {
  if (flutterProbePrepared) return;
  const root = findFlutterRootSync();
  if (!root) throw new Error('No Flutter SDK found for the examples');
  const platforms = process.platform === 'win32' ? 'windows,web' : process.platform === 'darwin' ? 'macos,web' : 'linux,web';
  const platformDir = path.join(FLUTTER_PROBE_DIR, platforms.split(',')[0]);
  if (!existsSync(platformDir)) {
    const r = runFlutter(root, ['create', `--platforms=${platforms}`, '--project-name', 'flutter_probe', '.'], FLUTTER_PROBE_DIR);
    if (r.status !== 0) throw new Error(`flutter create failed: ${r.out}`);
  }
  if (!existsSync(path.join(FLUTTER_PROBE_DIR, '.dart_tool', 'package_config.json'))) {
    const r = runFlutter(root, ['pub', 'get'], FLUTTER_PROBE_DIR);
    if (r.status !== 0) throw new Error(`flutter pub get failed: ${r.out}`);
  }
  flutterProbePrepared = true;
}

let cachedDevices: string[] | undefined;

/** Device ids `flutter devices --machine` reports on this box (cached); empty without Flutter. */
export function flutterDeviceIds(): string[] {
  if (cachedDevices) return cachedDevices;
  const root = findFlutterRootSync();
  if (!root) return (cachedDevices = []);
  const r = runFlutter(root, ['devices', '--machine'], DART_EXAMPLES_DIR, 120_000);
  try {
    // stdout only: the tool's warnings (`[!] adb …`, startup-lock notices) go to stderr and would
    // follow the array.
    const start = r.stdout.indexOf('[');
    const list = JSON.parse(r.stdout.slice(start)) as Array<{ id?: string }>;
    cachedDevices = list.map((d) => d.id).filter((id): id is string => typeof id === 'string');
  } catch {
    cachedDevices = [];
  }
  return cachedDevices;
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

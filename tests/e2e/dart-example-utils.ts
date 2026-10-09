/**
 * Shared helpers for the Dart e2e suites: find a Dart SDK the way the adapter does (PATH, env,
 * Flutter's bundled copy, the winget install dir), resolve the example project's packages once,
 * and locate `// BP-NAME` marker lines so moving a line never breaks an assertion.
 */
import { spawnSync } from 'child_process';
import { existsSync, readFileSync, readdirSync } from 'fs';
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

export const DART_EXAMPLES = {
  hello: path.join(DART_EXAMPLES_DIR, 'hello.dart'),
  app: path.join(DART_PROBE_DIR, 'bin', 'app.dart'),
  pause: path.join(DART_PROBE_DIR, 'bin', 'pause.dart'),
  throws: path.join(DART_PROBE_DIR, 'bin', 'throws.dart'),
  mathTest: path.join(DART_PROBE_DIR, 'test', 'math_test.dart'),
} as const;

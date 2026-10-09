/**
 * Dart / Flutter SDK discovery.
 *
 * Order: explicit env (`DART_SDK`/`DART_PATH`, `FLUTTER_ROOT`/`FLUTTER_PATH`) → the project's fvm
 * pin (`.fvmrc`, `.fvm/fvm_config.json`, `.fvm/flutter_sdk`) → `flutter` on PATH → `dart` on PATH
 * (realpath'd first: package managers install symlinks) → well-known install directories.
 *
 * A Flutter checkout always carries its own Dart at `<root>/bin/cache/dart-sdk`; a `dart` found
 * there identifies the Flutter root as well. Everything that touches the machine comes through
 * {@link LocatorIo} so the policy is unit-testable without an SDK.
 */
import path from 'node:path';

/** The node:path flavour to join with; `typeof path.win32` because the interface is not re-exported by every @types/node. */
type PlatformPath = typeof path.win32;

export interface LocatorIo {
  platform: NodeJS.Platform;
  env: Record<string, string | undefined>;
  homeDir: string;
  exists(p: string): boolean;
  realpath(p: string): string;
  which(name: string): string | undefined;
  readFile(p: string): string | undefined;
  /** Directory of the project whose fvm pin applies (usually the pubspec directory). */
  projectRoot?: string;
  /** Path flavour to join with; defaults from `platform`. */
  pathSep?: 'win32' | 'posix';
}

export type DartSource = 'env:DART_SDK' | 'env:DART_PATH' | 'path' | 'flutter-bundled' | 'known-dir';
export type FlutterSource = 'env:FLUTTER_ROOT' | 'env:FLUTTER_PATH' | 'fvm' | 'path' | 'dart-on-path' | 'known-dir';

export interface DartToolchain {
  dartExe?: string;
  dartSdkRoot?: string;
  dartSource?: DartSource;
  flutterRoot?: string;
  flutterExe?: string;
  flutterSource?: FlutterSource;
  warnings: string[];
}

interface Names { flutter: string; dart: string }

function namesFor(platform: NodeJS.Platform): Names {
  return platform === 'win32' ? { flutter: 'flutter.bat', dart: 'dart.exe' } : { flutter: 'flutter', dart: 'dart' };
}

/** The Dart executable a Flutter checkout bundles. */
export function bundledDartExe(flutterRoot: string, platform: NodeJS.Platform, p: PlatformPath = pathFor(platform)): string {
  return p.join(flutterRoot, 'bin', 'cache', 'dart-sdk', 'bin', namesFor(platform).dart);
}

function pathFor(platform: NodeJS.Platform, pathSep?: 'win32' | 'posix'): PlatformPath {
  return (pathSep ?? (platform === 'win32' ? 'win32' : 'posix')) === 'win32' ? path.win32 : path.posix;
}

/** Walk `n` directories up. */
function up(p: PlatformPath, from: string, n: number): string {
  let d = from;
  for (let i = 0; i < n; i++) d = p.dirname(d);
  return d;
}

export function locateToolchain(io: LocatorIo): DartToolchain {
  const p = pathFor(io.platform, io.pathSep);
  const names = namesFor(io.platform);
  const warnings: string[] = [];

  const flutterRootValid = (dir: string | undefined): dir is string => !!dir && io.exists(p.join(dir, 'bin', names.flutter));
  const dartSdkValid = (dir: string | undefined): dir is string => !!dir && io.exists(p.join(dir, 'bin', names.dart));
  /** Accept either the install root or the executable itself for an env var. */
  const rootFromEnv = (value: string | undefined, exeName: string): string | undefined => {
    if (!value) return undefined;
    // Trailing separators stripped by hand: `/[\\/]+$/` backtracks quadratically on a long run
    // of separators (CodeQL polynomial-ReDoS).
    let trimmed = value.trim();
    while (trimmed.endsWith('/') || trimmed.endsWith('\\')) trimmed = trimmed.slice(0, -1);
    if (trimmed.toLowerCase().endsWith(exeName.toLowerCase())) return up(p, trimmed, 2);
    return trimmed;
  };
  /** `<root>/bin/cache/dart-sdk/bin/dart` → `<root>` when that root really is a Flutter checkout. */
  const flutterRootOfBundledDart = (dartExe: string): string | undefined => {
    const root = up(p, dartExe, 5);
    const expected = bundledDartExe(root, io.platform, p);
    return expected.toLowerCase() === dartExe.toLowerCase() && flutterRootValid(root) ? root : undefined;
  };

  // --- Flutter -----------------------------------------------------------------------------
  let flutterRoot: string | undefined;
  let flutterSource: FlutterSource | undefined;
  const takeFlutter = (dir: string | undefined, source: FlutterSource): boolean => {
    if (flutterRoot || !flutterRootValid(dir)) return false;
    flutterRoot = dir;
    flutterSource = source;
    return true;
  };

  for (const [key, source] of [['FLUTTER_ROOT', 'env:FLUTTER_ROOT'], ['FLUTTER_PATH', 'env:FLUTTER_PATH']] as const) {
    const dir = rootFromEnv(io.env[key], names.flutter);
    if (dir && !takeFlutter(dir, source) && !flutterRoot) warnings.push(`${key}=${io.env[key]} does not contain bin/${names.flutter}; ignored`);
  }
  if (!flutterRoot && io.projectRoot) {
    for (const dir of fvmCandidates(io, p)) if (takeFlutter(dir, 'fvm')) break;
  }
  if (!flutterRoot) {
    const found = io.which('flutter');
    if (found) takeFlutter(up(p, io.realpath(found), 2), 'path');
  }

  // --- Dart --------------------------------------------------------------------------------
  let dartExe: string | undefined;
  let dartSdkRoot: string | undefined;
  let dartSource: DartSource | undefined;
  const takeDart = (dir: string | undefined, source: DartSource): boolean => {
    if (dartExe || !dartSdkValid(dir)) return false;
    dartSdkRoot = dir;
    dartExe = p.join(dir, 'bin', names.dart);
    dartSource = source;
    return true;
  };

  for (const [key, source] of [['DART_SDK', 'env:DART_SDK'], ['DART_PATH', 'env:DART_PATH']] as const) {
    const dir = rootFromEnv(io.env[key], names.dart);
    if (dir && !takeDart(dir, source) && !dartExe) warnings.push(`${key}=${io.env[key]} does not contain bin/${names.dart}; ignored`);
  }
  if (!dartExe) {
    const found = io.which('dart');
    if (found) {
      const real = io.realpath(found);
      if (takeDart(up(p, real, 2), 'path')) {
        const bundledIn = flutterRootOfBundledDart(real);
        if (bundledIn) takeFlutter(bundledIn, 'dart-on-path');
      }
    }
  }
  if (!flutterRoot) {
    for (const dir of knownFlutterDirs(io, p)) if (takeFlutter(dir, 'known-dir')) break;
  }
  if (!dartExe && flutterRoot) {
    takeDart(p.join(flutterRoot, 'bin', 'cache', 'dart-sdk'), 'flutter-bundled');
  }
  if (!dartExe) {
    for (const dir of knownDartDirs(io, p)) if (takeDart(dir, 'known-dir')) break;
  }

  return {
    dartExe,
    dartSdkRoot,
    dartSource,
    flutterRoot,
    flutterExe: flutterRoot ? p.join(flutterRoot, 'bin', names.flutter) : undefined,
    flutterSource,
    warnings,
  };
}

/** fvm pins: `.fvmrc` (`{"flutter": "<version>"}`), `.fvm/fvm_config.json`, or the `.fvm/flutter_sdk` link. */
function fvmCandidates(io: LocatorIo, p: PlatformPath): string[] {
  const root = io.projectRoot!;
  const out: string[] = [];
  const versionsDir = p.join(io.homeDir, 'fvm', 'versions');
  const fromJson = (file: string, key: string): void => {
    const text = io.readFile(p.join(root, file));
    if (!text) return;
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const version = parsed[key];
      if (typeof version === 'string' && version.trim()) out.push(p.join(versionsDir, version.trim()));
    } catch {
      // not JSON; ignore
    }
  };
  fromJson('.fvmrc', 'flutter');
  fromJson(p.join('.fvm', 'fvm_config.json'), 'flutterSdkVersion');
  out.push(p.join(root, '.fvm', 'flutter_sdk'));
  return out;
}

function knownFlutterDirs(io: LocatorIo, p: PlatformPath): string[] {
  const home = io.homeDir;
  if (io.platform === 'win32') {
    return ['C:\\src\\flutter', 'C:\\flutter', 'C:\\tools\\flutter', 'C:\\dev\\flutter', p.join(home, 'flutter'), p.join(home, 'fvm', 'default'), p.join(home, 'development', 'flutter'), p.join(home, 'dev', 'flutter')];
  }
  return ['/opt/flutter', '/usr/local/flutter', '/usr/lib/flutter', p.join(home, 'flutter'), p.join(home, 'fvm', 'default'), p.join(home, 'development', 'flutter'), p.join(home, 'dev', 'flutter'), '/snap/flutter/current'];
}

function knownDartDirs(io: LocatorIo, p: PlatformPath): string[] {
  const home = io.homeDir;
  if (io.platform === 'win32') {
    return ['C:\\tools\\dart-sdk', 'C:\\dart-sdk', 'C:\\src\\dart-sdk', p.join(home, 'dart-sdk'), ...(io.env.LOCALAPPDATA ? [p.join(io.env.LOCALAPPDATA, 'Programs', 'Dart', 'dart-sdk')] : [])];
  }
  return ['/usr/lib/dart', '/usr/local/lib/dart', '/opt/dart-sdk', '/usr/local/opt/dart/libexec', '/opt/homebrew/opt/dart/libexec', p.join(home, 'dart-sdk')];
}

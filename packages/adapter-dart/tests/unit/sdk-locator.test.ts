/**
 * SDK discovery for Dart and Flutter.
 *
 * Order (from the #790 plan): explicit env (DART_SDK / FLUTTER_ROOT) → project fvm → `flutter` on
 * PATH → `dart` on PATH → well-known install dirs. A `dart` that lives inside a Flutter checkout
 * (`<root>/bin/cache/dart-sdk`) identifies that Flutter root too. Everything that touches the
 * machine is injected so these tests describe the policy, not this box.
 */
import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { locateToolchain, type LocatorIo } from '../../src/utils/sdk-locator.js';

function io(overrides: Partial<LocatorIo> & { files?: string[]; platform?: NodeJS.Platform }): LocatorIo {
  const platform = overrides.platform ?? 'win32';
  const files = new Set((overrides.files ?? []).map((f) => f.toLowerCase()));
  return {
    platform,
    env: overrides.env ?? {},
    homeDir: overrides.homeDir ?? (platform === 'win32' ? 'C:\\Users\\jf' : '/home/jf'),
    exists: overrides.exists ?? ((p: string) => files.has(p.toLowerCase())),
    realpath: overrides.realpath ?? ((p: string) => p),
    which: overrides.which ?? (() => undefined),
    readFile: overrides.readFile ?? (() => undefined),
    ...(overrides.pathSep ? { pathSep: overrides.pathSep } : {}),
    ...(overrides.projectRoot ? { projectRoot: overrides.projectRoot } : {}),
  };
}

const W = (...parts: string[]) => path.win32.join(...parts);

describe('locateToolchain (win32)', () => {
  it('uses FLUTTER_ROOT when it holds bin/flutter.bat, and the bundled Dart under it', () => {
    const root = 'C:\\src\\flutter';
    const t = locateToolchain(io({
      env: { FLUTTER_ROOT: root },
      files: [W(root, 'bin', 'flutter.bat'), W(root, 'bin', 'cache', 'dart-sdk', 'bin', 'dart.exe')],
    }));
    expect(t.flutterRoot).toBe(root);
    expect(t.flutterSource).toBe('env:FLUTTER_ROOT');
    expect(t.dartExe).toBe(W(root, 'bin', 'cache', 'dart-sdk', 'bin', 'dart.exe'));
    expect(t.dartSource).toBe('flutter-bundled');
  });

  it('prefers a standalone DART_SDK for dartExe over the Flutter-bundled one', () => {
    const sdk = 'C:\\tools\\dart-sdk';
    const root = 'C:\\src\\flutter';
    const t = locateToolchain(io({
      env: { DART_SDK: sdk, FLUTTER_ROOT: root },
      files: [W(sdk, 'bin', 'dart.exe'), W(root, 'bin', 'flutter.bat'), W(root, 'bin', 'cache', 'dart-sdk', 'bin', 'dart.exe')],
    }));
    expect(t.dartExe).toBe(W(sdk, 'bin', 'dart.exe'));
    expect(t.dartSdkRoot).toBe(sdk);
    expect(t.dartSource).toBe('env:DART_SDK');
    expect(t.flutterRoot).toBe(root);
  });

  it('does not mistake a POSIX root whose basename is the executable name for the executable itself', () => {
    // FLUTTER_ROOT=/opt/sdks/flutter and DART_SDK=/usr/lib/dart are the canonical values; only
    // `<root>/bin/<exe>` is the executable.
    const P = (...parts: string[]) => path.posix.join(...parts);
    const t = locateToolchain(io({
      platform: 'linux',
      env: { FLUTTER_ROOT: '/opt/sdks/flutter', DART_SDK: '/usr/lib/dart' },
      files: [P('/opt/sdks/flutter', 'bin', 'flutter'), P('/opt/sdks/flutter', 'bin', 'cache', 'dart-sdk', 'bin', 'dart'), P('/usr/lib/dart', 'bin', 'dart')],
    }));
    expect(t.flutterRoot).toBe('/opt/sdks/flutter');
    expect(t.flutterSource).toBe('env:FLUTTER_ROOT');
    expect(t.dartSdkRoot).toBe('/usr/lib/dart');
    expect(t.dartSource).toBe('env:DART_SDK');
    expect(t.warnings).toEqual([]);
    // The executable form still resolves to the root.
    const viaExe = locateToolchain(io({
      platform: 'linux',
      env: { FLUTTER_ROOT: '/opt/sdks/flutter/bin/flutter' },
      files: [P('/opt/sdks/flutter', 'bin', 'flutter'), P('/opt/sdks/flutter', 'bin', 'cache', 'dart-sdk', 'bin', 'dart')],
    }));
    expect(viaExe.flutterRoot).toBe('/opt/sdks/flutter');
  });

  it('strips trailing separators from an env var, however many (no quadratic regex)', () => {
    const sdk = 'C:\\tools\\dart-sdk';
    const t = locateToolchain(io({
      env: { DART_SDK: sdk + '\\'.repeat(20_000) + '/'.repeat(20_000) },
      files: [W(sdk, 'bin', 'dart.exe')],
    }));
    expect(t.dartSdkRoot).toBe(sdk);
    expect(t.dartSource).toBe('env:DART_SDK');
  });

  it('ignores an env var whose directory has no SDK and keeps looking', () => {
    const t = locateToolchain(io({
      env: { FLUTTER_ROOT: 'C:\\nope' },
      which: (name) => (name === 'dart' ? 'C:\\dart\\bin\\dart.exe' : undefined),
      files: ['C:\\dart\\bin\\dart.exe'],
    }));
    expect(t.flutterRoot).toBeUndefined();
    expect(t.dartExe).toBe('C:\\dart\\bin\\dart.exe');
    expect(t.dartSource).toBe('path');
    expect(t.warnings.join(' ')).toMatch(/FLUTTER_ROOT/);
  });

  it('resolves a flutter found on PATH to its root and bundled Dart', () => {
    const root = 'C:\\src\\flutter';
    const t = locateToolchain(io({
      which: (name) => (name === 'flutter' ? W(root, 'bin', 'flutter.bat') : undefined),
      files: [W(root, 'bin', 'flutter.bat'), W(root, 'bin', 'cache', 'dart-sdk', 'bin', 'dart.exe')],
    }));
    expect(t.flutterRoot).toBe(root);
    expect(t.flutterSource).toBe('path');
    expect(t.dartExe).toBe(W(root, 'bin', 'cache', 'dart-sdk', 'bin', 'dart.exe'));
  });

  it('realpaths a dart on PATH (winget symlink) before deriving the SDK root', () => {
    const link = 'C:\\Users\\jf\\AppData\\Local\\Microsoft\\WinGet\\Links\\dart.exe';
    const real = 'C:\\Users\\jf\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Google.DartSDK_x\\dart-sdk\\bin\\dart.exe';
    const t = locateToolchain(io({
      which: (name) => (name === 'dart' ? link : undefined),
      realpath: (p) => (p === link ? real : p),
      files: [link, real],
    }));
    expect(t.dartExe).toBe(real);
    expect(t.dartSdkRoot).toBe('C:\\Users\\jf\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Google.DartSDK_x\\dart-sdk');
  });

  it('recognises a PATH dart that lives inside a Flutter checkout and reports that Flutter root', () => {
    const root = 'C:\\src\\flutter';
    const dart = W(root, 'bin', 'cache', 'dart-sdk', 'bin', 'dart.exe');
    const t = locateToolchain(io({
      which: (name) => (name === 'dart' ? dart : undefined),
      files: [dart, W(root, 'bin', 'flutter.bat')],
    }));
    expect(t.dartExe).toBe(dart);
    expect(t.flutterRoot).toBe(root);
    expect(t.flutterSource).toBe('dart-on-path');
  });

  it('uses the project .fvmrc version under ~/fvm/versions ahead of PATH', () => {
    const fvmRoot = 'C:\\Users\\jf\\fvm\\versions\\3.47.7';
    const t = locateToolchain(io({
      projectRoot: 'C:\\proj',
      readFile: (p) => (p === W('C:\\proj', '.fvmrc') ? '{"flutter":"3.47.7"}' : undefined),
      which: (name) => (name === 'flutter' ? 'C:\\other\\bin\\flutter.bat' : undefined),
      files: [W('C:\\proj', '.fvmrc'), W(fvmRoot, 'bin', 'flutter.bat'), W(fvmRoot, 'bin', 'cache', 'dart-sdk', 'bin', 'dart.exe'), 'C:\\other\\bin\\flutter.bat'],
    }));
    expect(t.flutterRoot).toBe(fvmRoot);
    expect(t.flutterSource).toBe('fvm');
  });

  it('falls back to well-known install dirs', () => {
    const t = locateToolchain(io({
      files: [W('C:\\src\\flutter', 'bin', 'flutter.bat'), W('C:\\src\\flutter', 'bin', 'cache', 'dart-sdk', 'bin', 'dart.exe')],
    }));
    expect(t.flutterRoot).toBe('C:\\src\\flutter');
    expect(t.flutterSource).toBe('known-dir');
  });

  it('reports nothing found, with no throw', () => {
    const t = locateToolchain(io({}));
    expect(t.dartExe).toBeUndefined();
    expect(t.flutterRoot).toBeUndefined();
  });
});

describe('locateToolchain (posix)', () => {
  it('looks for bin/flutter and bin/dart without extensions', () => {
    const root = '/opt/flutter';
    const t = locateToolchain(io({
      platform: 'linux',
      env: { FLUTTER_ROOT: root },
      files: ['/opt/flutter/bin/flutter', '/opt/flutter/bin/cache/dart-sdk/bin/dart'],
      pathSep: 'posix',
    }));
    expect(t.flutterExe).toBe('/opt/flutter/bin/flutter');
    expect(t.dartExe).toBe('/opt/flutter/bin/cache/dart-sdk/bin/dart');
  });
});

/**
 * How the SDK debug adapters are invoked, per runner and platform.
 *
 * Measured in the #790 spike: `flutter.bat` cannot be spawned by Node without a shell, and
 * `flutter.bat` itself only runs `dart.exe --packages=<root>\packages\flutter_tools\.dart_tool\
 * package_config.json <root>\bin\cache\flutter_tools.snapshot <args>` with FLUTTER_ROOT in the
 * environment. On POSIX `bin/flutter` is a plain script and is spawned directly.
 */
import { describe, expect, it } from 'vitest';
import { dapCommandFor, flutterWarmCacheFiles } from '../../src/utils/flutter-invocation.js';

const WIN = { platform: 'win32' as const, dartExe: 'C:\\tools\\dart-sdk\\bin\\dart.exe', flutterRoot: 'C:\\src\\flutter' };
const NIX = { platform: 'linux' as const, dartExe: '/usr/lib/dart/bin/dart', flutterRoot: '/opt/flutter' };

describe('dapCommandFor', () => {
  it('runs `dart debug_adapter` for the dart runner and adds --test for dart-test', () => {
    expect(dapCommandFor('dart', WIN)).toEqual({ command: WIN.dartExe, args: ['debug_adapter'], env: {} });
    expect(dapCommandFor('dart-test', WIN).args).toEqual(['debug_adapter', '--test']);
  });

  it('bypasses flutter.bat on Windows: bundled dart.exe + tool snapshot, FLUTTER_ROOT exported', () => {
    const c = dapCommandFor('flutter', WIN);
    expect(c.command).toBe('C:\\src\\flutter\\bin\\cache\\dart-sdk\\bin\\dart.exe');
    expect(c.args).toEqual([
      '--packages=C:\\src\\flutter\\packages\\flutter_tools\\.dart_tool\\package_config.json',
      'C:\\src\\flutter\\bin\\cache\\flutter_tools.snapshot',
      'debug-adapter',
    ]);
    expect(c.env).toEqual({ FLUTTER_ROOT: 'C:\\src\\flutter' });
    expect(dapCommandFor('flutter-test', WIN).args.at(-1)).toBe('--test');
  });

  it('passes FLUTTER_TOOL_ARGS through on Windows the way flutter.bat does', () => {
    const c = dapCommandFor('flutter', { ...WIN, flutterToolArgs: '--enable-asserts' });
    expect(c.args.slice(0, 3)).toEqual([
      '--packages=C:\\src\\flutter\\packages\\flutter_tools\\.dart_tool\\package_config.json',
      '--enable-asserts',
      'C:\\src\\flutter\\bin\\cache\\flutter_tools.snapshot',
    ]);
  });

  it('spawns bin/flutter directly on POSIX', () => {
    const c = dapCommandFor('flutter-test', NIX);
    expect(c).toEqual({ command: '/opt/flutter/bin/flutter', args: ['debug-adapter', '--test'], env: { FLUTTER_ROOT: '/opt/flutter' } });
  });

  it('refuses a Flutter runner without a Flutter root, naming FLUTTER_ROOT', () => {
    expect(() => dapCommandFor('flutter', { platform: 'win32', dartExe: WIN.dartExe })).toThrow(/FLUTTER_ROOT/);
  });

  it('refuses a Dart runner without a Dart executable', () => {
    expect(() => dapCommandFor('dart', { platform: 'linux', flutterRoot: NIX.flutterRoot })).toThrow(/Dart SDK/);
  });
});

describe('flutterWarmCacheFiles', () => {
  it('lists the files the Windows bypass depends on', () => {
    expect(flutterWarmCacheFiles('C:\\src\\flutter', 'win32')).toEqual([
      'C:\\src\\flutter\\bin\\cache\\dart-sdk\\bin\\dart.exe',
      'C:\\src\\flutter\\bin\\cache\\flutter_tools.snapshot',
      'C:\\src\\flutter\\packages\\flutter_tools\\.dart_tool\\package_config.json',
    ]);
  });
});

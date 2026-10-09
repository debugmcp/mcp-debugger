/**
 * The SDK debug-adapter command for each runner.
 *
 * Measured in the #790 spike: Node cannot spawn `flutter.bat` without a shell, and all the batch
 * file does after validating the tool cache is
 * `dart.exe --packages=<root>\packages\flutter_tools\.dart_tool\package_config.json %FLUTTER_TOOL_ARGS%
 * <root>\bin\cache\flutter_tools.snapshot <args>` with FLUTTER_ROOT in the environment. So on
 * Windows the adapter runs that snapshot through Flutter's bundled Dart directly; on POSIX
 * `bin/flutter` is a plain script and is spawned as-is. The warm-cache guarantee comes from the
 * toolchain probe, which runs the real launcher once (`flutter --version --machine`).
 */
import path from 'node:path';

/** The node:path flavour to join with; `typeof path.win32` because the interface is not re-exported by every @types/node. */
type PlatformPath = typeof path.win32;
import type { DartRunner } from '../runner.js';

export interface InvocationToolchain {
  platform: NodeJS.Platform;
  /** Standalone or bundled Dart executable; required for the Dart runners. */
  dartExe?: string;
  /** Flutter checkout root; required for the Flutter runners. */
  flutterRoot?: string;
  /** Contents of FLUTTER_TOOL_ARGS, passed through like flutter.bat does (Windows only). */
  flutterToolArgs?: string;
}

export interface DapCommand {
  command: string;
  args: string[];
  /** Environment entries to add on top of the inherited environment. */
  env: Record<string, string>;
}

function pathFor(platform: NodeJS.Platform): PlatformPath {
  return platform === 'win32' ? path.win32 : path.posix;
}

/** Files the Windows bypass depends on; all must exist for a direct snapshot spawn. */
export function flutterWarmCacheFiles(flutterRoot: string, platform: NodeJS.Platform): string[] {
  const p = pathFor(platform);
  const dart = platform === 'win32' ? 'dart.exe' : 'dart';
  return [
    p.join(flutterRoot, 'bin', 'cache', 'dart-sdk', 'bin', dart),
    p.join(flutterRoot, 'bin', 'cache', 'flutter_tools.snapshot'),
    p.join(flutterRoot, 'packages', 'flutter_tools', '.dart_tool', 'package_config.json'),
  ];
}

export function dapCommandFor(runner: DartRunner, tc: InvocationToolchain): DapCommand {
  const p = pathFor(tc.platform);
  const test = runner.endsWith('-test');
  if (runner === 'dart' || runner === 'dart-test') {
    if (!tc.dartExe) throw new Error('No Dart SDK found: install Dart (or Flutter) and put `dart` on PATH, or set DART_SDK');
    return { command: tc.dartExe, args: ['debug_adapter', ...(test ? ['--test'] : [])], env: {} };
  }
  if (!tc.flutterRoot) throw new Error('No Flutter SDK found for a Flutter project: put `flutter` on PATH or set FLUTTER_ROOT');
  const dapArgs = ['debug-adapter', ...(test ? ['--test'] : [])];
  const env = { FLUTTER_ROOT: tc.flutterRoot };
  if (tc.platform !== 'win32') {
    return { command: p.join(tc.flutterRoot, 'bin', 'flutter'), args: dapArgs, env };
  }
  const [dartExe, snapshot, packageConfig] = flutterWarmCacheFiles(tc.flutterRoot, tc.platform);
  const toolArgs = tc.flutterToolArgs?.trim() ? tc.flutterToolArgs.trim().split(/\s+/) : [];
  return { command: dartExe, args: [`--packages=${packageConfig}`, ...toolArgs, snapshot, ...dapArgs], env };
}

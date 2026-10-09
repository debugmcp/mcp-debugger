/**
 * Runner selection: which SDK debug adapter a Dart program needs.
 *
 * - `dart`          → `dart debug_adapter`            (plain Dart program)
 * - `dart-test`     → `dart debug_adapter --test`     (package:test file)
 * - `flutter`       → `flutter debug-adapter`         (Flutter app)
 * - `flutter-test`  → `flutter debug-adapter --test`  (flutter_test / integration_test file)
 *
 * The project kind comes from the nearest pubspec.yaml above the program (then the cwd): a
 * `flutter`-family dependency means Flutter. A program under the project's `test/` or
 * `integration_test/` directory is a test. An explicit runner always wins.
 */
import fs from 'node:fs';
import path from 'node:path';

export const DART_RUNNERS = ['dart', 'dart-test', 'flutter', 'flutter-test'] as const;
export type DartRunner = (typeof DART_RUNNERS)[number];

export interface RunnerDetection {
  runner: DartRunner;
  /** True when the caller named the runner instead of letting detection choose. */
  explicit: boolean;
  /** The pubspec.yaml the decision was based on, when one was found. */
  pubspecPath?: string;
  /** Directory containing that pubspec (the project root). */
  projectRoot?: string;
  /** One line for the launch diagnostics. */
  reason: string;
}

export interface DetectRunnerOptions {
  /** The program to run; absent for an attach, where only the project kind matters. */
  program?: string;
  cwd?: string;
  explicit?: unknown;
}

export function isDartRunner(value: unknown): value is DartRunner {
  return typeof value === 'string' && (DART_RUNNERS as readonly string[]).includes(value);
}

/** Walk up from `startDir` to the filesystem root looking for a pubspec.yaml. */
export function findPubspec(startDir: string): string | undefined {
  let dir = path.resolve(startDir);
  for (;;) {
    const candidate = path.join(dir, 'pubspec.yaml');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

const FLUTTER_DEPENDENCY = /^\s+(flutter|flutter_test|flutter_driver|integration_test|flutter_localizations):\s*$/m;
const FLUTTER_SDK = /^\s+sdk:\s*flutter\s*$/m;

/** True when a pubspec.yaml text declares a Flutter-family dependency. */
export function pubspecDependsOnFlutter(pubspecText: string): boolean {
  return FLUTTER_DEPENDENCY.test(pubspecText) || FLUTTER_SDK.test(pubspecText);
}

/** True when `program` sits under the project's `test/` or `integration_test/` directory. */
export function isTestProgram(program: string, projectRoot: string): boolean {
  const rel = path.relative(path.resolve(projectRoot), path.resolve(program));
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return false;
  const first = rel.split(/[\\/]/)[0];
  return first === 'test' || first === 'integration_test';
}

export function detectRunner(options: DetectRunnerOptions): RunnerDetection {
  const { program, cwd, explicit } = options;
  if (explicit !== undefined && explicit !== null) {
    if (!isDartRunner(explicit)) {
      throw new Error(`Unknown Dart runner ${JSON.stringify(explicit)}; valid values: ${DART_RUNNERS.join(', ')}`);
    }
    return { runner: explicit, explicit: true, reason: `runner ${explicit} requested explicitly` };
  }

  const pubspecPath = (program ? findPubspec(path.dirname(path.resolve(program))) : undefined) ?? (cwd ? findPubspec(cwd) : undefined);
  if (!pubspecPath) {
    return { runner: 'dart', explicit: false, reason: 'no pubspec.yaml above the program or cwd; plain dart' };
  }
  const projectRoot = path.dirname(pubspecPath);
  const flutter = pubspecDependsOnFlutter(fs.readFileSync(pubspecPath, 'utf8'));
  const test = program ? isTestProgram(program, projectRoot) : false;
  const runner: DartRunner = flutter ? (test ? 'flutter-test' : 'flutter') : (test ? 'dart-test' : 'dart');
  return {
    runner,
    explicit: false,
    pubspecPath,
    projectRoot,
    reason: `${flutter ? 'flutter' : 'dart'} project (${pubspecPath})${test ? ', program under test/ or integration_test/' : ''}`,
  };
}

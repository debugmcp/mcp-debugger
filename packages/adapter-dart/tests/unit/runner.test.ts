/**
 * Runner selection: which SDK debug adapter a program needs.
 *
 * Measured in the #790 spike: `dart debug_adapter` runs plain programs, `dart debug_adapter --test`
 * runs package:test files, and Flutter projects (a `flutter` dependency in pubspec.yaml) need
 * `flutter debug-adapter [--test]` instead. Detection reads the nearest pubspec.yaml above the
 * program; an explicit `runner` always wins.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectRunner, isTestProgram } from '../../src/runner.js';

let root: string;

function writeProject(name: string, pubspec: string | null, files: string[]): string {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  if (pubspec !== null) fs.writeFileSync(path.join(dir, 'pubspec.yaml'), pubspec);
  for (const f of files) {
    const p = path.join(dir, f);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, 'void main() {}\n');
  }
  return dir;
}

const DART_PUBSPEC = 'name: probe\nenvironment:\n  sdk: ">=3.0.0 <4.0.0"\ndev_dependencies:\n  test: any\n';
const FLUTTER_PUBSPEC = 'name: probe\nenvironment:\n  sdk: ">=3.0.0 <4.0.0"\ndependencies:\n  flutter:\n    sdk: flutter\ndev_dependencies:\n  flutter_test:\n    sdk: flutter\n';
const FLUTTER_TEST_ONLY_PUBSPEC = 'name: probe\ndev_dependencies:\n  flutter_test:\n    sdk: flutter\n';

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-dart-runner-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('detectRunner', () => {
  it('picks the plain dart runner for a program in a Dart-only project', () => {
    const dir = writeProject('dart', DART_PUBSPEC, ['bin/app.dart']);
    const r = detectRunner({ program: path.join(dir, 'bin', 'app.dart'), cwd: dir });
    expect(r.runner).toBe('dart');
    expect(r.pubspecPath).toBe(path.join(dir, 'pubspec.yaml'));
  });

  it('picks the dart test runner for a file under test/ in a Dart-only project', () => {
    const dir = writeProject('dart', DART_PUBSPEC, ['test/math_test.dart']);
    expect(detectRunner({ program: path.join(dir, 'test', 'math_test.dart'), cwd: dir }).runner).toBe('dart-test');
  });

  it('picks the flutter runner when pubspec.yaml depends on flutter', () => {
    const dir = writeProject('flutter', FLUTTER_PUBSPEC, ['lib/main.dart']);
    expect(detectRunner({ program: path.join(dir, 'lib', 'main.dart'), cwd: dir }).runner).toBe('flutter');
  });

  it('treats a flutter_test-only dev dependency as a Flutter project', () => {
    const dir = writeProject('flutter', FLUTTER_TEST_ONLY_PUBSPEC, ['test/widget_test.dart']);
    expect(detectRunner({ program: path.join(dir, 'test', 'widget_test.dart'), cwd: dir }).runner).toBe('flutter-test');
  });

  it('picks the flutter test runner for integration_test/ files in a Flutter project', () => {
    const dir = writeProject('flutter', FLUTTER_PUBSPEC, ['integration_test/app_test.dart']);
    expect(detectRunner({ program: path.join(dir, 'integration_test', 'app_test.dart'), cwd: dir }).runner).toBe('flutter-test');
  });

  it('finds the pubspec above a nested program directory', () => {
    const dir = writeProject('flutter', FLUTTER_PUBSPEC, ['lib/src/deep/page.dart']);
    const r = detectRunner({ program: path.join(dir, 'lib', 'src', 'deep', 'page.dart'), cwd: path.join(dir, 'lib') });
    expect(r.runner).toBe('flutter');
    expect(r.pubspecPath).toBe(path.join(dir, 'pubspec.yaml'));
  });

  it('falls back to the plain dart runner when there is no pubspec at all', () => {
    const dir = writeProject('bare', null, ['hello.dart']);
    const r = detectRunner({ program: path.join(dir, 'hello.dart'), cwd: dir });
    expect(r.runner).toBe('dart');
    expect(r.pubspecPath).toBeUndefined();
  });

  it('honours an explicit runner over anything detected', () => {
    const dir = writeProject('flutter', FLUTTER_PUBSPEC, ['lib/main.dart']);
    const r = detectRunner({ program: path.join(dir, 'lib', 'main.dart'), cwd: dir, explicit: 'dart' });
    expect(r.runner).toBe('dart');
    expect(r.explicit).toBe(true);
  });

  it('rejects an unknown explicit runner with a message naming the valid values', () => {
    const dir = writeProject('dart', DART_PUBSPEC, ['bin/app.dart']);
    expect(() => detectRunner({ program: path.join(dir, 'bin', 'app.dart'), cwd: dir, explicit: 'cobcrun' })).toThrow(/dart-test.*flutter-test|runner/);
  });

  it('detects the project kind from a bare cwd when there is no program (attach)', () => {
    const dir = writeProject('flutter', FLUTTER_PUBSPEC, ['lib/main.dart']);
    const r = detectRunner({ cwd: dir });
    expect(r.runner).toBe('flutter');
    expect(r.projectRoot).toBe(dir);
    expect(detectRunner({ cwd: path.join(root, 'nowhere') }).runner).toBe('dart');
  });

  it('does not treat a lib/ file ending in _test.dart outside test dirs as a test', () => {
    const dir = writeProject('dart', DART_PUBSPEC, ['lib/self_test.dart']);
    expect(detectRunner({ program: path.join(dir, 'lib', 'self_test.dart'), cwd: dir }).runner).toBe('dart');
  });
});

describe('isTestProgram', () => {
  it('is true under test/ and integration_test/ of the project root only', () => {
    const root = path.join('C:', 'proj');
    expect(isTestProgram(path.join(root, 'test', 'a_test.dart'), root)).toBe(true);
    expect(isTestProgram(path.join(root, 'integration_test', 'a_test.dart'), root)).toBe(true);
    expect(isTestProgram(path.join(root, 'lib', 'a_test.dart'), root)).toBe(false);
    expect(isTestProgram(path.join(root, 'bin', 'main.dart'), root)).toBe(false);
  });
});

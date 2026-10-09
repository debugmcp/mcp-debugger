/**
 * DartAdapterFactory without a `locate` hook runs the real locator (process env, fs, which).
 * Whatever the box has, the shape is stable; with an explicit DART_SDK pointing at a temp SDK the
 * answer is deterministic. The version probes stay stubbed: they would spawn the SDK.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DartAdapterFactory } from '../../src/dart-adapter-factory.js';

let root: string;
let savedEnv: NodeJS.ProcessEnv;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-dart-factory-'));
  savedEnv = { ...process.env };
});
afterEach(() => {
  process.env = savedEnv;
  fs.rmSync(root, { recursive: true, force: true });
});

describe('DartAdapterFactory locate seam', () => {
  it('hands the project root through to the locator, so an fvm pin is consulted in production', async () => {
    const seen: Array<string | undefined> = [];
    const f = new DartAdapterFactory({
      platform: 'win32',
      locate: (projectRoot) => { seen.push(projectRoot); return { dartExe: 'C:\\sdk\\bin\\dart.exe', dartSdkRoot: 'C:\\sdk', dartSource: 'env:DART_SDK', warnings: [] }; },
      probeDartVersion: async () => '3.13.4',
      probeFlutterVersion: async () => null,
    });
    const dir = path.join(root, 'proj');
    fs.mkdirSync(path.join(dir, 'bin'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'pubspec.yaml'), 'name: p\n');
    fs.writeFileSync(path.join(dir, 'bin', 'app.dart'), 'void main() {}\n');
    const { createMockAdapterDependencies } = await import('../../../../tests/test-utils/helpers/adapter-dependencies.js');
    const a = f.createAdapter(createMockAdapterDependencies());
    await a.transformLaunchConfig({ program: path.join(dir, 'bin', 'app.dart'), cwd: dir } as never);
    expect(seen).toContain(dir);
  });
});

describe('DartAdapterFactory default io', () => {
  it('finds a DART_SDK on disk through the real file system', async () => {
    const sdk = path.join(root, 'dart-sdk');
    const exe = path.join(sdk, 'bin', process.platform === 'win32' ? 'dart.exe' : 'dart');
    fs.mkdirSync(path.dirname(exe), { recursive: true });
    fs.writeFileSync(exe, '');
    process.env.DART_SDK = sdk;
    delete process.env.FLUTTER_ROOT;
    const f = new DartAdapterFactory({
      probeDartVersion: async () => '3.13.4',
      probeFlutterVersion: async () => null,
    });
    const v = await f.validate();
    expect(v.valid).toBe(true);
    expect((v.details as { dartExe?: string }).dartExe).toBe(exe);
    const row = await f.describeToolchain(v);
    expect(JSON.stringify(row)).toContain('3.13.4');
  });
});

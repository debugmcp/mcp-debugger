/**
 * DartAdapterFactory: metadata, validation and the doctor row.
 */
import { describe, expect, it } from 'vitest';
import { DebugLanguage } from '@debugmcp/shared';
import { createMockAdapterDependencies } from '../../../../tests/test-utils/helpers/adapter-dependencies.js';
import { DartAdapterFactory, type DartFactoryHooks } from '../../src/dart-adapter-factory.js';
import { DartDebugAdapter } from '../../src/dart-debug-adapter.js';

const DART_EXE = 'C:\\tools\\dart-sdk\\bin\\dart.exe';
const FLUTTER_ROOT = 'C:\\src\\flutter';

function hooks(overrides: Partial<DartFactoryHooks> = {}): DartFactoryHooks {
  return {
    platform: 'win32',
    locate: () => ({ dartExe: DART_EXE, dartSdkRoot: 'C:\\tools\\dart-sdk', dartSource: 'env:DART_SDK', flutterRoot: FLUTTER_ROOT, flutterExe: `${FLUTTER_ROOT}\\bin\\flutter.bat`, flutterSource: 'env:FLUTTER_ROOT', warnings: [] }),
    probeDartVersion: async () => '3.13.4',
    probeFlutterVersion: async () => ({ frameworkVersion: '3.47.7', channel: 'stable', dartSdkVersion: '3.13.5' }),
    ...overrides,
  };
}

describe('DartAdapterFactory', () => {
  it('creates a Dart adapter and describes itself as dart with launch and spawn-attach modes', () => {
    const f = new DartAdapterFactory(hooks());
    expect(f.createAdapter(createMockAdapterDependencies())).toBeInstanceOf(DartDebugAdapter);
    const m = f.getMetadata();
    expect(m.language).toBe(DebugLanguage.DART);
    expect(m.modes).toMatchObject({ launch: true, attach: 'spawn' })  // attachBy/attachHints are pinned by adapter-attach-contract.test.ts (issue #903);
    expect(m.fileExtensions).toContain('.dart');
  });

  it('validates when a Dart SDK is found and records both SDK locations', async () => {
    const v = await new DartAdapterFactory(hooks()).validate();
    expect(v.valid).toBe(true);
    expect(v.details).toMatchObject({ dartExe: DART_EXE, flutterRoot: FLUTTER_ROOT, backend: 'dart debug_adapter' });
  });

  it('fails validation with the install hint when no SDK is found, keeping locator warnings', async () => {
    const v = await new DartAdapterFactory(hooks({ locate: () => ({ warnings: ['DART_SDK=C:\\nope does not contain bin/dart.exe; ignored'] }) })).validate();
    expect(v.valid).toBe(false);
    expect(v.errors[0]).toMatch(/DART_SDK|FLUTTER_ROOT/);
    expect(v.warnings[0]).toMatch(/DART_SDK/);
  });

  it('describes the toolchain from the version probes', async () => {
    const f = new DartAdapterFactory(hooks());
    const d = await f.describeToolchain(await f.validate());
    expect(d.runtime).toMatchObject({ label: 'Dart SDK', version: '3.13.4', path: DART_EXE });
    expect(d.backend).toMatchObject({ label: 'dart debug_adapter' });
    expect(d.runtime?.source).toMatch(/Flutter 3\.47\.7 \(stable\)/);
  });

  it('leaves the Flutter mention out when only Dart is installed, and survives a failed probe', async () => {
    const f = new DartAdapterFactory(hooks({ locate: () => ({ dartExe: DART_EXE, dartSdkRoot: 'C:\\tools\\dart-sdk', dartSource: 'path', warnings: [] }), probeDartVersion: async () => null }));
    const d = await f.describeToolchain(await f.validate());
    expect(d.runtime).toMatchObject({ label: 'Dart SDK', path: DART_EXE });
    expect(d.runtime?.version).toBeUndefined();
    expect(d.runtime?.source).toBeUndefined();
  });

  it('lists the Flutter devices and the emulators not booted as the doctor targets (issue #877)', async () => {
    const f = new DartAdapterFactory(hooks({
      probeFlutterDevices: async () => [{ id: 'windows', name: 'Windows', targetPlatform: 'windows-x64', emulator: false }, { id: 'emulator-5554', name: 'sdk gphone64 x86 64', targetPlatform: 'android-x64', emulator: true }],
      probeFlutterEmulators: async () => ['mcp_api35'],
    }));
    const d = await f.describeToolchain(await f.validate());
    expect(d.targets).toEqual({
      label: 'Flutter devices',
      items: ['windows (Windows, windows-x64)', 'emulator-5554 (sdk gphone64 x86 64, android-x64, emulator)'],
      note: 'emulators: mcp_api35 (flutter emulators --launch <id> boots one; a booted emulator is listed as emulator-NNNN)',
    });
  });

  it('says when the devices were not probed within the budget, and lists none without Flutter', async () => {
    const slow = new DartAdapterFactory(hooks({ probeFlutterDevices: async () => null, probeFlutterEmulators: async () => null }));
    expect((await slow.describeToolchain(await slow.validate())).targets).toEqual({ label: 'Flutter devices', items: [], note: 'not probed (flutter devices answered nothing within the doctor budget)' });
    const dartOnly = new DartAdapterFactory(hooks({ locate: () => ({ dartExe: DART_EXE, dartSdkRoot: 'C:\\tools\\dart-sdk', dartSource: 'path', warnings: [] }) }));
    expect((await dartOnly.describeToolchain(await dartOnly.validate())).targets).toBeUndefined();
  });

  it('renders no runtime cell at all without an SDK', async () => {
    const f = new DartAdapterFactory(hooks({ locate: () => ({ warnings: [] }) }));
    const d = await f.describeToolchain(await f.validate());
    expect(d.runtime).toBeUndefined();
    expect(d.backend).toBeUndefined();
  });
});

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
    expect(m.modes).toEqual({ launch: true, attach: 'spawn' });
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

  it('renders no runtime cell at all without an SDK', async () => {
    const f = new DartAdapterFactory(hooks({ locate: () => ({ warnings: [] }) }));
    const d = await f.describeToolchain(await f.validate());
    expect(d.runtime).toBeUndefined();
    expect(d.backend).toBeUndefined();
  });
});

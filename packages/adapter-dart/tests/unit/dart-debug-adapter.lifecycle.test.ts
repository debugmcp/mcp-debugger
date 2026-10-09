/**
 * DartDebugAdapter: lifecycle, DAP plumbing, messages, defaults and the diagnostic branches the
 * transform tests do not reach. The proxy does the real DAP traffic; the adapter's part is state,
 * thread bookkeeping and words.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AdapterError, AdapterState, DebugFeature } from '@debugmcp/shared';
import type { DartToolchain } from '../../src/utils/sdk-locator.js';
import type { GenericAttachConfig, GenericLaunchConfig } from '@debugmcp/shared';
import { createMockAdapterDependencies } from '../../../../tests/test-utils/helpers/adapter-dependencies.js';
import { DartDebugAdapter, type DartAdapterHooks } from '../../src/dart-debug-adapter.js';

const FLUTTER_ROOT = 'C:\\src\\flutter';
const DART_EXE = 'C:\\tools\\dart-sdk\\bin\\dart.exe';
const FOUND: DartToolchain = { dartExe: DART_EXE, dartSdkRoot: 'C:\\tools\\dart-sdk', dartSource: 'env:DART_SDK', flutterRoot: FLUTTER_ROOT, flutterExe: `${FLUTTER_ROOT}\\bin\\flutter.bat`, flutterSource: 'env:FLUTTER_ROOT', warnings: ['DART_PATH is deprecated'] };
const MISSING: DartToolchain = { warnings: [] } as unknown as DartToolchain;

function hooks(overrides: Partial<DartAdapterHooks> = {}): DartAdapterHooks {
  return { platform: 'win32', nodeExe: 'C:\\node\\node.exe', bridgePath: 'C:\\bridge\\dap-stdio-bridge.js', locate: () => FOUND, ...overrides };
}
const adapter = (overrides: Partial<DartAdapterHooks> = {}) => new DartDebugAdapter(createMockAdapterDependencies(), hooks(overrides));

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-dart-lifecycle-')); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

function project(pubspec: string, file: string): { dir: string; program: string } {
  const dir = path.join(root, 'p');
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  fs.writeFileSync(path.join(dir, 'pubspec.yaml'), pubspec);
  fs.writeFileSync(path.join(dir, file), 'void main() {}\n');
  return { dir, program: path.join(dir, file) };
}
const FLUTTER_PUBSPEC = 'name: p\ndependencies:\n  flutter:\n    sdk: flutter\n';
const DART_PUBSPEC = 'name: p\n';

describe('DartDebugAdapter lifecycle', () => {
  it('initializes to READY when a Dart SDK is found, carrying the locator warnings', async () => {
    const a = adapter();
    const states: Array<[AdapterState, AdapterState]> = [];
    a.on('stateChanged', (prev: AdapterState, next: AdapterState) => states.push([prev, next]));
    const initialized = vi.fn();
    a.on('initialized', initialized);
    await a.initialize();
    expect(a.getState()).toBe(AdapterState.READY);
    expect(a.isReady()).toBe(true);
    expect(states).toEqual([[AdapterState.UNINITIALIZED, AdapterState.INITIALIZING], [AdapterState.INITIALIZING, AdapterState.READY]]);
    expect(initialized).toHaveBeenCalledTimes(1);
    const v = await a.validateEnvironment();
    expect(v).toMatchObject({ valid: true, errors: [] });
    expect(v.warnings).toEqual([{ code: 'DART_SDK_ENV', message: 'DART_PATH is deprecated' }]);
  });

  it('initializes to ERROR and throws the SDK hint when no Dart SDK is found', async () => {
    const a = adapter({ locate: () => MISSING });
    await expect(a.initialize()).rejects.toThrow(AdapterError);
    expect(a.getState()).toBe(AdapterState.ERROR);
    expect(a.isReady()).toBe(false);
    await expect(a.resolveExecutablePath()).rejects.toThrow(/Dart SDK not found/);
    expect(a.getExecutableSearchPaths()).toEqual([]);
  });

  it('resolves the executable (preferred path first), lists search paths and dependencies', async () => {
    const a = adapter();
    await expect(a.resolveExecutablePath('C:\\other\\dart.exe')).resolves.toBe('C:\\other\\dart.exe');
    await expect(a.resolveExecutablePath()).resolves.toBe(DART_EXE);
    expect(a.getDefaultExecutableName()).toBe('dart');
    expect(a.getExecutableSearchPaths()).toEqual(['C:\\tools\\dart-sdk', FLUTTER_ROOT]);
    expect(a.getRequiredDependencies().map((d) => [d.name, d.required])).toEqual([['Dart SDK', true], ['Flutter SDK', false]]);
    expect(a.getAdapterModuleName()).toBe('dart debug_adapter');
    expect(a.getAdapterInstallCommand()).toMatch(/ships with it/);
  });

  it('tracks the stopped thread through DAP events and connect/disconnect/dispose state', async () => {
    const a = adapter();
    const events: string[] = [];
    for (const e of ['connected', 'disconnected', 'disposed', 'stopped']) a.on(e, () => events.push(e));
    await a.connect('127.0.0.1', 4711);
    expect(a.isConnected()).toBe(true);
    expect(a.getState()).toBe(AdapterState.CONNECTED);
    expect(a.isReady()).toBe(true);
    a.handleDapEvent({ seq: 1, type: 'event', event: 'stopped', body: { reason: 'breakpoint', threadId: 7 } });
    expect(a.getCurrentThreadId()).toBe(7);
    a.handleDapEvent({ seq: 2, type: 'event', event: 'output', body: { output: 'x' } });
    expect(a.getCurrentThreadId()).toBe(7);
    a.handleDapResponse({ seq: 3, type: 'response', request_seq: 1, success: true, command: 'next' });
    await expect(a.sendDapRequest('threads')).resolves.toEqual({});
    await a.disconnect();
    expect(a.isConnected()).toBe(false);
    expect(a.getCurrentThreadId()).toBeNull();
    expect(a.getState()).toBe(AdapterState.DISCONNECTED);
    await a.dispose();
    expect(a.getState()).toBe(AdapterState.UNINITIALIZED);
    expect(events).toEqual(['connected', 'stopped', 'disconnected', 'disposed']);
  });

  it('answers the feature matrix, defaults and the capability pins', () => {
    const a = adapter();
    expect(a.supportsFeature(DebugFeature.LOG_POINTS)).toBe(true);
    expect(a.supportsFeature(DebugFeature.FUNCTION_BREAKPOINTS)).toBe(false);
    expect(a.getFeatureRequirements(DebugFeature.LOG_POINTS)).toEqual([]);
    expect(a.getDefaultLaunchConfig()).toEqual({ stopOnEntry: false, justMyCode: true });
    expect(a.getDefaultAttachConfig()).toEqual({ timeout: 30000 });
    expect(a.supportsAttach()).toBe(true);
    expect(a.supportsDetach()).toBe(true);
    expect(a.getCapabilities()).toMatchObject({ supportsFunctionBreakpoints: false, supportsLogPoints: true, supportsRestartRequest: false });
  });

  it('words its errors: install steps, the missing-SDK line, and the three translated messages', () => {
    const a = adapter();
    expect(a.getInstallationInstructions()).toMatch(/flutter doctor/);
    expect(a.getMissingExecutableError()).toMatch(/DART_SDK \/ FLUTTER_ROOT/);
    expect(a.translateErrorMessage(new Error('No Dart SDK found anywhere'))).toBe(a.getMissingExecutableError());
    expect(a.translateErrorMessage(new Error('FLUTTER_ROOT is not set'))).toMatch(/flutter --version/);
    expect(a.translateErrorMessage(new Error('Session terminated before debugger initialized: (1)'))).toMatch(/failed to compile or start/);
    expect(a.translateErrorMessage(new Error('something else'))).toBe('something else');
  });
});

describe('DartDebugAdapter diagnostic branches', () => {
  it('notes a non-string deviceId and an unknown flutterMode on a Flutter launch', async () => {
    const { dir, program } = project(FLUTTER_PUBSPEC, 'lib/main.dart');
    const a = adapter();
    const out = await a.transformLaunchConfig({ program, cwd: dir, deviceId: 42, flutterMode: 'fast' } as unknown as GenericLaunchConfig);
    expect(out.toolArgs).toBeUndefined();
    const notes = a.consumeLaunchConfigDiagnostics().map((d) => `${d.key}: ${d.message}`);
    expect(notes).toEqual(expect.arrayContaining([
      expect.stringMatching(/^deviceId: ignored: expected a device id string/),
      expect.stringMatching(/^flutterMode: ignored: expected debug, profile or release/),
    ]));
    expect(a.consumeLaunchConfigDiagnostics()).toEqual([]);
  });

  it('refuses an unknown runner on attach and notes deviceId on a Dart attach', async () => {
    const { dir } = project(DART_PUBSPEC, 'bin/app.dart');
    const a = adapter();
    await expect(a.transformAttachConfig({ request: 'attach', __attachMode: true, runner: 'bogus', vmServiceUri: 'ws://h/ws' } as unknown as GenericAttachConfig))
      .rejects.toThrow(/Unknown Dart runner "bogus"/);
    const out = await a.transformAttachConfig({ request: 'attach', __attachMode: true, cwd: dir, vmServiceUri: 'ws://h/ws', deviceId: 'windows' } as unknown as GenericAttachConfig);
    expect(out.toolArgs).toBeUndefined();
    expect(a.consumeLaunchConfigDiagnostics().map((d) => d.key)).toContain('deviceId');
  });

  it('locates the toolchain through the real io when no locate hook is given (env SDK through the mock file system)', async () => {
    const deps = createMockAdapterDependencies();
    const sdk = path.join(root, 'dart-sdk');
    deps.environment.getAll = () => ({ DART_SDK: sdk }) as Record<string, string>;
    deps.environment.get = (name: string) => (name === 'DART_SDK' ? sdk : undefined);
    deps.fileSystem.existsSync = (p: string) => p.startsWith(sdk);
    const a = new DartDebugAdapter(deps, { platform: process.platform, nodeExe: 'node', bridgePath: 'bridge.js' });
    const v = await a.validateEnvironment();
    expect(v.valid).toBe(true);
    await expect(a.resolveExecutablePath()).resolves.toBe(path.join(sdk, 'bin', process.platform === 'win32' ? 'dart.exe' : 'dart'));
  });
});

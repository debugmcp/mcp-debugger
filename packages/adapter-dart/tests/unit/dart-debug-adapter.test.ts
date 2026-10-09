/**
 * DartDebugAdapter: launch/attach transforms, the bridge command, environment validation.
 *
 * The adapter takes its toolchain, platform and bridge location through constructor hooks so these
 * tests describe its policy without an SDK on the box. Project detection is real (temp pubspecs).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AdapterError, DebugLanguage } from '@debugmcp/shared';
import type { GenericAttachConfig, GenericLaunchConfig } from '@debugmcp/shared';
import { createMockAdapterDependencies } from '../../../../tests/test-utils/helpers/adapter-dependencies.js';
import { DartDebugAdapter, type DartAdapterHooks } from '../../src/dart-debug-adapter.js';

let root: string;
const FLUTTER_ROOT = 'C:\\src\\flutter';
const DART_EXE = 'C:\\tools\\dart-sdk\\bin\\dart.exe';
const BRIDGE = 'C:\\bridge\\dap-stdio-bridge.js';
const NODE = 'C:\\node\\node.exe';

/** Mock dependencies whose file system holds a warm Flutter tool cache under FLUTTER_ROOT. */
function deps() {
  const d = createMockAdapterDependencies();
  d.fileSystem.existsSync = ((p: string) => p.toLowerCase().startsWith(FLUTTER_ROOT.toLowerCase())) as typeof d.fileSystem.existsSync;
  return d;
}

function hooks(overrides: Partial<DartAdapterHooks> = {}): DartAdapterHooks {
  return {
    platform: 'win32',
    nodeExe: NODE,
    bridgePath: BRIDGE,
    locate: () => ({ dartExe: DART_EXE, dartSdkRoot: 'C:\\tools\\dart-sdk', dartSource: 'env:DART_SDK', flutterRoot: FLUTTER_ROOT, flutterExe: `${FLUTTER_ROOT}\\bin\\flutter.bat`, flutterSource: 'env:FLUTTER_ROOT', warnings: [] }),
    ...overrides,
  };
}

function project(name: string, pubspec: string, files: string[]): string {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'pubspec.yaml'), pubspec);
  for (const f of files) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), 'void main() {}\n');
  }
  return dir;
}
const DART_PUBSPEC = 'name: p\ndev_dependencies:\n  test: any\n';
const FLUTTER_PUBSPEC = 'name: p\ndependencies:\n  flutter:\n    sdk: flutter\n';

const launch = (extra: Record<string, unknown>): GenericLaunchConfig => ({ ...extra } as GenericLaunchConfig);
const attach = (extra: Record<string, unknown>): GenericAttachConfig => ({ request: 'attach', __attachMode: true, ...extra } as GenericAttachConfig);

beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-dart-adapter-')); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

describe('DartDebugAdapter launch', () => {
  it('forwards generic keys, drops console, defaults evaluateToStringInDebugViews, and disables the exit pause for Dart runners', async () => {
    const dir = project('dart', DART_PUBSPEC, ['bin/app.dart']);
    const program = path.join(dir, 'bin', 'app.dart');
    const a = new DartDebugAdapter(deps(), hooks());
    const out = await a.transformLaunchConfig(launch({ program, cwd: dir, args: ['x'], env: { A: '1' }, stopOnEntry: false, console: 'terminal', vmAdditionalArgs: ['--enable-asserts'] }));
    expect(out).toMatchObject({ request: 'launch', program, cwd: dir, args: ['x'], env: { A: '1' }, evaluateToStringInDebugViews: true });
    expect(out.console).toBeUndefined();
    expect(out.vmAdditionalArgs).toEqual(['--enable-asserts', '--pause_isolates_on_exit=false']);
    expect(out.runner).toBeUndefined();
    expect(a.lastRunner?.runner).toBe('dart');
  });

  it('maps deviceId and flutterMode to toolArgs for Flutter projects and leaves vmAdditionalArgs alone', async () => {
    const dir = project('flutter', FLUTTER_PUBSPEC, ['lib/main.dart']);
    const program = path.join(dir, 'lib', 'main.dart');
    const a = new DartDebugAdapter(deps(), hooks());
    const out = await a.transformLaunchConfig(launch({ program, cwd: dir, deviceId: 'windows', flutterMode: 'profile', toolArgs: ['--verbose'] }));
    expect(out.toolArgs).toEqual(['-d', 'windows', '--profile', '--verbose']);
    expect(out.vmAdditionalArgs).toBeUndefined();
    expect(out.deviceId).toBeUndefined();
    expect(out.flutterMode).toBeUndefined();
    expect(a.lastRunner?.runner).toBe('flutter');
    const diag = a.consumeLaunchConfigDiagnostics();
    expect(diag.find((d) => d.key === 'flutterMode')?.message).toMatch(/debugger/i);
    expect(diag.find((d) => d.key === 'runner')?.message).toMatch(/flutter/);
  });

  it('honours an explicit runner and warns when deviceId is given to a Dart runner', async () => {
    const dir = project('flutter', FLUTTER_PUBSPEC, ['lib/main.dart']);
    const program = path.join(dir, 'lib', 'main.dart');
    const a = new DartDebugAdapter(deps(), hooks());
    const out = await a.transformLaunchConfig(launch({ program, cwd: dir, runner: 'dart', deviceId: 'windows' }));
    expect(a.lastRunner?.runner).toBe('dart');
    expect(out.toolArgs).toBeUndefined();
    expect(a.consumeLaunchConfigDiagnostics().find((d) => d.key === 'deviceId')?.message).toMatch(/ignored|Flutter/);
  });

  it('rejects an unknown runner value', async () => {
    const dir = project('dart', DART_PUBSPEC, ['bin/app.dart']);
    const a = new DartDebugAdapter(deps(), hooks());
    await expect(a.transformLaunchConfig(launch({ program: path.join(dir, 'bin', 'app.dart'), cwd: dir, runner: 'cobcrun' }))).rejects.toThrow(/runner/);
  });

  it('fails a Flutter project launch with a FLUTTER_ROOT hint when only Dart is installed', async () => {
    const dir = project('flutter', FLUTTER_PUBSPEC, ['lib/main.dart']);
    const a = new DartDebugAdapter(deps(), hooks({ locate: () => ({ dartExe: DART_EXE, dartSdkRoot: 'C:\\tools\\dart-sdk', dartSource: 'path', warnings: [] }) }));
    await expect(a.transformLaunchConfig(launch({ program: path.join(dir, 'lib', 'main.dart'), cwd: dir }))).rejects.toThrow(/FLUTTER_ROOT/);
  });
});

describe('DartDebugAdapter.buildAdapterCommand', () => {
  it('wraps the Flutter DAP (Windows snapshot bypass) in the stdio bridge with the proxy port and FLUTTER_ROOT', async () => {
    const dir = project('flutter', FLUTTER_PUBSPEC, ['lib/main.dart']);
    const program = path.join(dir, 'lib', 'main.dart');
    const a = new DartDebugAdapter(deps(), hooks());
    const launchConfig = await a.transformLaunchConfig(launch({ program, cwd: dir }));
    const cmd = a.buildAdapterCommand({ sessionId: 's', executablePath: DART_EXE, adapterHost: '127.0.0.1', adapterPort: 4711, logDir: 'C:\\logs', scriptPath: program, launchConfig });
    expect(cmd.command).toBe(NODE);
    expect(cmd.args).toEqual([
      BRIDGE, '--port', '4711', '--host', '127.0.0.1', '--cwd', dir, '--',
      `${FLUTTER_ROOT}\\bin\\cache\\dart-sdk\\bin\\dart.exe`,
      `--packages=${FLUTTER_ROOT}\\packages\\flutter_tools\\.dart_tool\\package_config.json`,
      `${FLUTTER_ROOT}\\bin\\cache\\flutter_tools.snapshot`,
      'debug-adapter',
    ]);
    expect(cmd.env?.FLUTTER_ROOT).toBe(FLUTTER_ROOT);
  });

  it('runs `dart debug_adapter --test` for a Dart test file', async () => {
    const dir = project('dart', DART_PUBSPEC, ['test/a_test.dart']);
    const program = path.join(dir, 'test', 'a_test.dart');
    const a = new DartDebugAdapter(deps(), hooks());
    const launchConfig = await a.transformLaunchConfig(launch({ program, cwd: dir }));
    const cmd = a.buildAdapterCommand({ sessionId: 's', executablePath: DART_EXE, adapterHost: '127.0.0.1', adapterPort: 1, logDir: 'C:\\logs', scriptPath: program, launchConfig });
    expect(cmd.args.slice(cmd.args.indexOf('--') + 1)).toEqual([DART_EXE, 'debug_adapter', '--test']);
  });
});

describe('DartDebugAdapter container temp dir', () => {
  const linuxHooks = (): DartAdapterHooks => hooks({ platform: 'linux', nodeExe: '/usr/local/bin/node', bridgePath: '/app/bridge.js', locate: () => ({ dartExe: '/usr/lib/dart/bin/dart', dartSdkRoot: '/usr/lib/dart', dartSource: 'env:DART_SDK', warnings: [] }) });
  const cfg = (launchConfig: GenericLaunchConfig) => ({ sessionId: 's', executablePath: '/usr/lib/dart/bin/dart', adapterHost: '127.0.0.1', adapterPort: 7, logDir: '/tmp', scriptPath: '/workspace/dart/hello.dart', launchConfig });
  const envWith = (vars: Record<string, string | undefined>) => createMockAdapterDependencies({ environment: { get: (k: string) => vars[k], getAll: () => vars as Record<string, string>, getCurrentWorkingDirectory: () => '/workspace' } });

  it('points the SDK adapter at a container-local temp dir in container mode', async () => {
    // The adapter writes its VM service-info file under the system temp dir and watches for it;
    // the Docker lane bind-mounts /tmp from the host, where no inotify events arrive (measured).
    const dir = project('bare', DART_PUBSPEC, ['hello.dart']);
    const a = new DartDebugAdapter(envWith({ MCP_CONTAINER: 'true' }), linuxHooks());
    const launchConfig = await a.transformLaunchConfig(launch({ program: path.join(dir, 'hello.dart'), cwd: dir }));
    expect(a.buildAdapterCommand(cfg(launchConfig)).env?.TMPDIR).toBe('/var/tmp');
  });

  it('keeps a TMPDIR the environment already sets, and sets none outside containers or on Windows', async () => {
    const dir = project('bare', DART_PUBSPEC, ['hello.dart']);
    const program = path.join(dir, 'hello.dart');
    const keep = new DartDebugAdapter(envWith({ MCP_CONTAINER: 'true', TMPDIR: '/scratch' }), linuxHooks());
    expect(keep.buildAdapterCommand(cfg(await keep.transformLaunchConfig(launch({ program, cwd: dir })))).env?.TMPDIR).toBe('/scratch');
    const host = new DartDebugAdapter(envWith({}), linuxHooks());
    expect(host.buildAdapterCommand(cfg(await host.transformLaunchConfig(launch({ program, cwd: dir })))).env?.TMPDIR).toBeUndefined();
    const win = new DartDebugAdapter(envWith({ MCP_CONTAINER: 'true' }), hooks());
    expect(win.buildAdapterCommand(cfg(await win.transformLaunchConfig(launch({ program, cwd: dir })))).env?.TMPDIR).toBeUndefined();
  });
});

describe('DartDebugAdapter attach', () => {
  it('forwards vmServiceUri and strips the generic and internal keys', async () => {
    const dir = project('dart', DART_PUBSPEC, ['bin/pause.dart']);
    const a = new DartDebugAdapter(deps(), hooks());
    const out = await a.transformAttachConfig(attach({ vmServiceUri: 'ws://127.0.0.1:8181/ws', cwd: dir, timeout: 5000, justMyCode: true, sourcePaths: ['x'] }));
    // `request: 'attach'` is how the proxy worker tells an attach from a launch (it reads the
    // transformed config); the SDK adapter ignores the key.
    expect(out).toEqual({ request: 'attach', vmServiceUri: 'ws://127.0.0.1:8181/ws', cwd: dir });
  });

  it('builds a no-auth URI from host and port, and says so', async () => {
    const a = new DartDebugAdapter(deps(), hooks());
    const out = await a.transformAttachConfig(attach({ host: '127.0.0.1', port: 8181 }));
    expect(out.vmServiceUri).toBe('ws://127.0.0.1:8181/ws');
    expect(out.host).toBeUndefined();
    expect(out.port).toBeUndefined();
    expect(a.consumeLaunchConfigDiagnostics().find((d) => d.key === 'port')?.message).toMatch(/disable-service-auth-codes/);
  });

  it('rejects processId with a message that names vmServiceUri', async () => {
    const a = new DartDebugAdapter(deps(), hooks());
    await expect(a.transformAttachConfig(attach({ processId: 1234 }))).rejects.toThrow(/vmServiceUri/);
  });

  it('rejects attach for the test runners', async () => {
    const a = new DartDebugAdapter(deps(), hooks());
    await expect(a.transformAttachConfig(attach({ vmServiceUri: 'ws://x/ws', runner: 'dart-test' }))).rejects.toThrow(/attach/i);
  });

  it('attaches Flutter projects with the flutter adapter and the device', async () => {
    const dir = project('flutter', FLUTTER_PUBSPEC, ['lib/main.dart']);
    const a = new DartDebugAdapter(deps(), hooks());
    const out = await a.transformAttachConfig(attach({ vmServiceUri: 'ws://x/ws', cwd: dir, deviceId: 'emulator-5554' }));
    expect(out.toolArgs).toEqual(['-d', 'emulator-5554']);
    expect(a.lastRunner?.runner).toBe('flutter');
    const cmd = a.buildAdapterCommand({ sessionId: 's', executablePath: DART_EXE, adapterHost: '127.0.0.1', adapterPort: 2, logDir: 'C:\\logs', scriptPath: 'attach://remote', launchConfig: out as GenericLaunchConfig, attachMode: true });
    expect(cmd.args).toContain('debug-adapter');
  });
});

describe('DartDebugAdapter environment and capabilities', () => {
  it('validates when a Dart SDK is found and reports locator warnings', async () => {
    const a = new DartDebugAdapter(deps(), hooks({ locate: () => ({ dartExe: DART_EXE, dartSdkRoot: 'C:\\tools\\dart-sdk', dartSource: 'path', warnings: ['FLUTTER_ROOT=C:\\nope does not contain bin/flutter.bat; ignored'] }) }));
    const v = await a.validateEnvironment();
    expect(v.valid).toBe(true);
    expect(v.warnings[0]?.message).toMatch(/FLUTTER_ROOT/);
  });

  it('fails validation without any Dart SDK', async () => {
    const a = new DartDebugAdapter(deps(), hooks({ locate: () => ({ warnings: [] }) }));
    const v = await a.validateEnvironment();
    expect(v.valid).toBe(false);
    expect(v.errors[0]?.message).toMatch(/DART_SDK|dart/);
    await expect(a.initialize()).rejects.toBeInstanceOf(AdapterError);
  });

  it('declares the measured capability set', () => {
    const a = new DartDebugAdapter(deps(), hooks());
    const c = a.getCapabilities();
    expect(c).toMatchObject({ supportsLogPoints: true, supportsConditionalBreakpoints: true, supportsFunctionBreakpoints: false, supportsHitConditionalBreakpoints: false, supportsRestartRequest: false, supportsExceptionInfoRequest: false, supportsSetVariable: false, supportsTerminateRequest: true });
    expect(c.exceptionBreakpointFilters?.map((f) => f.filter)).toEqual(['All', 'Unhandled']);
    expect(a.language).toBe(DebugLanguage.DART);
    expect(a.supportsAttach()).toBe(true);
    expect(a.getDefaultExecutableName()).toBe('dart');
  });

  it('resolves the executable path to the preferred path, else the located Dart', async () => {
    const a = new DartDebugAdapter(deps(), hooks());
    await expect(a.resolveExecutablePath('C:\\custom\\dart.exe')).resolves.toBe('C:\\custom\\dart.exe');
    await expect(a.resolveExecutablePath()).resolves.toBe(DART_EXE);
  });
});

/**
 * Dart / Flutter adapter factory (issue #790): metadata, environment validation, and the
 * `mcp-debugger doctor` row. The debugger itself ships with the SDK, so "backend" is the SDK's
 * `dart debug_adapter` and "runtime" is the Dart SDK (with the Flutter SDK named when present).
 */
import { DebugLanguage, probeWithinBudget, toolchainComponent } from '@debugmcp/shared';
import type {
  AdapterDependencies,
  AdapterMetadata,
  DescribeToolchainOptions,
  FactoryValidationResult,
  IAdapterFactory,
  IDebugAdapter,
  ToolchainDescription,
  ToolchainTargets,
} from '@debugmcp/shared';
import { DART_ATTACH_FORMS_HINT } from './attach-hints.js';
import { DartDebugAdapter } from './dart-debug-adapter.js';
import { locateToolchain, realLocatorIo, type DartToolchain } from './utils/sdk-locator.js';
import { probeDartVersion, probeFlutterDevices, probeFlutterEmulators, probeFlutterVersion, type FlutterDevice, type FlutterVersion } from './utils/version-probes.js';

/** Seams for tests. */
export interface DartFactoryHooks {
  platform?: NodeJS.Platform;
  /** The locator, given the project root whose fvm pin applies. */
  locate?: (projectRoot?: string) => DartToolchain;
  probeDartVersion?: (dartExe: string) => Promise<string | null>;
  probeFlutterVersion?: (flutterRoot: string) => Promise<FlutterVersion | null>;
  /** `flutter devices --machine` (issue #877); `timeoutMs` is the doctor budget, the probe's own spawn timeout too. */
  probeFlutterDevices?: (flutterRoot: string, timeoutMs?: number) => Promise<FlutterDevice[] | null>;
  /** `flutter emulators` (issue #877); `timeoutMs` as above. */
  probeFlutterEmulators?: (flutterRoot: string, timeoutMs?: number) => Promise<string[] | null>;
}

/** What validate() records and describeToolchain() reads back (one alias, compiler-checked). */
type DartToolchainDetails = {
  dartExe?: string;
  dartSdkRoot?: string;
  dartSource?: string;
  flutterRoot?: string;
  flutterSource?: string;
  backend: 'dart debug_adapter';
  platform: string;
  timestamp: string;
};

export class DartAdapterFactory implements IAdapterFactory {
  private readonly hooks: Required<DartFactoryHooks>;

  constructor(hooks: DartFactoryHooks = {}) {
    const platform = hooks.platform ?? process.platform;
    this.hooks = {
      platform,
      locate: hooks.locate ?? ((projectRoot) => locateToolchain(realLocatorIo({ platform, env: process.env, projectRoot }))),
      probeDartVersion: hooks.probeDartVersion ?? ((dartExe) => probeDartVersion(dartExe)),
      probeFlutterVersion: hooks.probeFlutterVersion ?? ((root) => probeFlutterVersion(root, { platform })),
      probeFlutterDevices: hooks.probeFlutterDevices ?? ((root, timeoutMs) => probeFlutterDevices(root, { platform, timeoutMs })),
      probeFlutterEmulators: hooks.probeFlutterEmulators ?? ((root, timeoutMs) => probeFlutterEmulators(root, { platform, timeoutMs })),
    };
  }

  createAdapter(dependencies: AdapterDependencies): IDebugAdapter {
    return new DartDebugAdapter(dependencies, { platform: this.hooks.platform, locate: (projectRoot) => this.hooks.locate(projectRoot) });
  }

  getMetadata(): AdapterMetadata {
    return {
      language: DebugLanguage.DART,
      displayName: 'Dart/Flutter',
      version: '0.1.0',
      author: 'mcp-debugger team',
      description: 'Debug Dart programs, package:test suites, and Flutter apps and tests with the SDK\'s own debug adapters',
      documentationUrl: 'https://github.com/debugmcp/mcp-debugger/docs/dart',
      minimumDebuggerVersion: '3.0.0',
      fileExtensions: ['.dart'],
      modes: {
        launch: true,
        attach: 'spawn',
        // A VM-service URI (or info file) under adapterConfig, or host:port for a
        // VM started with --disable-service-auth-codes, or a Flutter deviceId alone
        // for an app on an Android device (issue #882); no PID step (issue #903)
        attachBy: ['port', 'adapterConfig'],
        attachHints: {
          processId: DART_ATTACH_FORMS_HINT
        }
      },
    };
  }

  async validate(): Promise<FactoryValidationResult> {
    const tc = this.hooks.locate();
    const errors: string[] = [];
    if (!tc.dartExe) {
      errors.push('No Dart SDK found. Install Dart or Flutter, put `dart`/`flutter` on PATH, or set DART_SDK / FLUTTER_ROOT.');
    }
    const details: DartToolchainDetails = {
      dartExe: tc.dartExe,
      dartSdkRoot: tc.dartSdkRoot,
      dartSource: tc.dartSource,
      flutterRoot: tc.flutterRoot,
      flutterSource: tc.flutterSource,
      backend: 'dart debug_adapter',
      platform: this.hooks.platform,
      timestamp: new Date().toISOString(),
    };
    return { valid: errors.length === 0, errors, warnings: [...tc.warnings], details };
  }

  async describeToolchain(validation: FactoryValidationResult, options?: DescribeToolchainOptions): Promise<ToolchainDescription> {
    const details = (validation.details ?? {}) as Partial<DartToolchainDetails>;
    // The four probes are independent and the doctor's outer timeout is one budget for the
    // whole description, so they run together: the versions, then (issue #877) the devices
    // the SDK sees and the AVDs `flutter emulators` lists. The device probes get the budget
    // as their own spawn timeout too, so a slow `flutter devices` does not outlive the doctor.
    const budget = options?.timeoutMs;
    const flutterRoot = details.flutterRoot;
    const [dartVersion, flutterVersion, devices, emulators] = await Promise.all([
      details.dartExe ? probeWithinBudget(budget, () => this.hooks.probeDartVersion(details.dartExe!)) : Promise.resolve(null),
      flutterRoot ? probeWithinBudget(budget, () => this.hooks.probeFlutterVersion(flutterRoot)) : Promise.resolve(null),
      flutterRoot ? probeWithinBudget(budget, () => this.hooks.probeFlutterDevices(flutterRoot, budget)) : Promise.resolve(null),
      flutterRoot ? probeWithinBudget(budget, () => this.hooks.probeFlutterEmulators(flutterRoot, budget)) : Promise.resolve(null),
    ]);
    const targets = details.flutterRoot ? describeFlutterTargets(devices ?? null, emulators ?? null) : undefined;
    const flutterNote = flutterVersion?.frameworkVersion
      ? `Flutter ${flutterVersion.frameworkVersion}${flutterVersion.channel ? ` (${flutterVersion.channel})` : ''} at ${details.flutterRoot}`
      : undefined;
    return {
      runtime: toolchainComponent({ label: 'Dart SDK', path: details.dartExe, version: dartVersion ?? undefined, source: flutterNote }),
      backend: toolchainComponent({ label: 'dart debug_adapter', path: details.dartExe ? `${details.dartExe} debug_adapter` : undefined, version: dartVersion ?? undefined }),
      ...(targets ? { targets } : {}),
    };
  }
}

/**
 * The doctor's targets row for Flutter: `<id> (<name>, <platform>[, emulator])`, plus the AVDs
 * `flutter emulators` lists — every AVD, booted or not (the device JSON does not name the AVD
 * behind a running emulator, so the two lists are not reconciled; the note says so).
 */
function describeFlutterTargets(devices: FlutterDevice[] | null, emulators: string[] | null): ToolchainTargets {
  if (devices === null) {
    // A null is a probe that did not answer in time or failed (a non-zero exit, a spawn error,
    // unparseable output); the two are not told apart, so the note names both.
    return { label: 'Flutter devices', items: [], note: 'not probed (flutter devices --machine did not answer within the doctor budget, or failed)' };
  }
  const items = devices.map((d) => `${d.id} (${[d.name, d.targetPlatform, d.emulator ? 'emulator' : undefined].filter(Boolean).join(', ')})`);
  const note = emulators && emulators.length > 0
    ? `emulators: ${emulators.join(', ')} (flutter emulators --launch <id> boots one; a booted emulator is listed as emulator-NNNN)`
    : undefined;
  return { label: 'Flutter devices', items, ...(note ? { note } : {}) };
}

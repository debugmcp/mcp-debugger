/**
 * Dart / Flutter adapter factory (issue #790): metadata, environment validation, and the
 * `mcp-debugger doctor` row. The debugger itself ships with the SDK, so "backend" is the SDK's
 * `dart debug_adapter` and "runtime" is the Dart SDK (with the Flutter SDK named when present).
 */
import fs from 'node:fs';
import os from 'node:os';
import which from 'which';
import { DebugLanguage, probeWithinBudget, toolchainComponent } from '@debugmcp/shared';
import type {
  AdapterDependencies,
  AdapterMetadata,
  DescribeToolchainOptions,
  FactoryValidationResult,
  IAdapterFactory,
  IDebugAdapter,
  ToolchainDescription,
} from '@debugmcp/shared';
import { DartDebugAdapter } from './dart-debug-adapter.js';
import { locateToolchain, type DartToolchain } from './utils/sdk-locator.js';
import { probeDartVersion, probeFlutterVersion, type FlutterVersion } from './utils/version-probes.js';

/** Seams for tests. */
export interface DartFactoryHooks {
  platform?: NodeJS.Platform;
  locate?: () => DartToolchain;
  probeDartVersion?: (dartExe: string) => Promise<string | null>;
  probeFlutterVersion?: (flutterRoot: string) => Promise<FlutterVersion | null>;
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
      locate: hooks.locate ?? (() => locateToolchain({
        platform,
        env: process.env,
        homeDir: os.homedir(),
        exists: (p) => fs.existsSync(p),
        realpath: (p) => { try { return fs.realpathSync(p); } catch { return p; } },
        which: (name) => which.sync(name, { nothrow: true }) ?? undefined,
        readFile: (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return undefined; } },
      })),
      probeDartVersion: hooks.probeDartVersion ?? ((dartExe) => probeDartVersion(dartExe)),
      probeFlutterVersion: hooks.probeFlutterVersion ?? ((root) => probeFlutterVersion(root, { platform })),
    };
  }

  createAdapter(dependencies: AdapterDependencies): IDebugAdapter {
    return new DartDebugAdapter(dependencies, { platform: this.hooks.platform, locate: () => this.hooks.locate() });
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
      modes: { launch: true, attach: 'spawn' },
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
    const [dartVersion, flutterVersion] = await Promise.all([
      details.dartExe ? probeWithinBudget(options?.timeoutMs, () => this.hooks.probeDartVersion(details.dartExe!)) : Promise.resolve(null),
      details.flutterRoot ? probeWithinBudget(options?.timeoutMs, () => this.hooks.probeFlutterVersion(details.flutterRoot!)) : Promise.resolve(null),
    ]);
    const flutterNote = flutterVersion?.frameworkVersion
      ? `Flutter ${flutterVersion.frameworkVersion}${flutterVersion.channel ? ` (${flutterVersion.channel})` : ''} at ${details.flutterRoot}`
      : undefined;
    return {
      runtime: toolchainComponent({ label: 'Dart SDK', path: details.dartExe, version: dartVersion ?? undefined, source: flutterNote }),
      backend: toolchainComponent({ label: 'dart debug_adapter', path: details.dartExe ? `${details.dartExe} debug_adapter` : undefined, version: dartVersion ?? undefined }),
    };
  }
}

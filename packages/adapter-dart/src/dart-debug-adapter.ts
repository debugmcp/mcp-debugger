/**
 * Dart / Flutter debug adapter (issue #790).
 *
 * The debugger is the SDK's own DAP server — `dart debug_adapter [--test]` for Dart programs and
 * package:test files, `flutter debug-adapter [--test]` for Flutter apps and their tests — reached
 * through the TCP-to-stdio bridge in `bridge/`, because the proxy connects to adapters over TCP
 * and those servers speak stdio only. Nothing is vendored: the SDKs are found on the machine
 * (`utils/sdk-locator.ts`) and invoked the way their own launchers do (`utils/flutter-invocation.ts`).
 *
 * Measured behaviour the transforms encode (docs/dart/spike-notes.md):
 * - `--pause_isolates_on_exit=false` as a user VM flag removes the adapter's transient exit stop;
 * - the Flutter adapter has no `deviceId`; the device travels as `toolArgs: ['-d', id]`;
 * - `--profile`/`--release` turn the debugger off, so `flutterMode` is passed through with a note;
 * - Dart attaches by VM-service URI or service-info file only; a PID cannot be translated;
 * - a `ws://host:port/ws` URI only works for a VM started with `--disable-service-auth-codes`;
 * - the test adapters refuse attach.
 */
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import which from 'which';
import type { DebugProtocol } from '@vscode/debugprotocol';
import {
  AdapterError,
  AdapterErrorCode,
  AdapterState,
  DebugFeature,
  DebugLanguage,
} from '@debugmcp/shared';
import type {
  AdapterCapabilities,
  AdapterCommand,
  AdapterConfig,
  AdapterDependencies,
  DependencyInfo,
  FeatureRequirement,
  GenericAttachConfig,
  GenericLaunchConfig,
  IDebugAdapter,
  LanguageSpecificAttachConfig,
  LanguageSpecificLaunchConfig,
  LaunchConfigDiagnostic,
  ValidationError,
  ValidationResult,
  ValidationWarning,
} from '@debugmcp/shared';
import { detectRunner, isDartRunner, type DartRunner, type RunnerDetection } from './runner.js';
import { locateToolchain, type DartToolchain } from './utils/sdk-locator.js';
import { dapCommandFor } from './utils/flutter-invocation.js';
import { resolveBridgePath } from './utils/bridge-path.js';

/** Seams for tests: the machine-facing lookups and the process this adapter runs in. */
export interface DartAdapterHooks {
  platform?: NodeJS.Platform;
  nodeExe?: string;
  bridgePath?: string;
  locate?: (projectRoot?: string) => DartToolchain;
}

/** Launch keys the SDK adapters read, forwarded as-is. */
const FORWARDED_LAUNCH_KEYS = [
  'toolArgs', 'vmAdditionalArgs', 'vmServicePort', 'debugSdkLibraries', 'debugExternalPackageLibraries',
  'evaluateGettersInDebugViews', 'evaluateToStringInDebugViews', 'showGettersInDebugViews', 'additionalProjectPaths',
  'customTool', 'customToolReplacesArgs', 'sendLogsToClient', 'sendCustomProgressEvents', 'allowAnsiColorOutput', 'noDebug',
] as const;

const FLUTTER_ONLY_KEYS = ['deviceId', 'flutterMode'] as const;
const FLUTTER_MODES = new Set(['debug', 'profile', 'release']);

export class DartDebugAdapter extends EventEmitter implements IDebugAdapter {
  readonly language = DebugLanguage.DART;
  readonly name = 'Dart/Flutter Debug Adapter (SDK DAP)';

  readonly supportedLaunchKeys = ['program', 'args', 'cwd', 'env', 'stopOnEntry', 'runner', ...FLUTTER_ONLY_KEYS, ...FORWARDED_LAUNCH_KEYS] as const;
  readonly consumedLaunchKeys = ['runner', ...FLUTTER_ONLY_KEYS] as const;
  readonly supportedAttachKeys = [
    'vmServiceUri', 'vmServiceInfoFile', 'cwd', 'host', 'port', 'runner', 'deviceId', 'toolArgs',
    'debugSdkLibraries', 'debugExternalPackageLibraries', 'evaluateGettersInDebugViews', 'evaluateToStringInDebugViews',
    'showGettersInDebugViews', 'additionalProjectPaths', 'sendLogsToClient',
  ] as const;
  readonly consumedAttachKeys = ['host', 'port', 'runner', 'deviceId'] as const;

  /** The runner the last launch/attach transform chose; `buildAdapterCommand` spawns for it. */
  lastRunner?: RunnerDetection;

  private state: AdapterState = AdapterState.UNINITIALIZED;
  private currentThreadId: number | null = null;
  private connected = false;
  private lastToolchain?: DartToolchain;
  private diagnostics: LaunchConfigDiagnostic[] = [];
  private readonly hooks: Required<Pick<DartAdapterHooks, 'platform' | 'nodeExe' | 'locate'>> & Pick<DartAdapterHooks, 'bridgePath'>;

  constructor(private readonly dependencies: AdapterDependencies, hooks: DartAdapterHooks = {}) {
    super();
    this.hooks = {
      platform: hooks.platform ?? process.platform,
      nodeExe: hooks.nodeExe ?? process.execPath,
      bridgePath: hooks.bridgePath,
      locate: hooks.locate ?? ((projectRoot) => this.locateWithRealIo(projectRoot)),
    };
  }

  // ===== Lifecycle =====

  async initialize(): Promise<void> {
    this.transitionTo(AdapterState.INITIALIZING);
    const validation = await this.validateEnvironment();
    if (!validation.valid) {
      this.transitionTo(AdapterState.ERROR);
      throw new AdapterError(validation.errors[0]?.message ?? 'Dart environment validation failed', AdapterErrorCode.ENVIRONMENT_INVALID);
    }
    this.transitionTo(AdapterState.READY);
    this.emit('initialized');
  }

  async dispose(): Promise<void> {
    this.currentThreadId = null;
    this.connected = false;
    this.lastToolchain = undefined;
    this.lastRunner = undefined;
    this.state = AdapterState.UNINITIALIZED;
    this.emit('disposed');
  }

  getState(): AdapterState { return this.state; }
  isReady(): boolean { return this.state === AdapterState.READY || this.state === AdapterState.CONNECTED || this.state === AdapterState.DEBUGGING; }
  getCurrentThreadId(): number | null { return this.currentThreadId; }

  private transitionTo(next: AdapterState): void {
    const prev = this.state;
    this.state = next;
    this.emit('stateChanged', prev, next);
  }

  // ===== Environment =====

  async validateEnvironment(_executablePath?: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const tc = this.toolchain();
    for (const w of tc.warnings) warnings.push({ code: 'DART_SDK_ENV', message: w });
    if (!tc.dartExe) {
      errors.push({
        code: 'DART_SDK_NOT_FOUND',
        message: 'No Dart SDK found. Install Dart (https://dart.dev/get-dart) or Flutter (https://docs.flutter.dev/get-started), put `dart`/`flutter` on PATH, or set DART_SDK / FLUTTER_ROOT.',
        recoverable: false,
      });
    }
    return { valid: errors.length === 0, errors, warnings };
  }

  getRequiredDependencies(): DependencyInfo[] {
    return [
      { name: 'Dart SDK', version: '3.0+', required: true, installCommand: 'https://dart.dev/get-dart (or set DART_SDK)' },
      { name: 'Flutter SDK', version: '3.0+', required: false, installCommand: 'https://docs.flutter.dev/get-started (or set FLUTTER_ROOT)' },
    ];
  }

  async resolveExecutablePath(preferredPath?: string): Promise<string> {
    if (preferredPath) return preferredPath;
    const dart = this.toolchain().dartExe;
    if (!dart) throw new AdapterError(this.getMissingExecutableError(), AdapterErrorCode.ENVIRONMENT_INVALID);
    return dart;
  }

  getDefaultExecutableName(): string { return 'dart'; }

  getExecutableSearchPaths(): string[] {
    const tc = this.toolchain();
    return [tc.dartSdkRoot, tc.flutterRoot].filter((p): p is string => !!p);
  }

  // ===== Adapter command =====

  buildAdapterCommand(config: AdapterConfig): AdapterCommand {
    const launch = config.launchConfig as Record<string, unknown>;
    const detection = this.lastRunner ?? detectRunner({ program: typeof launch.program === 'string' ? launch.program : undefined, cwd: typeof launch.cwd === 'string' ? launch.cwd : undefined, explicit: launch.runner });
    const tc = this.lastToolchain ?? this.toolchain(detection.projectRoot);
    const dap = dapCommandFor(detection.runner, {
      platform: this.hooks.platform,
      dartExe: tc.dartExe,
      flutterRoot: tc.flutterRoot,
      flutterToolArgs: this.dependencies.environment.get('FLUTTER_TOOL_ARGS'),
    });
    const bridge = this.hooks.bridgePath ?? resolveBridgePath(path.dirname(fileURLToPath(import.meta.url)), process.cwd(), (p) => fs.existsSync(p));
    const cwd = typeof launch.cwd === 'string' ? launch.cwd : undefined;
    const args = [bridge, '--port', String(config.adapterPort), '--host', config.adapterHost, ...(cwd ? ['--cwd', cwd] : []), '--', dap.command, ...dap.args];
    const inherited = this.dependencies.environment.getAll() as Record<string, string | undefined>;
    const env: Record<string, string> = { ...(inherited as Record<string, string>), ...dap.env };
    // The SDK adapter writes the VM's service-info file under the system temp dir and watches
    // for it. The container image bind-mounts /tmp from the host for its logs, and a host bind
    // mount under Docker Desktop delivers no inotify events (measured: the launch answered and
    // then nothing ever arrived). A container-local temp dir restores the handshake.
    if (this.hooks.platform !== 'win32' && inherited.MCP_CONTAINER === 'true' && !inherited.TMPDIR) {
      env.TMPDIR = '/var/tmp';
    }
    this.dependencies.logger?.info?.(`[DartDebugAdapter] ${detection.runner} via ${dap.command} ${dap.args.join(' ')} behind the stdio bridge on ${config.adapterHost}:${config.adapterPort}`);
    return { command: this.hooks.nodeExe, args, env };
  }

  getAdapterModuleName(): string { return 'dart debug_adapter'; }
  getAdapterInstallCommand(): string { return 'Install the Dart SDK (https://dart.dev/get-dart); the debug adapter ships with it'; }

  // ===== Launch =====

  async transformLaunchConfig(config: GenericLaunchConfig): Promise<LanguageSpecificLaunchConfig> {
    this.diagnostics = [];
    const input = config as Record<string, unknown>;
    const detection = detectRunner({ program: config.program, cwd: config.cwd, explicit: input.runner });
    const tc = this.toolchain(detection.projectRoot ?? config.cwd);
    // Fail here, with the SDK hint, rather than at spawn time.
    dapCommandFor(detection.runner, { platform: this.hooks.platform, dartExe: tc.dartExe, flutterRoot: tc.flutterRoot });
    this.lastRunner = detection;
    this.lastToolchain = tc;
    this.note('runner', `runner: ${detection.runner} (${detection.reason})`, 'launch');

    const { runner: _runner, deviceId, flutterMode, console: _console, ...rest } = input;
    const out: Record<string, unknown> = { ...rest, request: 'launch' };
    if (out.evaluateToStringInDebugViews === undefined) out.evaluateToStringInDebugViews = true;

    if (isFlutter(detection.runner)) {
      const toolArgs: string[] = [];
      if (typeof deviceId === 'string' && deviceId) toolArgs.push('-d', deviceId);
      else if (deviceId !== undefined) this.note('deviceId', 'ignored: expected a device id string (see `flutter devices`)');
      if (typeof flutterMode === 'string' && flutterMode !== 'debug') {
        if (FLUTTER_MODES.has(flutterMode)) {
          toolArgs.push(`--${flutterMode}`);
          this.note('flutterMode', `running in ${flutterMode} mode: the Flutter tool turns the debugger off, so breakpoints and variables are unavailable`);
        } else {
          this.note('flutterMode', 'ignored: expected debug, profile or release');
        }
      }
      const existing = Array.isArray(out.toolArgs) ? (out.toolArgs as unknown[]).map(String) : [];
      if (toolArgs.length || existing.length) out.toolArgs = [...toolArgs, ...existing];
      if (out.vmAdditionalArgs !== undefined) this.note('vmAdditionalArgs', 'forwarded, but the Flutter adapter does not read it; use toolArgs for `flutter run` options');
    } else {
      for (const key of FLUTTER_ONLY_KEYS) {
        if (input[key] !== undefined) this.note(key, `ignored: only Flutter runners use ${key} (this launch uses ${detection.runner})`);
      }
      const vmArgs = Array.isArray(out.vmAdditionalArgs) ? (out.vmAdditionalArgs as unknown[]).map(String) : [];
      if (!vmArgs.some((a) => /pause[_-]isolates[_-]on[_-]exit/.test(a))) vmArgs.push('--pause_isolates_on_exit=false');
      out.vmAdditionalArgs = vmArgs;
    }
    return out as LanguageSpecificLaunchConfig;
  }

  getDefaultLaunchConfig(): Partial<GenericLaunchConfig> {
    return { stopOnEntry: false, justMyCode: true };
  }

  consumeLaunchConfigDiagnostics(): readonly LaunchConfigDiagnostic[] {
    const out = this.diagnostics;
    this.diagnostics = [];
    return out;
  }

  // ===== Attach =====

  supportsAttach(): boolean { return true; }
  supportsDetach(): boolean { return true; }

  async transformAttachConfig(config: GenericAttachConfig): Promise<LanguageSpecificAttachConfig> {
    this.diagnostics = [];
    const input = config as Record<string, unknown>;
    const {
      request: _request, __attachMode: _mode, identifierType: _idType, processId, processName, host, port, timeout: _timeout,
      sourcePaths: _sourcePaths, justMyCode: _jmc, stopOnEntry: _soe, runner, deviceId, ...rest
    } = input;

    if (processId !== undefined || processName !== undefined) {
      throw new AdapterError(
        'Dart attaches by VM-service URI, not by process id. Pass adapterConfig.vmServiceUri (from `dart --enable-vm-service … run`, '
        + 'the `app.debugPort` event of `flutter run --machine`, or this server\'s dart.debuggerUris answer) or adapterConfig.vmServiceInfoFile '
        + '(the file written by `--write-service-info`).',
        AdapterErrorCode.ENVIRONMENT_INVALID,
      );
    }
    if (runner !== undefined && !isDartRunner(runner)) {
      throw new AdapterError(`Unknown Dart runner ${JSON.stringify(runner)}`, AdapterErrorCode.ENVIRONMENT_INVALID);
    }
    const cwd = typeof rest.cwd === 'string' ? rest.cwd : undefined;
    const detection = detectRunner({ cwd, explicit: runner });
    if (detection.runner.endsWith('-test')) {
      throw new AdapterError(`The ${detection.runner} runner does not support attach: the SDK test adapters only launch`, AdapterErrorCode.ENVIRONMENT_INVALID);
    }
    this.lastRunner = detection;
    this.lastToolchain = this.toolchain(detection.projectRoot ?? cwd);

    // `request: 'attach'` stays: the proxy worker reads it off the transformed config to pick
    // the attach handshake and detach-on-close semantics; the SDK adapter ignores the key.
    const out: Record<string, unknown> = { ...rest, request: 'attach' };
    if (out.vmServiceUri === undefined && out.vmServiceInfoFile === undefined && host !== undefined && port !== undefined) {
      out.vmServiceUri = `ws://${String(host)}:${String(port)}/ws`;
      this.note('port', `attaching to ws://${String(host)}:${String(port)}/ws — a host:port only works for a VM started with --disable-service-auth-codes; otherwise pass the full vmServiceUri with its token`);
    }
    if (isFlutter(detection.runner) && typeof deviceId === 'string' && deviceId) {
      const existing = Array.isArray(out.toolArgs) ? (out.toolArgs as unknown[]).map(String) : [];
      out.toolArgs = ['-d', deviceId, ...existing];
    } else if (deviceId !== undefined) {
      this.note('deviceId', `ignored: only Flutter runners use deviceId (this attach uses ${detection.runner})`);
    }
    return out;
  }

  getDefaultAttachConfig(): Partial<GenericAttachConfig> {
    return { timeout: 30000 };
  }

  // ===== DAP plumbing (the proxy does the actual communication) =====

  async sendDapRequest<T extends DebugProtocol.Response>(_command: string, _args?: unknown): Promise<T> {
    return {} as T;
  }

  handleDapEvent(event: DebugProtocol.Event): void {
    if (event.event === 'stopped' && typeof event.body?.threadId === 'number') this.currentThreadId = event.body.threadId;
    this.emit(event.event, event.body);
  }

  handleDapResponse(_response: DebugProtocol.Response): void { /* nothing adapter-specific */ }

  async connect(host: string, port: number): Promise<void> {
    this.dependencies.logger?.debug?.(`[DartDebugAdapter] connect ${host}:${port}`);
    this.connected = true;
    this.transitionTo(AdapterState.CONNECTED);
    this.emit('connected');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.currentThreadId = null;
    this.transitionTo(AdapterState.DISCONNECTED);
    this.emit('disconnected');
  }

  isConnected(): boolean { return this.connected; }

  // ===== Errors =====

  getInstallationInstructions(): string {
    return `Dart/Flutter debugging uses the debug adapter that ships with the SDK:

1. Install the Dart SDK (https://dart.dev/get-dart) or the Flutter SDK (https://docs.flutter.dev/get-started/install),
   which bundles Dart.
2. Put \`dart\` (and \`flutter\`) on PATH, or set DART_SDK / FLUTTER_ROOT to the install directory.
3. For Flutter, run \`flutter doctor\` once so the tool cache is built.`;
  }

  getMissingExecutableError(): string {
    return 'Dart SDK not found. Install Dart or Flutter and put `dart` on PATH, or set DART_SDK / FLUTTER_ROOT.';
  }

  translateErrorMessage(error: Error): string {
    const m = error.message;
    if (/no dart sdk|dart sdk not found/i.test(m)) return this.getMissingExecutableError();
    if (/flutter_root/i.test(m)) return `${m} (run \`flutter --version\` once after installing so the tool cache is built)`;
    if (/session terminated before debugger initialized/i.test(m)) return `${m} — the program or test file failed to compile or start; the compiler diagnostics are in the captured output`;
    return m;
  }

  // ===== Features =====

  supportsFeature(feature: DebugFeature): boolean {
    return [
      DebugFeature.CONDITIONAL_BREAKPOINTS, DebugFeature.EXCEPTION_BREAKPOINTS, DebugFeature.LOG_POINTS,
      DebugFeature.EVALUATE_FOR_HOVERS, DebugFeature.TERMINATE_REQUEST, DebugFeature.DELAYED_STACK_TRACE_LOADING,
    ].includes(feature);
  }

  getFeatureRequirements(_feature: DebugFeature): FeatureRequirement[] { return []; }

  getCapabilities(): AdapterCapabilities {
    return {
      supportsConfigurationDoneRequest: true,
      supportsConditionalBreakpoints: true,
      supportsHitConditionalBreakpoints: false,
      supportsFunctionBreakpoints: false,
      supportsLogPoints: true,
      supportsEvaluateForHovers: true,
      supportsValueFormattingOptions: true,
      supportsDelayedStackTraceLoading: true,
      supportsRestartFrame: true,
      supportsRestartRequest: false,
      supportsTerminateRequest: true,
      supportsExceptionInfoRequest: false,
      supportsSetVariable: false,
      supportsCompletionsRequest: false,
      supportsClipboardContext: true,
      supportTerminateDebuggee: false,
      exceptionBreakpointFilters: [
        { filter: 'All', label: 'All Exceptions', default: false },
        { filter: 'Unhandled', label: 'Uncaught Exceptions', default: true },
      ],
    };
  }

  // ===== Internals =====

  private note(key: string, message: string, scope?: 'launch'): void {
    this.diagnostics.push(scope ? { key, message, scope } : { key, message });
  }

  private toolchain(projectRoot?: string): DartToolchain {
    return this.hooks.locate(projectRoot);
  }

  private locateWithRealIo(projectRoot?: string): DartToolchain {
    const env = this.dependencies.environment.getAll() as Record<string, string | undefined>;
    return locateToolchain({
      platform: this.hooks.platform,
      env,
      homeDir: os.homedir(),
      exists: (p) => this.dependencies.fileSystem.existsSync(p),
      realpath: (p) => { try { return fs.realpathSync(p); } catch { return p; } },
      which: (name) => which.sync(name, { nothrow: true }) ?? undefined,
      readFile: (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return undefined; } },
      projectRoot,
    });
  }
}

function isFlutter(runner: DartRunner): boolean {
  return runner === 'flutter' || runner === 'flutter-test';
}

/**
 * .NET Debug Adapter implementation
 *
 * Provides .NET/C#-specific debugging functionality using vsdbg (or netcoredbg).
 * Encapsulates all .NET-specific logic including executable discovery,
 * environment validation, and vsdbg integration.
 *
 * ## DAP Handshake Order: `sendAttachBeforeInitialized`
 *
 * Most DAP adapters (debugpy, js-debug, CodeLLDB, Delve) follow this sequence:
 *   initialize -> response -> initialized event -> attach/launch -> configurationDone
 *
 * vsdbg follows a different sequence for attach mode:
 *   initialize -> response -> attach -> initialized event -> configurationDone
 *
 * vsdbg does NOT send the `initialized` event until AFTER it processes the
 * `attach` request. Waiting for `initialized` before sending `attach` is a
 * deadlock. The `sendAttachBeforeInitialized` flag in DotnetAdapterPolicy
 * tells the proxy worker to use this reversed sequence.
 *
 * ## vsdbg Handshake (vsda)
 *
 * vsdbg implements a proprietary authentication handshake: it sends a
 * `handshake` reverse request containing a challenge value, and expects
 * the host to sign it using vsda.node (a native module bundled with the
 * VS Code C# extension). Without a valid signature, vsdbg refuses to
 * proceed. The vsdbg-bridge handles this signing automatically.
 *
 * ## Critical Safety: terminateDebuggee
 *
 * When attaching to a process, terminateDebuggee is always set to false on
 * disconnect. The proxy worker's handleTerminate() auto-detaches with
 * terminateDebuggee=false for attach-mode sessions, so even if
 * close_debug_session is called without an explicit detach_from_process,
 * the target process survives.
 *
 * @since 0.1.0
 */
import { EventEmitter } from 'events';
import { DebugProtocol } from '@vscode/debugprotocol';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  IDebugAdapter,
  AdapterState,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  DependencyInfo,
  AdapterCommand,
  AdapterConfig,
  GenericLaunchConfig,
  LanguageSpecificLaunchConfig,
  DebugFeature,
  FeatureRequirement,
  AdapterCapabilities,
  AdapterError,
  AdapterErrorCode,
  AdapterEvents,
  GenericAttachConfig,
  LanguageSpecificAttachConfig
} from '@debugmcp/shared';
import { DebugLanguage } from '@debugmcp/shared';
import { AdapterDependencies } from '@debugmcp/shared';
import { findDotnetBackend, findVsdaNode } from './utils/dotnet-utils.js';

/**
 * Cache entry for debugger executable paths
 */
interface DebuggerPathCacheEntry {
  path: string;
  timestamp: number;
  backend?: 'vsdbg' | 'netcoredbg';
}

/**
 * .NET-specific launch configuration
 */
interface DotnetLaunchConfig extends LanguageSpecificLaunchConfig {
  type: string;
  request: string;
  program?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  justMyCode?: boolean;
  stopOnEntry?: boolean;
  console?: 'internalConsole' | 'integratedTerminal' | 'externalTerminal';
  sourceFileMap?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * .NET Debug Adapter implementation
 */
export class DotnetDebugAdapter extends EventEmitter implements IDebugAdapter {
  readonly language = DebugLanguage.DOTNET;
  readonly name = '.NET Debug Adapter';

  private state: AdapterState = AdapterState.UNINITIALIZED;
  private dependencies: AdapterDependencies;

  // Caching
  private debuggerPathCache = new Map<string, DebuggerPathCacheEntry>();
  private readonly cacheTimeout = 60000; // 1 minute

  // State
  private currentThreadId: number | null = null;
  private connected = false;

  constructor(dependencies: AdapterDependencies) {
    super();
    this.dependencies = dependencies;
  }

  // ===== Lifecycle Management =====

  async initialize(): Promise<void> {
    this.transitionTo(AdapterState.INITIALIZING);

    try {
      const validation = await this.validateEnvironment();
      if (!validation.valid) {
        this.transitionTo(AdapterState.ERROR);
        throw new AdapterError(
          validation.errors[0]?.message || '.NET environment validation failed',
          AdapterErrorCode.ENVIRONMENT_INVALID
        );
      }

      this.transitionTo(AdapterState.READY);
      this.emit('initialized');
    } catch (error) {
      this.transitionTo(AdapterState.ERROR);
      throw error;
    }
  }

  async dispose(): Promise<void> {
    this.debuggerPathCache.clear();
    this.currentThreadId = null;
    this.connected = false;
    this.state = AdapterState.UNINITIALIZED;
    this.emit('disposed');
  }

  // ===== State Management =====

  getState(): AdapterState {
    return this.state;
  }

  isReady(): boolean {
    return this.state === AdapterState.READY ||
           this.state === AdapterState.CONNECTED ||
           this.state === AdapterState.DEBUGGING;
  }

  getCurrentThreadId(): number | null {
    return this.currentThreadId;
  }

  private transitionTo(newState: AdapterState): void {
    const oldState = this.state;
    this.state = newState;
    this.emit('stateChanged', oldState, newState);
  }

  // ===== Environment Validation =====

  async validateEnvironment(): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Check for a .NET debugger
      const backend = await findDotnetBackend(this.dependencies.logger as { error: (msg: string) => void; debug?: (msg: string) => void } | undefined);
      this.dependencies.logger?.debug?.(`[DotnetDebugAdapter] Found backend: ${backend.backend} at ${backend.path}`);

      if (backend.backend === 'netcoredbg') {
        warnings.push({
          code: 'USING_NETCOREDBG',
          message: 'Using netcoredbg. Note: .NET Framework 4.8 (NinjaTrader) requires vsdbg. Install the C# extension in VS Code for vsdbg support.'
        });
      }
    } catch (error) {
      errors.push({
        code: 'DEBUGGER_NOT_FOUND',
        message: error instanceof Error ? error.message : '.NET debugger not found',
        recoverable: false
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  getRequiredDependencies(): DependencyInfo[] {
    return [
      {
        name: 'vsdbg',
        version: 'latest',
        required: true,
        installCommand: 'Install the C# extension in VS Code'
      },
      {
        name: '.NET Framework / .NET Runtime',
        version: '4.8+',
        required: false,
        installCommand: 'Download from https://dotnet.microsoft.com'
      }
    ];
  }

  // ===== Executable Management =====

  async resolveExecutablePath(preferredPath?: string): Promise<string> {
    const cacheKey = preferredPath || 'default';
    const cached = this.debuggerPathCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      this.dependencies.logger?.debug?.(`[DotnetDebugAdapter] Using cached debugger path: ${cached.path}`);
      return cached.path;
    }

    const result = await findDotnetBackend(
      this.dependencies.logger as { error: (msg: string) => void; debug?: (msg: string) => void } | undefined
    );

    this.debuggerPathCache.set(cacheKey, {
      path: result.path,
      timestamp: Date.now(),
      backend: result.backend
    });

    return result.path;
  }

  getDefaultExecutableName(): string {
    return 'vsdbg';
  }

  getExecutableSearchPaths(): string[] {
    const paths: string[] = [];
    const home = process.env.HOME || process.env.USERPROFILE || '';

    if (process.platform === 'win32') {
      paths.push(
        path.join(home, '.vscode', 'extensions'),
        path.join(home, '.vscode-insiders', 'extensions')
      );
    } else if (process.platform === 'darwin') {
      paths.push(
        path.join(home, '.vscode', 'extensions'),
        '/usr/local/bin',
        '/opt/homebrew/bin'
      );
    } else {
      paths.push(
        path.join(home, '.vscode', 'extensions'),
        '/usr/local/bin',
        '/usr/bin'
      );
    }

    if (process.env.PATH) {
      paths.push(...process.env.PATH.split(path.delimiter));
    }

    return paths;
  }

  // ===== Adapter Configuration =====

  buildAdapterCommand(config: AdapterConfig): AdapterCommand {
    // Resolve the bridge script path relative to this package's dist directory
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const bridgePath = path.join(__dirname, 'utils', 'vsdbg-bridge.js');

    const args = [
      bridgePath,
      '--vsdbg', config.executablePath,
      '--host', config.adapterHost,
      '--port', config.adapterPort.toString()
    ];

    // vsda.node for handshake signing
    const vsdaPath = findVsdaNode(
      this.dependencies.logger as { error: (msg: string) => void; debug?: (msg: string) => void } | undefined
    );
    if (vsdaPath) {
      args.push('--vsda', vsdaPath);
    }

    return {
      command: 'node',
      args,
      env: {
        ...process.env as Record<string, string>
      }
    };
  }

  getAdapterModuleName(): string {
    return 'vsdbg';
  }

  getAdapterInstallCommand(): string {
    return 'Install the C# extension in VS Code (ms-dotnettools.csharp)';
  }

  // ===== Debug Configuration =====

  async transformLaunchConfig(config: GenericLaunchConfig): Promise<LanguageSpecificLaunchConfig> {
    const dotnetConfig: DotnetLaunchConfig = {
      ...config,
      type: 'coreclr',
      request: 'launch',
      name: '.NET: Launch',
      console: 'internalConsole',
      justMyCode: config.justMyCode ?? true,
      stopOnEntry: config.stopOnEntry ?? true
    };

    return dotnetConfig;
  }

  getDefaultLaunchConfig(): Partial<GenericLaunchConfig> {
    return {
      stopOnEntry: true,
      justMyCode: true,
      env: {},
      cwd: process.cwd()
    };
  }

  // ===== Attach Support =====

  supportsAttach(): boolean {
    return true;
  }

  supportsDetach(): boolean {
    return true;
  }

  transformAttachConfig(config: GenericAttachConfig): LanguageSpecificAttachConfig {
    console.error(`[DotnetDebugAdapter] transformAttachConfig called, sourcePaths=${JSON.stringify(config.sourcePaths || null)}`);

    const attachConfig = {
      type: 'coreclr',
      request: 'attach',
      name: '.NET: Attach',
      processId: config.processId ? Number(config.processId) : undefined,
      justMyCode: config.justMyCode ?? true,
      // CRITICAL: Never terminate the debuggee on detach
      terminateDebuggee: false,
      sourceFileMap: config.sourcePaths ? Object.fromEntries(
        config.sourcePaths.map(p => [p, p])
      ) : undefined
    };

    console.error(`[DotnetDebugAdapter] Returning attach config: type=${attachConfig.type}`);
    return attachConfig;
  }

  getDefaultAttachConfig(): Partial<GenericAttachConfig> {
    return {
      stopOnEntry: false,
      justMyCode: true
    };
  }

  // ===== DAP Protocol Operations =====

  async sendDapRequest<T extends DebugProtocol.Response>(
    command: string,
    args?: unknown
  ): Promise<T> {
    // Validate .NET-specific exception filters
    if (command === 'setExceptionBreakpoints' && args) {
      const exceptionArgs = args as DebugProtocol.SetExceptionBreakpointsArguments;
      const validFilters = ['all', 'user-unhandled'];
      const invalidFilters = exceptionArgs.filters?.filter(f => !validFilters.includes(f));
      if (invalidFilters?.length) {
        throw new AdapterError(
          `Invalid .NET exception filters: ${invalidFilters.join(', ')}. Valid filters: ${validFilters.join(', ')}`,
          AdapterErrorCode.INVALID_RESPONSE
        );
      }
    }

    // ProxyManager handles actual communication
    return {} as T;
  }

  handleDapEvent(event: DebugProtocol.Event): void {
    if (event.event === 'stopped' && event.body?.threadId) {
      this.currentThreadId = event.body.threadId;
    }

    type AdapterEventName = Extract<keyof AdapterEvents, string | symbol>;
    this.emit(event.event as AdapterEventName, event.body);
  }

  handleDapResponse(_response: DebugProtocol.Response): void {
    // .NET adapter doesn't need special response handling
  }

  // ===== Connection Management =====

  async connect(host: string, port: number): Promise<void> {
    this.dependencies.logger?.debug?.(`[DotnetDebugAdapter] Connect request to ${host}:${port}`);

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

  isConnected(): boolean {
    return this.connected;
  }

  // ===== Error Handling =====

  getInstallationInstructions(): string {
    return `.NET Debugging Setup:

1. Install the C# extension in VS Code:
   - Open VS Code
   - Go to Extensions (Ctrl+Shift+X)
   - Search for "C#" by Microsoft
   - Install "C# Dev Kit" or "C#" extension

2. Verify vsdbg is available:
   The C# extension bundles vsdbg automatically.
   Default location: ~/.vscode/extensions/ms-dotnettools.csharp-*/.debugger/

3. For NinjaTrader debugging:
   - NinjaTrader uses .NET Framework 4.8
   - vsdbg (not netcoredbg) is required for Framework support
   - Attach to NinjaTrader.exe by PID

4. Alternative (for .NET Core/.NET 5+ only):
   Install netcoredbg from https://github.com/Samsung/netcoredbg`;
  }

  getMissingExecutableError(): string {
    return `vsdbg not found. The C# extension for VS Code must be installed.

Install the C# extension:
  1. Open VS Code
  2. Install "C#" or "C# Dev Kit" extension
  3. vsdbg will be installed automatically

Or set the VSDBG_PATH environment variable to the vsdbg executable path.

For netcoredbg (.NET Core only): set NETCOREDBG_PATH or install globally.`;
  }

  translateErrorMessage(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes('vsdbg') && message.includes('not found')) {
      return this.getMissingExecutableError();
    }

    if (message.includes('attach') && message.includes('denied')) {
      return 'Permission denied attaching to process. Try running as Administrator.';
    }

    if (message.includes('process') && message.includes('not found')) {
      return 'Target process not found. Verify the process is running and the PID is correct.';
    }

    if (message.includes('symbol') && message.includes('load')) {
      return 'Failed to load debug symbols. Ensure PDB files are available next to the assembly.';
    }

    if (message.includes('connection') && message.includes('refused')) {
      return 'Connection to debug adapter refused. The vsdbg bridge may have failed to start.';
    }

    return error.message;
  }

  // ===== Feature Support =====

  supportsFeature(feature: DebugFeature): boolean {
    const supportedFeatures = [
      DebugFeature.CONDITIONAL_BREAKPOINTS,
      DebugFeature.FUNCTION_BREAKPOINTS,
      DebugFeature.EXCEPTION_BREAKPOINTS,
      DebugFeature.EVALUATE_FOR_HOVERS,
      DebugFeature.SET_VARIABLE,
      DebugFeature.TERMINATE_REQUEST,
      DebugFeature.EXCEPTION_OPTIONS,
      DebugFeature.EXCEPTION_INFO_REQUEST,
      DebugFeature.LOADED_SOURCES_REQUEST,
      DebugFeature.STEP_IN_TARGETS_REQUEST,
    ];

    return supportedFeatures.includes(feature);
  }

  getFeatureRequirements(feature: DebugFeature): FeatureRequirement[] {
    const requirements: FeatureRequirement[] = [];

    switch (feature) {
      case DebugFeature.CONDITIONAL_BREAKPOINTS:
        requirements.push({
          type: 'dependency',
          description: 'vsdbg with C# extension',
          required: true
        });
        break;

      case DebugFeature.EXCEPTION_INFO_REQUEST:
        requirements.push({
          type: 'dependency',
          description: 'vsdbg with PDB symbols',
          required: true
        });
        break;
    }

    return requirements;
  }

  getCapabilities(): AdapterCapabilities {
    return {
      supportsConfigurationDoneRequest: true,
      supportsFunctionBreakpoints: true,
      supportsConditionalBreakpoints: true,
      supportsHitConditionalBreakpoints: true,
      supportsEvaluateForHovers: true,
      exceptionBreakpointFilters: [
        {
          filter: 'all',
          label: 'All Exceptions',
          description: 'Break on all thrown exceptions',
          default: false,
          supportsCondition: false
        },
        {
          filter: 'user-unhandled',
          label: 'User-Unhandled Exceptions',
          description: 'Break on exceptions not handled by user code',
          default: true,
          supportsCondition: false
        }
      ],
      supportsStepBack: false,
      supportsSetVariable: true,
      supportsRestartFrame: false,
      supportsGotoTargetsRequest: false,
      supportsStepInTargetsRequest: true,
      supportsCompletionsRequest: false,
      supportsModulesRequest: true,
      supportsRestartRequest: false,
      supportsExceptionOptions: true,
      supportsValueFormattingOptions: true,
      supportsExceptionInfoRequest: true,
      supportTerminateDebuggee: false, // Safety: never allow terminate through DAP
      supportSuspendDebuggee: false,
      supportsDelayedStackTraceLoading: true,
      supportsLoadedSourcesRequest: true,
      supportsLogPoints: false,
      supportsTerminateThreadsRequest: false,
      supportsSetExpression: false,
      supportsTerminateRequest: true,
      supportsDataBreakpoints: false,
      supportsReadMemoryRequest: false,
      supportsWriteMemoryRequest: false,
      supportsDisassembleRequest: true,
      supportsCancelRequest: false,
      supportsBreakpointLocationsRequest: true,
      supportsClipboardContext: false,
      supportsSteppingGranularity: false,
      supportsInstructionBreakpoints: false,
      supportsExceptionFilterOptions: false,
      supportsSingleThreadExecutionRequests: false
    };
  }
}

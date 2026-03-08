/**
 * .NET Debug Adapter implementation
 *
 * Provides .NET/C#-specific debugging functionality using netcoredbg.
 * Encapsulates all .NET-specific logic including executable discovery,
 * environment validation, and netcoredbg integration.
 *
 * ## .NET Runtime Landscape
 *
 * There are two fundamentally different .NET runtimes:
 *
 * - **.NET Core / .NET 5+** (modern, cross-platform): Uses the `coreclr` runtime.
 *   Produces **Portable PDB** debug symbols by default. netcoredbg works out of the box.
 *
 * - **.NET Framework 4.x** (Windows-only, legacy but widely deployed): Uses the
 *   `clr` (Desktop CLR) runtime. Produces **Windows PDB** debug symbols by default.
 *   Our modified netcoredbg (forked from Samsung/netcoredbg) adds Desktop CLR support
 *   via ICorDebug COM interfaces, enabling both attach and launch debugging.
 *
 * ## PDB Format Requirement
 *
 * netcoredbg's ManagedPart.dll only reads **Portable PDB** format for symbol loading.
 * .NET Framework compilers (csc.exe) produce Windows PDBs by default. Applications
 * must be compiled with `/debug:portable` (Roslyn csc) for symbols to load.
 *
 * For apps with Windows PDBs (e.g., NinjaTrader), **Pdb2Pdb.exe** converts them
 * to Portable PDB format. We bundle it in `packages/adapter-dotnet/tools/pdb2pdb/`.
 *
 * ## netcoredbg Communication
 *
 * netcoredbg supports DAP over TCP via `--server=PORT --interpreter=vscode`, but the
 * server mode has a connection bug on Windows. We use a lightweight TCP-to-stdio bridge
 * (`netcoredbg-bridge.ts`) that spawns netcoredbg in stdio mode and forwards DAP messages
 * over a TCP socket that the proxy connects to.
 *
 * ## Safety: terminateDebuggee
 *
 * When attaching to a process (especially long-running ones like NinjaTrader),
 * terminateDebuggee is always set to false on disconnect. The proxy worker's
 * handleTerminate() auto-detaches with terminateDebuggee=false for attach-mode
 * sessions.
 *
 * @since 0.2.0
 */
import { EventEmitter } from 'events';
import { DebugProtocol } from '@vscode/debugprotocol';
import * as path from 'path';
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
import { findNetcoredbgExecutable, findPdb2PdbExecutable, convertPdbsToTemp, getProcessExecutableDir, getProcessArchitecture } from './utils/dotnet-utils.js';

/**
 * Cache entry for debugger executable paths
 */
interface DebuggerPathCacheEntry {
  path: string;
  timestamp: number;
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
  symbolOptions?: {
    searchPaths?: string[];
    searchMicrosoftSymbolServer?: boolean;
  };
  [key: string]: unknown;
}

/**
 * .NET Debug Adapter implementation
 */
export class DotnetDebugAdapter extends EventEmitter implements IDebugAdapter {
  readonly language = DebugLanguage.DOTNET;
  readonly name = '.NET Debug Adapter (netcoredbg)';

  private state: AdapterState = AdapterState.UNINITIALIZED;
  private dependencies: AdapterDependencies;

  // Caching
  private debuggerPathCache = new Map<string, DebuggerPathCacheEntry>();
  private readonly cacheTimeout = 60000; // 1 minute

  // State
  private currentThreadId: number | null = null;
  private connected = false;
  private targetProcessArch: 'x86' | 'x64' | null = null;

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
    this.targetProcessArch = null;
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
      const netcoredbgPath = await findNetcoredbgExecutable(
        undefined,
        this.dependencies.logger as { error: (msg: string) => void; debug?: (msg: string) => void } | undefined
      );
      this.dependencies.logger?.debug?.(`[DotnetDebugAdapter] Found netcoredbg at ${netcoredbgPath}`);
    } catch (error) {
      errors.push({
        code: 'DEBUGGER_NOT_FOUND',
        message: error instanceof Error ? error.message : 'netcoredbg not found',
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
        name: 'netcoredbg',
        version: 'latest',
        required: true,
        installCommand: 'Build from source or set NETCOREDBG_PATH environment variable'
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
    const archSuffix = this.targetProcessArch ? `-${this.targetProcessArch}` : '';
    const cacheKey = (preferredPath || 'default') + archSuffix;
    const cached = this.debuggerPathCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      this.dependencies.logger?.debug?.(`[DotnetDebugAdapter] Using cached debugger path: ${cached.path}`);
      return cached.path;
    }

    const resolvedPath = await findNetcoredbgExecutable(
      preferredPath,
      this.dependencies.logger as { error: (msg: string) => void; debug?: (msg: string) => void } | undefined,
      this.targetProcessArch || undefined
    );

    this.debuggerPathCache.set(cacheKey, {
      path: resolvedPath,
      timestamp: Date.now()
    });

    return resolvedPath;
  }

  getDefaultExecutableName(): string {
    return 'netcoredbg';
  }

  getExecutableSearchPaths(): string[] {
    const paths: string[] = [];
    const home = process.env.HOME || process.env.USERPROFILE || '';

    if (process.platform === 'win32') {
      // Custom build locations
      paths.push(
        path.join(home, 'documents', 'github', 'netcoredbg', 'bin'),
        'C:\\netcoredbg',
        path.join(home, 'netcoredbg')
      );
    } else {
      paths.push(
        '/usr/local/bin',
        '/usr/bin',
        '/opt/netcoredbg',
        path.join(home, 'netcoredbg')
      );
    }

    if (process.env.PATH) {
      paths.push(...process.env.PATH.split(path.delimiter));
    }

    return paths;
  }

  // ===== Adapter Configuration =====

  /**
   * Build the command to launch netcoredbg via the TCP-to-stdio bridge.
   *
   * netcoredbg's `--server=PORT` mode has a connection bug on Windows,
   * so we use a lightweight bridge that:
   * 1. Listens on the TCP port (for the proxy to connect)
   * 2. Spawns netcoredbg in stdio mode (`--interpreter=vscode`)
   * 3. Forwards DAP messages bidirectionally
   */
  buildAdapterCommand(config: AdapterConfig): AdapterCommand {
    // Resolve the bridge script path relative to this file's dist location
    const bridgePath = path.resolve(
      path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/i, '$1')),
      'utils', 'netcoredbg-bridge.js'
    );

    return {
      command: process.execPath, // node
      args: [
        bridgePath,
        config.executablePath,
        config.adapterPort.toString()
      ],
      env: {
        ...process.env as Record<string, string>
      }
    };
  }

  getAdapterModuleName(): string {
    return 'netcoredbg';
  }

  getAdapterInstallCommand(): string {
    return 'Build netcoredbg from source (https://github.com/Samsung/netcoredbg) or set NETCOREDBG_PATH';
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
    // Detect target process architecture for executable resolution
    // This must happen before resolveExecutablePath is called (which happens after this method)
    if (config.processId) {
      this.targetProcessArch = getProcessArchitecture(config.processId);
      this.dependencies.logger?.debug?.(
        `[DotnetDebugAdapter] Target process ${config.processId} architecture: ${this.targetProcessArch || 'unknown'}`
      );
    }

    // Determine directories to scan for PDB files
    // Use explicit sourcePaths if provided, otherwise auto-detect from process executable
    let pdbScanDirs = config.sourcePaths;
    if (!pdbScanDirs && config.processId) {
      const procDir = getProcessExecutableDir(config.processId);
      if (procDir) {
        pdbScanDirs = [procDir];
      }
    }

    // Convert Windows PDBs to Portable PDB format in a temp directory
    // (originals may be locked by the debuggee process)
    const symbolSearchPaths: string[] = [];
    if (pdbScanDirs) {
      const pdb2pdbPath = findPdb2PdbExecutable();
      if (pdb2pdbPath) {
        const tempDir = convertPdbsToTemp(pdbScanDirs, pdb2pdbPath);
        if (tempDir) {
          symbolSearchPaths.push(tempDir);
        }
      }
    }

    const attachConfig = {
      type: 'coreclr',
      request: 'attach',
      name: '.NET: Attach',
      processId: config.processId ? Number(config.processId) : undefined,
      justMyCode: config.justMyCode ?? true,
      // CRITICAL: Never terminate the debuggee on detach
      terminateDebuggee: false,
      sourceFileMap: pdbScanDirs ? Object.fromEntries(
        pdbScanDirs.map(p => [p, p])
      ) : undefined,
      symbolOptions: symbolSearchPaths.length > 0
        ? { searchPaths: symbolSearchPaths, searchMicrosoftSymbolServer: false }
        : undefined
    };

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
    return `.NET Debugging Setup (netcoredbg):

1. Build netcoredbg from source:
   git clone https://github.com/Samsung/netcoredbg
   (Use our modified fork for .NET Framework 4.8 support)

2. Set NETCOREDBG_PATH to the built binary:
   export NETCOREDBG_PATH=/path/to/netcoredbg/bin/netcoredbg.exe

3. For .NET Framework 4.8 debugging:
   - Our modified netcoredbg supports Desktop CLR via ICorDebug
   - Compile target apps with /debug:portable for symbol loading
   - Or use Pdb2Pdb.exe to convert Windows PDBs to Portable format

4. For .NET Core / .NET 5+:
   - Works out of the box with standard netcoredbg`;
  }

  getMissingExecutableError(): string {
    return `netcoredbg not found. Set NETCOREDBG_PATH to the netcoredbg binary path.

For .NET Framework 4.8 support, use the modified netcoredbg fork with Desktop CLR support.
For .NET Core/.NET 5+, install standard netcoredbg from https://github.com/Samsung/netcoredbg`;
  }

  translateErrorMessage(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes('netcoredbg') && message.includes('not found')) {
      return this.getMissingExecutableError();
    }

    if (message.includes('attach') && message.includes('denied')) {
      return 'Permission denied attaching to process. Try running as Administrator.';
    }

    if (message.includes('process') && message.includes('not found')) {
      return 'Target process not found. Verify the process is running and the PID is correct.';
    }

    if (message.includes('symbol') && message.includes('load')) {
      return 'Failed to load debug symbols. Ensure Portable PDB files are available (compile with /debug:portable or use Pdb2Pdb).';
    }

    if (message.includes('connection') && message.includes('refused')) {
      return 'Connection to netcoredbg refused. The debugger may have failed to start.';
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
    ];

    return supportedFeatures.includes(feature);
  }

  getFeatureRequirements(feature: DebugFeature): FeatureRequirement[] {
    const requirements: FeatureRequirement[] = [];

    switch (feature) {
      case DebugFeature.CONDITIONAL_BREAKPOINTS:
        requirements.push({
          type: 'dependency',
          description: 'netcoredbg with Portable PDB symbols',
          required: true
        });
        break;

      case DebugFeature.EXCEPTION_INFO_REQUEST:
        requirements.push({
          type: 'dependency',
          description: 'netcoredbg with PDB symbols loaded',
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
      supportsStepInTargetsRequest: false,
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
      supportsDisassembleRequest: false,
      supportsCancelRequest: false,
      supportsBreakpointLocationsRequest: false,
      supportsClipboardContext: false,
      supportsSteppingGranularity: false,
      supportsInstructionBreakpoints: false,
      supportsExceptionFilterOptions: false,
      supportsSingleThreadExecutionRequests: false
    };
  }
}

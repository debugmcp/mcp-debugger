/**
 * Go Debug Adapter implementation
 * 
 * Provides Go-specific debugging functionality using Delve (dlv).
 * Delve natively supports DAP (Debug Adapter Protocol) via `dlv dap` command.
 * 
 * @since 0.1.0
 */
import { EventEmitter } from 'events';
import { DebugProtocol } from '@vscode/debugprotocol';
import { 
  IDebugAdapter,
  AdapterState,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  DependencyInfo,
  AdapterConfig,
  AdapterCommand,
  GenericLaunchConfig,
  LanguageSpecificLaunchConfig,
  DebugFeature,
  FeatureRequirement,
  AdapterCapabilities,
  AdapterError,
  AdapterErrorCode,
} from '@debugmcp/shared';
import { DebugLanguage } from '@debugmcp/shared';
import { AdapterDependencies } from '@debugmcp/shared';
import { 
  findDelveExecutable, 
  getGoVersion, 
  getDelveVersion, 
  checkDelveDapSupport,
  getGoSearchPaths
} from './utils/go-utils.js';

/**
 * Cache entry for Go/Delve executable paths
 */
interface GoPathCacheEntry {
  path: string;
  timestamp: number;
  version?: string;
}

/**
 * Go-specific launch configuration
 */
interface GoLaunchConfig extends LanguageSpecificLaunchConfig {
  mode?: 'debug' | 'test' | 'exec' | 'replay' | 'core';
  program?: string;
  buildFlags?: string | string[];
  output?: string;
  dlvCwd?: string;
  backend?: string;
  stackTraceDepth?: number;
  showGlobalVariables?: boolean;
  showRegisters?: boolean;
  hideSystemGoroutines?: boolean;
  goroutineFilters?: string[];
  substitutePath?: Array<{ from: string; to: string }>;
  [key: string]: unknown;
}

/**
 * Go Debug Adapter implementation using Delve DAP
 */
export class GoDebugAdapter extends EventEmitter implements IDebugAdapter {
  readonly language = DebugLanguage.GO;
  readonly name = 'Go Debug Adapter (Delve)';
  
  private state: AdapterState = AdapterState.UNINITIALIZED;
  private dependencies: AdapterDependencies;
  
  // Caching
  private goPathCache = new Map<string, GoPathCacheEntry>();
  private delvePathCache = new Map<string, GoPathCacheEntry>();
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
    if (process.env.CI === 'true') {
      console.error('[GoDebugAdapter] Starting initialize()');
    }
    this.transitionTo(AdapterState.INITIALIZING);

    try {
      if (process.env.CI === 'true') {
        console.error('[GoDebugAdapter] Calling validateEnvironment()');
      }
      const validation = await this.validateEnvironment();
      if (!validation.valid) {
        if (process.env.CI === 'true') {
          console.error('[GoDebugAdapter] Validation failed:', validation.errors);
        }
        this.transitionTo(AdapterState.ERROR);
        throw new AdapterError(
          validation.errors[0]?.message || 'Go environment validation failed',
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
    this.goPathCache.clear();
    this.delvePathCache.clear();
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
      // Check Go executable
      if (process.env.CI === 'true') {
        console.error('[GoDebugAdapter] Resolving Go executable path...');
      }
      const goPath = await this.resolveExecutablePath();
      if (process.env.CI === 'true') {
        console.error('[GoDebugAdapter] Resolved Go path:', goPath);
      }
      
      // Check Go version
      const goVersion = await this.checkGoVersion(goPath);
      if (goVersion) {
        const [major, minor] = goVersion.split('.').map(Number);
        // Delve requires Go 1.18+ for full compatibility
        if (major < 1 || (major === 1 && minor < 18)) {
          errors.push({
            code: 'GO_VERSION_TOO_OLD',
            message: `Go 1.18 or higher required. Current version: ${goVersion}`,
            recoverable: false
          });
        }
      } else {
        warnings.push({
          code: 'GO_VERSION_CHECK_FAILED',
          message: 'Could not determine Go version'
        });
      }
      
      // Check Delve installation
      try {
        const dlvPath = await findDelveExecutable(undefined, this.dependencies.logger);
        const hasDapSupport = await checkDelveDapSupport(dlvPath);
        if (!hasDapSupport) {
          errors.push({
            code: 'DELVE_DAP_NOT_SUPPORTED',
            message: 'Delve does not support DAP. Update with: go install github.com/go-delve/delve/cmd/dlv@latest',
            recoverable: true
          });
        }
      } catch {
        errors.push({
          code: 'DELVE_NOT_INSTALLED',
          message: 'Delve (dlv) not installed. Install with: go install github.com/go-delve/delve/cmd/dlv@latest',
          recoverable: true
        });
      }
      
    } catch (error) {
      if (process.env.CI === 'true') {
        console.error('[GoDebugAdapter] validateEnvironment catch block error:', error);
      }
      errors.push({
        code: 'GO_NOT_FOUND',
        message: error instanceof Error ? error.message : 'Go executable not found',
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
        name: 'Go',
        version: '1.18+',
        required: true,
        installCommand: 'Download from https://go.dev/dl/'
      },
      {
        name: 'Delve (dlv)',
        version: 'latest',
        required: true,
        installCommand: 'go install github.com/go-delve/delve/cmd/dlv@latest'
      }
    ];
  }
  
  // ===== Executable Management =====
  
  async resolveExecutablePath(preferredPath?: string): Promise<string> {
    // For Go debugging, we need the Delve (dlv) executable, not go.
    // The adapter uses `dlv dap` to start the debug adapter.
    const cacheKey = preferredPath || 'default';
    const cached = this.delvePathCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      this.dependencies.logger?.debug?.(`[GoDebugAdapter] Using cached Delve path: ${cached.path}`);
      return cached.path;
    }
    
    const dlvPath = await findDelveExecutable(preferredPath, this.dependencies.logger);
    
    // Cache the result
    this.delvePathCache.set(cacheKey, {
      path: dlvPath,
      timestamp: Date.now()
    });
    
    return dlvPath;
  }
  
  getDefaultExecutableName(): string {
    return process.platform === 'win32' ? 'dlv.exe' : 'dlv';
  }
  
  getExecutableSearchPaths(): string[] {
    return getGoSearchPaths();
  }
  
  // ===== Adapter Configuration =====
  
  buildAdapterCommand(config: AdapterConfig): AdapterCommand {
    // Delve DAP mode: dlv dap --listen=host:port
    const args: string[] = [
      'dap',
      `--listen=${config.adapterHost}:${config.adapterPort}`
    ];
    
    // Add log output if in debug mode
    if (process.env.DEBUG) {
      args.push('--log');
      args.push('--log-output=dap');
    }
    
    return {
      // Use the resolved executablePath if provided, otherwise fall back to 'dlv'
      command: config.executablePath || 'dlv',
      args,
      env: process.env as Record<string, string>
    };
  }
  
  getAdapterModuleName(): string {
    return 'dlv';
  }
  
  getAdapterInstallCommand(): string {
    return 'go install github.com/go-delve/delve/cmd/dlv@latest';
  }
  
  // ===== Debug Configuration =====
  
  async transformLaunchConfig(config: GenericLaunchConfig): Promise<GoLaunchConfig> {
    const goConfig: GoLaunchConfig = {
      ...config,
      type: 'go',
      request: 'launch',
      // Preserve mode if specified (e.g., 'test'), otherwise default to 'debug'
      mode: (config as Record<string, unknown>).mode as GoLaunchConfig['mode'] || 'debug',
      stopOnEntry: config.stopOnEntry ?? true,
    };
    
    // Transform common config to Go-specific
    if (config.cwd) {
      goConfig.dlvCwd = config.cwd;
    }
    
    if (config.env) {
      goConfig.env = config.env;
    }
    
    if (config.args) {
      goConfig.args = config.args;
    }
    
    // Default settings for better debugging experience
    goConfig.stackTraceDepth = 50;
    goConfig.showGlobalVariables = false;
    goConfig.hideSystemGoroutines = true;
    
    return goConfig;
  }
  
  getDefaultLaunchConfig(): Partial<GenericLaunchConfig> {
    return {
      stopOnEntry: true,
      justMyCode: true
    };
  }
  
  // ===== DAP Protocol Operations =====
  
  async sendDapRequest<T extends DebugProtocol.Response>(
    command: string, 
    args?: unknown
  ): Promise<T> {
    void command;
    void args;
    throw new Error('DAP request forwarding not implemented - handled by DAP client');
  }
  
  handleDapEvent(event: DebugProtocol.Event): void {
    // Map DAP events to adapter state
    switch (event.event) {
      case 'stopped':
        this.transitionTo(AdapterState.DEBUGGING);
        const stoppedEvent = event as DebugProtocol.StoppedEvent;
        if (stoppedEvent.body?.threadId) {
          this.currentThreadId = stoppedEvent.body.threadId;
        }
        this.emit('stopped', event);
        break;
        
      case 'continued':
        this.transitionTo(AdapterState.DEBUGGING);
        this.emit('continued', event);
        break;
        
      case 'terminated':
        this.transitionTo(AdapterState.DISCONNECTED);
        this.emit('terminated', event);
        break;
        
      case 'exited':
        this.emit('exited', event);
        break;
        
      case 'thread':
        this.emit('thread', event);
        break;
        
      case 'output':
        this.emit('output', event);
        break;
        
      case 'breakpoint':
        this.emit('breakpoint', event);
        break;
    }
  }
  
  handleDapResponse(response: DebugProtocol.Response): void {
    void response;
    // Optional: process responses if needed
  }
  
  // ===== Connection Management =====
  
  async connect(host: string, port: number): Promise<void> {
    void host;
    void port;
    this.connected = true;
    this.transitionTo(AdapterState.CONNECTED);
    this.emit('connected');
  }
  
  async disconnect(): Promise<void> {
    this.connected = false;
    this.transitionTo(AdapterState.DISCONNECTED);
    this.emit('disconnected');
  }
  
  isConnected(): boolean {
    return this.connected;
  }
  
  // ===== Error Handling =====
  
  getInstallationInstructions(): string {
    return `Go Debugging Setup:

1. Install Go 1.18 or higher:
   - All platforms: Download from https://go.dev/dl/
   - macOS: brew install go
   - Linux: Use your package manager or download from go.dev

2. Install Delve debugger:
   go install github.com/go-delve/delve/cmd/dlv@latest

3. Verify installation:
   go version
   dlv version

4. Ensure GOPATH/bin is in your PATH:
   - Linux/macOS: export PATH="$PATH:$(go env GOPATH)/bin"
   - Windows: Add %USERPROFILE%\\go\\bin to PATH

For CGO programs (C bindings):
   - macOS: xcode-select --install
   - Linux: Install gcc and libc-dev`;
  }
  
  getMissingExecutableError(): string {
    return `Go not found. Please ensure Go 1.18+ is installed and available in PATH.

Download from: https://go.dev/dl/

After installation, you may need to:
- Add Go to your PATH
- Restart your terminal/IDE
- Set GOROOT if using a custom installation location

You can also specify the Go path explicitly in your debug configuration.`;
  }
  
  translateErrorMessage(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('dlv') && message.includes('not found')) {
      return 'Delve debugger not found. Install with: go install github.com/go-delve/delve/cmd/dlv@latest';
    }
    
    if (message.includes('go') && message.includes('not found')) {
      return this.getMissingExecutableError();
    }
    
    if (message.includes('permission denied')) {
      return `Permission denied. Check file permissions for Go and Delve executables.`;
    }
    
    if (message.includes('could not launch process')) {
      return `Could not launch process. Ensure the program is valid Go code and compiles successfully.`;
    }
    
    if (message.includes('could not attach')) {
      return `Could not attach to process. Ensure the process is running and you have permission to attach.`;
    }
    
    return error.message;
  }
  
  // ===== Feature Support =====
  
  supportsFeature(feature: DebugFeature): boolean {
    const supportedFeatures = [
      DebugFeature.CONDITIONAL_BREAKPOINTS,
      DebugFeature.FUNCTION_BREAKPOINTS,
      DebugFeature.EXCEPTION_BREAKPOINTS,
      DebugFeature.VARIABLE_PAGING,
      DebugFeature.EVALUATE_FOR_HOVERS,
      DebugFeature.SET_VARIABLE,
      DebugFeature.LOG_POINTS,
      DebugFeature.TERMINATE_REQUEST,
      DebugFeature.LOADED_SOURCES_REQUEST,
      DebugFeature.STEP_IN_TARGETS_REQUEST
    ];
    
    return supportedFeatures.includes(feature);
  }
  
  getFeatureRequirements(feature: DebugFeature): FeatureRequirement[] {
    const requirements: FeatureRequirement[] = [];
    
    switch (feature) {
      case DebugFeature.CONDITIONAL_BREAKPOINTS:
        requirements.push({
          type: 'dependency',
          description: 'Delve 1.6+',
          required: true
        });
        break;
        
      case DebugFeature.LOG_POINTS:
        requirements.push({
          type: 'version',
          description: 'Delve 1.7+',
          required: true
        });
        break;
        
      case DebugFeature.STEP_BACK:
        requirements.push({
          type: 'configuration',
          description: 'Requires rr (record/replay) support',
          required: false
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
          filter: 'panic',
          label: 'Panic',
          description: 'Break on panic',
          default: true,
          supportsCondition: false
        },
        {
          filter: 'fatal',
          label: 'Fatal Error',
          description: 'Break on fatal errors',
          default: true,
          supportsCondition: false
        }
      ],
      supportsStepBack: false, // Requires rr
      supportsSetVariable: true,
      supportsRestartFrame: false,
      supportsGotoTargetsRequest: false,
      supportsStepInTargetsRequest: true,
      supportsCompletionsRequest: true,
      completionTriggerCharacters: ['.'],
      supportsModulesRequest: false,
      supportsRestartRequest: false,
      supportsExceptionOptions: false,
      supportsValueFormattingOptions: true,
      supportsExceptionInfoRequest: true,
      supportTerminateDebuggee: true,
      supportSuspendDebuggee: true,
      supportsDelayedStackTraceLoading: true,
      supportsLoadedSourcesRequest: true,
      supportsLogPoints: true,
      supportsTerminateThreadsRequest: false,
      supportsSetExpression: false,
      supportsTerminateRequest: true,
      supportsDataBreakpoints: false,
      supportsReadMemoryRequest: true,
      supportsWriteMemoryRequest: false,
      supportsDisassembleRequest: true,
      supportsCancelRequest: false,
      supportsBreakpointLocationsRequest: true,
      supportsClipboardContext: false,
      supportsSteppingGranularity: true,
      supportsInstructionBreakpoints: false,
      supportsExceptionFilterOptions: false,
      supportsSingleThreadExecutionRequests: true
    };
  }
  
  // ===== Go-specific helper methods =====
  
  /**
   * Check Go version
   */
  private async checkGoVersion(goPath: string): Promise<string | null> {
    const cached = this.goPathCache.get(goPath);
    if (cached?.version) {
      return cached.version;
    }
    
    const version = await getGoVersion(goPath);
    
    if (version && cached) {
      cached.version = version;
    }
    
    return version;
  }
  
  /**
   * Resolve Delve executable path
   */
  async resolveDelveExecutablePath(preferredPath?: string): Promise<string> {
    const cacheKey = preferredPath || 'default';
    const cached = this.delvePathCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      this.dependencies.logger?.debug?.(`[GoDebugAdapter] Using cached Delve path: ${cached.path}`);
      return cached.path;
    }
    
    const dlvPath = await findDelveExecutable(preferredPath, this.dependencies.logger);
    
    this.delvePathCache.set(cacheKey, {
      path: dlvPath,
      timestamp: Date.now()
    });
    
    return dlvPath;
  }
  
  /**
   * Check Delve version
   */
  async checkDelveVersion(dlvPath: string): Promise<string | null> {
    const cached = this.delvePathCache.get(dlvPath);
    if (cached?.version) {
      return cached.version;
    }
    
    const version = await getDelveVersion(dlvPath);
    
    if (version && cached) {
      cached.version = version;
    }
    
    return version;
  }
}

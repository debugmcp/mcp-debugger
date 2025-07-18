/**
 * Python Debug Adapter implementation
 * 
 * Provides Python-specific debugging functionality using debugpy.
 * Encapsulates all Python-specific logic including executable discovery,
 * environment validation, and debugpy integration.
 * 
 * @since 2.0.0
 */
import { EventEmitter } from 'events';
import { spawn } from 'child_process';
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
  AdapterEvents
} from '../debug-adapter-interface.js';
import { DebugLanguage } from '../../session/models.js';
import { AdapterDependencies } from '../adapter-registry-interface.js';
import { findPythonExecutable, getPythonVersion } from '../../utils/python-utils.js';

/**
 * Cache entry for Python executable paths
 */
interface PythonPathCacheEntry {
  path: string;
  timestamp: number;
  version?: string;
  hasDebugpy?: boolean;
}

/**
 * Python-specific launch configuration
 */
interface PythonLaunchConfig extends LanguageSpecificLaunchConfig {
  module?: string;              // For -m module execution
  pythonArgs?: string[];        // Additional Python arguments
  console?: 'integratedTerminal' | 'internalConsole' | 'externalTerminal';
  django?: boolean;             // Django debugging support
  flask?: boolean;              // Flask debugging support
  jinja?: boolean;             // Jinja template debugging
  redirectOutput?: boolean;     // Redirect output to debug console
  showReturnValue?: boolean;    // Show function return values
  subProcess?: boolean;         // Debug child processes
}

/**
 * Python Debug Adapter implementation
 */
export class PythonDebugAdapter extends EventEmitter implements IDebugAdapter {
  readonly language = DebugLanguage.PYTHON;
  readonly name = 'Python Debug Adapter';
  
  private state: AdapterState = AdapterState.UNINITIALIZED;
  private dependencies: AdapterDependencies;
  
  // Caching
  private pythonPathCache = new Map<string, PythonPathCacheEntry>();
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
      // Validate environment
      const validation = await this.validateEnvironment();
      if (!validation.valid) {
        this.transitionTo(AdapterState.ERROR);
        throw new AdapterError(
          validation.errors[0]?.message || 'Python environment validation failed',
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
    this.pythonPathCache.clear();
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
      // Check Python executable
      const pythonPath = await this.resolveExecutablePath();
      
      // Check Python version
      const version = await this.checkPythonVersion(pythonPath);
      if (version) {
        const [major, minor] = version.split('.').map(Number);
        if (major < 3 || (major === 3 && minor < 7)) {
          errors.push({
            code: 'PYTHON_VERSION_TOO_OLD',
            message: `Python 3.7 or higher required. Current version: ${version}`,
            recoverable: false
          });
        }
      } else {
        warnings.push({
          code: 'PYTHON_VERSION_CHECK_FAILED',
          message: 'Could not determine Python version'
        });
      }
      
      // Check debugpy installation
      const hasDebugpy = await this.checkDebugpyInstalled(pythonPath);
      if (!hasDebugpy) {
        errors.push({
          code: 'DEBUGPY_NOT_INSTALLED',
          message: 'debugpy not installed. Run: pip install debugpy',
          recoverable: true
        });
      }
      
      // Check if in virtual environment
      const isVenv = await this.detectVirtualEnv(pythonPath);
      if (isVenv) {
        this.dependencies.logger?.info('[PythonDebugAdapter] Virtual environment detected');
      }
      
    } catch (error) {
      errors.push({
        code: 'PYTHON_NOT_FOUND',
        message: error instanceof Error ? error.message : 'Python executable not found',
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
        name: 'Python',
        version: '3.7+',
        required: true,
        installCommand: 'Download from https://python.org'
      },
      {
        name: 'debugpy',
        version: 'latest',
        required: true,
        installCommand: 'pip install debugpy'
      }
    ];
  }
  
  // ===== Executable Management =====
  
  async resolveExecutablePath(preferredPath?: string): Promise<string> {
    // Check cache first
    const cacheKey = preferredPath || 'default';
    const cached = this.pythonPathCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      this.dependencies.logger?.debug(`[PythonDebugAdapter] Using cached Python path: ${cached.path}`);
      return cached.path;
    }
    
    // Find Python executable
    const pythonPath = await findPythonExecutable(
      preferredPath,
      this.dependencies.logger
    );
    
    // Cache the result
    this.pythonPathCache.set(cacheKey, {
      path: pythonPath,
      timestamp: Date.now()
    });
    
    return pythonPath;
  }
  
  getDefaultExecutableName(): string {
    switch (process.platform) {
      case 'win32':
        return 'py';
      default:
        return 'python3';
    }
  }
  
  getExecutableSearchPaths(): string[] {
    const paths: string[] = [];
    
    // Add common Python installation paths
    if (process.platform === 'win32') {
      paths.push(
        'C:\\Python39',
        'C:\\Python38',
        'C:\\Python37',
        'C:\\Program Files\\Python39',
        'C:\\Program Files\\Python38',
        'C:\\Program Files\\Python37',
        `${process.env.LOCALAPPDATA}\\Programs\\Python\\Python39`,
        `${process.env.LOCALAPPDATA}\\Programs\\Python\\Python38`,
        `${process.env.LOCALAPPDATA}\\Programs\\Python\\Python37`
      );
    } else if (process.platform === 'darwin') {
      paths.push(
        '/usr/local/bin',
        '/opt/homebrew/bin',
        '/usr/bin'
      );
    } else {
      paths.push(
        '/usr/bin',
        '/usr/local/bin',
        '/opt/python/bin'
      );
    }
    
    // Add PATH directories
    if (process.env.PATH) {
      paths.push(...process.env.PATH.split(path.delimiter));
    }
    
    return paths;
  }
  
  // ===== Adapter Configuration =====
  
  buildAdapterCommand(config: AdapterConfig): AdapterCommand {
    return {
      command: config.executablePath,
      args: [
        '-m', 'debugpy.adapter',
        '--host', config.adapterHost,
        '--port', config.adapterPort.toString()
      ],
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',  // Ensure unbuffered output
        DEBUGPY_LOG_DIR: config.logDir
      }
    };
  }
  
  getAdapterModuleName(): string {
    return 'debugpy.adapter';
  }
  
  getAdapterInstallCommand(): string {
    return 'pip install debugpy';
  }
  
  // ===== Debug Configuration =====
  
  transformLaunchConfig(config: GenericLaunchConfig): PythonLaunchConfig {
    const pythonConfig: PythonLaunchConfig = {
      ...config,
      type: 'python',
      request: 'launch',
      name: 'Python: Current File',
      console: 'integratedTerminal',
      redirectOutput: true,
      showReturnValue: true,
      justMyCode: config.justMyCode ?? true,
      stopOnEntry: config.stopOnEntry ?? false
    };
    
    return pythonConfig;
  }
  
  getDefaultLaunchConfig(): Partial<GenericLaunchConfig> {
    return {
      stopOnEntry: false,
      justMyCode: true,
      env: {},
      cwd: process.cwd()
    };
  }
  
  // ===== DAP Protocol Operations =====
  
  async sendDapRequest<T extends DebugProtocol.Response>(
    command: string, 
    args?: unknown
  ): Promise<T> {
    // This will be handled by ProxyManager
    // Adapter just needs to validate the request is appropriate for Python
    
    // Validate Python-specific commands
    if (command === 'setExceptionBreakpoints' && args) {
      const exceptionArgs = args as DebugProtocol.SetExceptionBreakpointsArguments;
      // Ensure Python exception filters are valid
      const validFilters = ['raised', 'uncaught', 'userUnhandled'];
      const invalidFilters = exceptionArgs.filters?.filter(f => !validFilters.includes(f));
      if (invalidFilters?.length) {
        throw new AdapterError(
          `Invalid Python exception filters: ${invalidFilters.join(', ')}`,
          AdapterErrorCode.INVALID_RESPONSE
        );
      }
    }
    
    // ProxyManager will handle actual communication
    return {} as T;
  }
  
  handleDapEvent(event: DebugProtocol.Event): void {
    // Update thread ID on stopped events
    if (event.event === 'stopped' && event.body?.threadId) {
      this.currentThreadId = event.body.threadId;
    }
    
    this.emit(event.event as keyof AdapterEvents, event.body);
  }
  
  handleDapResponse(_response: DebugProtocol.Response): void {
    // Python adapter doesn't need special response handling
    void _response;
  }
  
  // ===== Connection Management =====
  
  async connect(host: string, port: number): Promise<void> {
    // Connection is handled by ProxyManager
    // Store connection info for debugging purposes
    this.dependencies.logger?.debug(`[PythonDebugAdapter] Connect request to ${host}:${port}`);
    
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
    return `Python Debugging Setup:

1. Install Python 3.7 or higher:
   - Windows: Download from https://python.org
   - macOS: brew install python3
   - Linux: sudo apt install python3 python3-pip

2. Install debugpy:
   pip install debugpy

3. Verify installation:
   python -m debugpy --version

For virtual environments:
   python -m venv myenv
   source myenv/bin/activate  # On Windows: myenv\\Scripts\\activate
   pip install debugpy`;
  }
  
  getMissingExecutableError(): string {
    return `Python not found. Please ensure Python 3.7+ is installed and available in PATH.
    
Windows users: Try 'py' command or install from https://python.org
macOS users: Try 'brew install python3'
Linux users: Try 'sudo apt install python3'

You can also specify the Python path explicitly in your debug configuration.`;
  }
  
  translateErrorMessage(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('debugpy') && message.includes('modulenotfounderror')) {
      return 'debugpy is not installed. Please run: pip install debugpy';
    }
    
    if (message.includes('python') && message.includes('not found')) {
      return this.getMissingExecutableError();
    }
    
    if (message.includes('permission denied')) {
      return `Permission denied accessing Python executable. Check file permissions.`;
    }
    
    if (message.includes('windows store')) {
      return `Windows Store Python alias detected. Please install Python from https://python.org`;
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
      DebugFeature.EXCEPTION_OPTIONS,
      DebugFeature.EXCEPTION_INFO_REQUEST
    ];
    
    return supportedFeatures.includes(feature);
  }
  
  getFeatureRequirements(feature: DebugFeature): FeatureRequirement[] {
    const requirements: FeatureRequirement[] = [];
    
    switch (feature) {
      case DebugFeature.CONDITIONAL_BREAKPOINTS:
        requirements.push({
          type: 'dependency',
          description: 'debugpy 1.0+',
          required: true
        });
        break;
        
      case DebugFeature.LOG_POINTS:
        requirements.push({
          type: 'version',
          description: 'debugpy 1.5+',
          required: true
        });
        break;
        
      case DebugFeature.EXCEPTION_INFO_REQUEST:
        requirements.push({
          type: 'version',
          description: 'Python 3.7+',
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
          filter: 'raised',
          label: 'Raised Exceptions',
          description: 'Break on all raised exceptions',
          default: false,
          supportsCondition: true
        },
        {
          filter: 'uncaught',
          label: 'Uncaught Exceptions',
          description: 'Break on uncaught exceptions',
          default: true,
          supportsCondition: true
        },
        {
          filter: 'userUnhandled',
          label: 'User Unhandled Exceptions',
          description: 'Break on exceptions not handled by user code',
          default: false,
          supportsCondition: true
        }
      ],
      supportsStepBack: false,
      supportsSetVariable: true,
      supportsRestartFrame: false,
      supportsGotoTargetsRequest: false,
      supportsStepInTargetsRequest: true,
      supportsCompletionsRequest: true,
      completionTriggerCharacters: ['.', '['],
      supportsModulesRequest: true,
      supportsRestartRequest: false,
      supportsExceptionOptions: true,
      supportsValueFormattingOptions: true,
      supportsExceptionInfoRequest: true,
      supportTerminateDebuggee: true,
      supportSuspendDebuggee: false,
      supportsDelayedStackTraceLoading: true,
      supportsLoadedSourcesRequest: true,
      supportsLogPoints: true,
      supportsTerminateThreadsRequest: false,
      supportsSetExpression: false,
      supportsTerminateRequest: true,
      supportsDataBreakpoints: false,
      supportsReadMemoryRequest: false,
      supportsWriteMemoryRequest: false,
      supportsDisassembleRequest: false,
      supportsCancelRequest: false,
      supportsBreakpointLocationsRequest: true,
      supportsClipboardContext: false,
      supportsSteppingGranularity: false,
      supportsInstructionBreakpoints: false,
      supportsExceptionFilterOptions: true,
      supportsSingleThreadExecutionRequests: false
    };
  }
  
  // ===== Python-specific helper methods =====
  
  /**
   * Check Python version
   */
  private async checkPythonVersion(pythonPath: string): Promise<string | null> {
    // Check cache first
    const cached = this.pythonPathCache.get(pythonPath);
    if (cached?.version) {
      return cached.version;
    }
    
    const version = await getPythonVersion(pythonPath);
    
    // Update cache
    if (version && cached) {
      cached.version = version;
    }
    
    return version;
  }
  
  /**
   * Check if debugpy is installed
   */
  private async checkDebugpyInstalled(pythonPath: string): Promise<boolean> {
    // Check cache first
    const cached = this.pythonPathCache.get(pythonPath);
    if (cached?.hasDebugpy !== undefined) {
      return cached.hasDebugpy;
    }
    
    return new Promise((resolve) => {
      const child = spawn(pythonPath, ['-c', 'import debugpy; print(debugpy.__version__)'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let output = '';
      child.stdout?.on('data', (data) => { output += data.toString(); });
      
      child.on('error', () => resolve(false));
      child.on('exit', (code) => {
        const hasDebugpy = code === 0 && output.trim().length > 0;
        
        // Update cache
        if (cached) {
          cached.hasDebugpy = hasDebugpy;
        }
        
        if (hasDebugpy) {
          this.dependencies.logger?.info(`[PythonDebugAdapter] debugpy version: ${output.trim()}`);
        }
        
        resolve(hasDebugpy);
      });
    });
  }
  
  /**
   * Detect if Python is in a virtual environment
   */
  private async detectVirtualEnv(pythonPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn(pythonPath, ['-c', 'import sys; print(hasattr(sys, "real_prefix") or (hasattr(sys, "base_prefix") and sys.base_prefix != sys.prefix))'], {
        stdio: ['ignore', 'pipe', 'ignore']
      });
      
      let output = '';
      child.stdout?.on('data', (data) => { output += data.toString(); });
      
      child.on('error', () => resolve(false));
      child.on('exit', () => {
        resolve(output.trim().toLowerCase() === 'true');
      });
    });
  }
}

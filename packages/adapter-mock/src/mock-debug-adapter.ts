/**
 * Mock Debug Adapter implementation for testing
 * 
 * Provides a fully functional debug adapter that simulates debugging
 * without requiring external dependencies.
 * 
 * @since 2.0.0
 */
import { EventEmitter } from 'events';
import { DebugProtocol } from '@vscode/debugprotocol';
import * as path from 'path';
import * as fs from 'fs';
import {
  IDebugAdapter,
  AdapterState,
  ValidationResult,
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
} from '@debugmcp/shared';
import { DebugLanguage } from '@debugmcp/shared';
import { AdapterDependencies } from '@debugmcp/shared';

/**
 * Mock adapter configuration
 */
export interface MockAdapterConfig {
  // Timing configuration
  defaultDelay?: number;        // Base delay for operations (ms)
  connectionDelay?: number;     // Delay for connect operation
  stepDelay?: number;          // Delay for step operations
  
  // Behavior configuration
  supportedFeatures?: DebugFeature[];  // Which DAP features to support
  maxVariableDepth?: number;           // How deep variable trees can go
  maxArrayLength?: number;             // Maximum array size to simulate
  
  // Error simulation
  errorProbability?: number;    // Random error chance (0-1)
  errorScenarios?: MockErrorScenario[]; // Enabled error scenarios
  
  // Performance simulation
  cpuIntensive?: boolean;       // Simulate CPU-intensive operations
  memoryIntensive?: boolean;    // Simulate memory pressure
}

/**
 * Mock error scenarios
 */
export enum MockErrorScenario {
  NONE = 'none',
  EXECUTABLE_NOT_FOUND = 'executable_not_found',
  ADAPTER_CRASH = 'adapter_crash',
  CONNECTION_TIMEOUT = 'connection_timeout',
  INVALID_BREAKPOINT = 'invalid_breakpoint',
  SCRIPT_ERROR = 'script_error',
  OUT_OF_MEMORY = 'out_of_memory'
}

/**
 * Valid state transitions
 * Made more permissive to match real adapter behavior (e.g., Python adapter)
 * Real adapters don't have strict state validation, so the mock shouldn't either
 */
const VALID_TRANSITIONS: { [key in AdapterState]?: AdapterState[] } = {
  [AdapterState.UNINITIALIZED]: [
    AdapterState.INITIALIZING,
    AdapterState.READY,         // Allow direct ready
    AdapterState.CONNECTED,     // Allow direct connection
    AdapterState.DEBUGGING,     // Allow direct debugging (matches real adapter behavior)
    AdapterState.ERROR
  ],
  [AdapterState.INITIALIZING]: [
    AdapterState.READY, 
    AdapterState.CONNECTED,     // Allow direct connection during init
    AdapterState.ERROR,
    AdapterState.UNINITIALIZED // Allow reset
  ],
  [AdapterState.READY]: [
    AdapterState.CONNECTED, 
    AdapterState.DEBUGGING,     // Allow direct debugging from ready
    AdapterState.DISCONNECTED,  // Allow disconnection
    AdapterState.ERROR,
    AdapterState.UNINITIALIZED // Allow reset
  ],
  [AdapterState.CONNECTED]: [
    AdapterState.DEBUGGING, 
    AdapterState.CONNECTED,     // Allow staying connected (idempotent)
    AdapterState.DISCONNECTED,
    AdapterState.READY,         // Allow going back to ready
    AdapterState.ERROR
  ],
  [AdapterState.DEBUGGING]: [
    AdapterState.DEBUGGING,     // Allow staying in debugging (idempotent)
    AdapterState.CONNECTED,     // Allow going back to connected
    AdapterState.DISCONNECTED,
    AdapterState.READY,         // Allow going back to ready
    AdapterState.ERROR
  ],
  [AdapterState.DISCONNECTED]: [
    AdapterState.READY,
    AdapterState.CONNECTED,     // Allow reconnection
    AdapterState.UNINITIALIZED, // Allow full reset
    AdapterState.ERROR
  ],
  [AdapterState.ERROR]: [
    AdapterState.UNINITIALIZED,
    AdapterState.READY,         // Allow recovery to ready
    AdapterState.DISCONNECTED   // Allow recovery to disconnected
  ]
};

/**
 * Mock debug adapter implementation
 */
export class MockDebugAdapter extends EventEmitter implements IDebugAdapter {
  readonly language = DebugLanguage.MOCK;
  readonly name = 'Mock Debug Adapter';
  
  private state: AdapterState = AdapterState.UNINITIALIZED;
  private config: Required<MockAdapterConfig>;
  private dependencies: AdapterDependencies;
  
  // State
  private currentThreadId: number | null = null;
  private connected = false;
  
  // Error simulation
  private errorScenario: MockErrorScenario = MockErrorScenario.NONE;
  
  constructor(dependencies: AdapterDependencies, config: MockAdapterConfig = {}) {
    super();
    this.dependencies = dependencies;
    this.config = {
      defaultDelay: config.defaultDelay ?? 0,
      connectionDelay: config.connectionDelay ?? 50,
      stepDelay: config.stepDelay ?? 5,
      supportedFeatures: config.supportedFeatures ?? [
        DebugFeature.CONDITIONAL_BREAKPOINTS,
        DebugFeature.FUNCTION_BREAKPOINTS,
        DebugFeature.VARIABLE_PAGING,
        DebugFeature.SET_VARIABLE
      ],
      maxVariableDepth: config.maxVariableDepth ?? 10,
      maxArrayLength: config.maxArrayLength ?? 100,
      errorProbability: config.errorProbability ?? 0,
      errorScenarios: config.errorScenarios ?? [],
      cpuIntensive: config.cpuIntensive ?? false,
      memoryIntensive: config.memoryIntensive ?? false
    };
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
          validation.errors[0]?.message || 'Validation failed',
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
    const validTransitions = VALID_TRANSITIONS[oldState];
    
    if (!validTransitions?.includes(newState)) {
      throw new AdapterError(
        `Invalid state transition: ${oldState} → ${newState}`,
        AdapterErrorCode.UNKNOWN_ERROR
      );
    }
    
    this.state = newState;
    this.emit('stateChanged', oldState, newState);
  }
  
  // ===== Environment Validation =====
  
  async validateEnvironment(): Promise<ValidationResult> {
    if (this.errorScenario === MockErrorScenario.EXECUTABLE_NOT_FOUND) {
      return {
        valid: false,
        errors: [{
          code: 'MOCK_NOT_FOUND',
          message: 'Mock executable not found',
          recoverable: false
        }],
        warnings: []
      };
    }
    
    // Mock adapter always validates successfully
    return {
      valid: true,
      errors: [],
      warnings: []
    };
  }
  
  getRequiredDependencies(): DependencyInfo[] {
    // Mock adapter has no external dependencies
    return [];
  }
  
  // ===== Executable Management =====
  
  async resolveExecutablePath(preferredPath?: string): Promise<string> {
    if (preferredPath) {
      return preferredPath;
    }
    // Use node as the mock executable
    return process.execPath;
  }
  
  getDefaultExecutableName(): string {
    return 'node';
  }
  
  getExecutableSearchPaths(): string[] {
    return process.env.PATH?.split(path.delimiter) || [];
  }
  
  // ===== Adapter Configuration =====
  
  buildAdapterCommand(config: AdapterConfig): AdapterCommand {
    // Get the directory of this module
    // When compiled, this will be in dist/adapters/mock/
    let mockAdapterPath: string;

    try {
      // Try to use import.meta.url if available
      const currentFileUrl = new URL(import.meta.url);
      let currentDir = path.dirname(currentFileUrl.pathname);

      // In Windows, remove the leading slash from the pathname
      if (process.platform === 'win32' && currentDir.startsWith('/')) {
        currentDir = currentDir.substring(1);
      }

      // Decode URL encoding (e.g., %20 for spaces)
      currentDir = decodeURIComponent(currentDir);

      mockAdapterPath = path.join(currentDir, 'mock-adapter-process.js');

      // In npx bundle, the process file is bundled as mock-adapter-process.cjs
      // in the same directory as cli.mjs
      if (!fs.existsSync(mockAdapterPath)) {
        const bundledPath = path.join(currentDir, 'mock-adapter-process.cjs');
        if (fs.existsSync(bundledPath)) {
          mockAdapterPath = bundledPath;
          this.dependencies.logger?.debug(
            `[MockDebugAdapter] Using bundled mock adapter process: ${mockAdapterPath}`
          );
        }
      }
    } catch {
      // Fallback: assume we're running from the project root
      // The compiled file is at packages/adapter-mock/dist/mock-adapter-process.js
      const projectRoot = path.resolve(process.cwd());
      mockAdapterPath = path.join(projectRoot, 'packages', 'adapter-mock', 'dist', 'mock-adapter-process.js');

      this.dependencies.logger?.debug(
        `[MockDebugAdapter] Using fallback path resolution: ${mockAdapterPath}`
      );
    }

    return {
      command: process.execPath,
      args: [
        mockAdapterPath,
        '--port', config.adapterPort.toString(),
        '--host', config.adapterHost,
        '--session', config.sessionId
      ],
      env: {
        ...process.env,
        MOCK_ADAPTER_LOG: config.logDir
      }
    };
  }
  
  getAdapterModuleName(): string {
    return 'mock-adapter';
  }
  
  getAdapterInstallCommand(): string {
    return 'echo "Mock adapter is built-in"';
  }
  
  // ===== Debug Configuration =====
  
  async transformLaunchConfig(config: GenericLaunchConfig): Promise<LanguageSpecificLaunchConfig> {
    return {
      ...config,
      type: 'mock',
      request: 'launch',
      name: 'Mock Debug'
    };
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
    // Mock adapter just validates the request is appropriate
    
    this.dependencies.logger?.debug(`[MockDebugAdapter] DAP request: ${command}`, args);
    
    // ProxyManager will handle actual communication
    return {} as T;
  }
  
  handleDapEvent(event: DebugProtocol.Event): void {
    // Update thread ID on stopped events
    if (event.event === 'stopped' && event.body?.threadId) {
      this.currentThreadId = event.body.threadId;
      this.transitionTo(AdapterState.DEBUGGING);
    } else if (event.event === 'continued') {
      this.transitionTo(AdapterState.DEBUGGING);
    } else if (event.event === 'terminated' || event.event === 'exited') {
      this.currentThreadId = null;
      if (this.connected) {
        this.transitionTo(AdapterState.CONNECTED);
      }
    }
    
    type AdapterEventName = Extract<keyof AdapterEvents, string | symbol>;
    this.emit(event.event as AdapterEventName, event.body);
  }
  
  handleDapResponse(_response: DebugProtocol.Response): void {
    // Mock adapter doesn't need special response handling
    void _response; // Explicitly ignore
  }
  
  // ===== Connection Management =====
  
  async connect(host: string, port: number): Promise<void> {
    // Simulate connection delay if configured
    if (this.config.connectionDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.config.connectionDelay));
    }
    
    if (this.errorScenario === MockErrorScenario.CONNECTION_TIMEOUT) {
      throw new AdapterError(
        'Connection timeout',
        AdapterErrorCode.CONNECTION_TIMEOUT,
        true
      );
    }
    
    // Connection is handled by ProxyManager
    // Store connection info for debugging purposes
    this.dependencies.logger?.debug(`[MockDebugAdapter] Connect request to ${host}:${port}`);
    
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
    return 'The Mock Debug Adapter is built-in and requires no installation.';
  }
  
  getMissingExecutableError(): string {
    return 'Mock executable not found. This should not happen with the mock adapter.';
  }
  
  translateErrorMessage(error: Error): string {
    if (error.message.includes('ENOENT')) {
      return 'Mock file not found: ' + error.message;
    }
    return error.message;
  }
  
  // ===== Feature Support =====
  
  supportsFeature(feature: DebugFeature): boolean {
    return this.config.supportedFeatures?.includes(feature) || false;
  }
  
  getFeatureRequirements(feature: DebugFeature): FeatureRequirement[] {
    const requirements: FeatureRequirement[] = [];
    
    if (feature === DebugFeature.CONDITIONAL_BREAKPOINTS) {
      requirements.push({
        type: 'version',
        description: 'Mock adapter version 1.0+',
        required: true
      });
    }
    
    return requirements;
  }
  
  getCapabilities(): AdapterCapabilities {
    return {
      supportsConfigurationDoneRequest: true,
      supportsFunctionBreakpoints: this.supportsFeature(DebugFeature.FUNCTION_BREAKPOINTS),
      supportsConditionalBreakpoints: this.supportsFeature(DebugFeature.CONDITIONAL_BREAKPOINTS),
      supportsHitConditionalBreakpoints: false,
      supportsEvaluateForHovers: this.supportsFeature(DebugFeature.EVALUATE_FOR_HOVERS),
      exceptionBreakpointFilters: [],
      supportsStepBack: false,
      supportsSetVariable: this.supportsFeature(DebugFeature.SET_VARIABLE),
      supportsRestartFrame: false,
      supportsGotoTargetsRequest: false,
      supportsStepInTargetsRequest: false,
      supportsCompletionsRequest: false,
      supportsModulesRequest: false,
      supportsRestartRequest: false,
      supportsExceptionOptions: false,
      supportsValueFormattingOptions: false,
      supportsExceptionInfoRequest: false,
      supportTerminateDebuggee: true,
      supportSuspendDebuggee: false,
      supportsDelayedStackTraceLoading: false,
      supportsLoadedSourcesRequest: false,
      supportsLogPoints: this.supportsFeature(DebugFeature.LOG_POINTS),
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
  
  // ===== Mock-specific methods =====
  
  /**
   * Set error scenario for testing
   */
  setErrorScenario(scenario: MockErrorScenario): void {
    this.errorScenario = scenario;
  }
}

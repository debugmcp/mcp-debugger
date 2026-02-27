/**
 * Java Debug Adapter implementation using JDI bridge (JdiDapServer)
 *
 * JdiDapServer is a single-file Java program that implements a minimal DAP
 * server using JDI (com.sun.jdi.*) directly. It speaks DAP over TCP natively,
 * eliminating the need for the stdio-tcp bridge that KDA required.
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
  AdapterConfig,
  AdapterCommand,
  GenericLaunchConfig,
  GenericAttachConfig,
  LanguageSpecificLaunchConfig,
  LanguageSpecificAttachConfig,
  DebugFeature,
  FeatureRequirement,
  AdapterCapabilities,
  AdapterError,
  AdapterErrorCode,
} from '@debugmcp/shared';
import { DebugLanguage } from '@debugmcp/shared';
import { AdapterDependencies } from '@debugmcp/shared';
import { findJavaExecutable, getJavaVersion, getJavaSearchPaths } from './utils/java-utils.js';
import { resolveJdiBridgeClassDir, ensureJdiBridgeCompiled } from './utils/jdi-resolver.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Java-specific launch configuration
 */
interface JavaLaunchConfig extends LanguageSpecificLaunchConfig {
  mainClass?: string;
  classpath?: string;
  sourcePath?: string;
  vmArgs?: string;
  javaPath?: string;
  [key: string]: unknown;
}

/**
 * Java Debug Adapter implementation
 */
export class JavaDebugAdapter extends EventEmitter implements IDebugAdapter {
  readonly language = DebugLanguage.JAVA;
  readonly name = 'Java Debug Adapter (JDI)';

  private state: AdapterState = AdapterState.UNINITIALIZED;
  private dependencies: AdapterDependencies;

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

      if (validation.warnings?.length) {
        for (const warning of validation.warnings) {
          this.dependencies.logger?.warn(`[JavaDebugAdapter] ${warning.message}`);
        }
      }

      if (!validation.valid) {
        this.transitionTo(AdapterState.ERROR);
        throw new AdapterError(
          validation.errors[0]?.message || 'Java environment validation failed',
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
    this.state = newState;
    this.emit('stateChanged', oldState, newState);
  }

  // ===== Environment Validation =====

  async validateEnvironment(): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Check Java executable
      await findJavaExecutable();

      // Check Java version
      const javaVersion = await getJavaVersion();
      if (javaVersion) {
        const parts = javaVersion.split('.');
        const major = parseInt(parts[0], 10);
        const effectiveMajor = major === 1 ? parseInt(parts[1], 10) : major;

        if (effectiveMajor < 11) {
          warnings.push({
            code: 'JAVA_VERSION_OLD',
            message: `Java 11+ recommended for best results. Current version: ${javaVersion}`
          });
        }
      }

      // Check JDI bridge
      const bridgeDir = resolveJdiBridgeClassDir();
      if (!bridgeDir) {
        warnings.push({
          code: 'JDI_BRIDGE_NOT_COMPILED',
          message: 'JDI bridge not compiled. Run: pnpm --filter @debugmcp/adapter-java run build:adapter'
        });
      }

    } catch (error) {
      errors.push({
        code: 'JAVA_NOT_FOUND',
        message: error instanceof Error ? error.message : 'Java executable not found',
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
        name: 'JDK',
        version: '11+',
        required: true,
        installCommand: 'Download from https://adoptium.net/'
      }
    ];
  }

  // ===== Executable Management =====

  async resolveExecutablePath(preferredPath?: string): Promise<string> {
    return findJavaExecutable(preferredPath);
  }

  getDefaultExecutableName(): string {
    return process.platform === 'win32' ? 'java.exe' : 'java';
  }

  getExecutableSearchPaths(): string[] {
    return getJavaSearchPaths();
  }

  // ===== Adapter Configuration =====

  buildAdapterCommand(config: AdapterConfig): AdapterCommand {
    // Try to find compiled bridge, or compile on demand
    let bridgeDir = resolveJdiBridgeClassDir();
    if (!bridgeDir) {
      bridgeDir = ensureJdiBridgeCompiled();
    }

    if (!bridgeDir) {
      throw new AdapterError(
        'JDI bridge not compiled. Run: pnpm --filter @debugmcp/adapter-java run build:adapter',
        AdapterErrorCode.ENVIRONMENT_INVALID
      );
    }

    if (!config.adapterPort || config.adapterPort === 0) {
      throw new AdapterError(
        `Valid TCP port required for Java adapter. Port was: ${config.adapterPort}`,
        AdapterErrorCode.ENVIRONMENT_INVALID
      );
    }

    // Find java executable
    const javaCmd = process.env.JAVA_HOME
      ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
      : 'java';

    const env: Record<string, string> = { ...process.env as Record<string, string> };

    this.dependencies.logger?.info(`[JavaDebugAdapter] Using JDI bridge at: ${bridgeDir}`);
    this.dependencies.logger?.info(`[JavaDebugAdapter] Listening on port: ${config.adapterPort}`);

    return {
      command: javaCmd,
      args: [
        '-cp', bridgeDir,
        'JdiDapServer',
        '--port', String(config.adapterPort),
      ],
      env
    };
  }

  getAdapterModuleName(): string {
    return 'jdi-bridge';
  }

  getAdapterInstallCommand(): string {
    return 'pnpm --filter @debugmcp/adapter-java run build:adapter';
  }

  // ===== Debug Configuration =====

  async transformLaunchConfig(config: GenericLaunchConfig): Promise<LanguageSpecificLaunchConfig> {
    const javaConfig: JavaLaunchConfig = {
      ...config,
      type: 'java',
      request: 'launch',
      stopOnEntry: config.stopOnEntry ?? true,
    };

    // If a .java source file is provided as 'program', determine mainClass
    const program = (config as Record<string, unknown>).program as string | undefined;
    if (program) {
      if (program.endsWith('.java')) {
        javaConfig.mainClass = path.basename(program, '.java');
      } else {
        javaConfig.mainClass = program;
      }
    }

    // Pass through classpath if provided
    const classpath = (config as Record<string, unknown>).classpath as string | undefined;
    if (classpath) {
      javaConfig.classpath = classpath;
    }

    // Pass through sourcePath if provided
    const sourcePath = (config as Record<string, unknown>).sourcePath as string | undefined;
    if (sourcePath) {
      javaConfig.sourcePath = sourcePath;
    }

    if (config.cwd) {
      javaConfig.cwd = config.cwd;
    }

    if (config.env) {
      javaConfig.env = config.env;
    }

    if (config.args) {
      javaConfig.args = config.args;
    }

    return javaConfig;
  }

  getDefaultLaunchConfig(): Partial<GenericLaunchConfig> {
    return {
      stopOnEntry: true,
      justMyCode: true
    };
  }

  // ===== Attach Support =====

  supportsAttach(): boolean {
    return true;
  }

  transformAttachConfig(config: GenericAttachConfig): LanguageSpecificAttachConfig {
    const attachConfig: LanguageSpecificAttachConfig = {
      type: 'java',
      request: 'attach',
      host: config.host || 'localhost',
      port: config.port,
    };

    if (config.sourcePaths) {
      attachConfig.sourcePaths = config.sourcePaths;
    }
    if (config.stopOnEntry !== undefined) {
      attachConfig.stopOnEntry = config.stopOnEntry;
    }
    if (config.cwd) {
      attachConfig.cwd = config.cwd;
    }
    if (config.env) {
      attachConfig.env = config.env;
    }
    if (config.timeout !== undefined) {
      attachConfig.timeout = config.timeout;
    }

    return attachConfig;
  }

  getDefaultAttachConfig(): Partial<GenericAttachConfig> {
    return {
      request: 'attach',
      host: 'localhost',
    };
  }

  // ===== DAP Protocol Operations =====

  async sendDapRequest<T extends DebugProtocol.Response>(
    _command: string,
    _args?: unknown
  ): Promise<T> {
    throw new Error('DAP request forwarding not implemented - handled by DAP client');
  }

  handleDapEvent(event: DebugProtocol.Event): void {
    switch (event.event) {
      case 'stopped':
        this.transitionTo(AdapterState.DEBUGGING);
        if (event.body?.threadId) {
          this.currentThreadId = event.body.threadId;
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

  handleDapResponse(_response: DebugProtocol.Response): void {
    // No-op: responses handled by ProxyManager
  }

  // ===== Connection Management =====

  async connect(_host: string, _port: number): Promise<void> {
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
    return `Java Debugging Setup:

1. Install JDK 11 or higher:
   - All platforms: Download from https://adoptium.net/
   - macOS: brew install openjdk
   - Ubuntu: sudo apt install openjdk-17-jdk
   - Windows: Download from https://adoptium.net/

2. Compile the JDI bridge:
   cd packages/adapter-java
   pnpm run build:adapter

3. Verify installation:
   java -version
   # Should show JDK 11+

4. Ensure JAVA_HOME is set (optional but recommended):
   export JAVA_HOME=/path/to/jdk`;
  }

  getMissingExecutableError(): string {
    return `Java not found. Please ensure JDK 11+ is installed and available in PATH.

Download from: https://adoptium.net/

After installation:
- Add Java to your PATH
- Set JAVA_HOME environment variable
- Restart your terminal`;
  }

  translateErrorMessage(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes('jdi') && message.includes('not compiled')) {
      return 'JDI bridge not compiled. Run: pnpm --filter @debugmcp/adapter-java run build:adapter';
    }

    if (message.includes('java') && message.includes('not found')) {
      return this.getMissingExecutableError();
    }

    if (message.includes('permission denied')) {
      return 'Permission denied accessing executable. Check file permissions.';
    }

    if (message.includes('classnotfound') || message.includes('noclassdef')) {
      return 'Java class not found. Ensure the classpath is correct and the class is compiled.';
    }

    return error.message;
  }

  // ===== Feature Support =====

  supportsFeature(feature: DebugFeature): boolean {
    const supportedFeatures = [
      DebugFeature.CONDITIONAL_BREAKPOINTS,
      DebugFeature.EXCEPTION_BREAKPOINTS,
      DebugFeature.EVALUATE_FOR_HOVERS,
      DebugFeature.TERMINATE_REQUEST,
    ];

    return supportedFeatures.includes(feature);
  }

  getFeatureRequirements(feature: DebugFeature): FeatureRequirement[] {
    const requirements: FeatureRequirement[] = [];

    switch (feature) {
      case DebugFeature.CONDITIONAL_BREAKPOINTS:
        requirements.push({
          type: 'dependency',
          description: 'JDK 11+ with JDI support',
          required: true
        });
        break;

      case DebugFeature.EXCEPTION_BREAKPOINTS:
        requirements.push({
          type: 'dependency',
          description: 'JDI exception request support',
          required: true
        });
        break;
    }

    return requirements;
  }

  getCapabilities(): AdapterCapabilities {
    return {
      supportsConfigurationDoneRequest: true,
      supportsFunctionBreakpoints: false,
      supportsConditionalBreakpoints: true,
      supportsHitConditionalBreakpoints: false,
      supportsEvaluateForHovers: true,
      exceptionBreakpointFilters: [
        {
          filter: 'caught',
          label: 'Caught Exceptions',
          description: 'Break on caught exceptions',
          default: false,
          supportsCondition: false
        },
        {
          filter: 'uncaught',
          label: 'Uncaught Exceptions',
          description: 'Break on uncaught exceptions',
          default: true,
          supportsCondition: false
        }
      ],
      supportsStepBack: false,
      supportsSetVariable: false,
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

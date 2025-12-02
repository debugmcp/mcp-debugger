/**
 * Java Debug Adapter
 *
 * Implements the IDebugAdapter interface for Java debugging using jdb.
 * This adapter bridges the Debug Adapter Protocol (DAP) with jdb's text-based interface.
 *
 * @since 1.0.0
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
  AdapterCommand,
  AdapterConfig,
  GenericLaunchConfig,
  LanguageSpecificLaunchConfig,
  GenericAttachConfig,
  LanguageSpecificAttachConfig,
  DebugFeature,
  FeatureRequirement,
  AdapterCapabilities,
  AdapterDependencies,
  DebugLanguage
} from '@debugmcp/shared';
import {
  findJavaExecutable,
  getJavaVersion,
  parseJavaMajorVersion,
  findJdb,
  findJavaHome
} from './utils/java-utils.js';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Java-specific launch configuration
 */
export interface JavaLaunchConfig extends LanguageSpecificLaunchConfig {
  /** Main class to debug (e.g., "com.example.Main") */
  mainClass?: string;
  /** Classpath for Java application */
  classpath?: string;
  /** Source paths for mapping files to classes */
  sourcePaths?: string[];
  /** VM arguments */
  vmArgs?: string[];
  /** Program to run */
  program?: string;
}

/**
 * Java attach configuration (for remote debugging)
 */
export interface JavaAttachConfig extends LanguageSpecificAttachConfig {
  /** Type of debug request */
  type: 'java';
  /** Request type */
  request: 'attach';
  /** Remote host (default: localhost) */
  hostName?: string;
  /** Remote debug port */
  port: number;
  /** Connection timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Source paths for mapping files to classes */
  sourcePaths?: string[];
  /** Process ID (for local attach by PID, jdb extension) */
  processId?: number | string;
  /** Index signature for additional properties */
  [key: string]: unknown;
}

/**
 * Java Debug Adapter implementation using jdb
 */
export class JavaDebugAdapter extends EventEmitter implements IDebugAdapter {
  readonly language = DebugLanguage.JAVA;
  readonly name = 'Java Debug Adapter (jdb)';

  private state: AdapterState = AdapterState.UNINITIALIZED;
  private currentThreadId: number | null = null;
  private connected = false;
  private javaPath: string | null = null;
  private jdbPath: string | null = null;

  constructor(private dependencies: AdapterDependencies) {
    super();
  }

  // ===== Lifecycle Management =====

  async initialize(): Promise<void> {
    this.transitionTo(AdapterState.INITIALIZING);

    const validation = await this.validateEnvironment();
    if (!validation.valid) {
      this.transitionTo(AdapterState.ERROR);
      throw new Error(`Environment validation failed: ${validation.errors[0]?.message}`);
    }

    this.transitionTo(AdapterState.READY);
    this.emit('initialized');
  }

  async dispose(): Promise<void> {
    if (this.connected) {
      await this.disconnect();
    }
    this.state = AdapterState.UNINITIALIZED;
    this.emit('disposed');
    this.removeAllListeners();
  }

  // ===== State Management =====

  getState(): AdapterState {
    return this.state;
  }

  isReady(): boolean {
    return this.state === AdapterState.READY || this.state === AdapterState.CONNECTED;
  }

  getCurrentThreadId(): number | null {
    return this.currentThreadId;
  }

  private transitionTo(newState: AdapterState): void {
    const oldState = this.state;
    this.state = newState;
    this.emit('stateChanged', { from: oldState, to: newState });
  }

  // ===== Environment Validation =====

  async validateEnvironment(): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Check Java executable
      this.javaPath = await this.resolveExecutablePath();
      const version = await getJavaVersion(this.javaPath);

      if (version) {
        const majorVersion = parseJavaMajorVersion(version);
        if (majorVersion < 8) {
          errors.push({
            code: 'JAVA_VERSION_TOO_OLD',
            message: `Java 8 or higher required. Current: ${version}`,
            recoverable: false
          });
        }
      } else {
        warnings.push({
          code: 'JAVA_VERSION_UNKNOWN',
          message: 'Could not determine Java version'
        });
      }

      // Check jdb availability
      try {
        this.jdbPath = await findJdb(this.javaPath);
      } catch (error) {
        errors.push({
          code: 'JDB_NOT_FOUND',
          message: error instanceof Error ? error.message : 'jdb not found',
          recoverable: false
        });
      }
    } catch (error) {
      errors.push({
        code: 'JAVA_NOT_FOUND',
        message: error instanceof Error ? error.message : 'Java not found',
        recoverable: false
      });
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  getRequiredDependencies(): DependencyInfo[] {
    return [
      {
        name: 'Java JDK',
        version: '8+',
        required: true,
        installCommand: 'Install Java JDK from https://adoptium.net/ or https://www.oracle.com/java/'
      },
      {
        name: 'jdb',
        required: true,
        installCommand: 'jdb is included with Java JDK'
      }
    ];
  }

  // ===== Executable Management =====

  async resolveExecutablePath(preferredPath?: string): Promise<string> {
    return await findJavaExecutable(preferredPath, this.dependencies.logger);
  }

  getDefaultExecutableName(): string {
    return 'java';
  }

  getExecutableSearchPaths(): string[] {
    const paths: string[] = [];
    const javaHome = findJavaHome();

    if (javaHome) {
      paths.push(path.join(javaHome, 'bin'));
    }

    // Common Java installation paths
    if (process.platform === 'win32') {
      paths.push('C:\\Program Files\\Java', 'C:\\Program Files\\AdoptOpenJDK');
    } else if (process.platform === 'darwin') {
      paths.push('/Library/Java/JavaVirtualMachines', '/System/Library/Java/JavaVirtualMachines');
    } else {
      paths.push('/usr/lib/jvm', '/usr/local/java');
    }

    return paths;
  }

  // ===== Adapter Configuration =====

  buildAdapterCommand(config: AdapterConfig): AdapterCommand {
    // Run the jdb-dap-server.js with Node.js (not Java!)
    const jdbDapServerPath = path.join(__dirname, 'jdb-dap-server.js');

    return {
      command: process.execPath, // Use Node.js (not Java) to run our DAP server
      args: [
        jdbDapServerPath,
        '--port', config.adapterPort.toString(),
        '--jdb-path', this.jdbPath || 'jdb',
        '--session-id', config.sessionId
      ],
      env: {
        ...process.env,
        JAVA_HOME: findJavaHome() || ''
      }
    };
  }

  getAdapterModuleName(): string {
    return 'jdb';
  }

  getAdapterInstallCommand(): string {
    return 'jdb is included with Java JDK. Install Java JDK from https://adoptium.net/';
  }

  // ===== Debug Configuration =====

  async transformLaunchConfig(config: GenericLaunchConfig): Promise<JavaLaunchConfig> {
    const javaConfig: JavaLaunchConfig = {
      ...config,
      type: 'java',
      request: 'launch',
      name: 'Java Debug',
      mainClass: 'Main', // Will be set from scriptPath in buildAdapterCommand
      classpath: config.cwd || '.',
      sourcePaths: config.cwd ? [config.cwd] : [],
      vmArgs: []
    };

    return javaConfig;
  }

  getDefaultLaunchConfig(): Partial<GenericLaunchConfig> {
    return {
      stopOnEntry: false,
      justMyCode: true,
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

  transformAttachConfig(config: GenericAttachConfig): JavaAttachConfig {
    // Default to remote attach via host:port
    const hostName = config.host || 'localhost';
    const port = config.port;

    if (!port) {
      throw new Error('Port is required for Java attach');
    }

    const javaConfig: JavaAttachConfig = {
      ...config,
      type: 'java',
      request: 'attach',
      hostName,
      port,
      timeout: config.timeout || 30000,
      sourcePaths: config.sourcePaths || (config.cwd ? [config.cwd] : [])
    };

    // If processId is provided, add it for local attach
    if (config.processId) {
      javaConfig.processId = config.processId;
    }

    return javaConfig;
  }

  getDefaultAttachConfig(): Partial<GenericAttachConfig> {
    return {
      host: 'localhost',
      timeout: 30000,
      stopOnEntry: false,
      justMyCode: false
    };
  }

  private extractMainClass(programPath: string): string {
    // Extract class name from path
    // Example: /path/to/Main.java → Main
    // Example: /path/to/com/example/App.java → com.example.App
    const basename = path.basename(programPath, '.java');
    return basename;
  }

  private inferClasspath(programPath: string): string {
    // Default to the directory containing the program
    return path.dirname(programPath);
  }

  // ===== DAP Protocol Operations =====

  async sendDapRequest<T extends DebugProtocol.Response>(
    _command: string,
    _args?: unknown
  ): Promise<T> {
    // This will be delegated to ProxyManager
    // For now, throw an error
    throw new Error('sendDapRequest must be called through ProxyManager');
  }

  handleDapEvent(event: DebugProtocol.Event): void {
    // Handle DAP events from jdb-dap-server
    switch (event.event) {
      case 'stopped':
        if (event.body?.threadId) {
          this.currentThreadId = event.body.threadId;
        }
        this.transitionTo(AdapterState.DEBUGGING);
        break;

      case 'continued':
        // Stay in DEBUGGING state
        break;

      case 'terminated':
      case 'exited':
        this.currentThreadId = null;
        this.transitionTo(AdapterState.DISCONNECTED);
        break;
    }

    // Emit the event for SessionManager
    this.emit(event.event, event.body);
  }

  handleDapResponse(_response: DebugProtocol.Response): void {
    // Handle responses if needed
    // Most response handling is done by ProxyManager
  }

  // ===== Connection Management =====

  async connect(_host: string, _port: number): Promise<void> {
    // Connection is managed by ProxyManager
    this.connected = true;
    this.transitionTo(AdapterState.CONNECTED);
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.transitionTo(AdapterState.DISCONNECTED);
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ===== Error Handling =====

  getInstallationInstructions(): string {
    return [
      'To debug Java applications, you need Java JDK 8 or higher installed.',
      '',
      'Installation options:',
      '1. Adoptium (recommended): https://adoptium.net/',
      '2. Oracle JDK: https://www.oracle.com/java/',
      '3. OpenJDK: https://openjdk.org/install/',
      '',
      'After installation:',
      '1. Set JAVA_HOME environment variable to your JDK installation path',
      '2. Add $JAVA_HOME/bin to your PATH',
      '3. Verify installation: java -version',
      '4. Verify jdb is available: jdb -version'
    ].join('\n');
  }

  getMissingExecutableError(): string {
    return 'Java executable not found. Please install Java JDK 8 or higher.';
  }

  translateErrorMessage(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes('java') && message.includes('not found')) {
      return this.getMissingExecutableError() + '\n\n' + this.getInstallationInstructions();
    }

    if (message.includes('jdb') && message.includes('not found')) {
      return 'jdb (Java Debugger) not found. jdb is part of the Java JDK.\n\n' +
             this.getInstallationInstructions();
    }

    if (message.includes('version')) {
      return 'Java version 8 or higher is required for debugging.';
    }

    return error.message;
  }

  // ===== Feature Support =====

  supportsFeature(feature: DebugFeature): boolean {
    const supportedFeatures = new Set([
      DebugFeature.FUNCTION_BREAKPOINTS,
      DebugFeature.EXCEPTION_BREAKPOINTS
      // Note: jdb does not natively support conditional breakpoints
    ]);

    return supportedFeatures.has(feature);
  }

  getFeatureRequirements(_feature: DebugFeature): FeatureRequirement[] {
    // No special requirements for Java debugging features
    return [];
  }

  getCapabilities(): AdapterCapabilities {
    return {
      supportsConfigurationDoneRequest: true,
      supportsFunctionBreakpoints: true,
      supportsConditionalBreakpoints: false, // jdb limitation
      supportsEvaluateForHovers: true,
      supportsStepInTargetsRequest: false,
      supportsTerminateRequest: true,
      supportsBreakpointLocationsRequest: false,
      supportsExceptionInfoRequest: true,
      exceptionBreakpointFilters: [
        {
          filter: 'all',
          label: 'All Exceptions',
          default: false
        },
        {
          filter: 'uncaught',
          label: 'Uncaught Exceptions',
          default: true
        }
      ]
    };
  }
}

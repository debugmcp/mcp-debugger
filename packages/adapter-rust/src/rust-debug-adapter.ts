/**
 * Rust Debug Adapter implementation using CodeLLDB
 * 
 * Provides Rust-specific debugging functionality via CodeLLDB.
 * Follows the proxy-based architecture where ProxyManager handles
 * actual process spawning and DAP communication.
 * 
 * @since 0.1.0
 */
import { EventEmitter } from 'events';
import { DebugProtocol } from '@vscode/debugprotocol';
import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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
} from '@debugmcp/shared';
import { DebugLanguage } from '@debugmcp/shared';
import { AdapterDependencies } from '@debugmcp/shared';
import { resolveCodeLLDBExecutable } from './utils/codelldb-resolver.js';
import { checkCargoInstallation, checkRustInstallation, getRustHostTriple } from './utils/rust-utils.js';
import { detectBinaryFormat, BinaryInfo } from './utils/binary-detector.js';

export type MsvcBehavior = 'warn' | 'error' | 'continue';

export interface ToolchainValidationResult {
  compatible: boolean;
  toolchain: 'msvc' | 'gnu' | 'unknown';
  message?: string;
  suggestions?: string[];
  behavior: MsvcBehavior;
  binaryInfo: BinaryInfo;
}

/**
 * Cache entry for executable paths
 */
interface ExecutablePathCacheEntry {
  path: string;
  timestamp: number;
  version?: string;
  hasCodeLLDB?: boolean;
}

/**
 * Rust-specific launch configuration
 */
interface RustLaunchConfig extends LanguageSpecificLaunchConfig {
  program: string;                       // Path to the executable
  sourceLanguages?: string[];            // Should be ['rust'] for proper formatting
  cargo?: {                             // Cargo-specific options
    build?: boolean;                     // Whether to build before debugging
    bin?: string;                        // Binary target name
    example?: string;                    // Example target name
    test?: string;                       // Test target name
    release?: boolean;                   // Build in release mode
    features?: string[];                 // Cargo features to enable
    allFeatures?: boolean;               // Enable all features
    noDefaultFeatures?: boolean;         // Disable default features
  };
  sourceMap?: Record<string, string>;    // Source path mappings
  initCommands?: string[];              // LLDB commands to run on init
  preRunCommands?: string[];            // LLDB commands before running
  postRunCommands?: string[];           // LLDB commands after running
  console?: 'internalConsole' | 'integratedTerminal' | 'externalTerminal';
  [key: string]: unknown;               // Required by LanguageSpecificLaunchConfig
}

/**
 * Rust Debug Adapter implementation
 */
export class RustDebugAdapter extends EventEmitter implements IDebugAdapter {
  readonly language = DebugLanguage.RUST;
  readonly name = 'Rust Debug Adapter';
  
  private state: AdapterState = AdapterState.UNINITIALIZED;
  private dependencies: AdapterDependencies;
  private lastToolchainValidation: ToolchainValidationResult | undefined;
  private readonly msvcBehavior: MsvcBehavior;
  private readonly autoSuggestGnu: boolean;
  
  // Caching
  private executablePathCache = new Map<string, ExecutablePathCacheEntry>();
  private readonly cacheTimeout = 60000; // 1 minute
  
  // State
  private currentThreadId: number | null = null;
  private connected = false;
  
  constructor(dependencies: AdapterDependencies) {
    super();
    this.dependencies = dependencies;
    this.msvcBehavior = this.resolveMsvcBehavior();
    this.autoSuggestGnu = this.resolveAutoSuggestGnu();
  }

  public consumeLastToolchainValidation(): ToolchainValidationResult | undefined {
    const value = this.lastToolchainValidation;
    this.lastToolchainValidation = undefined;
    return value;
  }
  
  // ===== Lifecycle Management =====
  
  async initialize(): Promise<void> {
    this.transitionTo(AdapterState.INITIALIZING);

    try {
      // Validate environment
      const validation = await this.validateEnvironment();
      
      // Log warnings
      if (validation.warnings?.length) {
        for (const warning of validation.warnings) {
          this.dependencies.logger?.warn(`[RustDebugAdapter] ${warning.message}`);
        }
      }
      
      if (!validation.valid) {
        this.transitionTo(AdapterState.ERROR);
        throw new AdapterError(
          validation.errors[0]?.message || 'Rust environment validation failed',
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
    this.executablePathCache.clear();
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
      // Check CodeLLDB executable
      const codelldbPath = await resolveCodeLLDBExecutable();
      if (!codelldbPath) {
        errors.push({
          code: 'CODELLDB_NOT_FOUND',
          message: 'CodeLLDB executable not found. Run: npm run build:adapter',
          recoverable: true
        });
      }
      
      // Check Rust installation
      const rustInstalled = await checkRustInstallation();
      if (!rustInstalled) {
        warnings.push({
          code: 'RUST_NOT_FOUND',
          message: 'Rust toolchain not found. Install from https://rustup.rs/'
        });
      }

      const hostTriple = await getRustHostTriple();
      if (hostTriple && /-pc-windows-msvc/i.test(hostTriple)) {
        warnings.push({
          code: 'RUST_MSVC_TOOLCHAIN',
          message: 'Detected Rust MSVC toolchain. For the best debugging experience with CodeLLDB, use the GNU toolchain (x86_64-pc-windows-gnu) or ensure DWARF debug info is available.'
        });
      }
      
      // Check Cargo installation
      const cargoInstalled = await checkCargoInstallation();
      if (!cargoInstalled) {
        warnings.push({
          code: 'CARGO_NOT_FOUND',
          message: 'Cargo not found in PATH. Install Rust from https://rustup.rs/'
        });
      }
      
      // Check for Windows-specific requirements
      if (process.platform === 'win32') {
        // Check for MSVC runtime (optional but recommended for native debugging)
        const hasMSVC = process.env['VCINSTALLDIR'] || process.env['VS140COMNTOOLS'];
        if (!hasMSVC) {
          warnings.push({
            code: 'MSVC_NOT_FOUND',
            message: 'Microsoft Visual C++ runtime not found. Native Windows debugging may be limited.'
          });
        }
      }
      
    } catch (error) {
      errors.push({
        code: 'VALIDATION_ERROR',
        message: error instanceof Error ? error.message : 'Environment validation failed',
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
        name: 'CodeLLDB',
        version: '1.11.0+',
        required: true,
        installCommand: 'npm run build:adapter'
      },
      {
        name: 'Rust',
        version: 'stable',
        required: false,
        installCommand: 'Install from https://rustup.rs'
      },
      {
        name: 'Cargo',
        version: 'latest',
        required: false,
        installCommand: 'Included with Rust installation'
      }
    ];
  }
  
  // ===== Executable Management =====
  
  async resolveExecutablePath(preferredPath?: string): Promise<string> {
    // Check cache first
    const cacheKey = preferredPath || 'default';
    const cached = this.executablePathCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      this.dependencies.logger?.debug(`[RustDebugAdapter] Using cached executable path: ${cached.path}`);
      return cached.path;
    }
    
    // Find Cargo executable
    let execPath: string;
    
    if (preferredPath) {
      // Validate user-provided path
      try {
        await fs.access(preferredPath);
        execPath = preferredPath;
      } catch {
        throw new AdapterError(
          `Specified executable not found: ${preferredPath}`,
          AdapterErrorCode.EXECUTABLE_NOT_FOUND
        );
      }
    } else {
      // Find Cargo in PATH
      const cargoInstalled = await checkCargoInstallation();
      if (cargoInstalled) {
        execPath = 'cargo';
      } else {
        // Fallback to rustc if cargo not found
        const rustInstalled = await checkRustInstallation();
        if (rustInstalled) {
          execPath = 'rustc';
        } else {
          throw new AdapterError(
            'Neither cargo nor rustc found in PATH',
            AdapterErrorCode.EXECUTABLE_NOT_FOUND
          );
        }
      }
    }
    
    // Cache the result
    this.executablePathCache.set(cacheKey, {
      path: execPath,
      timestamp: Date.now()
    });
    
    return execPath;
  }
  
  getDefaultExecutableName(): string {
    return 'cargo';
  }
  
  getExecutableSearchPaths(): string[] {
    const paths: string[] = [];
    
    // Add Rust-specific paths
    const rustupHome = process.env.RUSTUP_HOME || path.join(process.env.HOME || '', '.rustup');
    const cargoHome = process.env.CARGO_HOME || path.join(process.env.HOME || '', '.cargo');
    
    if (process.platform === 'win32') {
      paths.push(
        path.join(cargoHome, 'bin'),
        path.join(rustupHome, 'toolchains', 'stable-x86_64-pc-windows-msvc', 'bin'),
        'C:\\Program Files\\Rust\\bin'
      );
    } else if (process.platform === 'darwin') {
      paths.push(
        path.join(cargoHome, 'bin'),
        path.join(rustupHome, 'toolchains', 'stable-x86_64-apple-darwin', 'bin'),
        '/usr/local/bin',
        '/opt/homebrew/bin'
      );
    } else {
      paths.push(
        path.join(cargoHome, 'bin'),
        path.join(rustupHome, 'toolchains', 'stable-x86_64-unknown-linux-gnu', 'bin'),
        '/usr/local/bin',
        '/usr/bin'
      );
    }
    
    // Add PATH directories
    if (process.env.PATH) {
      paths.push(...process.env.PATH.split(path.delimiter));
    }
    
    return paths;
  }

  private resolveMsvcBehavior(): MsvcBehavior {
    const envValue =
      this.dependencies.environment?.get('RUST_MSVC_BEHAVIOR') ??
      process.env.RUST_MSVC_BEHAVIOR ??
      '';
    const raw = envValue.toLowerCase();
    if (raw === 'error' || raw === 'continue' || raw === 'warn') {
      return raw;
    }
    return 'warn';
  }

  private resolveAutoSuggestGnu(): boolean {
    const rawValue =
      this.dependencies.environment?.get('RUST_AUTO_SUGGEST_GNU') ??
      process.env.RUST_AUTO_SUGGEST_GNU;
    if (rawValue === undefined) {
      return true;
    }
    const normalized = rawValue.toLowerCase();
    return !(normalized === '0' || normalized === 'false' || normalized === 'no');
  }

  private buildMsvcWarningMessage(binaryPath: string): string {
    const lines = [
      `Binary: ${binaryPath}`,
      '------------------------------------------------------------',
      'MSVC toolchain detected - limited debugging support.',
      '',
      'This Rust binary was compiled with the MSVC toolchain. CodeLLDB cannot fully',
      'read MSVC PDB debug symbols, which causes:',
      '  - Variable values to appear as <unavailable>',
      '  - Corrupted string contents',
      '  - Missing data for complex types (Vec, HashMap, async state)',
      '',
      'Breakpoints and stepping continue to work, but variable inspection will be limited.',
      '',
      'Recommended actions:',
      ' 1. Switch to the GNU toolchain (best option)',
      '    rustup target add x86_64-pc-windows-gnu',
      '    cargo clean',
      '    cargo +stable-gnu build',
      ' 2. Use Visual Studio Code with the C++ debugger for MSVC builds',
      ' 3. Continue with limited debugging (control flow only)',
      '',
    ];

    return lines.join('\n');
  }

  async validateToolchain(binaryPath: string): Promise<ToolchainValidationResult> {
    try {
      const binaryInfo = await detectBinaryFormat(binaryPath);

      if (binaryInfo.format === 'msvc') {
        const message = this.buildMsvcWarningMessage(binaryPath);
        const suggestions = this.autoSuggestGnu
          ? [
              'Rebuild with GNU toolchain: rustup target add x86_64-pc-windows-gnu',
              'Run: cargo clean && cargo +stable-gnu build',
              'Use Visual Studio Code C++ debugger for MSVC binaries',
              'Set RUST_MSVC_BEHAVIOR=continue to ignore this warning'
            ]
          : [
              'Rebuild with GNU toolchain for full debugging support',
              'Use Visual Studio Code C++ debugger for MSVC binaries'
            ];

        return {
          compatible: false,
          toolchain: 'msvc',
          message,
          suggestions,
          behavior: this.msvcBehavior,
          binaryInfo
        };
      }

      return {
        compatible: true,
        toolchain: binaryInfo.format,
        behavior: this.msvcBehavior,
        binaryInfo
      };
    } catch (error) {
      this.dependencies.logger?.debug?.(
        '[RustDebugAdapter] Failed to detect binary format',
        error
      );
      return {
        compatible: true,
        toolchain: 'unknown',
        behavior: this.msvcBehavior,
        binaryInfo: {
          format: 'unknown',
          hasPDB: false,
          hasRSDS: false,
          imports: [],
          debugInfoType: 'none'
        }
      };
    }
  }

  private async evaluateToolchain(binaryPath: string): Promise<void> {
    const validation = await this.validateToolchain(binaryPath);
    this.lastToolchainValidation = validation;

    if (!validation.compatible) {
      if (validation.behavior === 'error') {
        const message =
          validation.message ||
          'Rust MSVC toolchain binaries are not supported by CodeLLDB';
        throw new AdapterError(message, AdapterErrorCode.ENVIRONMENT_INVALID);
      }

      if (validation.behavior === 'warn' && validation.message) {
        this.dependencies.logger?.warn(validation.message);
      }
    }
  }
  
  // ===== Adapter Configuration =====
  
  buildAdapterCommand(config: AdapterConfig): AdapterCommand {
    // Resolve CodeLLDB executable synchronously (already validated in initialize)
    const codelldbPath = this.resolveCodeLLDBExecutableSync();
    
    if (!codelldbPath) {
      throw new AdapterError(
        'CodeLLDB executable not found. Run: npm run build:adapter',
        AdapterErrorCode.ENVIRONMENT_INVALID
      );
    }
    
    // Validate port - proxy infrastructure requires valid TCP port
    if (!config.adapterPort || config.adapterPort === 0) {
      throw new AdapterError(
        `Valid TCP port required for CodeLLDB adapter. Port was: ${config.adapterPort}`,
        AdapterErrorCode.ENVIRONMENT_INVALID
      );
    }
    
    // Build CodeLLDB command for TCP mode
    // CodeLLDB uses --port argument for TCP mode
    const args = ['--port', String(config.adapterPort)];
    
    // Prepare environment
    const env: Record<string, string> = { ...process.env as Record<string, string> };
    
    // Windows: Enable native PDB reader for MSVC-compiled Rust
    if (process.platform === 'win32') {
      env.LLDB_USE_NATIVE_PDB_READER = '1';
    }
    
    // Ensure RUST_BACKTRACE is enabled for better error messages
    if (!env.RUST_BACKTRACE) {
      env.RUST_BACKTRACE = '1';
    }
    
    this.dependencies.logger?.info(`[RustDebugAdapter] Using CodeLLDB at: ${codelldbPath}`);
    this.dependencies.logger?.debug(`[RustDebugAdapter] CodeLLDB args: ${args.join(' ')}`);
    
    return {
      command: codelldbPath,
      args,
      env
    };
  }
  
  private resolveCodeLLDBExecutableSync(): string | null {
    // Determine platform directory (same logic as async resolver)
    const platform = process.platform;
    const arch = process.arch;
    
    let platformDir = '';
    if (platform === 'win32') {
      platformDir = 'win32-x64';
    } else if (platform === 'darwin') {
      platformDir = arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
    } else if (platform === 'linux') {
      platformDir = arch === 'arm64' ? 'linux-arm64' : 'linux-x64';
    } else {
      return null;
    }
    
    const executableName = platform === 'win32' ? 'codelldb.exe' : 'codelldb';
    const candidatePaths = [
      // When executing via ts-node/ts-node-esm within the package
      path.resolve(__dirname, '..', 'vendor', 'codelldb', platformDir, 'adapter', executableName),
      // When executing from the compiled workspace distribution (dist/packages/adapter-rust/src)
      path.resolve(__dirname, '..', '..', '..', '..', 'packages', 'adapter-rust', 'vendor', 'codelldb', platformDir, 'adapter', executableName),
      // Fallback to workspace-relative resolution from CWD (handles unusual launchers)
      path.resolve(process.cwd(), 'packages', 'adapter-rust', 'vendor', 'codelldb', platformDir, 'adapter', executableName)
    ];
    
    for (const candidate of candidatePaths) {
      try {
        if (existsSync(candidate)) {
          return candidate;
        }
      } catch {
        // Try next candidate
      }
    }
    
    // Check environment variable as fallback
    if (process.env.CODELLDB_PATH) {
      try {
        if (existsSync(process.env.CODELLDB_PATH)) {
          return process.env.CODELLDB_PATH;
        }
      } catch {
        // Fall through
      }
    }
    
    return null;
  }
  
  getAdapterModuleName(): string {
    return 'codelldb';
  }
  
  getAdapterInstallCommand(): string {
    return 'npm run build:adapter';
  }
  
  // ===== Debug Configuration =====
  
  async transformLaunchConfig(config: GenericLaunchConfig): Promise<LanguageSpecificLaunchConfig> {
    const rustConfig = config as RustLaunchConfig;
    
    // Base configuration for CodeLLDB
    const launchConfig: RustLaunchConfig = {
      type: 'lldb',
      request: 'launch',
      name: rustConfig.name || 'Debug Rust',
      program: '',  // Will be resolved below
      args: rustConfig.args || [],
      cwd: rustConfig.cwd || process.cwd(),
      env: rustConfig.env || {},
      stopOnEntry: rustConfig.stopOnEntry || false,
      
      // Critical: Enable Rust language support for proper pretty-printing
      sourceLanguages: ['rust'],
      
      // Console configuration
      console: rustConfig.console || 'internalConsole',
      
      // Source mapping for debugging std library (optional)
      sourceMap: rustConfig.sourceMap || {},
      
      // LLDB commands (optional)
      initCommands: rustConfig.initCommands || [],
      preRunCommands: rustConfig.preRunCommands || [],
      postRunCommands: rustConfig.postRunCommands || []
    };
    
    // Resolve program path - handle source file paths
    if (rustConfig.program) {
      const programPath = rustConfig.program;
      
      // Check if this is a source file (.rs) instead of a binary
      if (programPath.endsWith('.rs')) {
        this.dependencies.logger?.info('[Rust Debugger] Resolving source file to binary...');
        
        try {
          // Find project root
          const { findCargoProjectRoot, getDefaultBinary, needsRebuild, buildCargoProject } = 
            await import('./utils/cargo-utils.js');
          
          const projectRoot = await findCargoProjectRoot(programPath);
          this.dependencies.logger?.info(`[Rust Debugger] Found Cargo project at: ${projectRoot}`);
          
          // Determine binary path
          const binaryName = await getDefaultBinary(projectRoot);
          const buildMode = rustConfig.cargo?.release ? 'release' : 'debug';
          const extension = process.platform === 'win32' ? '.exe' : '';
          const binaryPath = path.join(
            projectRoot,
            'target',
            buildMode,
            `${binaryName}${extension}`
          );
          
          // Check if build is needed
          if (await needsRebuild(projectRoot, binaryName, buildMode === 'release')) {
            this.dependencies.logger?.info('[Rust Debugger] Binary is out of date, rebuilding...');
            
            const buildResult = await buildCargoProject(
              projectRoot,
              this.dependencies.logger,
              buildMode
            );
            
            if (!buildResult.success) {
              throw new Error(`Cargo build failed: ${buildResult.error}`);
            }
            
            launchConfig.program = buildResult.binaryPath!;
          } else {
            this.dependencies.logger?.info('[Rust Debugger] Using existing binary (up to date)');
            launchConfig.program = binaryPath;
          }
          
        } catch (error) {
          this.dependencies.logger?.error(`[Rust Debugger] Failed to resolve binary: ${error}`);
          throw error;
        }
      } else {
        // Use explicitly specified binary path
        launchConfig.program = path.resolve(rustConfig.cwd || process.cwd(), programPath);
      }
    } else if (rustConfig.cargo) {
      // Build program path from Cargo configuration
      const targetDir = path.join(
        rustConfig.cwd || process.cwd(), 
        'target',
        rustConfig.cargo.release ? 'release' : 'debug'
      );
      
      let binaryName: string;
      if (rustConfig.cargo.bin) {
        binaryName = rustConfig.cargo.bin;
      } else if (rustConfig.cargo.example) {
        binaryName = rustConfig.cargo.example;
      } else if (rustConfig.cargo.test) {
        binaryName = rustConfig.cargo.test;
      } else {
        // Try to find default binary
        binaryName = 'main';  // Will need to be resolved from Cargo.toml
        this.dependencies.logger?.warn('[RustDebugAdapter] No binary specified, defaulting to "main"');
      }
      
      const extension = process.platform === 'win32' ? '.exe' : '';
      launchConfig.program = path.join(targetDir, `${binaryName}${extension}`);
    } else {
      throw new AdapterError(
        'No program specified. Provide either "program" or "cargo" configuration.',
        AdapterErrorCode.SCRIPT_NOT_FOUND
      );
    }
    
    // Copy over Cargo configuration if present
    if (rustConfig.cargo) {
      launchConfig.cargo = rustConfig.cargo;
    }
    
    // Handle preLaunchTask for building
    if (rustConfig.preLaunchTask === 'cargo build' || rustConfig.cargo?.build) {
      // Note: Actual building would be handled by the session manager or a pre-launch task
      this.dependencies.logger?.info('[RustDebugAdapter] Cargo build requested before debugging');
    }

    if (typeof launchConfig.program === 'string' && launchConfig.program.length > 0) {
      await this.evaluateToolchain(launchConfig.program);
    }
    
    return launchConfig;
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
    // Adapter just needs to validate the request is appropriate for Rust/LLDB
    
    this.dependencies.logger?.debug(`[RustDebugAdapter] DAP request: ${command}`);
    
    // Validate Rust/LLDB-specific commands
    if (command === 'setExceptionBreakpoints' && args) {
      // LLDB has different exception handling than other debuggers
      const exceptionArgs = args as DebugProtocol.SetExceptionBreakpointsArguments;
      // LLDB supports C++ exceptions, Rust panics are different
      const validFilters = ['rust_panic', 'cpp_throw', 'cpp_catch'];
      const invalidFilters = exceptionArgs.filters?.filter(f => !validFilters.includes(f));
      if (invalidFilters?.length) {
        this.dependencies.logger?.warn(`[RustDebugAdapter] Unknown exception filters: ${invalidFilters.join(', ')}`);
      }
    }
    
    // ProxyManager will handle actual communication
    return {} as T;
  }
  
  handleDapEvent(event: DebugProtocol.Event): void {
    this.dependencies.logger?.debug(`[RustDebugAdapter] DAP event: ${event.event}`);
    
    // Update thread ID on stopped events
    if (event.event === 'stopped' && event.body?.threadId) {
      this.currentThreadId = event.body.threadId;
      this.transitionTo(AdapterState.DEBUGGING);
    }
    
    // Handle other state transitions
    if (event.event === 'terminated' || event.event === 'exited') {
      this.currentThreadId = null;
      if (this.connected) {
        this.transitionTo(AdapterState.CONNECTED);
      }
    }
    
    type AdapterEventName = Extract<keyof AdapterEvents, string | symbol>;
    this.emit(event.event as AdapterEventName, event.body);
  }
  
  handleDapResponse(response: DebugProtocol.Response): void {
    // Log response for debugging
    this.dependencies.logger?.debug(`[RustDebugAdapter] DAP response: ${response.command} (success: ${response.success})`);
    
    if (!response.success && response.message) {
      this.dependencies.logger?.error(`[RustDebugAdapter] DAP error: ${response.message}`);
    }
  }
  
  // ===== Connection Management =====
  
  async connect(host: string, port: number): Promise<void> {
    // Connection is handled by ProxyManager
    // Store connection info for debugging purposes
    this.dependencies.logger?.debug(`[RustDebugAdapter] Connect request to ${host}:${port}`);
    
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
    return `Rust Debugging Setup:

1. Install Rust toolchain:
   - Visit https://rustup.rs and follow instructions
   - Or use your package manager:
     * macOS: brew install rust
     * Ubuntu: sudo apt install rustc cargo
     * Windows: Download installer from https://rustup.rs

2. Install CodeLLDB:
   cd packages/adapter-rust
   npm run build:adapter

3. Verify installation:
   rustc --version
   cargo --version

For Windows users:
   - Install Visual Studio Build Tools for best debugging experience
   - CodeLLDB will use native PDB reader for MSVC-compiled binaries

For macOS users:
   - Xcode Command Line Tools required for LLDB
   - Run: xcode-select --install

For Linux users:
   - Ensure glibc >= 2.18 for CodeLLDB compatibility`;
  }
  
  getMissingExecutableError(): string {
    return `Rust toolchain not found. Please ensure Rust is installed and available in PATH.
    
Install Rust from https://rustup.rs

After installation, verify with:
  rustc --version
  cargo --version

You can also specify the Rust executable path explicitly in your debug configuration.`;
  }
  
  translateErrorMessage(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('codelldb') && message.includes('not found')) {
      return 'CodeLLDB is not installed. Please run: npm run build:adapter in packages/adapter-rust/';
    }
    
    if (message.includes('cargo') && message.includes('not found')) {
      return this.getMissingExecutableError();
    }
    
    if (message.includes('permission denied')) {
      return `Permission denied accessing executable. Check file permissions.`;
    }
    
    if (message.includes('target') && message.includes('debug')) {
      return `Debug binary not found. Run 'cargo build' first or enable automatic building in configuration.`;
    }
    
    if (message.includes('lldb') && message.includes('failed')) {
      return `LLDB failed to start. Ensure CodeLLDB is properly installed and your system meets requirements.`;
    }
    
    return error.message;
  }
  
  // ===== Feature Support =====
  
  supportsFeature(feature: DebugFeature): boolean {
    const supportedFeatures = [
      DebugFeature.CONDITIONAL_BREAKPOINTS,
      DebugFeature.FUNCTION_BREAKPOINTS,
      DebugFeature.DATA_BREAKPOINTS,
      DebugFeature.VARIABLE_PAGING,
      DebugFeature.EVALUATE_FOR_HOVERS,
      DebugFeature.SET_VARIABLE,
      DebugFeature.LOG_POINTS,
      DebugFeature.DISASSEMBLE_REQUEST,
      DebugFeature.STEP_IN_TARGETS_REQUEST,
      DebugFeature.LOADED_SOURCES_REQUEST,
      DebugFeature.TERMINATE_REQUEST
    ];
    
    return supportedFeatures.includes(feature);
  }
  
  getFeatureRequirements(feature: DebugFeature): FeatureRequirement[] {
    const requirements: FeatureRequirement[] = [];
    
    switch (feature) {
      case DebugFeature.DATA_BREAKPOINTS:
        requirements.push({
          type: 'version',
          description: 'CodeLLDB 1.7+',
          required: true
        });
        break;
        
      case DebugFeature.DISASSEMBLE_REQUEST:
        requirements.push({
          type: 'configuration',
          description: 'LLDB disassembler support',
          required: true
        });
        break;
        
      case DebugFeature.LOG_POINTS:
        requirements.push({
          type: 'version',
          description: 'CodeLLDB 1.6+',
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
      supportsStepBack: false,  // LLDB doesn't support reverse debugging by default
      supportsSetVariable: true,
      supportsRestartFrame: false,
      supportsGotoTargetsRequest: false,
      supportsStepInTargetsRequest: true,
      supportsCompletionsRequest: true,
      completionTriggerCharacters: ['.', ':', '>', '<'],
      supportsModulesRequest: true,
      supportsRestartRequest: false,
      supportsExceptionOptions: true,
      supportsValueFormattingOptions: true,
      supportsExceptionInfoRequest: false,  // Rust panics are different from exceptions
      supportTerminateDebuggee: true,
      supportSuspendDebuggee: false,
      supportsDelayedStackTraceLoading: true,
      supportsLoadedSourcesRequest: true,
      supportsLogPoints: true,
      supportsTerminateThreadsRequest: false,
      supportsSetExpression: false,
      supportsTerminateRequest: true,
      supportsDataBreakpoints: true,  // LLDB supports watchpoints
      supportsReadMemoryRequest: false,
      supportsWriteMemoryRequest: false,
      supportsDisassembleRequest: true,  // LLDB has disassembly support
      supportsCancelRequest: false,
      supportsBreakpointLocationsRequest: true,
      supportsClipboardContext: false,
      supportsSteppingGranularity: true,  // LLDB supports instruction-level stepping
      supportsInstructionBreakpoints: true,
      supportsExceptionFilterOptions: false,
      supportsSingleThreadExecutionRequests: false
    };
  }
}


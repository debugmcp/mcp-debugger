/**
 * C/C++ Debug Adapter implementation using CodeLLDB (issue #325)
 *
 * Provides C/C++ debugging via the shared CodeLLDB infrastructure
 * (@debugmcp/codelldb-common). Follows the proxy-based architecture where
 * ProxyManager handles actual process spawning and DAP communication.
 *
 * Launch inputs: a prebuilt executable (primary), or a lone .c/.cpp source
 * file auto-compiled with `-g -O0` when stale. Attach: by PID.
 *
 * Advanced CodeLLDB launch keys (initCommands, targetCreateCommands /
 * processCreateCommands for core dumps and gdbserver/rr remote targets,
 * expressions, sourceMap, breakpointMode, …) pass through untouched.
 */
import { EventEmitter } from 'events';
import { DebugProtocol } from '@vscode/debugprotocol';
import * as path from 'path';
import { promises as fs } from 'fs';
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
  AdapterEvents,
  GenericAttachConfig,
  LanguageSpecificAttachConfig
} from '@debugmcp/shared';
import { DebugLanguage } from '@debugmcp/shared';
import { AdapterDependencies } from '@debugmcp/shared';
import {
  resolveCodeLLDBExecutable,
  resolveCodeLLDBExecutableSyncImpl,
  detectBinaryFormat,
  prepareCodelldbExecutablePath,
  buildCodeLLDBArgs,
  configurePythonEnvironment,
  resolveTerminalKind,
  deriveSourceMapFromBinary,
  BinaryInfo
} from '@debugmcp/codelldb-common';
import {
  isCppSourceFile,
  findAnyCompiler,
  needsRecompile,
  compileSourceFile,
  getDefaultOutputPath,
  CPP_COMPILER_CANDIDATES,
  C_COMPILER_CANDIDATES
} from './utils/compile-utils.js';

export type MsvcBehavior = 'warn' | 'error' | 'continue';

export interface ToolchainValidationResult {
  compatible: boolean;
  toolchain: 'msvc' | 'gnu' | 'unknown';
  message?: string;
  suggestions?: string[];
  behavior: MsvcBehavior;
  binaryInfo: BinaryInfo;
}

interface ExecutablePathCacheEntry {
  path: string;
  timestamp: number;
}

/**
 * C/C++ launch configuration (CodeLLDB launch schema + convenience keys)
 */
export interface CppLaunchConfig extends GenericLaunchConfig {
  name?: string;
  program?: string;                      // Executable path OR a lone .c/.cpp source file
  forceRebuild?: boolean;                // Recompile a source-file program even when fresh
  sourceLanguages?: string[];            // LLDB pretty-printer selection; defaults to ['cpp']
  sourceMap?: Record<string, string>;    // Source path mappings
  initCommands?: string[];               // LLDB commands to run on init
  preRunCommands?: string[];             // LLDB commands before running
  postRunCommands?: string[];            // LLDB commands after running
  terminal?: 'console' | 'integrated' | 'external';  // CodeLLDB's canonical attribute
  console?: 'internalConsole' | 'integratedTerminal' | 'externalTerminal';  // legacy alias, accepted as input
  [key: string]: unknown;               // Required by LanguageSpecificLaunchConfig
}

/**
 * C/C++ Debug Adapter implementation
 */
export class CppDebugAdapter extends EventEmitter implements IDebugAdapter {
  readonly language = DebugLanguage.CPP;
  readonly name = 'C/C++ Debug Adapter';

  private state: AdapterState = AdapterState.UNINITIALIZED;
  private dependencies: AdapterDependencies;
  private lastToolchainValidation: ToolchainValidationResult | undefined;
  private readonly msvcBehavior: MsvcBehavior;

  // Caching
  private executablePathCache = new Map<string, ExecutablePathCacheEntry>();
  private readonly cacheTimeout = 60000; // 1 minute

  // State
  private currentThreadId: number | null = null;
  private connected = false;

  constructor(
    dependencies: AdapterDependencies,
    /** Platform override for tests (issue #186); defaults to the real platform. */
    private readonly platform: NodeJS.Platform = process.platform
  ) {
    super();
    this.dependencies = dependencies;
    this.msvcBehavior = this.resolveMsvcBehavior();
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
      const validation = await this.validateEnvironment();

      if (validation.warnings?.length) {
        for (const warning of validation.warnings) {
          this.dependencies.logger?.warn(`[CppDebugAdapter] ${warning.message}`);
        }
      }

      if (!validation.valid) {
        this.transitionTo(AdapterState.ERROR);
        throw new AdapterError(
          validation.errors[0]?.message || 'C/C++ environment validation failed',
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
      // Check CodeLLDB executable — the only hard requirement
      const codelldbPath = await resolveCodeLLDBExecutable();
      if (!codelldbPath) {
        errors.push({
          code: 'CODELLDB_NOT_FOUND',
          message: 'CodeLLDB executable not found. It normally ships via the @debugmcp/codelldb-* optional dependencies (reinstall without --omit=optional), or set CODELLDB_PATH, or in a repo checkout run: npm run build:adapter',
          recoverable: true
        });
      }

      // A compiler is only needed for the single-file convenience path —
      // prebuilt-binary debugging works without one.
      const compiler = await findAnyCompiler();
      if (!compiler) {
        warnings.push({
          code: 'CPP_COMPILER_NOT_FOUND',
          message: `No C/C++ compiler found (tried: ${[...CPP_COMPILER_CANDIDATES, ...C_COMPILER_CANDIDATES].join(', ')}). Prebuilt-binary debugging still works; install a compiler for source-file launch (MSYS2/MinGW-w64 on Windows, build-essential on Debian/Ubuntu, Xcode CLT on macOS).`
        });
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
        name: 'C/C++ compiler (g++/clang++)',
        required: false,
        installCommand: 'MSYS2/MinGW-w64 (Windows), build-essential (Debian/Ubuntu), xcode-select --install (macOS)'
      }
    ];
  }

  // ===== Executable Management =====

  async resolveExecutablePath(preferredPath?: string): Promise<string> {
    const cacheKey = preferredPath || 'default';
    const cached = this.executablePathCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      this.dependencies.logger?.debug(`[CppDebugAdapter] Using cached executable path: ${cached.path}`);
      return cached.path;
    }

    let execPath: string;
    const relaxedMode = this.getRelaxedToolchainMode();

    if (preferredPath) {
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
      const compiler = await findAnyCompiler();
      if (compiler) {
        execPath = compiler;
      } else if (relaxedMode.enabled) {
        execPath = relaxedMode.placeholder;
        this.dependencies.logger?.warn(
          `[CppDebugAdapter] No C/C++ compiler found but ${relaxedMode.reason} active; assuming host-provided binaries`
        );
      } else {
        throw new AdapterError(
          this.getMissingExecutableError(),
          AdapterErrorCode.EXECUTABLE_NOT_FOUND
        );
      }
    }

    this.executablePathCache.set(cacheKey, {
      path: execPath,
      timestamp: Date.now()
    });

    return execPath;
  }

  private getRelaxedToolchainMode(): { enabled: boolean; reason: string; placeholder: string } {
    const placeholder = process.env.MCP_CPP_EXECUTABLE_PLACEHOLDER || 'cpp-prebuilt-binary';

    if (process.env.MCP_CPP_ALLOW_PREBUILT === 'true') {
      return { enabled: true, reason: 'MCP_CPP_ALLOW_PREBUILT', placeholder };
    }

    if (process.env.MCP_CONTAINER === 'true') {
      return { enabled: true, reason: 'MCP_CONTAINER', placeholder };
    }

    return { enabled: false, reason: 'auto-detect', placeholder };
  }

  getDefaultExecutableName(): string {
    return 'g++';
  }

  getExecutableSearchPaths(): string[] {
    const paths: string[] = [];

    if (this.platform === 'win32') {
      paths.push(
        'C:\\msys64\\mingw64\\bin',
        'C:\\msys64\\ucrt64\\bin',
        'C:\\MinGW\\bin',
        'C:\\Program Files\\LLVM\\bin'
      );
    } else if (this.platform === 'darwin') {
      paths.push('/usr/bin', '/usr/local/bin', '/opt/homebrew/bin');
    } else {
      paths.push('/usr/bin', '/usr/local/bin');
    }

    if (process.env.PATH) {
      paths.push(...process.env.PATH.split(path.delimiter));
    }

    return paths;
  }

  private resolveMsvcBehavior(): MsvcBehavior {
    const envValue =
      this.dependencies.environment?.get('CPP_MSVC_BEHAVIOR') ??
      process.env.CPP_MSVC_BEHAVIOR ??
      '';
    const raw = envValue.toLowerCase();
    if (raw === 'error' || raw === 'continue' || raw === 'warn') {
      return raw;
    }
    return 'warn';
  }

  private buildMsvcWarningMessage(binaryPath: string): string {
    const lines = [
      `Binary: ${binaryPath}`,
      '------------------------------------------------------------',
      'MSVC-compiled binary detected - limited debugging support.',
      '',
      'This binary carries MSVC PDB debug info. CodeLLDB cannot fully read',
      'PDB symbols (the native PDB reader is enabled, but coverage is partial),',
      'which can cause:',
      '  - Variable values to appear as <unavailable>',
      '  - Corrupted string contents',
      '  - Missing data for complex types (std::vector, std::map, ...)',
      '',
      'Breakpoints and stepping continue to work, but variable inspection may be limited.',
      '',
      'Recommended actions:',
      ' 1. Rebuild with a DWARF-emitting toolchain (best option):',
      '    g++ -g -O0 ... (MinGW-w64/MSYS2) or clang++ -g -O0 ...',
      ' 2. Continue with limited debugging (control flow only)',
      '',
    ];

    return lines.join('\n');
  }

  async validateToolchain(binaryPath: string): Promise<ToolchainValidationResult> {
    try {
      const binaryInfo = await detectBinaryFormat(binaryPath);

      if (binaryInfo.format === 'msvc') {
        const message = this.buildMsvcWarningMessage(binaryPath);
        return {
          compatible: false,
          toolchain: 'msvc',
          message,
          suggestions: [
            'Rebuild with MinGW-w64: g++ -g -O0 -o app app.cpp',
            'Or with clang: clang++ -g -O0 -o app app.cpp'
          ],
          behavior: this.msvcBehavior,
          binaryInfo
        };
      }

      return {
        compatible: true,
        toolchain: binaryInfo.format === 'gnu' ? 'gnu' : 'unknown',
        behavior: this.msvcBehavior,
        binaryInfo
      };
    } catch (error) {
      this.dependencies.logger?.warn(`[CppDebugAdapter] Toolchain detection failed: ${error}`);
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
    const result = await this.validateToolchain(binaryPath);
    this.lastToolchainValidation = result;

    if (!result.compatible && result.message) {
      if (this.msvcBehavior === 'error') {
        throw new AdapterError(result.message, AdapterErrorCode.ENVIRONMENT_INVALID);
      }
      if (this.msvcBehavior === 'warn') {
        this.dependencies.logger?.warn(`[CppDebugAdapter] ${result.message}`);
      }
    }
  }

  // ===== Adapter Configuration =====

  buildAdapterCommand(config: AdapterConfig): AdapterCommand {
    const resolvedPath = this.resolveCodeLLDBExecutableSync();

    if (!resolvedPath) {
      throw new AdapterError(
        'CodeLLDB executable not found. It normally ships via the @debugmcp/codelldb-* optional dependencies (reinstall without --omit=optional), or set CODELLDB_PATH, or in a repo checkout run: npm run build:adapter',
        AdapterErrorCode.ENVIRONMENT_INVALID
      );
    }

    const codelldbPath =
      prepareCodelldbExecutablePath(resolvedPath, this.platform, this.dependencies.logger) ?? resolvedPath;

    // Validate port - proxy infrastructure requires valid TCP port
    if (!config.adapterPort || config.adapterPort === 0) {
      throw new AdapterError(
        `Valid TCP port required for CodeLLDB adapter. Port was: ${config.adapterPort}`,
        AdapterErrorCode.ENVIRONMENT_INVALID
      );
    }

    const args = buildCodeLLDBArgs(codelldbPath, config.adapterPort, this.platform, this.dependencies.logger);

    const env: Record<string, string> = { ...process.env as Record<string, string> };

    // Windows: enable the native PDB reader so MSVC binaries get best-effort symbols
    if (this.platform === 'win32') {
      env.LLDB_USE_NATIVE_PDB_READER = '1';
    }

    configurePythonEnvironment(env, codelldbPath, this.dependencies.logger);

    this.dependencies.logger?.info(`[CppDebugAdapter] Using CodeLLDB at: ${codelldbPath}`);

    return {
      command: codelldbPath,
      args,
      env
    };
  }

  private resolveCodeLLDBExecutableSync(): string | null {
    // Shared candidate walk (issue #265). This file compiles one directory
    // shallower than the resolver's package, so pass our own package root —
    // the monorepo fallbacks land on packages/codelldb-common.
    return resolveCodeLLDBExecutableSyncImpl({
      platform: this.platform,
      packageRoot: path.resolve(__dirname, '..')
    });
  }

  getAdapterModuleName(): string {
    return 'codelldb';
  }

  getAdapterInstallCommand(): string {
    return 'npm run build:adapter';
  }

  // ===== Debug Configuration =====

  async transformLaunchConfig(config: GenericLaunchConfig): Promise<LanguageSpecificLaunchConfig> {
    const cppConfig = config as CppLaunchConfig;

    const {
      name,
      program,
      forceRebuild,
      sourceLanguages,
      sourceMap,
      initCommands,
      preRunCommands,
      postRunCommands,
      terminal: _terminal,
      console: _console,
      args,
      cwd,
      env,
      stopOnEntry,
      ...rest
    } = cppConfig;
    void _terminal;
    void _console;

    // Advanced passthrough first, normalized keys after — CodeLLDB power
    // features (targetCreateCommands/processCreateCommands for core dumps and
    // gdbserver/rr remote targets, expressions, breakpointMode, …) flow
    // through undamaged, while the keys we normalize always win.
    const launchConfig: LanguageSpecificLaunchConfig = {
      ...rest,
      type: 'lldb',
      request: 'launch',
      name: name || 'Debug C/C++',
      program: '',
      args: args || [],
      cwd: cwd || process.cwd(),
      env: env || {},
      stopOnEntry: stopOnEntry || false,
      sourceLanguages: sourceLanguages || ['cpp'],
      terminal: resolveTerminalKind(cppConfig),
      sourceMap: sourceMap || {},
      initCommands: initCommands || [],
      preRunCommands: preRunCommands || [],
      postRunCommands: postRunCommands || []
    };

    // Tracks whether the binary was compiled during this launch — a binary
    // built inside the container already has container paths in its DWARF,
    // so sourceMap derivation (issue #363) is unnecessary.
    let compiledAtLaunch = false;

    if (program) {
      const programPath = String(program);

      if (isCppSourceFile(programPath)) {
        // Convenience path: a lone source file, compiled on demand
        const sourcePath = path.resolve(cwd || process.cwd(), programPath);
        const outputPath = getDefaultOutputPath(sourcePath, this.platform);

        if (forceRebuild === true || await needsRecompile(sourcePath, outputPath)) {
          this.dependencies.logger?.info(`[CppDebugAdapter] Compiling ${sourcePath}...`);
          const result = await compileSourceFile({
            sourcePath,
            outputPath,
            logger: this.dependencies.logger
          });
          if (!result.success) {
            throw new Error(`C/C++ compile failed: ${result.error}`);
          }
          launchConfig.program = result.binaryPath!;
          compiledAtLaunch = true;
        } else {
          this.dependencies.logger?.info('[CppDebugAdapter] Using existing binary (up to date)');
          launchConfig.program = outputPath;
        }
      } else {
        // Primary path: a prebuilt executable
        launchConfig.program = path.resolve(cwd || process.cwd(), programPath);
      }
    } else {
      throw new AdapterError(
        'No program specified. Provide "program": a compiled executable or a single .c/.cpp source file.',
        AdapterErrorCode.SCRIPT_NOT_FOUND
      );
    }

    if (typeof launchConfig.program === 'string' && launchConfig.program.length > 0) {
      await this.evaluateToolchain(launchConfig.program);
    }

    // Container mode (issue #363): a host-built binary embeds host-absolute
    // DWARF paths, so /workspace breakpoint requests never match. Best-effort:
    // derive a hostPrefix -> workspaceRoot sourceMap from the binary's
    // embedded path strings. Caller-supplied sourceMap entries always win.
    if (
      process.env.MCP_CONTAINER === 'true' &&
      !compiledAtLaunch &&
      Object.keys(sourceMap || {}).length === 0 &&
      typeof launchConfig.program === 'string' &&
      launchConfig.program.length > 0
    ) {
      const workspaceRoot = process.env.MCP_WORKSPACE_ROOT || '/workspace';
      const derived = deriveSourceMapFromBinary(launchConfig.program, workspaceRoot);
      if (Object.keys(derived).length > 0) {
        launchConfig.sourceMap = derived;
        this.dependencies.logger?.info(
          `[CppDebugAdapter] Container mode: derived sourceMap from binary DWARF paths: ${JSON.stringify(derived)}`
        );
      }
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

  // ===== Attach Support =====

  supportsAttach(): boolean {
    return true;
  }

  supportsDetach(): boolean {
    // LLDB detach leaves the target running
    return true;
  }

  transformAttachConfig(config: GenericAttachConfig): LanguageSpecificAttachConfig {
    const {
      request: _request,
      identifierType: _identifierType,
      processId,
      processName: _processName,
      host: _host,
      port: _port,
      timeout: _timeout,
      sourcePaths: _sourcePaths,
      stopOnEntry,
      justMyCode: _justMyCode,
      env: _env,
      cwd: _cwd,
      ...rest
    } = config;
    void _request; void _identifierType; void _processName; void _host;
    void _port; void _timeout; void _sourcePaths; void _justMyCode;
    void _env; void _cwd;

    const pid = processId !== undefined && processId !== null ? Number(processId) : NaN;
    if (!Number.isInteger(pid) || pid <= 0) {
      throw new AdapterError(
        'C/C++ attach requires a numeric processId (attach-by-PID). Name/host-based attach is not supported yet.',
        AdapterErrorCode.UNSUPPORTED_OPERATION
      );
    }

    // Advanced passthrough (program for symbol resolution, initCommands, …)
    // with the normalized attach shape on top.
    return {
      ...rest,
      type: 'lldb',
      request: 'attach',
      pid,
      // Hold the target paused after attach unless the caller opts out —
      // agents attach to inspect, not to keep running blind.
      stopOnEntry: stopOnEntry ?? true
    };
  }

  getDefaultAttachConfig(): Partial<GenericAttachConfig> {
    return {
      request: 'attach',
      stopOnEntry: true
    };
  }

  // ===== DAP Protocol Operations =====

  async sendDapRequest<T extends DebugProtocol.Response>(
    command: string,
    args?: unknown
  ): Promise<T> {
    // Stub: actual DAP forwarding done by ProxyManager. Only validates setExceptionBreakpoints filters.

    this.dependencies.logger?.debug(`[CppDebugAdapter] DAP request: ${command}`);

    if (command === 'setExceptionBreakpoints' && args) {
      const exceptionArgs = args as DebugProtocol.SetExceptionBreakpointsArguments;
      const validFilters = ['cpp_throw', 'cpp_catch'];
      const invalidFilters = exceptionArgs.filters?.filter(f => !validFilters.includes(f));
      if (invalidFilters?.length) {
        this.dependencies.logger?.warn(`[CppDebugAdapter] Unknown exception filters: ${invalidFilters.join(', ')}`);
      }
    }

    // ProxyManager will handle actual communication
    return {} as T;
  }

  handleDapEvent(event: DebugProtocol.Event): void {
    this.dependencies.logger?.debug(`[CppDebugAdapter] DAP event: ${event.event}`);

    if (event.event === 'stopped' && event.body?.threadId) {
      this.currentThreadId = event.body.threadId;
      this.transitionTo(AdapterState.DEBUGGING);
    }

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
    this.dependencies.logger?.debug(`[CppDebugAdapter] DAP response: ${response.command} (success: ${response.success})`);

    if (!response.success && response.message) {
      this.dependencies.logger?.error(`[CppDebugAdapter] DAP error: ${response.message}`);
    }
  }

  // ===== Connection Management =====

  async connect(host: string, port: number): Promise<void> {
    // Connection is handled by ProxyManager
    this.dependencies.logger?.debug(`[CppDebugAdapter] Connect request to ${host}:${port}`);

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
    return `C/C++ Debugging Setup:

1. Install a compiler (only needed for source-file launch; prebuilt binaries work without one):
   - Windows: MSYS2/MinGW-w64 (pacman -S mingw-w64-x86_64-gcc) or LLVM/clang
   - Ubuntu/Debian: sudo apt install build-essential
   - macOS: xcode-select --install

2. Install CodeLLDB:
   npm run build:adapter

3. Compile your program with debug info:
   g++ -gdwarf-4 -O0 -o myapp myapp.cpp
   (clang++ works identically; -gdwarf-4 explicitly — MinGW gcc's default
   DWARF-5 line tables are unreadable by LLDB in PE-COFF, and MSVC PDB
   support is partial)

4. Verify installation:
   g++ --version`;
  }

  getMissingExecutableError(): string {
    return `No C/C++ compiler found (tried: ${[...CPP_COMPILER_CANDIDATES, ...C_COMPILER_CANDIDATES].join(', ')}).

A compiler is only required when launching a .c/.cpp source file directly —
debugging a prebuilt executable works without one (set MCP_CPP_ALLOW_PREBUILT=true
to skip this check).

Install:
  - Windows: MSYS2/MinGW-w64 or LLVM/clang
  - Ubuntu/Debian: sudo apt install build-essential
  - macOS: xcode-select --install`;
  }

  translateErrorMessage(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes('codelldb') && message.includes('not found')) {
      return 'CodeLLDB is not installed. It normally ships via the @debugmcp/codelldb-* optional dependencies; set CODELLDB_PATH, or in a repo checkout run: npm run build:adapter';
    }

    if (message.includes('compiler') && message.includes('not found')) {
      return this.getMissingExecutableError();
    }

    if (message.includes('permission denied') || message.includes('eperm')) {
      return 'Permission denied. For attach on Linux, check ptrace scope: sysctl kernel.yama.ptrace_scope (1 blocks attaching to non-child processes; 0 allows it). Otherwise check file permissions.';
    }

    if (message.includes('lldb') && message.includes('failed')) {
      return 'LLDB failed to start. Ensure CodeLLDB is properly installed and your system meets requirements.';
    }

    return error.message;
  }

  // ===== Feature Support =====

  supportsFeature(feature: DebugFeature): boolean {
    const supportedFeatures = [
      DebugFeature.CONDITIONAL_BREAKPOINTS,
      DebugFeature.FUNCTION_BREAKPOINTS,
      DebugFeature.EXCEPTION_BREAKPOINTS,
      DebugFeature.EXCEPTION_INFO_REQUEST,
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
          description: 'CodeLLDB 1.7+ (hardware watchpoints: 1/2/4/8-byte regions, max 4 on x86_64)',
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
      exceptionBreakpointFilters: [
        {
          filter: 'cpp_throw',
          label: 'C++: on throw',
          description: 'Break whenever a C++ exception is thrown (first chance)',
          default: false
        },
        {
          filter: 'cpp_catch',
          label: 'C++: on catch',
          description: 'Break whenever a C++ exception is caught',
          default: false
        }
      ],
      supportsStepBack: false,  // Reverse debugging needs an rr backend via custom launch
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
      supportsExceptionInfoRequest: true,  // CodeLLDB implements it for C++ exceptions
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

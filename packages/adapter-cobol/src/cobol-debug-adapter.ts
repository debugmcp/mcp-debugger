/**
 * COBOL Debug Adapter (issue #759): GnuCOBOL programs debugged through the
 * vendored CodeLLDB engine, with a Node DAP shim in front of the engine that
 * serves COBOL-shaped scopes, values and expressions from the symbol manifest
 * the builder derives from cobc's generated C.
 *
 * Launch inputs: a `.cob`/`.cbl`/`.cobol` source (compiled on demand into
 * `.debug-mcp/cobol/<name>/<buildKey>/`), or a prebuilt executable (its
 * manifest is regenerated from `sources` by a translate-only `cobc -C`).
 * Attach: by PID (manifests from `manifestDirs`).
 *
 * The adapter process mcp-debugger spawns is `node cobol-shim.js … -- <codelldb> …`;
 * the shim spawns CodeLLDB itself. Advanced CodeLLDB keys pass through untouched.
 */
import { EventEmitter } from 'events';
import type { DebugProtocol } from '@vscode/debugprotocol';
import * as path from 'path';
import * as fs from 'fs';
import { promises as fsp } from 'fs';
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
  LanguageSpecificAttachConfig,
  DebugLanguage,
  AdapterDependencies
} from '@debugmcp/shared';
import {
  resolveCodeLLDBExecutable,
  resolveCodeLLDBExecutableSyncImpl,
  prepareCodelldbExecutablePath,
  buildCodeLLDBArgs,
  configurePythonEnvironment,
  resolveTerminalKind
} from '@debugmcp/codelldb-common';
import {
  findCobc,
  cobcEnvironment,
  GnuCobolBuilder,
  isCobolSourceFile,
  type CobcLocation,
  type CobolBuildResult
} from './build/index.js';
import { COBOL_PRIVATE_KEY, SHIM_ENTRY_BASENAME, buildShimArgs, type CobolShimSessionOptions } from './shim-protocol.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Exception filter the shim implements as a function breakpoint on libcob's `cob_runtime_error`. */
export const COBOL_RUNTIME_ERROR_FILTER = 'cobol_runtime_error';

/**
 * COBOL launch configuration: the CodeLLDB launch schema plus the GnuCOBOL
 * build and shim options.
 */
export interface CobolLaunchConfig extends GenericLaunchConfig {
  name?: string;
  /** A COBOL source (auto-compiled) or a prebuilt executable. */
  program?: string;
  /** Extra sources statically linked into the program, or the sources of a prebuilt executable. */
  sources?: string[];
  /** Sources built as dynamically CALLed modules (`cobc -m`), placed on COB_LIBRARY_PATH. */
  modules?: string[];
  /** `-std=<dialect>`: ibm, mf, cobol85, default, … */
  dialect?: string;
  /** Source format; cobc's own default applies when omitted. */
  format?: 'fixed' | 'free';
  /** `-I` copybook search directories. */
  copybookDirs?: string[];
  /** Extra cobc flags, verbatim. */
  cobcFlags?: string[];
  /** `--debug`: enable all libcob runtime checks (subscript, ODO, ref-mod, numeric). */
  runtimeChecks?: boolean;
  forceRebuild?: boolean;
  /** File fed to the debuggee's stdin (`ACCEPT … FROM SYSIN`). */
  stdinFile?: string;
  /** Show the engine's own scopes (Local/Static/Global/Registers) after the COBOL ones. */
  engineScopes?: boolean;
  /** Pre-existing manifest directories (skips regeneration for prebuilt binaries). */
  manifestDirs?: string[];
  sourceLanguages?: string[];
  sourceMap?: Record<string, string>;
  initCommands?: string[];
  preRunCommands?: string[];
  postRunCommands?: string[];
  terminal?: 'console' | 'integrated' | 'external';
  console?: 'internalConsole' | 'integratedTerminal' | 'externalTerminal';
  [key: string]: unknown;
}

interface ExecutablePathCacheEntry {
  path: string;
  timestamp: number;
}

/**
 * COBOL Debug Adapter implementation
 */
export class CobolDebugAdapter extends EventEmitter implements IDebugAdapter {
  readonly language = DebugLanguage.COBOL;
  readonly name = 'COBOL Debug Adapter';

  // CodeLLDB attach options plus our sugar. Unlisted keys still reach the
  // engine (forwarded with a warning); this list powers recognition + typo hints (#466).
  readonly supportedAttachKeys = [
    'processId',
    'pid',
    'program',
    'stopOnEntry',
    'waitFor',
    'manifestDirs',
    'engineScopes',
    'initCommands',
    'preRunCommands',
    'postRunCommands',
    'exitCommands',
    'targetCreateCommands',
    'processCreateCommands',
    'expressions',
    'sourceMap',
    'sourceLanguages',
    'relativePathBase',
    'breakpointMode'
  ] as const;

  private state: AdapterState = AdapterState.UNINITIALIZED;
  private dependencies: AdapterDependencies;
  private executablePathCache = new Map<string, ExecutablePathCacheEntry>();
  private readonly cacheTimeout = 60000;
  private cobcLocation: CobcLocation | null | undefined;
  private lastBuild: CobolBuildResult | undefined;
  private lastShimOptions: CobolShimSessionOptions | undefined;
  private currentThreadId: number | null = null;
  private connected = false;

  constructor(
    dependencies: AdapterDependencies,
    /** Platform override for tests; defaults to the real platform. */
    private readonly platform: NodeJS.Platform = process.platform
  ) {
    super();
    this.dependencies = dependencies;
  }

  /** The last successful build (source launch or manifest regeneration), for diagnostics and tests. */
  consumeLastBuild(): CobolBuildResult | undefined {
    const value = this.lastBuild;
    this.lastBuild = undefined;
    return value;
  }

  // ===== Lifecycle Management =====

  async initialize(): Promise<void> {
    this.transitionTo(AdapterState.INITIALIZING);
    try {
      const validation = await this.validateEnvironment();
      for (const warning of validation.warnings ?? []) {
        this.dependencies.logger?.warn(`[CobolDebugAdapter] ${warning.message}`);
      }
      if (!validation.valid) {
        this.transitionTo(AdapterState.ERROR);
        throw new AdapterError(
          validation.errors[0]?.message || 'COBOL environment validation failed',
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
      const codelldbPath = await resolveCodeLLDBExecutable();
      if (!codelldbPath) {
        errors.push({
          code: 'CODELLDB_NOT_FOUND',
          message: 'CodeLLDB executable not found. It normally ships via the @debugmcp/codelldb-* optional dependencies (reinstall without --omit=optional), or set CODELLDB_PATH, or in a repo checkout run: npm run build:adapter',
          recoverable: true
        });
      }
      const cobc = await this.locateCobc();
      if (!cobc) {
        warnings.push({
          code: 'COBC_NOT_FOUND',
          message: 'GnuCOBOL (cobc) not found. Prebuilt-executable debugging still works at the engine level, but source launch and the COBOL symbol manifest (COBOL-shaped variables) need cobc: install GnuCOBOL 3.1.2+ (apt gnucobol3, brew gnucobol, MSYS2 mingw-w64-x86_64-gnucobol) or set COBC_PATH.'
        });
      }
    } catch (error) {
      errors.push({
        code: 'VALIDATION_ERROR',
        message: error instanceof Error ? error.message : 'Environment validation failed',
        recoverable: false
      });
    }
    return { valid: errors.length === 0, errors, warnings };
  }

  getRequiredDependencies(): DependencyInfo[] {
    return [
      { name: 'CodeLLDB', version: '1.11.0+', required: true, installCommand: 'npm run build:adapter' },
      {
        name: 'GnuCOBOL (cobc)',
        version: '3.1.2+',
        required: false,
        installCommand: 'apt install gnucobol3 (Debian/Ubuntu), brew install gnucobol (macOS), pacman -S mingw-w64-x86_64-gnucobol (MSYS2 on Windows)'
      }
    ];
  }

  private async locateCobc(): Promise<CobcLocation | null> {
    if (this.cobcLocation === undefined) {
      this.cobcLocation = await findCobc({ platform: this.platform });
    }
    return this.cobcLocation;
  }

  // ===== Executable Management =====

  async resolveExecutablePath(preferredPath?: string): Promise<string> {
    const cacheKey = preferredPath || 'default';
    const cached = this.executablePathCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.path;
    }
    let execPath: string;
    if (preferredPath) {
      try {
        await fsp.access(preferredPath);
        execPath = preferredPath;
      } catch {
        throw new AdapterError(`Specified executable not found: ${preferredPath}`, AdapterErrorCode.EXECUTABLE_NOT_FOUND);
      }
    } else {
      const cobc = await this.locateCobc();
      if (cobc) {
        execPath = cobc.path;
      } else if (process.env.MCP_CONTAINER === 'true' || process.env.MCP_COBOL_ALLOW_PREBUILT === 'true') {
        execPath = 'cobol-prebuilt-binary';
      } else {
        throw new AdapterError(this.getMissingExecutableError(), AdapterErrorCode.EXECUTABLE_NOT_FOUND);
      }
    }
    this.executablePathCache.set(cacheKey, { path: execPath, timestamp: Date.now() });
    return execPath;
  }

  getDefaultExecutableName(): string {
    return 'cobc';
  }

  getExecutableSearchPaths(): string[] {
    const paths: string[] = [];
    if (this.platform === 'win32') {
      paths.push('C:\\msys64\\mingw64\\bin', 'C:\\msys64\\ucrt64\\bin', 'C:\\msys64\\clang64\\bin');
    } else if (this.platform === 'darwin') {
      paths.push('/opt/homebrew/bin', '/usr/local/bin', '/usr/bin');
    } else {
      paths.push('/usr/bin', '/usr/local/bin');
    }
    if (process.env.PATH) {
      paths.push(...process.env.PATH.split(path.delimiter));
    }
    return paths;
  }

  // ===== Adapter Configuration =====

  /**
   * The adapter process is the shim: `node cobol-shim.js --port <n> [--manifest-dir …] -- <codelldb> [--liblldb …]`.
   * The shim appends CodeLLDB's own `--port`. Env: the Python/PATH setup CodeLLDB
   * needs (as cpp does) plus cobc's bin dir so the debuggee finds libcob on Windows.
   */
  buildAdapterCommand(config: AdapterConfig): AdapterCommand {
    const resolvedPath = this.resolveCodeLLDBExecutableSync();
    if (!resolvedPath) {
      throw new AdapterError(
        'CodeLLDB executable not found. It normally ships via the @debugmcp/codelldb-* optional dependencies (reinstall without --omit=optional), or set CODELLDB_PATH, or in a repo checkout run: npm run build:adapter',
        AdapterErrorCode.ENVIRONMENT_INVALID
      );
    }
    const codelldbPath = prepareCodelldbExecutablePath(resolvedPath, this.platform, this.dependencies.logger) ?? resolvedPath;
    if (!config.adapterPort || config.adapterPort === 0) {
      throw new AdapterError(`Valid TCP port required for the COBOL adapter. Port was: ${config.adapterPort}`, AdapterErrorCode.ENVIRONMENT_INVALID);
    }
    const shimPath = this.resolveShimPath();

    // buildCodeLLDBArgs gives ['--port', n, '--liblldb', p?]; the shim owns the engine port.
    const engineArgs = buildCodeLLDBArgs(codelldbPath, config.adapterPort, this.platform, this.dependencies.logger)
      .filter((arg, index, all) => !(arg === '--port' || (index > 0 && all[index - 1] === '--port')));

    const shimOptions = this.lastShimOptions ?? { manifestDirs: [] };
    const args = [
      shimPath,
      ...buildShimArgs({
        listenPort: config.adapterPort,
        manifestDirs: shimOptions.manifestDirs,
        logFile: config.logDir ? path.join(config.logDir, `cobol-shim-${config.sessionId}.log`) : undefined,
        stdinFile: this.platform === 'win32' ? shimOptions.stdinFile : undefined,
        engineScopes: shimOptions.engineScopes,
        refCheck: shimOptions.refCheck,
        engineCommand: [codelldbPath, ...engineArgs]
      })
    ];

    let env: Record<string, string> = { ...process.env as Record<string, string> };
    if (this.platform === 'win32') {
      env.LLDB_USE_NATIVE_PDB_READER = '1';
    }
    if (this.cobcLocation) {
      env = cobcEnvironment(this.cobcLocation, env, this.platform);
    }
    configurePythonEnvironment(env, codelldbPath, this.dependencies.logger);

    this.dependencies.logger?.info(`[CobolDebugAdapter] Using shim ${shimPath} over CodeLLDB at ${codelldbPath}`);
    return { command: process.execPath, args, env };
  }

  private resolveShimPath(): string {
    const candidates = [
      // Package dist: dist/index.js next to dist/shim/cobol-shim.js
      path.resolve(__dirname, 'shim', SHIM_ENTRY_BASENAME),
      // Bundled NPX distribution (cli.mjs in dist/, shim copied at dist/packages/adapter-cobol/dist/shim/)
      path.resolve(__dirname, 'packages', 'adapter-cobol', 'dist', 'shim', SHIM_ENTRY_BASENAME),
      // Monorepo source tree fallback
      path.resolve(__dirname, '..', '..', '..', '..', 'packages', 'adapter-cobol', 'dist', 'shim', SHIM_ENTRY_BASENAME),
      path.resolve(process.cwd(), 'packages', 'adapter-cobol', 'dist', 'shim', SHIM_ENTRY_BASENAME),
      // Container builds
      `/app/packages/adapter-cobol/dist/shim/${SHIM_ENTRY_BASENAME}`,
      `/app/node_modules/@debugmcp/adapter-cobol/dist/shim/${SHIM_ENTRY_BASENAME}`
    ];
    const found = candidates.find((p) => fs.existsSync(p));
    if (!found) {
      this.dependencies.logger?.error?.('[CobolDebugAdapter] cobol-shim.js not found. Searched:');
      candidates.forEach((p) => this.dependencies.logger?.error?.(`  ${p}: NOT FOUND`));
      throw new AdapterError(
        'cobol-shim.js not found. Run: pnpm --filter @debugmcp/adapter-cobol run build',
        AdapterErrorCode.ENVIRONMENT_INVALID
      );
    }
    return found;
  }

  private resolveCodeLLDBExecutableSync(): string | null {
    return resolveCodeLLDBExecutableSyncImpl({ platform: this.platform, packageRoot: path.resolve(__dirname, '..') });
  }

  getAdapterModuleName(): string {
    return 'codelldb';
  }

  getAdapterInstallCommand(): string {
    return 'npm run build:adapter';
  }

  // ===== Debug Configuration =====

  async transformLaunchConfig(config: GenericLaunchConfig): Promise<LanguageSpecificLaunchConfig> {
    const cobolConfig = config as CobolLaunchConfig;
    const {
      name,
      program,
      sources,
      modules,
      dialect,
      format,
      copybookDirs,
      cobcFlags,
      runtimeChecks,
      forceRebuild,
      stdinFile,
      engineScopes,
      manifestDirs,
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
    } = cobolConfig;
    void _terminal;
    void _console;

    if (!program) {
      throw new AdapterError(
        'No program specified. Provide "program": a COBOL source (.cob/.cbl/.cobol, compiled on demand) or a prebuilt executable.',
        AdapterErrorCode.SCRIPT_NOT_FOUND
      );
    }
    const baseDir = cwd || process.cwd();
    const programPath = path.resolve(baseDir, String(program));
    const absSources = (sources ?? []).map((s) => path.resolve(baseDir, s));
    const absCopybookDirs = (copybookDirs ?? []).map((d) => path.resolve(baseDir, d));

    // Advanced passthrough first, normalized keys after (cpp precedent).
    const launchConfig: LanguageSpecificLaunchConfig = {
      ...rest,
      type: 'lldb',
      request: 'launch',
      name: name || 'Debug COBOL',
      program: '',
      args: args || [],
      cwd: baseDir,
      env: {},
      stopOnEntry: stopOnEntry || false,
      sourceLanguages: sourceLanguages || ['cpp'],
      terminal: resolveTerminalKind(cobolConfig),
      sourceMap: sourceMap || {},
      initCommands: initCommands || [],
      preRunCommands: [...(preRunCommands || [])],
      postRunCommands: postRunCommands || []
    };

    const cobc = await this.locateCobc();
    const shimManifestDirs: string[] = [...(manifestDirs ?? []).map((d) => path.resolve(baseDir, d))];
    const libraryDirs: string[] = [];
    let launchEnv: Record<string, string> = {};

    if (isCobolSourceFile(programPath)) {
      if (!cobc) {
        throw new AdapterError(
          `GnuCOBOL (cobc) is required to launch a COBOL source file, and none was found. Install GnuCOBOL 3.1.2+ or set COBC_PATH; alternatively launch a prebuilt executable.`,
          AdapterErrorCode.ENVIRONMENT_INVALID
        );
      }
      const builder = new GnuCobolBuilder({ cobc, platform: this.platform, logger: this.dependencies.logger });
      const result = await builder.build({
        program: programPath,
        sources: absSources,
        mode: 'executable',
        dialect,
        format,
        copybookDirs: absCopybookDirs,
        cobcFlags,
        runtimeChecks,
        forceRebuild: forceRebuild === true
      });
      this.lastBuild = result;
      if (!result.success || !result.binaryPath) {
        throw new Error(`COBOL compile failed: ${result.error}`);
      }
      for (const diagnostic of result.diagnostics) {
        this.dependencies.logger?.warn(`[CobolDebugAdapter] cobc: ${diagnostic}`);
      }
      this.dependencies.logger?.info(
        result.compiled ? `[CobolDebugAdapter] Compiled ${programPath} -> ${result.binaryPath}` : `[CobolDebugAdapter] Reusing ${result.binaryPath} (up to date)`
      );
      launchConfig.program = result.binaryPath;
      if (result.artifactDir) {
        shimManifestDirs.push(result.artifactDir);
      }

      for (const modSource of modules ?? []) {
        const modResult = await builder.build({
          program: path.resolve(baseDir, modSource),
          mode: 'module',
          dialect,
          format,
          copybookDirs: absCopybookDirs,
          cobcFlags,
          runtimeChecks,
          forceRebuild: forceRebuild === true
        });
        if (!modResult.success) {
          throw new Error(`COBOL module compile failed for ${modSource}: ${modResult.error}`);
        }
        if (modResult.artifactDir) {
          libraryDirs.push(modResult.artifactDir);
          shimManifestDirs.push(modResult.artifactDir);
        }
      }
    } else {
      launchConfig.program = programPath;
      if (absSources.length > 0 && cobc) {
        const builder = new GnuCobolBuilder({ cobc, platform: this.platform, logger: this.dependencies.logger });
        const result = await builder.build({
          program: programPath,
          sources: absSources,
          mode: 'manifest-only',
          dialect,
          format,
          copybookDirs: absCopybookDirs,
          cobcFlags,
          forceRebuild: forceRebuild === true
        });
        this.lastBuild = result;
        if (!result.success) {
          this.dependencies.logger?.warn(`[CobolDebugAdapter] Symbol manifest regeneration failed (${result.error}); COBOL variables will fall back to the engine view.`);
        } else if (result.artifactDir) {
          shimManifestDirs.push(result.artifactDir);
        }
      } else if (shimManifestDirs.length === 0) {
        this.dependencies.logger?.warn(
          absSources.length > 0
            ? '[CobolDebugAdapter] "sources" given but cobc is not available: no COBOL symbol manifest, variables show the engine (C) view only.'
            : '[CobolDebugAdapter] Prebuilt executable without "sources" or "manifestDirs": no COBOL symbol manifest, variables show the engine (C) view only (the binary must have been built with cobc -g).'
        );
      }
    }

    if (cobc) {
      // PATH for libcob on Windows/MSYS2; COB_CONFIG_DIR/COB_COPY_DIR do not hurt at runtime.
      launchEnv = cobcEnvironment(cobc, {}, this.platform);
    }
    launchConfig.env = { ...launchEnv, ...(env || {}) };
    if (libraryDirs.length > 0) {
      // After the user's env is merged in, so the freshly built module
      // directories stay ahead of whatever COB_LIBRARY_PATH the caller set.
      const existing = env?.COB_LIBRARY_PATH ?? process.env.COB_LIBRARY_PATH;
      (launchConfig.env as Record<string, string>).COB_LIBRARY_PATH = [...libraryDirs, ...(existing ? [existing] : [])].join(path.delimiter);
    }

    if (stdinFile) {
      const stdinPath = path.resolve(baseDir, stdinFile);
      if (stdinPath.includes('"')) {
        // The path travels inside double quotes on an LLDB command line that has no
        // escape mechanism (see quoteLldbPath), so a quote in it cannot be expressed.
        throw new Error(`stdinFile path cannot contain a double quote: ${stdinPath}`);
      }
      if (!fs.existsSync(stdinPath)) {
        throw new AdapterError(`stdinFile not found: ${stdinPath}`, AdapterErrorCode.SCRIPT_NOT_FOUND);
      }
      // Measured (issue #759 spike): CodeLLDB 1.11's launch `stdio` key does not
      // feed a file on either platform; LLDB's own target.input-path setting does.
      (launchConfig.preRunCommands as string[]).unshift(`settings set target.input-path ${quoteLldbPath(stdinPath)}`);
    }

    const shimOptions: CobolShimSessionOptions = {
      manifestDirs: [...new Set(shimManifestDirs)],
      engineScopes: engineScopes === true,
      stdinFile: stdinFile ? path.resolve(baseDir, stdinFile) : undefined
    };
    this.lastShimOptions = shimOptions;
    (launchConfig as Record<string, unknown>)[COBOL_PRIVATE_KEY] = shimOptions;
    return launchConfig;
  }

  getDefaultLaunchConfig(): Partial<GenericLaunchConfig> {
    return { stopOnEntry: false, justMyCode: true, env: {}, cwd: process.cwd() };
  }

  // ===== Attach Support =====

  supportsAttach(): boolean {
    return true;
  }

  supportsDetach(): boolean {
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
      cwd,
      ...rest
    } = config as GenericAttachConfig & { manifestDirs?: string[]; engineScopes?: boolean };
    void _request; void _identifierType; void _processName; void _host;
    void _port; void _timeout; void _sourcePaths; void _justMyCode; void _env;

    const pid = processId !== undefined && processId !== null ? Number(processId) : NaN;
    if (!Number.isInteger(pid) || pid <= 0) {
      throw new AdapterError(
        'COBOL attach requires a numeric processId (attach-by-PID). Name/host-based attach is not supported.',
        AdapterErrorCode.UNSUPPORTED_OPERATION
      );
    }
    const { manifestDirs, engineScopes, ...passthrough } = rest;
    const baseDir = typeof cwd === 'string' && cwd.length > 0 ? cwd : process.cwd();
    const shimOptions: CobolShimSessionOptions = {
      manifestDirs: (manifestDirs ?? []).map((d) => path.resolve(baseDir, d)),
      engineScopes: engineScopes === true
    };
    this.lastShimOptions = shimOptions;
    return {
      ...passthrough,
      type: 'lldb',
      request: 'attach',
      pid,
      stopOnEntry: stopOnEntry ?? true,
      [COBOL_PRIVATE_KEY]: shimOptions
    };
  }

  getDefaultAttachConfig(): Partial<GenericAttachConfig> {
    return { request: 'attach', stopOnEntry: true };
  }

  // ===== DAP Protocol Operations (vestigial; ProxyManager owns the traffic) =====

  async sendDapRequest<T extends DebugProtocol.Response>(command: string, args?: unknown): Promise<T> {
    this.dependencies.logger?.debug(`[CobolDebugAdapter] DAP request: ${command}`);
    if (command === 'setExceptionBreakpoints' && args) {
      const exceptionArgs = args as DebugProtocol.SetExceptionBreakpointsArguments;
      const invalid = exceptionArgs.filters?.filter((f) => f !== COBOL_RUNTIME_ERROR_FILTER);
      if (invalid?.length) {
        this.dependencies.logger?.warn(`[CobolDebugAdapter] Unknown exception filters: ${invalid.join(', ')}`);
      }
    }
    return {} as T;
  }

  handleDapEvent(event: DebugProtocol.Event): void {
    this.dependencies.logger?.debug(`[CobolDebugAdapter] DAP event: ${event.event}`);
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
    this.dependencies.logger?.debug(`[CobolDebugAdapter] DAP response: ${response.command} (success: ${response.success})`);
    if (!response.success && response.message) {
      this.dependencies.logger?.error(`[CobolDebugAdapter] DAP error: ${response.message}`);
    }
  }

  // ===== Connection Management =====

  async connect(host: string, port: number): Promise<void> {
    this.dependencies.logger?.debug(`[CobolDebugAdapter] Connect request to ${host}:${port}`);
    this.connected = true;
    this.transitionTo(AdapterState.CONNECTED);
    this.emit('connected');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.currentThreadId = null;
    this.transitionTo(AdapterState.READY);
    this.emit('disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ===== Error Handling =====

  getInstallationInstructions(): string {
    return [
      'COBOL debugging needs CodeLLDB (vendored / @debugmcp/codelldb-* packages / CODELLDB_PATH) and, for source launch and COBOL-shaped variables, GnuCOBOL 3.1.2+:',
      '  Debian/Ubuntu: apt install gnucobol3',
      '  macOS: brew install gnucobol',
      '  Windows: MSYS2, then pacman -S mingw-w64-x86_64-gnucobol (set COBC_PATH if cobc is not on PATH)',
      'Programs are compiled with: cobc -x -g -fdump=ALL --save-temps -A "-O0 -gdwarf-4" (DWARF-4 is required for LLDB line breakpoints on MinGW).'
    ].join('\n');
  }

  getMissingExecutableError(): string {
    return 'GnuCOBOL compiler (cobc) not found. Install GnuCOBOL 3.1.2+ or set COBC_PATH. ' + this.getInstallationInstructions();
  }

  translateErrorMessage(error: Error): string {
    const message = error.message;
    const lower = message.toLowerCase();
    const cobcAt = lower.indexOf('cobc');
    const noSuchFileAt = lower.indexOf('no such file');
    if ((cobcAt >= 0 && lower.indexOf('not found', cobcAt) >= 0) || (noSuchFileAt >= 0 && lower.indexOf('cobc', noSuchFileAt) >= 0)) {
      return this.getMissingExecutableError();
    }
    if (/configuration error/i.test(message) && /\.conf/.test(message)) {
      return `${message} — cobc could not find its dialect configuration; set COB_CONFIG_DIR to <GnuCOBOL prefix>/share/gnucobol/config (the adapter does this automatically when cobc is found via COBC_PATH or a known install).`;
    }
    return message;
  }

  // ===== Feature Support =====

  supportsFeature(feature: DebugFeature): boolean {
    const supportedFeatures = [
      DebugFeature.CONDITIONAL_BREAKPOINTS,
      DebugFeature.EXCEPTION_BREAKPOINTS,
      DebugFeature.EXCEPTION_INFO_REQUEST,
      DebugFeature.VARIABLE_PAGING,
      DebugFeature.EVALUATE_FOR_HOVERS,
      DebugFeature.DISASSEMBLE_REQUEST,
      DebugFeature.LOADED_SOURCES_REQUEST,
      DebugFeature.TERMINATE_REQUEST
    ];
    return supportedFeatures.includes(feature);
  }

  getFeatureRequirements(feature: DebugFeature): FeatureRequirement[] {
    const requirements: FeatureRequirement[] = [];
    switch (feature) {
      case DebugFeature.FUNCTION_BREAKPOINTS:
        requirements.push({ type: 'version', description: 'Paragraph/section breakpoints land with milestone M3 of issue #759', required: true });
        break;
      case DebugFeature.LOG_POINTS:
        requirements.push({ type: 'version', description: 'COBOL-name interpolation in logpoints lands with milestone M3 of issue #759', required: true });
        break;
      case DebugFeature.DISASSEMBLE_REQUEST:
        requirements.push({ type: 'configuration', description: 'LLDB disassembler support', required: true });
        break;
    }
    return requirements;
  }

  getCapabilities(): AdapterCapabilities {
    return {
      supportsConfigurationDoneRequest: true,
      supportsFunctionBreakpoints: false,
      supportsConditionalBreakpoints: true,
      supportsHitConditionalBreakpoints: true,
      supportsEvaluateForHovers: true,
      exceptionBreakpointFilters: [
        {
          filter: COBOL_RUNTIME_ERROR_FILTER,
          label: 'COBOL: runtime error',
          description: 'Pause when libcob reports a runtime error (subscript out of bounds, non-numeric data, reference modification out of range) before the program aborts',
          default: true
        }
      ],
      supportsStepBack: false,
      supportsSetVariable: false,
      supportsRestartFrame: false,
      supportsGotoTargetsRequest: false,
      supportsStepInTargetsRequest: false,
      supportsCompletionsRequest: false,
      completionTriggerCharacters: [],
      supportsModulesRequest: true,
      supportsRestartRequest: false,
      supportsExceptionOptions: false,
      supportsValueFormattingOptions: false,
      supportsExceptionInfoRequest: true,
      supportTerminateDebuggee: true,
      supportSuspendDebuggee: false,
      supportsDelayedStackTraceLoading: true,
      supportsLoadedSourcesRequest: true,
      supportsLogPoints: false,
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
      supportsSteppingGranularity: false,
      supportsInstructionBreakpoints: false,
      supportsExceptionFilterOptions: false,
      supportsSingleThreadExecutionRequests: false
    };
  }
}

/**
 * `settings set` is a raw LLDB command: the value is the untokenised remainder of the
 * line, and a file-path setting strips surrounding quotes and whitespace from it and
 * keeps the rest verbatim, backslashes included (CommandObjectSettingsSet::DoExecute,
 * OptionValueFileSpec::SetValueFromString). So the path goes in double quotes with
 * nothing escaped; the caller refuses a path that itself contains a double quote.
 */
function quoteLldbPath(p: string): string {
  return `"${p}"`;
}

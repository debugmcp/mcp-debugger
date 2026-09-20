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
  resolveTerminalKind,
  deriveSourceMapFromBinary
} from '@debugmcp/codelldb-common';
import {
  findCobc,
  cobcrunPath,
  cobcEnvironment,
  GnuCobolBuilder,
  isCobolModuleFile,
  moduleExtension,
  isCobolSourceFile,
  type CobcLocation,
  type CobolBuildRequest,
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
  /**
   * `'cobcrun'`: build `program` as a module too and run it under GnuCOBOL's module loader
   * (`cobcrun <PROGRAM-ID> args…`), the way production sites run module-only builds; a
   * prebuilt `.so`/`.dll`/`.dylib` module is run by name from its own directory.
   */
  runner?: 'cobcrun';
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

/** CodeLLDB's own attach keys, passed through to the engine. */
const COBOL_FORWARDED_ATTACH_KEYS = [
  'processId',
  'pid',
  'program',
  'stopOnEntry',
  'waitFor',
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

/** The build options that only mean something together with `sources`. */
const COBOL_REGENERATION_OPTION_KEYS = ['dialect', 'format', 'copybookDirs', 'cobcFlags', 'runtimeChecks', 'forceRebuild'] as const;

/**
 * Attach keys transformAttachConfig consumes (into the manifest regeneration and the
 * shim's private block) instead of forwarding to CodeLLDB: not "ignored" when absent
 * from the attach request.
 */
const COBOL_CONSUMED_ATTACH_KEYS = [
  'cwd',
  'manifestDirs',
  'engineScopes',
  'sources',
  'dialect',
  'format',
  'copybookDirs',
  'cobcFlags',
  'runtimeChecks',
  'forceRebuild'
] as const;

/** Attach sugar over CodeLLDB's attach keys: the manifest sources and the build options they were compiled with. */
interface CobolAttachExtras {
  manifestDirs?: string[];
  engineScopes?: boolean;
  /** Sources of the running program; the manifest is regenerated from them by a translate-only `cobc -C`. */
  sources?: string[];
  dialect?: string;
  format?: 'fixed' | 'free';
  copybookDirs?: string[];
  cobcFlags?: string[];
  runtimeChecks?: boolean;
  forceRebuild?: boolean;
}

/** The cobc options every build of a session shares (a module, the program, a translate-only regeneration). */
type CobolBuildOptions = Pick<CobolBuildRequest, 'dialect' | 'format' | 'copybookDirs' | 'cobcFlags' | 'runtimeChecks' | 'forceRebuild'>;

/** The build options a manifest regeneration takes (the binary is not rebuilt; these must match how it was compiled). */
interface ManifestRegenerationOptions extends CobolBuildOptions {
  sources: string[];
  /** Ready manifests the caller also supplied: without cobc the session still has those. */
  manifestDirsGiven?: boolean;
  /** Budget for the translate-only run (an attach has a client timeout to stay under). */
  timeoutMs?: number;
  /** A failed translate is an error rather than a warning (attach: the caller asked for the manifest). */
  strict?: boolean;
}

/** The options as the launch/attach config spells them, resolved against `baseDir`. */
function buildOptionsOf(
  config: { dialect?: string; format?: 'fixed' | 'free'; copybookDirs?: string[]; cobcFlags?: string[]; runtimeChecks?: boolean; forceRebuild?: boolean },
  baseDir: string
): CobolBuildOptions {
  return {
    dialect: config.dialect,
    format: config.format,
    copybookDirs: (config.copybookDirs ?? []).map((d) => path.resolve(baseDir, d)),
    cobcFlags: config.cobcFlags,
    runtimeChecks: config.runtimeChecks,
    forceRebuild: config.forceRebuild === true
  };
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

  // CodeLLDB attach options (forwarded) plus our sugar (consumed). Unlisted keys still
  // reach the engine (forwarded with a warning); this list powers recognition + typo hints (#466).
  readonly supportedAttachKeys = [...COBOL_FORWARDED_ATTACH_KEYS, ...COBOL_CONSUMED_ATTACH_KEYS];

  readonly consumedAttachKeys = COBOL_CONSUMED_ATTACH_KEYS;

  private state: AdapterState = AdapterState.UNINITIALIZED;
  private dependencies: AdapterDependencies;
  private executablePathCache = new Map<string, ExecutablePathCacheEntry>();
  private readonly cacheTimeout = 60000;
  private cobcLocation: CobcLocation | null | undefined;
  /** A user-supplied cobc (the session's executablePath), probed before PATH and the install dirs. */
  private preferredCobc: string | undefined;
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
          message: 'CodeLLDB executable not found. It normally ships via the @debugmcp/codelldb-* optional dependencies (reinstall without --omit=optional), or set CODELLDB_PATH, or in a repo checkout run: pnpm install (vendors CodeLLDB)',
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
      { name: 'CodeLLDB', version: '1.11.0+', required: true, installCommand: 'pnpm install (vendors CodeLLDB)' },
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
      this.cobcLocation = await findCobc({
        platform: this.platform,
        env: this.preferredCobc ? { ...process.env, COBC_PATH: this.preferredCobc } : process.env
      });
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
      // The session's executablePath names the compiler: every later launch probes it first.
      if (this.preferredCobc !== preferredPath) {
        this.preferredCobc = preferredPath;
        this.cobcLocation = undefined;
      }
    } else {
      const cobc = await this.locateCobc();
      if (cobc) {
        execPath = cobc.path;
      } else {
        // cobc is needed only to compile a COBOL source. Attach and prebuilt launches run
        // on the vendored CodeLLDB alone, so this never fails the session here;
        // transformLaunchConfig refuses a source launch with the full message.
        this.dependencies.logger?.warn(`[CobolDebugAdapter] ${this.getMissingExecutableError()}`);
        execPath = 'cobol-prebuilt-binary';
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
        'CodeLLDB executable not found. It normally ships via the @debugmcp/codelldb-* optional dependencies (reinstall without --omit=optional), or set CODELLDB_PATH, or in a repo checkout run: pnpm install (vendors CodeLLDB)',
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
    return 'pnpm install (vendors CodeLLDB)';
  }

  // ===== Debug Configuration =====

  async transformLaunchConfig(config: GenericLaunchConfig): Promise<LanguageSpecificLaunchConfig> {
    const cobolConfig = config as CobolLaunchConfig;
    const {
      name,
      program,
      sources,
      modules,
      runner,
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
    const buildOptions = buildOptionsOf({ dialect, format, copybookDirs, cobcFlags, runtimeChecks, forceRebuild }, baseDir);

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
    const userManifestDirs = (manifestDirs ?? []).map((d) => path.resolve(baseDir, d));
    const shimManifestDirs: string[] = [];
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
      const result = await this.runBuild(builder, {
        program: programPath,
        sources: absSources,
        // Several statically linked sources under cobcrun become one module (`-b`, see the builder).
        mode: runner === 'cobcrun' ? 'module' : 'executable',
        ...buildOptions
      }, 'cobc');
      if (!result.success || !result.binaryPath) {
        throw new Error(`COBOL compile failed: ${result.error}`);
      }
      this.dependencies.logger?.info(
        result.compiled ? `[CobolDebugAdapter] Compiled ${programPath} -> ${result.binaryPath}` : `[CobolDebugAdapter] Reusing ${result.binaryPath} (up to date)`
      );
      if (runner === 'cobcrun') {
        const loader = this.cobcrunLoader(cobc, result.binaryPath);
        launchConfig.program = loader.program;
        launchConfig.args = [loader.entry, ...(args ?? [])];
        libraryDirs.push(path.dirname(result.binaryPath));
      } else {
        launchConfig.program = result.binaryPath;
      }
      if (result.artifactDir) {
        shimManifestDirs.push(result.artifactDir);
      }
    } else {
      if (runner === 'cobcrun') {
        // A compiled module run by name: cobcrun resolves `<name>.<ext>` on COB_LIBRARY_PATH.
        if (!isCobolModuleFile(programPath, this.platform)) {
          throw new AdapterError(
            `runner "cobcrun" takes a COBOL source or a compiled module (${moduleExtension(this.platform)} on this platform); ${programPath} is neither.`,
            AdapterErrorCode.SCRIPT_NOT_FOUND
          );
        }
        if (!cobc) {
          throw new AdapterError(
            'runner "cobcrun" needs GnuCOBOL (cobcrun ships beside cobc), and none was found. Install GnuCOBOL 3.1.2+ or set COBC_PATH.',
            AdapterErrorCode.ENVIRONMENT_INVALID
          );
        }
        const loader = this.cobcrunLoader(cobc, programPath);
        launchConfig.program = loader.program;
        launchConfig.args = [loader.entry, ...(args ?? [])];
        libraryDirs.push(path.dirname(programPath));
      } else {
        launchConfig.program = programPath;
      }
      if (process.env.MCP_CONTAINER === 'true' && Object.keys(sourceMap || {}).length === 0) {
        // Container mode (issue #363, as cpp/rust): a host-built binary embeds host paths
        // in its DWARF, so /workspace breakpoints never match without a sourceMap.
        const workspaceRoot = process.env.MCP_WORKSPACE_ROOT || '/workspace';
        const derived = deriveSourceMapFromBinary(programPath, workspaceRoot);
        if (Object.keys(derived).length > 0) {
          launchConfig.sourceMap = derived;
          this.dependencies.logger?.info(`[CobolDebugAdapter] Container mode: derived sourceMap from binary DWARF paths: ${JSON.stringify(derived)}`);
        }
      }
      if (absSources.length > 0) {
        const artifactDir = await this.regenerateManifest(cobc, programPath, {
          sources: absSources,
          manifestDirsGiven: userManifestDirs.length > 0,
          ...buildOptions
        });
        if (artifactDir) {
          shimManifestDirs.push(artifactDir);
        }
      } else if (userManifestDirs.length === 0) {
        this.dependencies.logger?.warn(
          '[CobolDebugAdapter] Prebuilt executable without "sources" or "manifestDirs": no COBOL symbol manifest, variables show the engine (C) view only (the binary must have been built with cobc -g).'
        );
      }
    }

    // Dynamically CALLed modules are built for a prebuilt program too (a `.so` under
    // cobcrun, an executable): they need cobc like any compile.
    if ((modules ?? []).length > 0) {
      if (!cobc) {
        throw new AdapterError(
          '"modules" are compiled with GnuCOBOL (cobc -m), and none was found. Install GnuCOBOL 3.1.2+ or set COBC_PATH.',
          AdapterErrorCode.ENVIRONMENT_INVALID
        );
      }
      const builder = new GnuCobolBuilder({ cobc, platform: this.platform, logger: this.dependencies.logger });
      for (const modSource of modules ?? []) {
        const modResult = await this.runBuild(builder, { program: path.resolve(baseDir, modSource), mode: 'module', ...buildOptions }, `cobc (${modSource})`);
        if (!modResult.success) {
          throw new Error(`COBOL module compile failed for ${modSource}: ${modResult.error}`);
        }
        if (modResult.artifactDir) {
          libraryDirs.push(modResult.artifactDir);
          shimManifestDirs.push(modResult.artifactDir);
        }
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
      // Fresh builds first: the shim keeps the first definition of a C function, so a
      // caller-supplied directory holding an older manifest must not shadow this launch's.
      manifestDirs: [...new Set([...shimManifestDirs, ...userManifestDirs])],
      engineScopes: engineScopes === true,
      stdinFile: stdinFile ? path.resolve(baseDir, stdinFile) : undefined
    };
    this.lastShimOptions = shimOptions;
    (launchConfig as Record<string, unknown>)[COBOL_PRIVATE_KEY] = shimOptions;
    return launchConfig;
  }

  /**
   * The debuggee for `runner: 'cobcrun'`: GnuCOBOL's module loader, given the module's
   * name (its PROGRAM-ID, which is also the file's basename — see the builder). The
   * program's own breakpoints stay pending until cobcrun loads the module; CodeLLDB
   * re-verifies them on load.
   */
  private cobcrunLoader(cobc: CobcLocation, modulePath: string): { program: string; entry: string } {
    const program = cobcrunPath(cobc, this.platform);
    if (!fs.existsSync(program)) {
      throw new AdapterError(
        `runner "cobcrun" needs GnuCOBOL's module loader beside cobc, and ${program} does not exist.`,
        AdapterErrorCode.ENVIRONMENT_INVALID
      );
    }
    return { program, entry: path.basename(modulePath, path.extname(modulePath)) };
  }

  /**
   * Regenerate the symbol manifest for a binary this session did not build — a prebuilt
   * launch, or the process being attached to — by a translate-only `cobc -C` over
   * `sources`. The binary is never touched; the artifacts land beside `anchor` (the
   * binary when known, else the first source). Returns the artifact directory, or
   * undefined after a warning when cobc is missing or the translation failed: the
   * session then shows the engine's C view (or the `manifestDirs` manifests) instead of
   * failing. Under `strict` a failed translation throws instead — the attach path uses
   * it when nothing else supplies a manifest.
   */
  private async regenerateManifest(cobc: CobcLocation | null, anchor: string, options: ManifestRegenerationOptions): Promise<string | undefined> {
    const { sources, manifestDirsGiven, timeoutMs, strict, ...buildOptions } = options;
    if (!cobc) {
      if (manifestDirsGiven) {
        this.dependencies.logger?.info('[CobolDebugAdapter] "sources" given but cobc is not available; using the manifests in "manifestDirs".');
      } else {
        this.dependencies.logger?.warn('[CobolDebugAdapter] "sources" given but cobc is not available: no COBOL symbol manifest, variables show the engine (C) view only.');
      }
      return undefined;
    }
    this.dependencies.logger?.info(`[CobolDebugAdapter] Regenerating the COBOL symbol manifest with a translate-only cobc -C over ${sources.length} source(s)`);
    const builder = new GnuCobolBuilder({ cobc, platform: this.platform, logger: this.dependencies.logger, ...(timeoutMs !== undefined ? { timeoutMs } : {}) });
    // `--debug` moves every later `#line` row; the manifest must be translated the way
    // the binary was compiled or runtime-error stops map to the wrong statement — which
    // is why the options travel as one object from the config to here.
    const result = await this.runBuild(builder, { program: anchor, sources, mode: 'manifest-only', ...buildOptions }, 'cobc -C');
    if (!result.success) {
      if (strict) {
        throw new AdapterError(
          `COBOL symbol manifest regeneration failed: ${result.error}. Raise "timeout" (it bounds the translate), pass "manifestDirs" from an earlier build, or omit "sources" to attach with the engine's C view.`,
          AdapterErrorCode.ENVIRONMENT_INVALID
        );
      }
      this.dependencies.logger?.warn(`[CobolDebugAdapter] Symbol manifest regeneration failed (${result.error}); COBOL variables will fall back to the engine view.`);
      return undefined;
    }
    return result.artifactDir;
  }

  /** One build through the builder: the result kept for diagnostics, every cobc diagnostic logged under `label`. */
  private async runBuild(builder: GnuCobolBuilder, request: CobolBuildRequest, label: string): Promise<CobolBuildResult> {
    const result = await builder.build(request);
    this.lastBuild = result;
    for (const diagnostic of result.diagnostics) {
      this.dependencies.logger?.warn(`[CobolDebugAdapter] ${label}: ${diagnostic}`);
    }
    return result;
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

  /**
   * Attach by PID. `sources` regenerates the running program's symbol manifest the way a
   * prebuilt launch does (translate-only, the process is not touched); `manifestDirs`
   * supplies ready manifests. Async because that regeneration runs cobc (the launcher
   * awaits the transform, issue #759 M2).
   */
  async transformAttachConfig(config: GenericAttachConfig): Promise<LanguageSpecificAttachConfig> {
    const {
      request: _request,
      identifierType: _identifierType,
      processId,
      processName: _processName,
      host: _host,
      port: _port,
      timeout,
      sourcePaths: _sourcePaths,
      stopOnEntry,
      justMyCode: _justMyCode,
      env: _env,
      cwd,
      ...rest
    } = config as GenericAttachConfig & CobolAttachExtras;
    void _request; void _identifierType; void _processName; void _host;
    void _port; void _sourcePaths; void _justMyCode; void _env;

    const pid = processId !== undefined && processId !== null ? Number(processId) : NaN;
    if (!Number.isInteger(pid) || pid <= 0) {
      throw new AdapterError(
        'COBOL attach requires a numeric processId (attach-by-PID). Name/host-based attach is not supported.',
        AdapterErrorCode.UNSUPPORTED_OPERATION
      );
    }
    const { manifestDirs, engineScopes, sources, dialect, format, copybookDirs, cobcFlags, runtimeChecks, forceRebuild, ...passthrough } = rest;
    const baseDir = typeof cwd === 'string' && cwd.length > 0 ? cwd : process.cwd();
    const userManifestDirs = (manifestDirs ?? []).map((d) => path.resolve(baseDir, d));
    const absSources = (sources ?? []).map((s) => path.resolve(baseDir, s));
    // CodeLLDB resolves a relative `program` against its own cwd, not this one: hand it
    // the same absolute path the manifest is anchored on.
    const program = typeof passthrough.program === 'string' && passthrough.program.length > 0 ? path.resolve(baseDir, passthrough.program) : undefined;
    if (program !== undefined) {
      passthrough.program = program;
    }
    const shimManifestDirs: string[] = [];
    if (absSources.length > 0) {
      // The artifacts go beside the binary when the caller named it (CodeLLDB's `program`
      // hint), else beside the first source. The translate runs before the engine is
      // spawned, under the caller's attach timeout: it gets that budget, less a margin.
      // A translate that fails or times out fails the attach: the caller asked for the
      // manifest, and a silent C view is the worst first contact — unless `manifestDirs`
      // supplied one, in which case the attach proceeds on those with a warning (the
      // error text would otherwise tell the caller to pass what they already passed).
      const anchor = program ?? absSources[0];
      const budget = typeof timeout === 'number' && timeout > 0 ? timeout : 30_000;
      const artifactDir = await this.regenerateManifest(await this.locateCobc(), anchor, {
        sources: absSources,
        manifestDirsGiven: userManifestDirs.length > 0,
        timeoutMs: Math.max(5_000, budget - 5_000),
        strict: userManifestDirs.length === 0,
        ...buildOptionsOf({ dialect, format, copybookDirs, cobcFlags, runtimeChecks, forceRebuild }, baseDir)
      });
      if (artifactDir) {
        shimManifestDirs.push(artifactDir);
      }
    } else {
      // The build options describe the regeneration: without `sources` there is none.
      const given = { dialect, format, copybookDirs, cobcFlags, runtimeChecks, forceRebuild };
      const unused = COBOL_REGENERATION_OPTION_KEYS.filter((key) => given[key] !== undefined);
      if (unused.length > 0) {
        this.dependencies.logger?.warn(
          `[CobolDebugAdapter] Attach: ${unused.join(', ')} given without "sources" — they describe the manifest regeneration and nothing else uses them.`
        );
      }
      if (userManifestDirs.length === 0) {
        this.dependencies.logger?.warn(
          '[CobolDebugAdapter] Attach without "sources" or "manifestDirs": no COBOL symbol manifest, variables show the engine (C) view only.'
        );
      }
    }
    const shimOptions: CobolShimSessionOptions = {
      // Fresh regeneration first (the shim keeps the first definition of a program).
      manifestDirs: [...new Set([...shimManifestDirs, ...userManifestDirs])],
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
    // DISCONNECTED, as the other adapters report it (the review of #760 found READY here).
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

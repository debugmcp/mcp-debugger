/**
 * JavaScript/TypeScript Debug Adapter
 *
 * @since 0.1.0
 */
import { EventEmitter } from 'events';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { readFile } from 'node:fs/promises';
import type { DebugProtocol } from '@vscode/debugprotocol';
import {
  AdapterState,
  AdapterError,
  AdapterErrorCode,
  DebugFeature,
  type IDebugAdapter,
  type ValidationResult,
  type DependencyInfo,
  type AdapterCommand,
  type AdapterConfig,
  type GenericLaunchConfig,
  type LaunchConfigDiagnostic,
  type LanguageSpecificLaunchConfig,
  type GenericAttachConfig,
  type LanguageSpecificAttachConfig,
  type FeatureRequirement,
  type AdapterCapabilities,
  type AdapterLaunchBarrier,
  OWNER_PID_ARG_PREFIX,
  SESSION_ID_ARG_PREFIX,
  resolveJsLaunchSkipFiles,
  resolveJsLaunchSmartStep,
  resolveJsLaunchWorkspaceFolder,
  resolveJsPauseForSourceMap,
  isJsTranspiledProgram
} from '@debugmcp/shared';
import { DebugLanguage } from '@debugmcp/shared';
import type { AdapterDependencies } from '@debugmcp/shared';
import { findNode } from './utils/executable-resolver.js';
import { detectBinary } from './utils/typescript-detector.js';
import { determineOutFiles, isESMProject, hasTsConfigPaths } from './utils/config-transformer.js';
import { JsDebugLaunchBarrier } from './utils/js-debug-launch-barrier.js';
import { jsDebugCandidatePaths } from './utils/js-debug-resolver.js';
import { JS_LAUNCH_CONSUMED_KEYS, JS_SUPPORTED_LAUNCH_KEYS, normalizeJsLaunchInputs } from './utils/launch-config.js';
import { resolveLaunchEnvironment } from './utils/launch-environment.js';

/**
 * Base path js-debug uses to resolve source-map `sources` on attach (issue
 * #655): the same fallback transformLaunchConfig applies when no program
 * directory is known — the workspace root in container mode, else the
 * server's working directory (VS Code's `${workspaceFolder}` equivalent).
 */
function defaultAttachCwd(): string {
  if (process.env.MCP_CONTAINER === 'true') {
    return process.env.MCP_WORKSPACE_ROOT || '/workspace';
  }
  return process.cwd();
}

/**
 * The pwa-node launch shape mcp-debugger owns: a caller value is dropped
 * with a warning rather than forwarded (a console other than the internal
 * one has nowhere to open here; outputCapture is what get_output reads).
 */
const JS_LAUNCH_PINNED_KEYS: ReadonlySet<string> = new Set([
  'type', 'request', 'name', 'console', 'outputCapture'
]);

/**
 * js-debug keys that have no meaning on a parent launch and break it when
 * present: __pendingTargetId is the child-adoption handle js-debug itself
 * issues (the DAP server rejects a launch that carries one), and
 * attachSimplePort switches js-debug to polling a port the launch never
 * opens (cf. the policy's _ignoredSimplePort on attach).
 */
const JS_LAUNCH_NOT_FOR_LAUNCH_KEYS: ReadonlySet<string> = new Set([
  '__pendingTargetId', 'attachSimplePort'
]);

/** Own keys a JSON-parsed config can carry that must never be copied. */
const UNSAFE_OBJECT_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

const DEFAULT_RESOLVE_SOURCE_MAP_LOCATIONS = ['**', '!**/node_modules/**'];

/**
 * Our own `--require` of the exit-code shim inside a NODE_OPTIONS value, in
 * both the quoted form the adapter writes and the bare form a hand-rolled
 * env might carry. Each eats its own leading whitespace so removing it leaves
 * the neighbouring tokens untouched, and each requires a token boundary after
 * the path so `exitcode-shim.cjs.d/hook.js` — a different file that merely
 * starts with the same name — is not mistaken for ours. The quoted pattern
 * runs first: the bare `\S*` would otherwise swallow the opening quote.
 */
const QUOTED_EXITCODE_SHIM_TOKEN = /\s*--require\s+"[^"]*exitcode-shim\.cjs"(?=\s|$)/g;
const BARE_EXITCODE_SHIM_TOKEN = /\s*--require\s+\S*exitcode-shim\.cjs(?=\s|$)/g;

/**
 * Strip an inherited exit-code shim environment from `env` in place
 * (issue #731).
 *
 * A server that is itself a js-debug debuggee inherits the outer session's
 * `NODE_OPTIONS --require .../exitcode-shim.cjs`, the outer session's
 * `MCP_DEBUGGER_EXITCODE_FILE`, and the `MCP_DEBUGGER_EXITCODE_CLAIMED=1` the
 * shim stamped on the server itself. Left in place, an inner launch would skip
 * its own preload, its debuggee would inherit the claim and register no exit
 * handler, and the inner proxy worker would read (and delete) the OUTER
 * session's exit-code file. Keys are matched by upper-cased name because
 * `process.env` is case-insensitive on Windows while a `{ ...process.env }`
 * copy is not. Only our own `--require` token is removed from `NODE_OPTIONS`;
 * everything else in it (js-debug's bootloader, user flags) survives.
 *
 * A NODE_OPTIONS holding no shim token of ours is left byte-identical, and a
 * value we do edit is only trimmed. This runs on every launch, so collapsing
 * its whitespace wholesale rewrote quoted paths that legitimately contain two
 * consecutive spaces into unresolvable ones and killed the debuggee at
 * startup.
 *
 * A value found under a non-canonical spelling is rewritten under
 * `NODE_OPTIONS` and the original key deleted: the fresh token below goes
 * under the canonical name, and Node's win32 spawn keeps only one of the two,
 * so leaving the remainder where it was lost it.
 *
 * An inherited claim is replaced by an explicit empty value rather than
 * deleted. `''` is a defensive explicit overlay that costs nothing: js-debug
 * builds the debuggee's env on top of its own process env, and while that
 * process env is scrubbed too, spelling the cleared claim out leaves nothing
 * to an ordering assumption — `''` reaches the debuggee and re-arms the shim,
 * which tests `=== '1'`.
 */
export function scrubInheritedExitCodeShim(env: Record<string, string>): void {
  let claimInherited = false;
  // NODE_OPTIONS survivors in key order, so a mixed-case spelling folds into
  // the canonical one instead of racing it at spawn time. Only written back
  // when something was actually removed or renamed.
  const nodeOptionRemainders: string[] = [];
  let rewriteNodeOptions = false;

  for (const key of Object.keys(env)) {
    switch (key.toUpperCase()) {
      case 'NODE_OPTIONS': {
        const value = env[key];
        const stripped = value
          .replace(QUOTED_EXITCODE_SHIM_TOKEN, '')
          .replace(BARE_EXITCODE_SHIM_TOKEN, '');
        if (stripped !== value || key !== 'NODE_OPTIONS') {
          rewriteNodeOptions = true;
        }
        nodeOptionRemainders.push(stripped.trim());
        if (key !== 'NODE_OPTIONS') {
          delete env[key];
        }
        break;
      }
      case 'MCP_DEBUGGER_EXITCODE_FILE':
        delete env[key];
        break;
      case 'MCP_DEBUGGER_EXITCODE_CLAIMED':
        delete env[key];
        claimInherited = true;
        break;
      default:
        break;
    }
  }

  if (rewriteNodeOptions) {
    const remainder = nodeOptionRemainders.filter(Boolean).join(' ');
    if (remainder) {
      env.NODE_OPTIONS = remainder;
    } else {
      delete env.NODE_OPTIONS;
    }
  }
  if (claimInherited) {
    env.MCP_DEBUGGER_EXITCODE_CLAIMED = '';
  }
}

export class JavascriptDebugAdapter extends EventEmitter implements IDebugAdapter {
  readonly language = 'javascript' as unknown as DebugLanguage;
  readonly name = 'JavaScript/TypeScript Debug Adapter';
  readonly supportedLaunchKeys = JS_SUPPORTED_LAUNCH_KEYS;
  readonly consumedLaunchKeys = [...JS_LAUNCH_CONSUMED_KEYS];
  private launchConfigDiagnostics: LaunchConfigDiagnostic[] = [];

  consumeLaunchConfigDiagnostics(): readonly LaunchConfigDiagnostic[] {
    const diagnostics = this.launchConfigDiagnostics;
    this.launchConfigDiagnostics = [];
    return diagnostics;
  }

  // js-debug pwa-node attach options https://github.com/microsoft/vscode-js-debug/blob/main/package.json
  // plus the generic keys transformAttachConfig special-cases. Unlisted keys
  // still reach js-debug (forwarded with a warning) — this list only powers
  // recognition + typo suggestions (#466).
  readonly supportedAttachKeys = [
    'host',
    'port',
    'address',
    'timeout',
    'localRoot',
    'remoteRoot',
    'smartStep',
    'skipFiles',
    'sourceMaps',
    'sourceMapPathOverrides',
    'outFiles',
    'outputCapture',
    'resolveSourceMapLocations',
    'pauseForSourceMap',
    'stopOnEntry',
    'justMyCode',
    'cwd',
    'env',
    'restart',
    'continueOnAttach',
    'trace',
    'websocketAddress',
    'attachExistingChildren',
    'autoAttachChildProcesses'
  ] as const;

  private state: AdapterState = AdapterState.UNINITIALIZED;
  private readonly dependencies: AdapterDependencies;

  private currentThreadId: number | null = null;
  private connected = false;

  // Per-instance memoization for executable detection
  private cachedNodePath?: string;

  constructor(dependencies: AdapterDependencies) {
    super();
    this.dependencies = dependencies;
  }

  // ===== Lifecycle Management =====

  async initialize(): Promise<void> {
    this.transitionTo(AdapterState.INITIALIZING);

    const validation = await this.validateEnvironment();

    // Log any validation warnings via dependencies logger
    try {
      const logger = this.dependencies.logger;
      if (validation?.warnings && Array.isArray(validation.warnings)) {
        for (const w of validation.warnings) {
          const msg = (w as { message?: unknown }).message;
          if (typeof msg === 'string') {
            logger?.warn?.(msg);
          }
        }
      }
    } catch {
      // ignore logging errors
    }

    if (!validation.valid) {
      this.transitionTo(AdapterState.ERROR);
      const logger = this.dependencies.logger;
      const msg = validation.errors[0]?.message ?? 'Environment invalid';
      logger?.warn?.(msg);
      throw new AdapterError(
        msg,
        AdapterErrorCode.ENVIRONMENT_INVALID
      );
    }

    this.dependencies.logger?.info?.('JavaScript adapter initialized');

    this.transitionTo(AdapterState.READY);
    this.emit('initialized');
  }

  async dispose(): Promise<void> {
    // Clear runtime state
    const wasConnected = this.connected;
    this.connected = false;
    this.currentThreadId = null;

    // Clear per-instance caches
    this.cachedNodePath = undefined;

    // Emit 'disconnected' for symmetry if we were connected
    if (wasConnected) {
      this.transitionTo(AdapterState.DISCONNECTED);
      this.emit('disconnected');
    }

    // Finalize lifecycle
    this.transitionTo(AdapterState.UNINITIALIZED);
    this.emit('disposed');
  }

  // ===== State Management =====

  getState(): AdapterState {
    return this.state;
  }

  isReady(): boolean {
    return (
      this.state === AdapterState.READY ||
      this.state === AdapterState.CONNECTED ||
      this.state === AdapterState.DEBUGGING
    );
  }

  getCurrentThreadId(): number | null {
    return this.currentThreadId;
  }

  createLaunchBarrier(command: string): AdapterLaunchBarrier | undefined {
    if (command !== 'launch') {
      return undefined;
    }
    return new JsDebugLaunchBarrier(this.dependencies.logger);
  }

  private transitionTo(next: AdapterState): void {
    const prev = this.state;
    this.state = next;
    this.emit('stateChanged', prev, next);
  }

  // ===== Environment Validation =====

  async validateEnvironment(): Promise<ValidationResult> {
    const errors: ValidationResult['errors'] = [];
    const warnings: ValidationResult['warnings'] = [];

    try {
      // ESM-safe resolution of vendored js-debug adapter path
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);

      const possiblePaths = jsDebugCandidatePaths(__dirname);

      let found = false;
      for (const adapterPath of possiblePaths) {
        if (await this.dependencies.fileSystem.pathExists(adapterPath)) {
          found = true;
          break;
        }
      }
      
      if (!found) {
        errors.push({
          code: 'JS_DEBUG_NOT_FOUND',
          message:
            'js-debug adapter not found or not readable. Run: pnpm -w -F @debugmcp/adapter-javascript run build:adapter',
          recoverable: true
        });
      }
    } catch (e) {
      // Unexpected error during validation - mark as recoverable with generic message
      const msg = e instanceof Error ? e.message : String(e);
      warnings.push({
        code: 'VALIDATION_CHECK_FAILED',
        message: `Validation encountered an unexpected error: ${msg}`
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
        name: 'Node.js',
        version: process.version.replace(/^v/, ''),
        required: true,
        installCommand: 'https://nodejs.org'
      }
    ];
  }

  // ===== Executable Management =====

  async resolveExecutablePath(preferredPath?: string): Promise<string> {
    // If a preferred path is provided, compute and override cache deterministically
    if (typeof preferredPath === 'string' && preferredPath.length > 0) {
      const resolved = await findNode(preferredPath);
      this.cachedNodePath = resolved;
      return resolved;
    }

    // Reuse cached path if available
    if (this.cachedNodePath) {
      return this.cachedNodePath;
    }

    // Compute and memoize
    const resolved = await findNode();
    this.cachedNodePath = resolved;
    return resolved;
  }

  getDefaultExecutableName(): string {
    return 'node';
  }

  getExecutableSearchPaths(): string[] {
    const envPath = process.env.PATH ?? '';
    return envPath.split(path.delimiter).filter(Boolean);
  }

  // ===== Adapter Configuration =====

  buildAdapterCommand(config: AdapterConfig): AdapterCommand {
    // ESM-safe resolution of vendored js-debug adapter path
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const possiblePaths = jsDebugCandidatePaths(__dirname);

    const adapterPath = possiblePaths.find(p => this.dependencies.fileSystem.existsSync(p));

    if (!adapterPath) {
      this.dependencies.logger?.error?.(`[JavascriptDebugAdapter] js-debug vendor file not found. Searched paths:`);
      possiblePaths.forEach(p => {
        this.dependencies.logger?.error?.(`  ${p}: NOT FOUND`);
      });
      
      throw new AdapterError(
        `js-debug vendor file not found. Run: pnpm -w -F @debugmcp/adapter-javascript run build:adapter`,
        AdapterErrorCode.ENVIRONMENT_INVALID
      );
    }
    
    this.dependencies.logger?.info?.(`[JavascriptDebugAdapter] Using adapter at: ${adapterPath}`);

    // Command: prefer resolved executablePath provided by Session Manager; fall back to cached or process.execPath
    const command =
      (config && typeof config.executablePath === 'string' && config.executablePath.length > 0)
        ? config.executablePath
        : (this.cachedNodePath || process.execPath);

    // Transport: TCP mode is REQUIRED by the proxy infrastructure
    // The proxy validates adapterPort and rejects port 0 or undefined.
    // js-debug uses positional argument syntax for TCP: [adapterPath, String(port)]
    // This matches the pattern used by the Python adapter (debugpy with --host/--port)
    const port = config.adapterPort;
    
    // Validate port - proxy infrastructure requires valid TCP port
    if (!port || port === 0) {
      throw new AdapterError(
        `Valid TCP port required for JavaScript adapter. Port was: ${port}`,
        AdapterErrorCode.ENVIRONMENT_INVALID
      );
    }

    // js-debug TCP mode: positional port argument followed by host
    // Example: ['path/to/vsDebugServer.cjs', '5678', '127.0.0.1']
    const host =
      typeof config?.adapterHost === 'string' && config.adapterHost.trim().length > 0
        ? config.adapterHost
        : '127.0.0.1';
    // Reaper markers (issue #431): vsDebugServer.cjs reads only argv[2] (port)
    // and argv[3] (host) and ignores trailing tokens, so these tags are inert
    // at runtime — but they let the startup janitor recognize an instance
    // stranded by a hard-killed proxy worker (spawned detached+unref'd, it
    // survives every tree-kill path) and reap it by owner pid. Constraints:
    // tokens must stay whitespace-free (the win32 process scan splits
    // CommandLine on whitespace) and must never contain `--help` (vsDebugServer
    // prints usage and exits if --help appears anywhere in argv).
    const ownerPid = Number(process.env.MCP_DEBUGGER_MAIN_PID) || process.pid;
    const args = [
      adapterPath,
      String(port),
      host,
      `${OWNER_PID_ARG_PREFIX}${ownerPid}`,
      `${SESSION_ID_ARG_PREFIX}${config.sessionId}`
    ];

    // Environment: clone from process.env (string values only), safely ensure NODE_OPTIONS memory flag
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (typeof v === 'string') {
        env[k] = v;
      }
    }
    // A nested server's adapter process must not carry the outer session's
    // exit-code shim either: js-debug builds every debuggee env on top of its
    // own process env (issue #731)
    scrubInheritedExitCodeShim(env);

    const existing = env.NODE_OPTIONS;
    const hasMaxOldSpace =
      typeof existing === 'string' && /--max-old-space-size\b/i.test(existing);

    if (hasMaxOldSpace) {
      // Normalize whitespace to keep env stable
      env.NODE_OPTIONS = existing.replace(/\s+/g, ' ').trim();
    } else {
      const base = typeof existing === 'string' ? existing : '';
      const appended = (base ? `${base} ` : '') + '--max-old-space-size=4096';
      env.NODE_OPTIONS = appended.replace(/\s+/g, ' ').trim();
    }

    return {
      command,
      args,
      env
    };
  }

  getAdapterModuleName(): string {
    return 'js-debug';
  }

  getAdapterInstallCommand(): string {
    return 'npm install -D @vscode/js-debug';
  }

  // ===== Debug Configuration =====

  async transformLaunchConfig(config: GenericLaunchConfig): Promise<LanguageSpecificLaunchConfig> {
    // Base fields and defaults - paths already resolved by server
    this.launchConfigDiagnostics = [];
    const u = normalizeJsLaunchInputs((config || {}) as Record<string, unknown>, this.launchConfigDiagnostics);
    for (const { key, message } of this.launchConfigDiagnostics) {
      this.dependencies.logger?.warn?.(`[JavascriptDebugAdapter] launch ${key}: ${message}`);
    }
    const program = typeof u.program === 'string' ? u.program : '';
    
    // Use cwd as provided (already resolved by server) or derive from program
    let cwd: string;
    if (typeof u.cwd === 'string' && u.cwd) {
      cwd = u.cwd as string;
    } else {
      // In container mode, use MCP_WORKSPACE_ROOT as the working directory
      if (program) {
        cwd = path.dirname(program);
      } else {
        // Fallback: use MCP_WORKSPACE_ROOT in container mode, otherwise process.cwd()
        if (process.env.MCP_CONTAINER === 'true') {
          // Use MCP_WORKSPACE_ROOT if set, fallback to /workspace for backward compatibility
          cwd = process.env.MCP_WORKSPACE_ROOT || '/workspace';
        } else {
          cwd = process.cwd();
        }
      }
    }
    
    const args = Array.isArray(u.args) ? (u.args as string[]) : [];
    const stopOnEntry = (u.stopOnEntry as boolean | undefined) ?? false;
    const justMyCode = (u.justMyCode as boolean | undefined) ?? true;

    // Type detection: treat .ts, .tsx, .mts, .cts as TypeScript — the same
    // predicate resolveJsPauseForSourceMap uses, so the runtime choice and the
    // source-map pause can never disagree on what counts as TypeScript
    const isTS = isJsTranspiledProgram(program);

    const inheritedEnv: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (typeof v === 'string') Object.defineProperty(inheritedEnv, k, { value: v, enumerable: true, writable: true, configurable: true });
    }
    // Scrub the INHERITED shim env before the caller's env is overlaid, not
    // after: a caller who sets MCP_DEBUGGER_EXITCODE_CLAIMED themselves is
    // opting the debuggee out of our exit handler, and a scrub running later
    // silently replaced that with our own claim (issue #731).
    scrubInheritedExitCodeShim(inheritedEnv);
    const mergedEnv = await resolveLaunchEnvironment({
      inherited: inheritedEnv, env: u.env, envFile: u.envFile, cwd,
      readFile: file => this.dependencies.fileSystem?.readFile
        ? this.dependencies.fileSystem.readFile(file, 'utf8')
        : readFile(file, 'utf8'),
      diagnostics: this.launchConfigDiagnostics
    });

    // js-debug never emits a DAP 'exited' event, so preload a shim that
    // records the debuggee's exit code for the proxy worker to replay as a
    // synthesized event (issue #247). Launch mode only - attach targets run
    // with an environment we don't control.
    this.injectExitCodeShim(mergedEnv);

    // js-debug has no justMyCode key: the skip list is the only thing behind
    // the intent, so it is derived from justMyCode here (issue #678). A caller
    // list replaces the defaults, as in VS Code's launch.json.
    const skipFiles = resolveJsLaunchSkipFiles(u);

    // Source maps and outFiles
    type MutableConfig = Partial<LanguageSpecificLaunchConfig> & { [key: string]: unknown };
    const result: MutableConfig = {
      type: 'pwa-node',
      request: 'launch',
      name: 'Debug JavaScript/TypeScript',
      program,
      cwd,
      args,
      stopOnEntry,
      justMyCode,
      // js-debug's smart-stepper keeps stepping while a pause or step is in a
      // skipped frame. Node internals are skipped on every launch, and on a
      // server the request path enters user code by calls, never by returns,
      // so with the stepper on a pause on an idle server never lands (issue
      // #678; the #513 mechanism on attach). justMyCode: false means "let me
      // see everything": turn the stepper off too, so the pause lands
      // truthfully even in an internal frame. An explicit caller value wins;
      // the shared helper is what the policy's hints read too.
      smartStep: resolveJsLaunchSmartStep(u),
      skipFiles,
      console: 'internalConsole',
      outputCapture: 'std',
      // Off by default (every fork() would park under waitForDebugger, #501);
      // an explicit caller value wins, as it does on attach
      autoAttachChildProcesses:
        typeof u.autoAttachChildProcesses === 'boolean' ? u.autoAttachChildProcesses : false,
      env: mergedEnv
    };

    // Source maps are on unless the caller opts out — js-debug's own default,
    // for .js programs as much as for .ts ones (issue #684): a compiled
    // TypeScript app run from dist/ then reports stops, frames, locals and
    // step locations in the src/*.ts view its breakpoints were set in. A
    // program without maps is unaffected; maps whose sources are missing
    // surface as unresolvedSource frames (issue #655).
    const userOut = Array.isArray(u.outFiles) ? (u.outFiles as string[]) : undefined;
    result.sourceMaps = typeof u.sourceMaps === 'boolean' ? u.sourceMaps : true;
    if (result.sourceMaps) {
      result.outFiles = determineOutFiles(userOut);
      // A caller value — including an explicit null, js-debug's "resolve maps
      // everywhere" — wins, as it does on attach (issue #655)
      result.resolveSourceMapLocations = 'resolveSourceMapLocations' in u
        ? this.resolveSourceMapLocationsOrDefault(u.resolveSourceMapLocations)
        : DEFAULT_RESOLVE_SOURCE_MAP_LOCATIONS;
    } else if (userOut) {
      // Caller opted out of maps but named outFiles: pass through untouched
      result.outFiles = userOut;
    }

    // js-debug's source-map pause and workspace root (issue #699). The pause
    // js-debug relies on with pauseForSourceMap does not fire for CommonJS
    // modules under Node 24, and while it is armed js-debug skips its
    // breakpoint predictor — the mechanism that pre-binds every mapped
    // breakpoint before the program runs, the way VS Code's launch does. The
    // predictor needs a workspace root; without one it never ran in any
    // mcp-debugger launch. The shared resolvers keep the policy's embedder
    // fallback on the same rules.
    result.pauseForSourceMap = resolveJsPauseForSourceMap({
      pauseForSourceMap: u.pauseForSourceMap,
      program
    });
    if (result.sourceMaps) {
      // No maps wanted means nothing to predict: the root (and the scan it
      // puts on the child attach's critical path) is only sent with maps on.
      const workspaceFolder = resolveJsLaunchWorkspaceFolder(
        { __workspaceFolder: u.__workspaceFolder, program },
        { fileExists: (p) => this.dependencies.fileSystem?.existsSync?.(p) ?? false }
      );
      if (workspaceFolder !== undefined) {
        result.__workspaceFolder = workspaceFolder;
        // js-debug caches its scan (bp-predict.json, keyed by file mtime)
        // under this directory, so restart_debugging does not re-read the tree
        const cachePath = typeof u.__workspaceCachePath === 'string' && u.__workspaceCachePath
          ? u.__workspaceCachePath
          : this.predictorCacheDirectory();
        if (cachePath) {
          result.__workspaceCachePath = cachePath;
        }
      }
    }

    // Runtime selection and args with overrides and idempotency
    const runtimeExecutableOverride = typeof u.runtimeExecutable === 'string' ? (u.runtimeExecutable as string) : undefined;
    const userRuntimeArgs = Array.isArray(u.runtimeArgs) ? (u.runtimeArgs as string[]) : [];
    const runtimeExecutableWasOverridden = typeof runtimeExecutableOverride === 'string' && runtimeExecutableOverride.length > 0;


    // We use synchronous-only fs helpers (detectBinary) for runtime discovery.
    // Override > auto-detect (tsx/ts-node via detectBinary) > fallback to 'node'.

    // Synchronous detection using detectBinary (fs-only, no async)
    // Respect runtimeExecutable override if provided
    let runtimeExecutableSync: string;
    const tsxSync = isTS ? detectBinary('tsx', cwd) : undefined;
    const tsNodeSync = isTS ? detectBinary('ts-node', cwd) : undefined;

    if (typeof runtimeExecutableOverride === 'string' && runtimeExecutableOverride.length > 0) {
      runtimeExecutableSync = runtimeExecutableOverride;
    } else if (isTS && tsxSync) {
      runtimeExecutableSync = tsxSync;
    } else {
      runtimeExecutableSync = process.execPath || 'node';
    }

    // Compute runtimeArgs synchronously with idempotency and user overrides
    const computedArgs: string[] = [];
    const normalizedRuntime = this.normalizeBinary(runtimeExecutableSync);
    const normalizedTsx = this.normalizeBinary(tsxSync);
    const normalizedTsNode = this.normalizeBinary(tsNodeSync);
    const isTsNodeExecutable =
      normalizedRuntime === 'ts-node' ||
      (!!normalizedTsNode && normalizedRuntime.length > 0 && normalizedRuntime === normalizedTsNode);
    const isUsingTsx =
      normalizedRuntime === 'tsx' ||
      (!!normalizedTsx && normalizedRuntime.length > 0 && normalizedRuntime === normalizedTsx);
    const isNodeRuntime = this.isNodeRuntime(runtimeExecutableSync);

    if (isTS && !runtimeExecutableWasOverridden) {
      // If using tsx (override or detected), do not add ts-node hooks
      if (!isUsingTsx) {
        // If user explicitly selected ts-node executable, don't add hooks (CLI handles it)
        if (!isTsNodeExecutable) {
          // If ts-node is available and we're running under node, add require hooks
          if (tsNodeSync && isNodeRuntime) {
            // Add -r ts-node/register (idempotent with user args)
            if (!this.hasPairArgs(userRuntimeArgs, '-r', 'ts-node/register')) {
              computedArgs.push('-r', 'ts-node/register');
            }
            if (!this.hasPairArgs(userRuntimeArgs, '-r', 'ts-node/register/transpile-only')) {
              computedArgs.push('-r', 'ts-node/register/transpile-only');
            }
            // ESM loader when project is ESM
            if (isESMProject(program, cwd)) {
              if (!this.hasPairArgs(userRuntimeArgs, '--loader', 'ts-node/esm')) {
                computedArgs.push('--loader', 'ts-node/esm');
              }
            }
            // tsconfig-paths/register if paths present
            const dirForTsconfig = cwd || (program ? path.dirname(program) : process.cwd());
            if (hasTsConfigPaths(dirForTsconfig)) {
              if (!this.hasPairArgs(userRuntimeArgs, '-r', 'tsconfig-paths/register')) {
                computedArgs.push('-r', 'tsconfig-paths/register');
              }
            }
          }
        }
      }
    }

    // Append any user-provided args last and normalize/dedupe
    let finalArgs = this.normalizeAndDedupeArgs([...computedArgs, ...userRuntimeArgs]);

    // Normalize Node inspector flags: ensure explicit port form, and add --inspect-brk when stopOnEntry is true

    result.runtimeExecutable = runtimeExecutableSync;
    if (finalArgs.length > 0) {
      result.runtimeArgs = finalArgs;
    }
    // Normalize Node inspector flags for js-debug.
    // If an --inspect/--inspect-brk flag is present, ensure it includes an explicit port.
    if (isNodeRuntime) {
      const findInspectIndex = () =>
        finalArgs.findIndex(
          (a) =>
            a === '--inspect' ||
            a === '--inspect-brk' ||
            a.startsWith('--inspect=') ||
            a.startsWith('--inspect-brk=')
        );
      const idx = findInspectIndex();
      if (idx !== -1) {
        const port = 9229;
        const arg = finalArgs[idx];
        const m = arg.match(/^--inspect(?:-brk)?=(\d+)$/);
        if (m) {
          // Port is already explicit in the flag; no rewrite needed
        } else {
          // Promote to explicit port for consistency and reliable auto-attach
          finalArgs[idx] = `--inspect-brk=${port}`;
          result.runtimeArgs = finalArgs;
        }
      } else if (stopOnEntry === true) {
        // Ensure a deterministic single-session stop on entry when requested
        const port = 9229;
        finalArgs = [...finalArgs, `--inspect-brk=${port}`];
        result.runtimeArgs = finalArgs;
      }
    }

    // Forward every js-debug key the caller passed that this transform does
    // not derive — trace, perScriptSourcemaps, timeouts, sourceMapPathOverrides,
    // … — the way the attach transform has since issue #466; until now a
    // launch silently dropped them (issue #703). Derived keys win; the pwa-node
    // shape mcp-debugger owns and the keys that break a parent launch are
    // dropped with a warning instead.
    const output: Record<string, unknown> = {};
    const forwarded: string[] = [];
    const pinned: string[] = [];
    const ignored: string[] = [];
    for (const [key, value] of Object.entries(u)) {
      if (value === undefined || JS_LAUNCH_CONSUMED_KEYS.has(key) || UNSAFE_OBJECT_KEYS.has(key)) {
        continue;
      }
      if (JS_LAUNCH_PINNED_KEYS.has(key)) {
        pinned.push(key);
        if (value !== result[key]) {
          this.launchConfigDiagnostics.push({ key, message: 'ignored; mcp-debugger pins the js-debug launch shape' });
        }
        continue;
      }
      if (JS_LAUNCH_NOT_FOR_LAUNCH_KEYS.has(key)) {
        ignored.push(key);
        this.launchConfigDiagnostics.push({ key, message: 'ignored; not applicable to a parent launch' });
        continue;
      }
      // js-debug reads trace.stdio when trace is an object: null would throw
      if (key === 'trace' && typeof value !== 'boolean' && (typeof value !== 'object' || value === null || Array.isArray(value))) {
        ignored.push(key);
        this.launchConfigDiagnostics.push({ key, message: 'ignored; expected a boolean or an options object' });
        continue;
      }
      output[key] = value;
      forwarded.push(key);
    }
    Object.assign(output, result);

    const log = this.dependencies.logger;
    if (forwarded.length > 0) {
      log?.info?.(`[JavascriptDebugAdapter] launch config key(s) forwarded to js-debug: ${forwarded.join(', ')}`);
    }
    if (pinned.length > 0) {
      log?.warn?.(`[JavascriptDebugAdapter] launch config key(s) ignored — mcp-debugger pins the js-debug launch shape: ${pinned.join(', ')}`);
    }
    if (ignored.length > 0) {
      log?.warn?.(`[JavascriptDebugAdapter] launch config key(s) ignored — not applicable to a launch: ${ignored.join(', ')}`);
    }

    return output as LanguageSpecificLaunchConfig;
  }

  /**
   * js-debug expects resolveSourceMapLocations as null ("resolve everywhere")
   * or an array of globs; anything else throws inside its path resolver and
   * kills the launch with no hint of the key. Validate here for both
   * transforms and fall back to the default with a warning.
   */
  private resolveSourceMapLocationsOrDefault(value: unknown): string[] | null {
    if (value === null) {
      return null;
    }
    if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) {
      return value as string[];
    }
    this.dependencies.logger?.warn?.(
      `[JavascriptDebugAdapter] resolveSourceMapLocations must be null or an array of globs; ignoring ${JSON.stringify(value)}`
    );
    return DEFAULT_RESOLVE_SOURCE_MAP_LOCATIONS;
  }

  /** Where js-debug may keep its breakpoint-predictor cache; undefined when it cannot be created. */
  private predictorCacheDirectory(): string | undefined {
    const fileSystem = this.dependencies.fileSystem;
    if (!fileSystem?.ensureDirSync) {
      return undefined;
    }
    const dir = path.join(os.tmpdir(), 'debug-mcp-server', 'js-debug-predictor');
    try {
      fileSystem.ensureDirSync(dir);
      return dir;
    } catch {
      return undefined;
    }
  }

  private normalizeBinary(value?: string): string {
    if (!value) {
      return '';
    }
    try {
      return path.normalize(value).replace(/\\/g, '/').toLowerCase();
    } catch {
      return value.toLowerCase();
    }
  }

  private isNodeRuntime(executable?: string): boolean {
    if (!executable) return false;
    const base = path.basename(executable).toLowerCase();
    return base === 'node' || base === 'node.exe' || base === 'node.cmd';
  }

  getDefaultLaunchConfig(): Partial<GenericLaunchConfig> {
    return {
      stopOnEntry: false,
      justMyCode: true,
      env: {},
      cwd: process.cwd()
    };
  }

  /**
   * Inject the exit-code preload shim into the debuggee's environment
   * (issue #247). The shim writes the debuggee's exit code to a per-session
   * temp file; the proxy worker reads it on 'terminated' and synthesizes the
   * DAP 'exited' event js-debug never sends. Missing shim asset degrades
   * gracefully to today's behavior (no exitCode), never a failed launch.
   */
  private injectExitCodeShim(env: Record<string, string | null>): void {
    // The inherited shim env is already gone: transformLaunchConfig scrubs the
    // process.env copy before overlaying the caller's env, so this only ever
    // stamps (issue #731). Keeping the scrub out of here is what lets a
    // caller-supplied claim survive; buildAdapterCommand still runs its own
    // for the adapter process.
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const candidates = [
      path.resolve(__dirname, '../assets/exitcode-shim.cjs'),
      path.resolve(__dirname, '../../assets/exitcode-shim.cjs'),
      // In bundled npx distribution
      path.resolve(__dirname, 'assets/exitcode-shim.cjs'),
      // In container builds
      '/app/packages/adapter-javascript/assets/exitcode-shim.cjs',
      '/app/node_modules/@debugmcp/adapter-javascript/assets/exitcode-shim.cjs'
    ];

    let shimPath: string | undefined;
    try {
      shimPath = candidates.find(p => this.dependencies.fileSystem?.existsSync?.(p));
    } catch {
      shimPath = undefined;
    }

    if (!shimPath) {
      this.dependencies.logger?.warn?.(
        '[JavascriptDebugAdapter] exitcode-shim.cjs not found; debuggee exit code will not be captured'
      );
      return;
    }

    env.MCP_DEBUGGER_EXITCODE_FILE = path.join(os.tmpdir(), `mcp-exitcode-${randomUUID()}.txt`);
    // Double quotes survive NODE_OPTIONS parsing for paths with spaces;
    // forward slashes sidestep backslash-escape ambiguity on Windows
    const requireArg = `--require "${shimPath.replace(/\\/g, '/')}"`;
    env.NODE_OPTIONS = env.NODE_OPTIONS ? `${env.NODE_OPTIONS} ${requireArg}`.trim() : requireArg;
  }

  // ===== Attach Support =====

  supportsAttach(): boolean {
    return true;
  }

  /**
   * Build the js-debug (pwa-node) attach configuration. Unlike
   * transformLaunchConfig — which always produces a launch request — this
   * preserves the attach request/host/port so the proxy worker detects attach
   * mode and JsDebugAdapterPolicy.performHandshake sends a real DAP 'attach'.
   */
  transformAttachConfig(config: GenericAttachConfig): LanguageSpecificAttachConfig {
    const {
      request: _request,
      __attachMode: _attachMode,
      processId: _processId,
      processName: _processName,
      identifierType: _identifierType,
      host,
      port,
      ...rest
    } = config as Record<string, unknown>;
    void _request; void _attachMode; void _processId; void _processName;
    void _identifierType;

    // Advanced passthrough (localRoot/remoteRoot, sourceMaps, skipFiles, …)
    // with the normalized pwa-node attach shape on top (issues #450/#466).
    return {
      ...rest,
      type: 'pwa-node',
      request: 'attach',
      name: 'Attach to Node.js process',
      host: (host as string | undefined) || '127.0.0.1',
      port: port as number | undefined,
      // js-debug's pwa-node attach defaults this to true, injecting its
      // NODE_OPTIONS bootloader into the inspected process; every fork() then
      // parks under waitForDebugger and only one child can be adopted (#501).
      // Default it off like launch mode does; an explicit caller value wins
      // (never silently override a supported key — cf. #499).
      autoAttachChildProcesses:
        typeof rest.autoAttachChildProcesses === 'boolean'
          ? rest.autoAttachChildProcesses
          : false,
      // js-debug's smart-stepper turns a user pause that lands on a
      // blackboxed/unmapped frame into an auto-step — and on a mostly-idle
      // server every frame the pause can land on is a node-internal one, so
      // it steps forever and the 'stopped' event never fires (issue #513;
      // its >256-step failsafe switches to step-out, which never escapes an
      // idle event loop either). Breakpoint/exception/entry stops are exempt
      // in js-debug itself, so those keep their normal behavior. Default it
      // off for attach — pausing an attached process must land truthfully,
      // even in an internal frame; an explicit caller value wins.
      smartStep: typeof rest.smartStep === 'boolean' ? rest.smartStep : false,
      // Source-map resolution on attach (issue #655). js-debug's pwa-node
      // attach defaults resolveSourceMapLocations to ['**','!**/node_modules/**'],
      // but its applyNodeDefaults copies an undefined outFiles over that
      // default before the spread, and without a workspace folder the value
      // collapses to null (= resolve maps everywhere). Dependencies that ship
      // .js.map files without their sources then surface as phantom
      // '../src/*.ts' frames. Pass launch's exclusion explicitly; an explicit
      // caller value — including null — wins ('in' check, not Array.isArray).
      // skipFiles is deliberately NOT defaulted: '**/node_modules/**' would
      // V8-blackbox dependency scripts and turn a pause landing in framework
      // glue on an idle server into the #513 step-chase; the policy hides
      // those frames from get_stack_trace instead. (Launch does blackbox
      // node_modules while justMyCode is true — see resolveJsLaunchSkipFiles.)
      resolveSourceMapLocations: 'resolveSourceMapLocations' in rest
        ? this.resolveSourceMapLocationsOrDefault(rest.resolveSourceMapLocations)
        : DEFAULT_RESOLVE_SOURCE_MAP_LOCATIONS,
      // js-debug resolves a source map's relative `sources` only when it has
      // a base path, and its attach path leaves cwd undefined — so even the
      // debuggee's own '../../src/x.ts' entries (which do exist next to
      // dist/) were reported as unopenable relative labels. The value only
      // gates the resolution (sources resolve against the map's own
      // location, verified with a deliberately wrong cwd); default it the way
      // launch does when no program dir is known. An explicit caller value wins.
      ...('cwd' in rest ? {} : { cwd: defaultAttachCwd() }),
    } as LanguageSpecificAttachConfig;
  }

  getDefaultAttachConfig(): Partial<GenericAttachConfig> {
    return {
      request: 'attach',
      host: '127.0.0.1',
    };
  }

  // ===== DAP Protocol Operations =====

  async sendDapRequest<T extends DebugProtocol.Response>(_command: string, _args?: unknown): Promise<T> {
    // Transport handled by ProxyManager
    return {} as T;
  }

  handleDapEvent(event: DebugProtocol.Event): void {
    const body: Record<string, unknown> = (event.body as Record<string, unknown>) ?? {};

    // Optional trace logging
    this.dependencies?.logger?.debug?.(`DAP event: ${event.event}`);

    switch (event.event) {
      case 'output': {
        if (body && body.category == null) {
          body.category = 'console';
        }
        break;
      }
      case 'stopped': {
        {
          const maybeTid = (body as { threadId?: unknown }).threadId;
          if (typeof maybeTid === 'number') {
            this.currentThreadId = maybeTid;
          }
        }
        this.transitionTo(AdapterState.DEBUGGING);
        break;
      }
      case 'continued': {
        // keep state as-is; if already debugging, remain
        break;
      }
      case 'terminated':
      case 'exited': {
        // Do not alter state; ProxyManager lifecycle handles cleanup
        break;
      }
      default:
        break;
    }

    // Emit event body to consumers (consistent with existing tests)
    this.emit(event.event as string, body);
  }

  handleDapResponse(): void {
    // No-op: DAP responses handled by the proxy layer
  }

  // ===== Connection Management =====

  async connect(host: string, port: number): Promise<void> {
    // Log connection intent; actual transport handled by ProxyManager
    this.dependencies?.logger?.debug?.(`connect requested to ${host}:${port}`);
    this.connected = true;
    this.transitionTo(AdapterState.CONNECTED);
    this.emit('connected');
  }

  async disconnect(): Promise<void> {
    this.dependencies?.logger?.debug?.('disconnect requested');
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
    return `JavaScript/TypeScript Debugging Setup:

1) Install Node.js 14+ from https://nodejs.org
2) Vendor js-debug into this package:
   pnpm -w -F @debugmcp/adapter-javascript run build:adapter
3) (Optional, for TypeScript) Install runners:
   npm i -D tsx ts-node tsconfig-paths`;
  }

  getMissingExecutableError(): string {
    return "Node.js runtime not found. Install from https://nodejs.org and ensure it's on PATH. You can also set a specific executable path in config.";
  }

  translateErrorMessage(error: Error): string {
    const msg = String(error?.message ?? '');
    const lower = msg.toLowerCase();

    if (lower.includes('enoent') || lower.includes('not found')) {
      return this.getMissingExecutableError();
    }
    if (lower.includes('eacces') || lower.includes('permission denied')) {
      return 'Permission denied executing Node.js runtime';
    }
    if (/cannot find module ['"]ts-node['"]|cannot find module ['"]tsx['"]|ts-node.*module not found|tsx.*module not found/i.test(msg)) {
      return 'Install tsx or ts-node: npm i -D tsx ts-node tsconfig-paths';
    }
    return error.message;
  }

  // ===== Feature Support (conservative defaults) =====

  supportsFeature(feature: DebugFeature): boolean {
    switch (feature) {
      case DebugFeature.CONDITIONAL_BREAKPOINTS:
      case DebugFeature.EXCEPTION_BREAKPOINTS:
      case DebugFeature.EVALUATE_FOR_HOVERS:
      case DebugFeature.SET_VARIABLE:
      case DebugFeature.LOG_POINTS:
      case DebugFeature.EXCEPTION_INFO_REQUEST:
      case DebugFeature.LOADED_SOURCES_REQUEST:
      case DebugFeature.FUNCTION_BREAKPOINTS:
        return true;
      default:
        return false;
    }
  }

  getFeatureRequirements(feature: DebugFeature): FeatureRequirement[] {
    switch (feature) {
      case DebugFeature.LOG_POINTS:
        return [
          {
            type: 'version',
            description: 'Requires recent js-debug version',
            required: true
          }
        ];
      default:
        return [];
    }
  }

  getCapabilities(): AdapterCapabilities {
    return {
      supportsConfigurationDoneRequest: true,
      // js-debug itself implements no setFunctionBreakpoints (its initialize
      // response says false), but ours are delivered out of band by the
      // proxy's CDP bridge (issue #295) — the policy's functionBreakpointsVia
      // 'cdp' marker makes the live capability bit irrelevant to gating
      supportsFunctionBreakpoints: true,
      supportsConditionalBreakpoints: true,
      supportsEvaluateForHovers: true,
      supportsLoadedSourcesRequest: true,
      supportsLogPoints: true,
      supportsExceptionInfoRequest: true,
      supportsTerminateRequest: true,
      supportsBreakpointLocationsRequest: true,
      // Matches the filters js-debug actually declares in its initialize
      // response (runtime-verified for issue #220): 'all' and 'uncaught'
      exceptionBreakpointFilters: [
        { filter: 'all', label: 'Caught Exceptions', default: false },
        { filter: 'uncaught', label: 'Uncaught Exceptions', default: false }
      ]
    };
  }

  private normalizeAndDedupeArgs(args: string[]): string[] {
    const out: string[] = [];
    const seenPairs = new Set<string>();
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '-r' && i + 1 < args.length) {
        const mod = args[i + 1];
        const key = `-r:${mod}`;
        if (!seenPairs.has(key)) {
          out.push(a, mod);
          seenPairs.add(key);
        }
        i++; // skip next
        continue;
      }
      if (a === '--loader' && i + 1 < args.length) {
        const ld = args[i + 1];
        const key = `--loader:${ld}`;
        if (!seenPairs.has(key)) {
          out.push(a, ld);
          seenPairs.add(key);
        }
        i++; // skip next
        continue;
      }
      out.push(a);
    }
    return out;
  }

  private hasPairArgs(args: readonly string[], flag: string, value: string): boolean {
    for (let i = 0; i < args.length - 1; i++) {
      if (args[i] === flag && args[i + 1] === value) return true;
    }
    return false;
  }

}

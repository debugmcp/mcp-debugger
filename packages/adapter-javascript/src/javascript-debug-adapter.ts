/**
 * JavaScript/TypeScript Debug Adapter (skeleton)
 *
 * NOTE: This is a minimal, non-functional stub for Task 1 scaffolding.
 * TODO: Add DebugLanguage.JAVASCRIPT to @debugmcp/shared enum in a later task.
 *
 * @since 0.1.0
 */
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
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
  type LanguageSpecificLaunchConfig,
  type FeatureRequirement,
  type AdapterCapabilities,
  type AdapterLaunchBarrier
} from '@debugmcp/shared';
import { DebugLanguage } from '@debugmcp/shared';
import type { AdapterDependencies } from '@debugmcp/shared';
import { findNode } from './utils/executable-resolver.js';
import { detectTsRunners as detectTsRunnersUtil, detectBinary } from './utils/typescript-detector.js';
import { determineOutFiles, isESMProject, hasTsConfigPaths } from './utils/config-transformer.js';
import { JsDebugLaunchBarrier } from './utils/js-debug-launch-barrier.js';

export class JavascriptDebugAdapter extends EventEmitter implements IDebugAdapter {
  // Cast string until DebugLanguage includes JAVASCRIPT
  readonly language = 'javascript' as unknown as DebugLanguage;
  readonly name = 'JavaScript/TypeScript Debug Adapter';

  private state: AdapterState = AdapterState.UNINITIALIZED;
  private readonly dependencies: AdapterDependencies;

  private currentThreadId: number | null = null;
  private connected = false;

  // Per-instance memoization for executable detection
  private cachedNodePath?: string;
  private cachedTsRunners?: { tsx?: string; tsNode?: string };

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
    this.cachedTsRunners = undefined;

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
      
      // Try multiple possible locations
      const possiblePaths = [
        path.resolve(__dirname, '../vendor/js-debug/vsDebugServer.cjs'),
        path.resolve(__dirname, '../vendor/js-debug/vsDebugServer.js'),
        // In bundled npx distribution
        path.resolve(__dirname, 'vendor/js-debug/vsDebugServer.cjs'),
        path.resolve(__dirname, 'vendor/js-debug/vsDebugServer.js'),
      ];
      
      let found = false;
      for (const adapterPath of possiblePaths) {
        try {
          await fs.promises.access(adapterPath, fs.constants.R_OK);
          found = true;
          break;
        } catch {
          // Continue checking other paths
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
    
    // Try multiple possible locations for the vendored js-debug
    const possiblePaths = [
      path.resolve(__dirname, '../vendor/js-debug/vsDebugServer.cjs'),
      path.resolve(__dirname, '../vendor/js-debug/vsDebugServer.js'),
      // In bundled npx distribution
      path.resolve(__dirname, 'vendor/js-debug/vsDebugServer.cjs'),
      path.resolve(__dirname, 'vendor/js-debug/vsDebugServer.js'),
      // In container builds, might be in different locations
      '/app/packages/adapter-javascript/vendor/js-debug/vsDebugServer.cjs',
      '/app/node_modules/@debugmcp/adapter-javascript/vendor/js-debug/vsDebugServer.cjs'
    ];
    
    const adapterPath = possiblePaths.find(p => fs.existsSync(p));
    
    if (!adapterPath) {
      this.dependencies.logger?.error?.(`[JavascriptDebugAdapter] js-debug vendor file not found. Searched paths:`);
      possiblePaths.forEach(p => {
        this.dependencies.logger?.error?.(`  ${p}: ${fs.existsSync(p) ? 'EXISTS' : 'NOT FOUND'}`);
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
    const args = [adapterPath, String(port), host];

    // Environment: clone from process.env (string values only), safely ensure NODE_OPTIONS memory flag
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (typeof v === 'string') {
        env[k] = v;
      }
    }

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

  transformLaunchConfig(config: GenericLaunchConfig): LanguageSpecificLaunchConfig {
    // Base fields and defaults - paths already resolved by server
    const user = (config || {}) as Record<string, unknown>;
    const u = user as Record<string, unknown>;
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

    // Type detection: treat .ts, .tsx, .mts, .cts as TypeScript
    const isTS = /\.([mc])?tsx?$/i.test(program);

    // Env: copy string values from process.env, merge user env (string-only), set NODE_ENV
    const mergedEnv: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (typeof v === 'string') mergedEnv[k] = v;
    }
    const userEnv = (u.env as Record<string, unknown> | undefined);
    if (userEnv && typeof userEnv === 'object') {
      for (const [k, v] of Object.entries(userEnv)) {
        if (typeof v === 'string') mergedEnv[k] = v;
      }
    }
    mergedEnv.NODE_ENV = userEnv && typeof userEnv.NODE_ENV === 'string'
      ? (userEnv.NODE_ENV as string)
      : 'development';

    // Skip files defaults with optional user merge (dedupe)
    const defaultSkip = ['<node_internals>/**', '**/node_modules/**'];
    const userSkip = Array.isArray(u.skipFiles) ? (u.skipFiles as string[]) : undefined;
    const skipFiles = Array.from(new Set([...(userSkip || []), ...defaultSkip]));

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
      smartStep: true,
      skipFiles,
      console: 'internalConsole',
      outputCapture: 'std',
      autoAttachChildProcesses: false,
      env: mergedEnv
    };

    if (isTS) {
      result.sourceMaps = true;
      const outFiles = determineOutFiles(program, Array.isArray(u.outFiles) ? (u.outFiles as string[]) : undefined);
      result.outFiles = outFiles;
      result.resolveSourceMapLocations = ['**', '!**/node_modules/**'];
    } else {
      const sm = Boolean(u.sourceMaps as unknown);
      result.sourceMaps = sm;
      const userOut = Array.isArray(u.outFiles) ? (u.outFiles as string[]) : undefined;
      if (sm) {
        result.outFiles = determineOutFiles(program, userOut);
        result.resolveSourceMapLocations = ['**', '!**/node_modules/**'];
      } else if (userOut) {
        // If user explicitly provided outFiles while sourceMaps false, pass through
        result.outFiles = userOut;
      }
    }

    // Runtime selection and args with overrides and idempotency
    const runtimeExecutableOverride = typeof u.runtimeExecutable === 'string' ? (u.runtimeExecutable as string) : undefined;
    const userRuntimeArgs = Array.isArray(u.runtimeArgs) ? (u.runtimeArgs as string[]) : [];


    // Note: transformLaunchConfig is not async in the interface; however our internal
    // helpers are async. Since we cannot change the signature, we synchronously block
    // by using deasync-like pattern is not allowed. Instead, we conservatively return
    // a config with best-effort synchronous defaults and attach async results is not possible.
    // To comply, we perform a synchronous approximation for runtimeExecutable/args:
    // - Prefer overrides immediately.
    // - For auto-detection, we will fall back to 'node' and empty args synchronously,
    //   and only compute more specific values when called in async contexts in later tasks.
    // Here, we inline minimal logic synchronously while keeping async helpers available.

    // Synchronous detection using detectBinary (fs-only, no async)
    // Respect runtimeExecutable override if provided
    let runtimeExecutableSync: string;
    const tsxSync = isTS ? detectBinary('tsx', cwd) : undefined;
    const tsNodeSync = isTS ? detectBinary('ts-node', cwd) : undefined;

    if (typeof runtimeExecutableOverride === 'string' && runtimeExecutableOverride.length > 0) {
      runtimeExecutableSync = runtimeExecutableOverride;
    } else {
      // Auto-detect for TS: tsx > node
      if (isTS && tsxSync) {
        runtimeExecutableSync = tsxSync;
      } else {
        runtimeExecutableSync = 'node';
      }
    }

    // Compute runtimeArgs synchronously with idempotency and user overrides
    const computedArgs: string[] = [];
    if (isTS) {
      // If using tsx (override or detected), do not add ts-node hooks
      const isUsingTsx = runtimeExecutableSync === 'tsx' || (!!tsxSync && runtimeExecutableSync === tsxSync);
      if (!isUsingTsx) {
        // If user explicitly selected ts-node executable, don't add hooks (CLI handles it)
        if (runtimeExecutableSync !== 'ts-node') {
          // If ts-node is available and we're running under node, add require hooks
          if (tsNodeSync && runtimeExecutableSync === 'node') {
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

    // Do not force Node inspector flags here; rely on adapter's stopOnEntry behavior.

    result.runtimeExecutable = runtimeExecutableSync;
    if (finalArgs.length > 0) {
      result.runtimeArgs = finalArgs;
    }
    // Normalize Node inspector flags and enable single-session adoption in js-debug.
    // If an --inspect/--inspect-brk flag is present, ensure it's explicit with a port
    // and set attachSimplePort so js-debug adopts the target in this same DAP session
    // (avoiding a reverse 'startDebugging' request).
    if (runtimeExecutableSync === 'node') {
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
        let port = 9229;
        const arg = finalArgs[idx];
        const m = arg.match(/^--inspect(?:-brk)?=(\d+)$/);
        if (m) {
          const p = Number(m[1]);
          if (!Number.isNaN(p) && p > 0) port = p;
        } else {
          // Promote to explicit port for consistency and reliable auto-attach
          finalArgs[idx] = `--inspect-brk=${port}`;
          result.runtimeArgs = finalArgs;
        }
        // REMOVED: attachSimplePort to trigger multi-session mode
      } else if (stopOnEntry === true) {
        // Ensure a deterministic single-session stop on entry when requested
        const port = 9229;
        finalArgs = [...finalArgs, `--inspect-brk=${port}`];
        result.runtimeArgs = finalArgs;
        // REMOVED: attachSimplePort to trigger multi-session mode
      }
    }

    return result as LanguageSpecificLaunchConfig;
  }

  getDefaultLaunchConfig(): Partial<GenericLaunchConfig> {
    return {
      stopOnEntry: false,
      justMyCode: true,
      env: {},
      cwd: process.cwd()
    };
  }

  // ===== DAP Protocol Operations (stubs) =====

  async sendDapRequest<T extends DebugProtocol.Response>(command: string, args?: unknown): Promise<T> {
    // Minimal validation only; transport handled by ProxyManager
    try {
      const logger = this.dependencies.logger;
      logger?.debug?.(`sendDapRequest: ${command}`);

      // Clone top-level and nested source to avoid mutating original args
      let req: Record<string, unknown> | undefined;
      if (args && typeof args === 'object') {
        const base = args as Record<string, unknown>;
        const source = base.source && typeof base.source === 'object'
          ? { ...(base.source as Record<string, unknown>) }
          : undefined;
        req = { ...base, source };
      }

      if (command === 'setBreakpoints' && req && typeof req.source === 'object' && req.source) {
        const src = req.source as Record<string, unknown>;
        const p = src.path;
        if (typeof p === 'string') {
          src.path = path.resolve(p);
        }
      }
    } catch {
      // ignore validation/logging errors
    }

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
    // No-op for Task 1
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
      case DebugFeature.FUNCTION_BREAKPOINTS:
      case DebugFeature.EXCEPTION_BREAKPOINTS:
      case DebugFeature.EVALUATE_FOR_HOVERS:
      case DebugFeature.SET_VARIABLE:
      case DebugFeature.LOG_POINTS:
      case DebugFeature.EXCEPTION_INFO_REQUEST:
      case DebugFeature.LOADED_SOURCES_REQUEST:
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
      supportsFunctionBreakpoints: true,
      supportsConditionalBreakpoints: true,
      supportsEvaluateForHovers: true,
      supportsLoadedSourcesRequest: true,
      supportsLogPoints: true,
      supportsExceptionInfoRequest: true,
      supportsTerminateRequest: true,
      supportsBreakpointLocationsRequest: true,
      exceptionBreakpointFilters: [
        { filter: 'uncaught', label: 'Uncaught Exceptions', default: true },
        { filter: 'userUnhandled', label: 'User-Unhandled Exceptions', default: false }
      ]
    };
  }

  // ===== Runtime selection helpers =====

  private async determineRuntimeExecutable(isTypeScript: boolean): Promise<string> {
    if (!isTypeScript) {
      return 'node';
    }
    const runners = await this.detectTypeScriptRunners();
    if (runners.tsx) {
      return runners.tsx;
    }
    if (runners.tsNode) {
      // Use node with ts-node require hooks
      return 'node';
    }
    // Warn when no TS runner found
    try {
      // Prefer dependency logger if present
      const logger = this.dependencies.logger;
      if (logger && typeof logger.warn === 'function') {
        logger.warn('TypeScript file detected but no TS runner found. Install tsx or ts-node for best experience.');
      } else {
        // Fallback to console
        console.warn('TypeScript file detected but no TS runner found. Install tsx or ts-node for best experience.');
      }
    } catch {
      // ignore logging errors
    }
    return 'node';
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

  private computeRuntimeArgsSync(
    isTypeScript: boolean,
    opts: { program: string; cwd: string; runtimeExecutable: string; userRuntimeArgs: string[] }
  ): string[] {
    const userArgs = Array.isArray(opts.userRuntimeArgs) ? opts.userRuntimeArgs.slice() : [];
    const base: string[] = [];

    if (!isTypeScript) {
      return this.normalizeAndDedupeArgs([...base, ...userArgs]);
    }

    // If runtimeExecutable is 'tsx', do not add ts-node hooks
    if (opts.runtimeExecutable === 'tsx') {
      return this.normalizeAndDedupeArgs([...base, ...userArgs]);
    }

    // If runtimeExecutable is 'ts-node', assume CLI handles transpilation; avoid adding hooks
    if (opts.runtimeExecutable === 'ts-node') {
      return this.normalizeAndDedupeArgs([...base, ...userArgs]);
    }

    // Heuristic-only synchronous add for ts-node hooks is skipped (we don't know availability);
    // rely on async version for precise behavior. Still, consider user args idempotency only.
    return this.normalizeAndDedupeArgs([...base, ...userArgs]);
  }

  private async determineRuntimeArgs(isTypeScript: boolean, config: Record<string, unknown>): Promise<string[]> {
    const userArgs: string[] = Array.isArray(config?.runtimeArgs) ? config.runtimeArgs.slice() : [];
    const args: string[] = [];

    if (!isTypeScript) {
      return this.normalizeAndDedupeArgs([...args, ...userArgs]);
    }

    const program: string = typeof config?.program === 'string' ? config.program : '';
    const cwd: string = typeof config?.cwd === 'string' ? config.cwd : (program ? path.dirname(program) : process.cwd());
    const overrideExec: string | undefined = typeof config?.runtimeExecutable === 'string' ? config.runtimeExecutable : undefined;

    // Respect runtimeExecutable overrides
    if (overrideExec === 'tsx') {
      // tsx executable handles TS, no hooks
      return this.normalizeAndDedupeArgs([...args, ...userArgs]);
    }
    if (overrideExec === 'ts-node') {
      // ts-node CLI handles transpilation; avoid adding hooks; still dedupe any user-provided hooks
      return this.normalizeAndDedupeArgs([...args, ...userArgs]);
    }

    const runners = await this.detectTypeScriptRunners();

    // If no override, prefer tsx -> no hooks
    if (!overrideExec && runners.tsx) {
      return this.normalizeAndDedupeArgs([...args, ...userArgs]);
    }

    // If ts-node present, add require hooks for node
    if (runners.tsNode) {
      // Only add if user hasn't already provided the same hooks
      if (!this.hasPairArgs(userArgs, '-r', 'ts-node/register')) {
        args.push('-r', 'ts-node/register');
      }
      if (!this.hasPairArgs(userArgs, '-r', 'ts-node/register/transpile-only')) {
        args.push('-r', 'ts-node/register/transpile-only');
      }

      // ESM loader if project is ESM
      if (isESMProject(program, cwd)) {
        if (!this.hasPairArgs(userArgs, '--loader', 'ts-node/esm')) {
          args.push('--loader', 'ts-node/esm');
        }
      }

      // tsconfig-paths/register if paths present
      const dirForTsconfig = cwd || (program ? path.dirname(program) : process.cwd());
      if (hasTsConfigPaths(dirForTsconfig)) {
        if (!this.hasPairArgs(userArgs, '-r', 'tsconfig-paths/register')) {
          args.push('-r', 'tsconfig-paths/register');
        }
      }
    } else {
      // No TS runner found; keep args empty (warn in executable selection)
    }

    // Append user args last and dedupe known pairs/loader
    return this.normalizeAndDedupeArgs([...args, ...userArgs]);
  }

  // ===== Internal discovery helpers =====
  // Task 7 will use these detected runners to adjust runtime executable/args as needed.
  private async detectTypeScriptRunners(): Promise<{ tsx?: string; tsNode?: string }> {
    if (this.cachedTsRunners) {
      return this.cachedTsRunners;
    }
    const result = await detectTsRunnersUtil();
    this.cachedTsRunners = result;
    return result;
  }
}

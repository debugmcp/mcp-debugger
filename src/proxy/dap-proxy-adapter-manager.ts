/**
 * Generic adapter process management for DAP proxy
 * Language-agnostic version that can spawn any debug adapter
 */

import { ChildProcess } from 'child_process';
import type { Readable } from 'stream';
import { LineBuffer, sanitizeStderr } from '@debugmcp/shared';
import {
  IProcessSpawner,
  ILogger,
  IFileSystem,
  AdapterSpawnResult
} from './dap-proxy-interfaces.js';

/**
 * Configuration for spawning any debug adapter
 */
export interface GenericAdapterConfig {
  command: string;
  args: string[];
  logDir: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

/**
 * Generic adapter manager that can spawn any debug adapter process
 */
export class GenericAdapterManager {
  constructor(
    private processSpawner: IProcessSpawner,
    private logger: ILogger,
    private fileSystem: IFileSystem,
    /** Platform override for tests (issue #183); defaults to the real platform. */
    private platform: NodeJS.Platform = globalThis.process.platform
  ) {}

  /**
   * Ensure the log directory exists
   */
  async ensureLogDirectory(logDir: string): Promise<void> {
    try {
      await this.fileSystem.ensureDir(logDir);
      this.logger.info(`[AdapterManager] Ensured adapter log directory exists: ${logDir}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[AdapterManager] Failed to ensure adapter log directory ${logDir}:`, error);
      throw new Error(`Failed to create adapter log directory: ${message}`);
    }
  }

  /**
   * Spawn a generic debug adapter process
   */
  async spawn(config: GenericAdapterConfig): Promise<AdapterSpawnResult> {
    const { command, args, logDir, cwd, env } = config;

    // Ensure log directory exists
    await this.ensureLogDirectory(logDir);

    const fullCommand = `${command} ${args.join(' ')}`;
    this.logger.info(`[AdapterManager] Spawning adapter: ${fullCommand}`);
    
    // Spawn options - no cwd manipulation, inherit from parent
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Need dynamic cwd property
    const spawnOptions: any = {
      stdio: ['ignore', 'pipe', 'pipe'] as ('ignore' | 'pipe' | 'inherit' | 'ipc' | number)[],
      env: env || process.env,
      detached: true,
      windowsHide: true
    };

    // Only set cwd if explicitly provided
    if (cwd) {
      spawnOptions.cwd = cwd;
    }

    // Log critical environment variables for debugging. These key names are
    // not secret-shaped, so key-based redaction would pass every value
    // through — run the values through the stderr value-shape redaction
    // instead (catches tokens, JWTs, PEM headers smuggled into e.g.
    // NODE_OPTIONS).
    const describeEnvVar = (value: string | undefined): string =>
      value === undefined ? '<not set>' : sanitizeStderr([value])[0];
    const criticalEnvVars = {
      NODE_OPTIONS: describeEnvVar(spawnOptions.env?.NODE_OPTIONS),
      NODE_DEBUG: describeEnvVar(spawnOptions.env?.NODE_DEBUG),
      NODE_ENV: describeEnvVar(spawnOptions.env?.NODE_ENV),
      DEBUG: describeEnvVar(spawnOptions.env?.DEBUG),
      VSCODE_INSPECTOR_OPTIONS: describeEnvVar(spawnOptions.env?.VSCODE_INSPECTOR_OPTIONS),
      // Check for any inspector-related variables
      hasInspectVars: Object.keys(spawnOptions.env || {}).some(k =>
        k.includes('INSPECT') || k.includes('DEBUG')
      )
    };

    this.logger.info('[AdapterManager] Spawn configuration:', {
      command: command,
      args: args,
      cwd: cwd || 'inherited',
      envVars: Object.keys(spawnOptions.env || {}).length,
      criticalEnvVars
    });

    // Log the full command being executed
    this.logger.info('[AdapterManager] Full command to execute:', {
      fullCommand: fullCommand,
      execArgv: args.filter(arg => arg.startsWith('--inspect')),
      hasInspectFlag: args.some(arg => arg.includes('--inspect'))
    });

    // Spawn the process
    const adapterProcess = this.processSpawner.spawn(command, args, spawnOptions);

    if (!adapterProcess || !adapterProcess.pid) {
      throw new Error('Failed to spawn adapter process or get PID');
    }

    // Detach and unref so proxy lifecycle is not blocked by child adapter
    try {
      adapterProcess.unref();
      this.logger.info(`[AdapterManager] Called unref() on adapter process PID: ${adapterProcess.pid}`);
    } catch {
      // ignore unref errors (older Node or platform quirk)
    }

    // Spawned adapter process; hide console on Windows and detach for independent lifecycle
    this.logger.info(`[AdapterManager] Spawned adapter process PID: ${adapterProcess.pid} (windowsHide=${!!spawnOptions.windowsHide}, detached=${!!spawnOptions.detached})`);

    // Set up error handlers and stderr capture
    this.setupProcessHandlers(adapterProcess);

    return {
      process: adapterProcess,
      pid: adapterProcess.pid
    };
  }

  /**
   * Set up process event handlers
   */
  private setupProcessHandlers(adapterProcess: ChildProcess): void {
    adapterProcess.on('error', (err: Error) => {
      this.logger.error('[AdapterManager] Adapter process spawn error:', err);
    });

    // Capture stderr for diagnostics. Chunks arrive at arbitrary byte
    // boundaries, so they are line-buffered before sanitization — a secret
    // assignment split across two chunks would otherwise leak its tail past
    // the key/value redaction patterns (issues #151/#153).
    if (adapterProcess.stderr) {
      this.consumeStream(adapterProcess.stderr, line =>
        this.logger.error(`[AdapterManager STDERR] ${line}`)
      );
    }

    // stdout is piped but carries no DAP traffic (that goes over TCP); drain
    // it through the same sanitized path so a chatty adapter cannot fill the
    // pipe buffer and stall, and its diagnostics land in the log at debug.
    if (adapterProcess.stdout) {
      this.consumeStream(adapterProcess.stdout, line =>
        this.logger.debug(`[AdapterManager STDOUT] ${line}`)
      );
    }

    adapterProcess.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
      this.logger.info(`[AdapterManager] Adapter process exited. Code: ${code}, Signal: ${signal}`);
    });
  }

  /**
   * Line-buffer, sanitize, and log a child output stream. The trailing
   * partial line is flushed on the stream's own 'end'/'close', never on
   * process 'exit' — the pipe can still deliver the rest of a split line
   * after exit, which would re-create the straddle leak (issue #151).
   */
  private consumeStream(stream: Readable, logLine: (line: string) => void): void {
    const buffer = new LineBuffer();
    const record = (lines: string[]) => {
      for (const line of sanitizeStderr(lines.filter(l => l.trim().length > 0))) {
        logLine(line);
      }
    };
    stream.on('data', (data: Buffer | string) => record(buffer.append(data.toString())));
    const flush = () => record(buffer.flush());
    stream.on('end', flush);
    stream.on('close', flush);
  }

  /**
   * Gracefully shutdown an adapter process.
   *
   * killProcessTree (launch mode only): on Windows the debuggee may be a
   * grandchild of the adapter (e.g. rdbg -c spawns the target as a child),
   * and a bare kill of the adapter is TerminateProcess — near-instant —
   * which orphans the grandchild. taskkill /T can only discover children
   * while the parent is alive, so the tree-kill must be the FIRST strike,
   * not a fallback (issue #156). Callers must never set it for attach mode.
   */
  async shutdown(process: ChildProcess | null, options: { killProcessTree?: boolean } = {}): Promise<void> {
    if (!process || !process.pid) {
      this.logger.info('[AdapterManager] No active adapter process to terminate.');
      return;
    }

    // An adapter that honored the DAP disconnect exits on its own during the
    // worker's grace wait — by now its PID may already belong to an unrelated
    // process, so signalling it (let alone taskkill /T /F) is a PID-reuse hazard.
    if (process.exitCode !== null || process.signalCode !== null) {
      this.logger.info(`[AdapterManager] Adapter process PID: ${process.pid} already exited (code=${process.exitCode}, signal=${process.signalCode}). Nothing to terminate.`);
      return;
    }

    this.logger.info(`[AdapterManager] Attempting to terminate adapter process PID: ${process.pid}`);

    const treeKillFirst = options.killProcessTree === true && this.platform === 'win32';

    try {
      if (!process.killed) {
        // Track actual termination via exit event (process.killed only indicates signal was sent)
        let exited = false;
        const onExit = () => { exited = true; };
        process.once('exit', onExit);

        if (treeKillFirst) {
          this.logger.info(`[AdapterManager] Killing adapter process tree via taskkill /T /F for PID: ${process.pid}`);
          try {
            this.processSpawner.spawn('taskkill', ['/PID', String(process.pid), '/T', '/F'], {
              stdio: 'ignore',
              windowsHide: true
            });
          } catch (tkErr) {
            this.logger.error('[AdapterManager] taskkill tree-kill failed to spawn:', tkErr as Error);
          }
        } else {
          this.logger.info(`[AdapterManager] Sending SIGTERM to adapter process PID: ${process.pid}`);
          process.kill('SIGTERM');
        }

        // Wait a short period for graceful exit
        await new Promise(resolve => setTimeout(resolve, 300));

        if (!exited) {
          this.logger.warn(`[AdapterManager] Adapter process PID: ${process.pid} did not exit after ${treeKillFirst ? 'taskkill' : 'SIGTERM'}. Sending SIGKILL.`);
          try {
            process.kill('SIGKILL');
          } catch {
            // ignore SIGKILL errors
          }
        } else {
          this.logger.info(`[AdapterManager] Adapter process PID: ${process.pid} exited after ${treeKillFirst ? 'taskkill' : 'SIGTERM'}.`);
        }
      } else {
        this.logger.info(`[AdapterManager] Adapter process PID: ${process.pid} was already marked as killed.`);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(`[AdapterManager] Error during adapter process termination (PID: ${process.pid}): ${message}`, e);
    }
  }
}


/**
 * Generic adapter process management for DAP proxy
 * Language-agnostic version that can spawn any debug adapter
 */

import { ChildProcess } from 'child_process';
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
  host: string;
  port: number;
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
    private fileSystem: IFileSystem
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
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'] as ('ignore' | 'pipe' | 'inherit' | 'ipc' | number)[],
      env: env || process.env,
      detached: true,
      windowsHide: true
    };

    // Only set cwd if explicitly provided
    if (cwd) {
      spawnOptions.cwd = cwd;
    }

    // Log critical environment variables for debugging
    const criticalEnvVars = {
      NODE_OPTIONS: spawnOptions.env?.NODE_OPTIONS || '<not set>',
      NODE_DEBUG: spawnOptions.env?.NODE_DEBUG || '<not set>',
      NODE_ENV: spawnOptions.env?.NODE_ENV || '<not set>',
      DEBUG: spawnOptions.env?.DEBUG || '<not set>',
      VSCODE_INSPECTOR_OPTIONS: spawnOptions.env?.VSCODE_INSPECTOR_OPTIONS || '<not set>',
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

    // Spawned adapter process; hide console on Windows and keep attached for lifecycle management
    this.logger.info(`[AdapterManager] Spawned adapter process PID: ${adapterProcess.pid} (windowsHide=${!!spawnOptions.windowsHide}, detached=${!!spawnOptions.detached})`);

    // Set up error handlers
    this.setupProcessHandlers(adapterProcess);

    return {
      process: adapterProcess,
      pid: adapterProcess.pid
    };
  }

  /**
   * Set up process event handlers
   */
  private setupProcessHandlers(process: ChildProcess): void {
    process.on('error', (err: Error) => {
      this.logger.error('[AdapterManager] Adapter process spawn error:', err);
    });

    process.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
      this.logger.info(`[AdapterManager] Adapter process exited. Code: ${code}, Signal: ${signal}`);
    });
  }

  /**
   * Gracefully shutdown an adapter process
   */
  async shutdown(process: ChildProcess | null): Promise<void> {
    if (!process || !process.pid) {
      this.logger.info('[AdapterManager] No active adapter process to terminate.');
      return;
    }

    this.logger.info(`[AdapterManager] Attempting to terminate adapter process PID: ${process.pid}`);

    try {
      if (!process.killed) {
        this.logger.info(`[AdapterManager] Sending SIGTERM to adapter process PID: ${process.pid}`);
        process.kill('SIGTERM');

        // Wait a short period for graceful exit
        await new Promise(resolve => setTimeout(resolve, 300));

        if (!process.killed) {
          this.logger.warn(`[AdapterManager] Adapter process PID: ${process.pid} did not exit after SIGTERM. Sending SIGKILL.`);
          try {
            process.kill('SIGKILL');
          } catch {
            // ignore SIGKILL errors
          }

          // Windows-specific fallback: force kill entire process tree
          if (globalThis.process.platform === 'win32' && process.pid) {
            try {
              this.logger.warn(`[AdapterManager] Forcing termination via taskkill /T /F for PID: ${process.pid}`);
              this.processSpawner.spawn('taskkill', ['/PID', String(process.pid), '/T', '/F'], {
                stdio: 'ignore',
                windowsHide: true
              });
            } catch (tkErr) {
              this.logger.error('[AdapterManager] taskkill fallback failed:', tkErr as Error);
            }
          }
        } else {
          this.logger.info(`[AdapterManager] Adapter process PID: ${process.pid} exited after SIGTERM.`);
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


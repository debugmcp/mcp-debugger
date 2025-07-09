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
    
    // Determine working directory
    const preferredCwd = cwd || process.env.MCP_SERVER_CWD || process.cwd();
    
    // Spawn options
    const spawnOptions = {
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'] as ('ignore' | 'pipe' | 'inherit' | 'ipc' | number)[],
      cwd: preferredCwd,
      env: env || process.env,
      detached: true
    };

    this.logger.info('[AdapterManager] Spawn configuration:', {
      command: command,
      args: args,
      cwd: spawnOptions.cwd,
      envVars: Object.keys(spawnOptions.env || {}).length
    });

    // Spawn the process
    const adapterProcess = this.processSpawner.spawn(command, args, spawnOptions);

    if (!adapterProcess || !adapterProcess.pid) {
      throw new Error('Failed to spawn adapter process or get PID');
    }

    // Detach the process
    adapterProcess.unref();
    this.logger.info(`[AdapterManager] Called unref() on adapter process PID: ${adapterProcess.pid}`);

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
          process.kill('SIGKILL');
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

/**
 * Python-specific adapter manager for backward compatibility
 */
export class DebugpyAdapterManager extends GenericAdapterManager {
  /**
   * Build the command and arguments for spawning debugpy adapter
   */
  buildSpawnCommand(pythonPath: string, host: string, port: number, logDir: string): {
    command: string;
    args: string[];
  } {
    const args = [
      '-m', 'debugpy.adapter',
      '--host', host,
      '--port', String(port),
      '--log-dir', logDir
    ];

    return {
      command: pythonPath,
      args
    };
  }

  /**
   * Spawn the debugpy adapter process (backward compatibility)
   */
  async spawnDebugpy(config: {
    pythonPath: string;
    host: string;
    port: number;
    logDir: string;
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  }): Promise<AdapterSpawnResult> {
    const { command, args } = this.buildSpawnCommand(
      config.pythonPath,
      config.host,
      config.port,
      config.logDir
    );

    return this.spawn({
      command,
      args,
      host: config.host,
      port: config.port,
      logDir: config.logDir,
      cwd: config.cwd,
      env: config.env
    });
  }
}

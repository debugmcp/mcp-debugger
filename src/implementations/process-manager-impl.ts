/**
 * Concrete implementation of IProcessManager using Node.js child_process
 */
import { spawn, SpawnOptions, exec } from 'child_process';
import { promisify } from 'util';
import { IProcessManager, IChildProcess } from '../interfaces/external-dependencies.js';

const execAsync = promisify(exec);

export class ProcessManagerImpl implements IProcessManager {
  spawn(command: string, args: string[] = [], options?: SpawnOptions): IChildProcess {
    // Directly return the Node.js ChildProcess as it implements our IChildProcess interface
    return spawn(command, args, options || {}) as unknown as IChildProcess;
  }

  async exec(command: string): Promise<{ stdout: string; stderr: string }> {
    return execAsync(command);
  }
}

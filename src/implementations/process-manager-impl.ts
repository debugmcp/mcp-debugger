/**
 * Concrete implementation of IProcessManager using Node.js child_process
 */
import { spawn, SpawnOptions, exec } from 'child_process';
import { promisify } from 'util';
import { IProcessManager, IChildProcess } from '@debugmcp/shared';

const execAsync = promisify(exec);

export class ProcessManagerImpl implements IProcessManager {
  spawn(command: string, args: string[] = [], options?: SpawnOptions): IChildProcess {
    // Cast Node.js ChildProcess to our IChildProcess interface (structurally compatible)
    return spawn(command, args, options || {}) as unknown as IChildProcess;
  }

  async exec(command: string): Promise<{ stdout: string; stderr: string }> {
    const promisifiedResult = await execAsync(command);

    // promisify(exec) resolves to { stdout: string, stderr: string }
    if (typeof promisifiedResult === 'object' && promisifiedResult !== null && 'stdout' in promisifiedResult && 'stderr' in promisifiedResult) {
      return promisifiedResult as { stdout: string; stderr: string };
    }

    // Fallback - this shouldn't be reached with Node.js promisify(exec)
    throw new Error(`[ProcessManagerImpl] execAsync resolved to unexpected type: ${typeof promisifiedResult}`);
  }
}

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

    // Case 1: Original child_process.exec with promisify.custom
    // It resolves to an object { stdout: string, stderr: string }
    if (typeof promisifiedResult === 'object' && promisifiedResult !== null && 'stdout' in promisifiedResult && 'stderr' in promisifiedResult) {
      return promisifiedResult as { stdout: string; stderr: string };
    }

    // Case 2: promisify returned an array [stdout, stderr]
    if (Array.isArray(promisifiedResult)) {
      return { stdout: promisifiedResult[0] as string, stderr: promisifiedResult[1] as string };
    }

    // Case 3: promisify returned only stdout as a string
    if (typeof promisifiedResult === 'string') {
      return { stdout: promisifiedResult, stderr: '' }; // Default stderr if only stdout is provided
    }
    
    // Fallback - this shouldn't be reached if the above cover known scenarios
    throw new Error(`[ProcessManagerImpl] execAsync resolved to unexpected type: ${typeof promisifiedResult}`);
  }
}

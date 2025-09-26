/**
 * Concrete implementation of IProcessManager using Node.js child_process
 */
import { SpawnOptions } from 'child_process';
import { IProcessManager, IChildProcess } from '@debugmcp/shared';
export declare class ProcessManagerImpl implements IProcessManager {
    spawn(command: string, args?: string[], options?: SpawnOptions): IChildProcess;
    exec(command: string): Promise<{
        stdout: string;
        stderr: string;
    }>;
}

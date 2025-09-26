/**
 * Concrete implementation of IProcessManager using Node.js child_process
 */
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
export class ProcessManagerImpl {
    spawn(command, args = [], options) {
        // Directly return the Node.js ChildProcess as it implements our IChildProcess interface
        return spawn(command, args, options || {});
    }
    async exec(command) {
        const promisifiedResult = await execAsync(command);
        // Case 1: Original child_process.exec with promisify.custom
        // It resolves to an object { stdout: string, stderr: string }
        if (typeof promisifiedResult === 'object' && promisifiedResult !== null && 'stdout' in promisifiedResult && 'stderr' in promisifiedResult) {
            return promisifiedResult;
        }
        // Case 2: Mocked exec (vi.fn) where promisify might return an array [stdout, stderr]
        if (Array.isArray(promisifiedResult)) {
            return { stdout: promisifiedResult[0], stderr: promisifiedResult[1] };
        }
        // Case 3: Mocked exec (vi.fn) where promisify might return only stdout string
        if (typeof promisifiedResult === 'string') {
            return { stdout: promisifiedResult, stderr: '' }; // Default stderr if only stdout is provided
        }
        // Fallback or error - this shouldn't be reached if the above cover known scenarios
        // but as a safeguard, return a default or throw.
        // For now, to satisfy the type, let's assume it could be an object if all else fails.
        // This path indicates an unexpected resolution from execAsync.
        console.warn('[ProcessManagerImpl] execAsync resolved to unexpected type:', promisifiedResult);
        return promisifiedResult; // Last resort cast
    }
}
//# sourceMappingURL=process-manager-impl.js.map
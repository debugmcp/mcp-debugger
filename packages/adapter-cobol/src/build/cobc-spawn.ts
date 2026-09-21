import crossSpawn from 'cross-spawn';
import type { ChildProcess, SpawnOptions } from 'node:child_process';

/**
 * Shared by compiler discovery and builds. cross-spawn quotes cmd.exe arguments
 * for Windows batch wrappers; native executables and POSIX commands use spawn
 * directly. Keep shell mode disabled so its argument escaping remains active.
 */
export function spawnCobc(command: string, args: string[], options: SpawnOptions): ChildProcess {
  return crossSpawn(command, args, { ...options, shell: false });
}

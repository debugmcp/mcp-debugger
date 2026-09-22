import type { ChildProcess, SpawnOptions } from 'node:child_process';

export interface TreeTerminationOptions {
  platform?: NodeJS.Platform;
  kill?: (pid: number, signal: NodeJS.Signals) => unknown;
  runFile?: (command: string, args: string[], options: {
    windowsHide: boolean; timeout: number; killSignal: NodeJS.Signals;
  }) => Promise<unknown>;
  graceMs?: number;
}

/** Terminate a dedicated POSIX build process group or a Windows build tree. */
export function terminateBuildTree(pid: number | undefined, options?: TreeTerminationOptions): Promise<void>;

export interface BuildOptions {
  command: string;
  cwd: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs: number;
  maxBufferBytes?: number;
  signal?: AbortSignal;
  platform?: NodeJS.Platform;
  spawnProcess?: (command: string, options: SpawnOptions) => ChildProcess;
  terminateTree?: typeof terminateBuildTree;
}

/** Resolves with sanitized stdout, or rejects with a sanitized build failure. */
export function runBuild(options: BuildOptions): Promise<string>;

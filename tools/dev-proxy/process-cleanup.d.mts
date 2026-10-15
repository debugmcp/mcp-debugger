import type { CommandRunner } from './command-runner.mjs';

export interface ProcessCleanupOptions {
  platform?: NodeJS.Platform;
  runFile?: CommandRunner;
  kill?: (pid: number, signal: 0 | NodeJS.Signals) => unknown;
  stillOwned?: () => boolean;
  wait?: (milliseconds: number) => Promise<unknown>;
}
export function forceKillPid(pid: number | null | undefined, options?: ProcessCleanupOptions): Promise<void>;
export function windowsListenerPid(output: string, port: number): number | null;
export function ensurePortFree(options: {
  port: number;
  platform?: NodeJS.Platform;
  runFile?: CommandRunner;
  forceKill?: (pid: number) => Promise<void>;
  log?: (message: string) => void;
  wait?: (milliseconds: number) => Promise<unknown>;
}): Promise<void>;

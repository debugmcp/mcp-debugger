import type { ExecFileOptions } from 'node:child_process';

export const COMMAND_TIMEOUT_MS: number;

export type CommandOptions = Omit<ExecFileOptions, 'encoding'> & { encoding?: BufferEncoding };
export interface CommandResult { stdout: string; stderr: string }
export type CommandRunner = (
  command: string, args: string[], options?: CommandOptions
) => Promise<CommandResult>;

/** Execute without a shell; UTF-8 output, hidden Windows console, five-second default. */
export const runCommand: CommandRunner;

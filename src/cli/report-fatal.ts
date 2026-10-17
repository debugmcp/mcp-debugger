import type { ProcessLike } from '../interfaces/process-interfaces.js';

/**
 * The console is silenced for every transport (src/cli/entry-prologue.ts sets
 * CONSOLE_OUTPUT_SILENCED before anything else loads), so a fatal line that only
 * reaches the logger leaves the operator with a bare exit code; write it to
 * stderr as well. `detail` is appended on stderr only, so callers keep their
 * existing logger call shapes.
 */
export function reportFatal(proc: ProcessLike, message: string, detail?: string): void {
  proc.stderr?.write(`mcp-debugger: ${message}${detail ? `: ${detail}` : ''}` + '\n');
}

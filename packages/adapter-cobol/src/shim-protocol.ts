/**
 * The contract between CobolDebugAdapter (server process) and the COBOL DAP
 * shim (adapter process): the shim's argv, and the private block the adapter
 * tucks into the CodeLLDB launch/attach config for the shim to strip.
 *
 * Kept outside `src/shim/` so the adapter can import it without pulling the
 * shim's runtime, and the shim can import it without pulling the adapter.
 */

/** Key of the private block inside the launch/attach arguments; never reaches CodeLLDB. */
export const COBOL_PRIVATE_KEY = '__cobol';

export interface CobolShimSessionOptions {
  /** Directories holding `*.cobol-symbols.json` manifests for this session's programs. */
  manifestDirs: string[];
  /** Also list the engine's own scopes (Local/Static/Global/Registers) after the COBOL ones. */
  engineScopes?: boolean;
  /** File whose contents feed the debuggee's stdin (`ACCEPT … FROM SYSIN`). */
  stdinFile?: string;
  /** Reference-namespace collision policy; tests use 'strict'. */
  refCheck?: 'strict' | 'warn';
  /** Primary source/module identity for a launch's COBOL entry stop. */
  entrySource?: string;
  entryProgram?: string;
}

export interface CobolShimArgv {
  listenPort: number;
  manifestDirs: string[];
  logFile?: string;
  stdinFile?: string;
  engineScopes?: boolean;
  refCheck?: 'strict' | 'warn';
  /** CodeLLDB executable followed by its extra args (e.g. `--liblldb <path>`); the shim appends `--port`. */
  engineCommand: string[];
}

export const SHIM_ENTRY_BASENAME = 'cobol-shim.js';

/** Build the shim's argv (everything after the script path). */
export function buildShimArgs(options: CobolShimArgv): string[] {
  const args: string[] = ['--port', String(options.listenPort)];
  for (const dir of options.manifestDirs) {
    args.push('--manifest-dir', dir);
  }
  if (options.logFile) {
    args.push('--log', options.logFile);
  }
  if (options.stdinFile) {
    args.push('--stdin-file', options.stdinFile);
  }
  if (options.engineScopes) {
    args.push('--engine-scopes');
  }
  if (options.refCheck) {
    args.push('--ref-check', options.refCheck);
  }
  args.push('--', ...options.engineCommand);
  return args;
}

/** Parse the shim's argv back (used by the shim entry and by tests of the round trip). */
export function parseShimArgs(argv: string[]): CobolShimArgv {
  const result: CobolShimArgv = { listenPort: 0, manifestDirs: [], engineCommand: [] };
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === '--') {
      result.engineCommand = argv.slice(i + 1);
      break;
    }
    const next = argv[i + 1];
    switch (arg) {
      case '--port':
        result.listenPort = Number(next);
        i += 2;
        break;
      case '--manifest-dir':
        if (next !== undefined) {
          result.manifestDirs.push(next);
        }
        i += 2;
        break;
      case '--log':
        result.logFile = next;
        i += 2;
        break;
      case '--stdin-file':
        result.stdinFile = next;
        i += 2;
        break;
      case '--engine-scopes':
        result.engineScopes = true;
        i += 1;
        break;
      case '--ref-check':
        result.refCheck = next === 'strict' ? 'strict' : 'warn';
        i += 2;
        break;
      default:
        throw new Error(`cobol-shim: unknown argument ${arg}`);
    }
  }
  if (!Number.isInteger(result.listenPort) || result.listenPort <= 0) {
    throw new Error('cobol-shim: --port <n> is required');
  }
  if (result.engineCommand.length === 0) {
    throw new Error('cobol-shim: the CodeLLDB command must follow "--"');
  }
  return result;
}

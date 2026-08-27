import { spawn } from 'child_process';
import fs from 'node:fs';
import path from 'node:path';
import which from 'which';

interface Logger {
  debug?(message: string): void;
  error?(message: string): void;
}

const noopLogger: Logger = {};

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const mode = process.platform === 'win32' ? fs.constants.F_OK : fs.constants.X_OK;
    await fs.promises.access(filePath, mode);
    return true;
  } catch {
    return false;
  }
}

async function resolveCandidate(command: string): Promise<string | null> {
  try {
    return await which(command);
  } catch {
    return null;
  }
}

async function findExecutable(
  preferredPath: string | undefined,
  envVar: string | undefined,
  candidates: string[],
  searchPaths: string[],
  label: string,
  logger: Logger = noopLogger
): Promise<string> {
  const tried: string[] = [];

  const directCandidates = [preferredPath, envVar].filter(
    (candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0
  );

  for (const candidate of directCandidates) {
    const resolved = await resolveCandidate(candidate);
    if (resolved) {
      logger.debug?.(`[RubyUtils] Using ${label} from explicit path: ${resolved}`);
      return resolved;
    }
    if (await fileExists(candidate)) {
      logger.debug?.(`[RubyUtils] Using ${label} from explicit file path: ${candidate}`);
      return candidate;
    }
    tried.push(candidate);
  }

  for (const candidate of candidates) {
    const resolved = await resolveCandidate(candidate);
    if (resolved) {
      logger.debug?.(`[RubyUtils] Found ${label} on PATH: ${resolved}`);
      return resolved;
    }
    tried.push(candidate);
  }

  for (const searchPath of searchPaths) {
    for (const candidate of candidates) {
      const fullPath = path.join(searchPath, candidate);
      if (await fileExists(fullPath)) {
        logger.debug?.(`[RubyUtils] Found ${label} in common path: ${fullPath}`);
        return fullPath;
      }
      tried.push(fullPath);
    }
  }

  throw new Error(`${label} not found. Tried: ${tried.join(', ')}`);
}

export function getRubySearchPaths(platform: NodeJS.Platform = process.platform): string[] {
  const paths: string[] = [];
  const home = process.env.HOME || process.env.USERPROFILE || '';

  if (platform === 'win32') {
    paths.push(
      'C:\\Ruby31-x64\\bin',
      'C:\\Ruby32-x64\\bin',
      'C:\\Ruby33-x64\\bin',
      'C:\\Ruby34-x64\\bin',
      path.join(home, 'scoop', 'apps', 'ruby', 'current', 'bin')
    );
  } else if (platform === 'darwin') {
    paths.push(
      '/usr/local/bin',
      '/opt/homebrew/bin',
      path.join(home, '.rubies', 'default', 'bin')
    );
  } else {
    paths.push(
      '/usr/bin',
      '/usr/local/bin',
      path.join(home, '.rubies', 'default', 'bin')
    );
  }

  if (process.env.PATH) {
    paths.push(...process.env.PATH.split(path.delimiter));
  }

  return Array.from(new Set(paths.filter(Boolean)));
}

export function getRdbgSearchPaths(platform: NodeJS.Platform = process.platform): string[] {
  const paths: string[] = [];
  const home = process.env.HOME || process.env.USERPROFILE || '';

  if (platform === 'win32') {
    paths.push(
      // RubyInstaller ships rdbg (bundled debug gem) alongside ruby.exe
      'C:\\Ruby31-x64\\bin',
      'C:\\Ruby32-x64\\bin',
      'C:\\Ruby33-x64\\bin',
      'C:\\Ruby34-x64\\bin',
      path.join(home, 'scoop', 'apps', 'ruby', 'current', 'bin'),
      path.join(home, '.local', 'share', 'gem', 'ruby', 'bin')
    );
  } else {
    paths.push(
      '/usr/local/bin',
      '/usr/bin',
      path.join(home, '.gem', 'bin'),
      path.join(home, '.local', 'share', 'gem', 'ruby', 'bin')
    );
  }

  if (process.env.PATH) {
    paths.push(...process.env.PATH.split(path.delimiter));
  }

  return Array.from(new Set(paths.filter(Boolean)));
}

export async function findRubyExecutable(
  preferredPath?: string,
  logger: Logger = noopLogger,
  platform: NodeJS.Platform = process.platform
): Promise<string> {
  const envRuby = process.env.RUBY_PATH || process.env.RUBY_EXECUTABLE;
  const candidates = platform === 'win32' ? ['ruby.exe', 'ruby'] : ['ruby'];
  return findExecutable(preferredPath, envRuby, candidates, getRubySearchPaths(platform), 'Ruby', logger);
}

export async function findRdbgExecutable(
  preferredPath?: string,
  logger: Logger = noopLogger,
  platform: NodeJS.Platform = process.platform
): Promise<string> {
  const envRdbg = process.env.RDBG_PATH;
  const candidates = platform === 'win32' ? ['rdbg.bat', 'rdbg.cmd', 'rdbg.exe', 'rdbg'] : ['rdbg'];
  return findExecutable(preferredPath, envRdbg, candidates, getRdbgSearchPaths(platform), 'rdbg', logger);
}

export interface RdbgInvocation {
  command: string;
  args: string[];
}

/**
 * Build a spawnable rdbg invocation. On Windows, gem executables are either
 * .bat/.cmd shims or extensionless Ruby scripts, neither of which Node's
 * spawn() can run directly without a shell (EINVAL/ENOENT since the
 * CVE-2024-27980 hardening). Run the extensionless script through Ruby,
 * resolving it beside a shim when needed. No shell fallback: routing through
 * cmd.exe would re-parse arguments and is never needed in practice.
 */
export function buildRdbgInvocation(
  rdbgPath: string,
  args: string[],
  rubyPath?: string,
  platform: NodeJS.Platform = process.platform
): RdbgInvocation {
  if (platform !== 'win32') {
    return { command: rdbgPath, args };
  }

  if (/\.(bat|cmd)$/i.test(rdbgPath)) {
    const scriptPath = rdbgPath.replace(/\.(bat|cmd)$/i, '');
    if (path.isAbsolute(scriptPath) && fs.existsSync(scriptPath)) {
      return { command: rubyPath || 'ruby', args: [scriptPath, ...args] };
    }
    throw new Error(
      `Cannot run rdbg shim '${rdbgPath}' directly (Windows .bat/.cmd files cannot be spawned). ` +
      `No sibling rdbg script found next to it. Set RDBG_PATH to the rdbg Ruby script ` +
      `(the extensionless file the gem installs alongside the shim).`
    );
  }

  if (path.extname(rdbgPath) === '' && path.isAbsolute(rdbgPath) && fs.existsSync(rdbgPath)) {
    return { command: rubyPath || 'ruby', args: [rdbgPath, ...args] };
  }

  return { command: rdbgPath, args };
}

/**
 * Prelude injected into the debuggee via `ruby -r` (issue #317). Ruby
 * block-buffers $stdout on pipes, and rdbg -c hands the debuggee the adapter
 * process's piped stdio — without sync mode, puts output only reaches the
 * proxy's stdio scraper when the process exits.
 */
export const RUBY_SYNC_HELPER_CONTENT = '$stdout.sync = true\n$stderr.sync = true\n';
export const RUBY_SYNC_HELPER_FILENAME = 'mcp_stdout_sync.rb';

/**
 * Materialize the stdout-sync prelude in `dir` (the session log dir — a path
 * the server owns; never a shared world-writable location, since this file is
 * `require`d into the debuggee). Idempotent: rewrites only on content
 * mismatch. Returns null on any failure so the launch degrades to exit-only
 * output flushing instead of failing.
 */
export function ensureRubySyncHelper(dir: string, logger: Logger = noopLogger): string | null {
  const helperPath = path.join(dir, RUBY_SYNC_HELPER_FILENAME);
  try {
    fs.mkdirSync(dir, { recursive: true });
    let existing: string | null = null;
    try {
      existing = fs.readFileSync(helperPath, 'utf8');
    } catch {
      // Not there yet.
    }
    if (existing !== RUBY_SYNC_HELPER_CONTENT) {
      fs.writeFileSync(helperPath, RUBY_SYNC_HELPER_CONTENT, 'utf8');
    }
    return helperPath;
  } catch (error) {
    logger.error?.(
      `[ruby-utils] Cannot materialize stdout-sync helper at ${helperPath}: ` +
      `${error instanceof Error ? error.message : String(error)}. ` +
      `Debuggee stdout will only flush at process exit.`
    );
    return null;
  }
}

export async function getRubyVersion(rubyPath: string): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn(rubyPath, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let output = '';

    child.stdout?.on('data', (data) => { output += data.toString(); });
    child.stderr?.on('data', (data) => { output += data.toString(); });

    child.on('error', () => resolve(null));
    // 'close' (not 'exit') so stdio is fully drained before we read `output`
    child.on('close', (code) => {
      if (code !== 0 || output.length === 0) {
        resolve(null);
        return;
      }

      const match = output.match(/ruby\s+(\d+\.\d+\.\d+)/i);
      resolve(match ? match[1] : output.trim());
    });
  });
}

export async function getRdbgVersion(rdbgPath: string): Promise<string | null> {
  let invocation: RdbgInvocation;
  try {
    invocation = buildRdbgInvocation(rdbgPath, ['--version']);
  } catch {
    // Unspawnable shim with no sibling script — version probe simply fails.
    return null;
  }
  return new Promise((resolve) => {
    const child = spawn(invocation.command, invocation.args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let output = '';

    child.stdout?.on('data', (data) => { output += data.toString(); });
    child.stderr?.on('data', (data) => { output += data.toString(); });

    child.on('error', () => resolve(null));
    // 'close' (not 'exit') so stdio is fully drained before we read `output`
    child.on('close', (code) => {
      if (code !== 0 || output.length === 0) {
        resolve(null);
        return;
      }

      const match = output.match(/(?:rdbg|debug)\s+(\d+\.\d+\.\d+)/i);
      resolve(match ? match[1] : output.trim());
    });
  });
}

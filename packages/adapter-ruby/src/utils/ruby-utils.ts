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

export function getRubySearchPaths(): string[] {
  const paths: string[] = [];
  const home = process.env.HOME || process.env.USERPROFILE || '';

  if (process.platform === 'win32') {
    paths.push(
      'C:\\Ruby31-x64\\bin',
      'C:\\Ruby32-x64\\bin',
      'C:\\Ruby33-x64\\bin',
      'C:\\Ruby34-x64\\bin',
      path.join(home, 'scoop', 'apps', 'ruby', 'current', 'bin')
    );
  } else if (process.platform === 'darwin') {
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

export function getRdbgSearchPaths(): string[] {
  const paths: string[] = [];
  const home = process.env.HOME || process.env.USERPROFILE || '';

  if (process.platform === 'win32') {
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
  logger: Logger = noopLogger
): Promise<string> {
  const envRuby = process.env.RUBY_PATH || process.env.RUBY_EXECUTABLE;
  const candidates = process.platform === 'win32' ? ['ruby.exe', 'ruby'] : ['ruby'];
  return findExecutable(preferredPath, envRuby, candidates, getRubySearchPaths(), 'Ruby', logger);
}

export async function findRdbgExecutable(
  preferredPath?: string,
  logger: Logger = noopLogger
): Promise<string> {
  const envRdbg = process.env.RDBG_PATH;
  const candidates = process.platform === 'win32' ? ['rdbg.bat', 'rdbg.cmd', 'rdbg.exe', 'rdbg'] : ['rdbg'];
  return findExecutable(preferredPath, envRdbg, candidates, getRdbgSearchPaths(), 'rdbg', logger);
}

export interface RdbgInvocation {
  command: string;
  args: string[];
}

/**
 * Build a spawnable rdbg invocation. On Windows, gem executables are .bat/.cmd
 * shims, which Node's spawn() rejects without a shell (EINVAL since the
 * CVE-2024-27980 hardening). Instead of spawning the shim, run the sibling
 * extensionless Ruby script directly with the Ruby interpreter; if no sibling
 * script exists, fall back to cmd.exe.
 */
export function buildRdbgInvocation(
  rdbgPath: string,
  args: string[],
  rubyPath?: string
): RdbgInvocation {
  if (process.platform === 'win32' && /\.(bat|cmd)$/i.test(rdbgPath)) {
    const scriptPath = rdbgPath.replace(/\.(bat|cmd)$/i, '');
    if (path.isAbsolute(scriptPath) && fs.existsSync(scriptPath)) {
      return { command: rubyPath || 'ruby', args: [scriptPath, ...args] };
    }
    return {
      command: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', rdbgPath, ...args]
    };
  }

  return { command: rdbgPath, args };
}

export async function getRubyVersion(rubyPath: string): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn(rubyPath, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';

    child.stdout?.on('data', (data) => { output += data.toString(); });
    child.stderr?.on('data', (data) => { output += data.toString(); });

    child.on('error', () => resolve(null));
    child.on('exit', (code) => {
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
  const invocation = buildRdbgInvocation(rdbgPath, ['--version']);
  return new Promise((resolve) => {
    const child = spawn(invocation.command, invocation.args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';

    child.stdout?.on('data', (data) => { output += data.toString(); });
    child.stderr?.on('data', (data) => { output += data.toString(); });

    child.on('error', () => resolve(null));
    child.on('exit', (code) => {
      if (code !== 0 || output.length === 0) {
        resolve(null);
        return;
      }

      const match = output.match(/(?:rdbg|debug)\s+(\d+\.\d+\.\d+)/i);
      resolve(match ? match[1] : output.trim());
    });
  });
}

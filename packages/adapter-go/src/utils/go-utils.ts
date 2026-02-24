/**
 * Go/Delve utility functions for executable discovery and version checking
 * 
 * @since 0.1.0
 */
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

interface Logger {
  debug?(message: string): void;
  info?(message: string): void;
  error?(message: string): void;
}

/**
 * Find the Go executable
 */
export async function findGoExecutable(
  preferredPath?: string,
  logger?: Logger
): Promise<string> {
  // If preferred path is specified and exists, use it
  if (preferredPath) {
    if (await fileExists(preferredPath)) {
      logger?.debug?.(`[GoUtils] Using preferred Go path: ${preferredPath}`);
      return preferredPath;
    }
    logger?.debug?.(`[GoUtils] Preferred path not found: ${preferredPath}`);
  }

  // Try common Go executable names
  const candidates = process.platform === 'win32'
    ? ['go.exe']
    : ['go'];

  for (const candidate of candidates) {
    const found = await findInPath(candidate);
    if (found) {
      logger?.debug?.(`[GoUtils] Found Go at: ${found}`);
      return found;
    }
  }

  // Try common installation paths
  const searchPaths = getGoSearchPaths();
  for (const searchPath of searchPaths) {
    const executable = process.platform === 'win32' ? 'go.exe' : 'go';
    const fullPath = path.join(searchPath, executable);
    if (await fileExists(fullPath)) {
      logger?.debug?.(`[GoUtils] Found Go at: ${fullPath}`);
      return fullPath;
    }
  }

  throw new Error('Go executable not found. Please install Go from https://go.dev/dl/');
}

/**
 * Find the Delve (dlv) debugger executable
 */
export async function findDelveExecutable(
  preferredPath?: string,
  logger?: Logger
): Promise<string> {
  // If preferred path is specified and exists, use it
  if (preferredPath) {
    if (await fileExists(preferredPath)) {
      logger?.debug?.(`[GoUtils] Using preferred Delve path: ${preferredPath}`);
      return preferredPath;
    }
    logger?.debug?.(`[GoUtils] Preferred Delve path not found: ${preferredPath}`);
  }

  // Try common Delve executable names
  const candidates = process.platform === 'win32'
    ? ['dlv.exe', 'dlv-dap.exe']
    : ['dlv', 'dlv-dap'];

  for (const candidate of candidates) {
    const found = await findInPath(candidate);
    if (found) {
      logger?.debug?.(`[GoUtils] Found Delve at: ${found}`);
      return found;
    }
  }

  // Try GOPATH/bin and GOBIN
  const gopathBin = await getGopathBin();
  if (gopathBin) {
    const executable = process.platform === 'win32' ? 'dlv.exe' : 'dlv';
    const fullPath = path.join(gopathBin, executable);
    if (await fileExists(fullPath)) {
      logger?.debug?.(`[GoUtils] Found Delve at: ${fullPath}`);
      return fullPath;
    }
  }

  throw new Error(
    'Delve (dlv) not found. Install it with: go install github.com/go-delve/delve/cmd/dlv@latest'
  );
}

/**
 * Get the Go version
 */
export async function getGoVersion(goPath: string): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn(goPath, ['version'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';
    child.stdout?.on('data', (data) => { output += data.toString(); });

    child.on('error', () => resolve(null));
    child.on('exit', (code) => {
      if (code === 0) {
        // Parse "go version go1.21.0 darwin/arm64"
        const match = output.match(/go(\d+\.\d+(\.\d+)?)/);
        resolve(match ? match[1] : null);
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Get the Delve version
 */
export async function getDelveVersion(dlvPath: string): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn(dlvPath, ['version'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';
    child.stdout?.on('data', (data) => { output += data.toString(); });

    child.on('error', () => resolve(null));
    child.on('exit', (code) => {
      if (code === 0) {
        // Parse "Delve Debugger\nVersion: 1.21.0"
        const match = output.match(/Version:\s*(\d+\.\d+\.\d+)/);
        resolve(match ? match[1] : null);
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Check if Delve supports DAP.
 * Returns an object with `supported` flag and optional `stderr` for diagnostics.
 */
export async function checkDelveDapSupport(dlvPath: string): Promise<{ supported: boolean; stderr?: string }> {
  return new Promise((resolve) => {
    const child = spawn(dlvPath, ['dap', '--help'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderrOutput = '';
    child.stderr?.on('data', (data) => { stderrOutput += data.toString(); });

    child.on('error', (err) => resolve({ supported: false, stderr: err.message }));
    child.on('exit', (code) => {
      // If dlv dap --help returns 0 or shows help, DAP is supported
      resolve({
        supported: code === 0,
        stderr: stderrOutput.trim() || undefined
      });
    });
  });
}

/**
 * Get common Go installation search paths
 */
export function getGoSearchPaths(): string[] {
  const paths: string[] = [];

  if (process.platform === 'win32') {
    paths.push(
      'C:\\Go\\bin',
      'C:\\Program Files\\Go\\bin',
      path.join(process.env.USERPROFILE || '', 'go', 'bin'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Go', 'bin')
    );
  } else if (process.platform === 'darwin') {
    paths.push(
      '/usr/local/go/bin',
      '/opt/homebrew/bin',
      '/opt/homebrew/opt/go/bin',
      path.join(process.env.HOME || '', 'go', 'bin'),
      path.join(process.env.HOME || '', '.local', 'bin')
    );
  } else {
    paths.push(
      '/usr/local/go/bin',
      '/usr/bin',
      path.join(process.env.HOME || '', 'go', 'bin'),
      path.join(process.env.HOME || '', '.local', 'bin')
    );
  }

  // Add GOBIN if set
  if (process.env.GOBIN) {
    paths.unshift(process.env.GOBIN);
  }

  return paths.filter(p => p.length > 0);
}

/**
 * Get GOPATH/bin directory
 */
async function getGopathBin(): Promise<string | null> {
  // Check GOBIN first
  if (process.env.GOBIN) {
    return process.env.GOBIN;
  }

  // Check GOPATH
  if (process.env.GOPATH) {
    return path.join(process.env.GOPATH, 'bin');
  }

  // Default GOPATH is ~/go
  const home = process.env.HOME || process.env.USERPROFILE;
  if (home) {
    return path.join(home, 'go', 'bin');
  }

  return null;
}

/**
 * Find executable in PATH
 */
async function findInPath(name: string): Promise<string | null> {
  const pathEnv = process.env.PATH || '';
  const pathSeparator = process.platform === 'win32' ? ';' : ':';
  const paths = pathEnv.split(pathSeparator);

  for (const dir of paths) {
    const fullPath = path.join(dir, name);
    if (await fileExists(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

/**
 * Check if file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

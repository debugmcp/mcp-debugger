/**
 * Python executable detection utilities using the 'which' library.
 */
import { spawn } from 'child_process';
import which from 'which';

// Simple logger interface (kept local to avoid external coupling)
interface Logger {
  error: (message: string) => void;
  debug?: (message: string) => void;
}

// Default no-op logger
const noopLogger: Logger = {
  error: () => {},
  debug: () => {}
};

// Local CommandFinder abstraction and which-based implementation

export class CommandNotFoundError extends Error {
  command: string;
  constructor(command: string) {
    super(command);
    this.name = 'CommandNotFoundError';
    this.command = command;
  }
}

export interface CommandFinder {
  find(cmd: string): Promise<string>;
}

class WhichCommandFinder implements CommandFinder {
  private cache = new Map<string, string>();
  constructor(private useCache = true) {}

  async find(cmd: string): Promise<string> {
    if (this.useCache && this.cache.has(cmd)) {
      return this.cache.get(cmd)!;
    }
    try {
      const resolved = await which(cmd);
      if (this.useCache) this.cache.set(cmd, resolved);
      return resolved;
    } catch {
      throw new CommandNotFoundError(cmd);
    }
  }
}

// Default command finder instance for production use
let defaultCommandFinder: CommandFinder = new WhichCommandFinder();

/**
 * Set the default command finder (useful for testing)
 * @param finder The CommandFinder to use as default
 */
export function setDefaultCommandFinder(finder: CommandFinder): void {
  defaultCommandFinder = finder;
}

/**
 * Validate that a Python command is a real Python executable, not a Windows Store alias
 */
async function isValidPythonExecutable(pythonCmd: string, logger: Logger = noopLogger): Promise<boolean> {
  logger.debug?.(`[Python Detection] Validating Python executable: ${pythonCmd}`);
  return new Promise((resolve) => {
    const child = spawn(pythonCmd, ['-c', 'import sys; sys.exit(0)'], {
      stdio: ['ignore', 'ignore', 'pipe']
    });

    let stderrData = '';
    child.stderr?.on('data', (data) => {
      stderrData += data.toString();
    });

    child.on('error', () => resolve(false));
    child.on('exit', (code) => {
      const storeAlias =
        code === 9009 ||
        stderrData.includes('Microsoft Store') ||
        stderrData.includes('Windows Store') ||
        stderrData.includes('AppData\\Local\\Microsoft\\WindowsApps');
      if (storeAlias) {
        logger.error(`[Python Detection] ${pythonCmd} appears to be a Windows Store alias, skipping...`);
        resolve(false);
      } else {
        resolve(code === 0);
      }
    });
  });
}

/**
 * Check if a Python executable has debugpy installed
 */
async function hasDebugpy(pythonPath: string, logger: Logger = noopLogger): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(pythonPath, ['-c', 'import debugpy; print(debugpy.__version__)'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let output = '';
    child.stdout?.on('data', (data) => { output += data.toString(); });
    
    child.on('error', () => resolve(false));
    child.on('exit', (code) => {
      const hasIt = code === 0 && output.trim().length > 0;
      if (hasIt) {
        logger.debug?.(`[Python Detection] debugpy version: ${output.trim()}`);
      }
      resolve(hasIt);
    });
  });
}

/**
 * Find a working Python executable
 * @param preferredPath Optional preferred Python path to check first
 * @param logger Optional logger instance for logging detection info
 * @param commandFinder Optional CommandFinder instance (defaults to WhichCommandFinder)
 */
export async function findPythonExecutable(
  preferredPath?: string,
  logger: Logger = noopLogger,
  commandFinder: CommandFinder = defaultCommandFinder
): Promise<string> {
  const isWindows = process.platform === 'win32';
  const triedPaths: string[] = [];
  const validPythonPaths: string[] = [];

  logger.debug?.(`[Python Detection] Starting discovery...`);

  // 1. User-specified path (if provided, prefer it regardless of debugpy)
  if (preferredPath) {
    try {
      const resolved = await commandFinder.find(preferredPath);
      triedPaths.push(`${preferredPath} → ${resolved}`);
      if (!isWindows || await isValidPythonExecutable(resolved, logger)) {
        logger.debug?.(`[Python Detection] Using user-specified Python: ${resolved}`);
        return resolved;
      }
    } catch (error) {
      if (error instanceof CommandNotFoundError) {
        triedPaths.push(`${preferredPath} → not found`);
      } else {
        throw error;
      }
    }
  }

  // 2. Environment variable (also prefer if set)
  const envPython = process.env.PYTHON_PATH || process.env.PYTHON_EXECUTABLE;
  if (envPython) {
    try {
      const resolved = await commandFinder.find(envPython);
      triedPaths.push(`${envPython} → ${resolved}`);
      if (!isWindows || await isValidPythonExecutable(resolved, logger)) {
        logger.debug?.(`[Python Detection] Using environment variable Python: ${resolved}`);
        return resolved;
      }
    } catch (error) {
      if (error instanceof CommandNotFoundError) {
        triedPaths.push(`${envPython} → not found`);
      } else {
        throw error;
      }
    }
  }

  // 3. Auto-detect - collect all valid Python executables
  const pythonCommands = isWindows
    ? ['py', 'python', 'python3']
    : ['python3', 'python'];

  for (const cmd of pythonCommands) {
    logger.debug?.(`[Python Detection] Trying command: ${cmd}`);
    try {
      const resolved = await commandFinder.find(cmd);
      triedPaths.push(`${cmd} → ${resolved}`);
      if (!isWindows || await isValidPythonExecutable(resolved, logger)) {
        // Don't return immediately, collect all valid ones
        validPythonPaths.push(resolved);
        logger.debug?.(`[Python Detection] Found valid Python: ${resolved}`);
      }
    } catch (error) {
      if (error instanceof CommandNotFoundError) {
        triedPaths.push(`${cmd} → not found`);
      } else {
        throw error;
      }
    }
  }

  // 4. Check each valid Python for debugpy and return the first one that has it
  logger.debug?.(`[Python Detection] Checking ${validPythonPaths.length} Python installations for debugpy...`);
  for (const pythonPath of validPythonPaths) {
    if (await hasDebugpy(pythonPath, logger)) {
      logger.debug?.(`[Python Detection] Found Python with debugpy installed: ${pythonPath}`);
      return pythonPath;
    } else {
      logger.debug?.(`[Python Detection] Python at ${pythonPath} does not have debugpy`);
    }
  }

  // 5. Fall back to first valid Python if none have debugpy
  if (validPythonPaths.length > 0) {
    logger.debug?.(`[Python Detection] No Python with debugpy found, using first valid: ${validPythonPaths[0]}`);
    logger.debug?.(`[Python Detection] Note: debugpy will need to be installed`);
    return validPythonPaths[0];
  }

  // No Python found at all
  const triedList = triedPaths.map(p => `  - ${p}`).join('\n');
  throw new Error(
    `Python not found.\nTried:\n${triedList}\n` +
    'Please install Python 3 or specify the Python path.'
  );
}

/**
 * Get Python version for a given executable
 */
export async function getPythonVersion(pythonPath: string): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn(pythonPath, ['--version'], { stdio: 'pipe' });
    let output = '';

    child.stdout?.on('data', (data) => { output += data.toString(); });
    child.stderr?.on('data', (data) => { output += data.toString(); });

    child.on('error', () => resolve(null));
    child.on('exit', (code) => {
      if (code === 0 && output) {
        const match = output.match(/Python (\d+\.\d+\.\d+)/);
        resolve(match ? match[1] : output.trim());
      } else {
        resolve(null);
      }
    });
  });
}

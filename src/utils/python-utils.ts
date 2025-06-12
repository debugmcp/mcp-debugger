/**
 * Python executable detection utilities
 */
import { spawn } from 'child_process';

// Define a simple logger interface
interface Logger {
  error: (message: string) => void;
}

// Default no-op logger
const noopLogger: Logger = {
  error: () => {}
};

/**
 * Check if a command exists and is executable
 */
async function commandExists(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const checkCommand = isWindows ? 'where' : 'which';
    
    const child = spawn(checkCommand, [command], { stdio: 'ignore' });
    child.on('error', () => resolve(false));
    child.on('exit', (code) => resolve(code === 0));
  });
}

/**
 * Validate that a Python command is a real Python executable, not a Windows Store alias
 * @param pythonCmd The Python command to validate
 * @param logger Optional logger instance
 * @returns true if it's a valid Python executable, false if it's a Store alias or invalid
 */
async function isValidPythonExecutable(pythonCmd: string, logger: Logger = noopLogger): Promise<boolean> {
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
      // Check for Windows Store alias indicators
      if (code === 9009 || 
          stderrData.includes('Microsoft Store') || 
          stderrData.includes('Windows Store') ||
          stderrData.includes('AppData\\Local\\Microsoft\\WindowsApps')) {
        logger.error(`[Python Detection] ${pythonCmd} appears to be a Windows Store alias, skipping...`);
        resolve(false);
      } else {
        resolve(code === 0);
      }
    });
  });
}

/**
 * Find a working Python executable
 * @param preferredPath Optional preferred Python path to check first
 * @param logger Optional logger instance for logging detection info
 * @returns The path to a working Python executable
 * @throws Error if no Python executable is found
 */
export async function findPythonExecutable(preferredPath?: string, logger: Logger = noopLogger): Promise<string> {
  const isWindows = process.platform === 'win32';
  
  // Priority order:
  // 1. User-specified pythonPath
  if (preferredPath && await commandExists(preferredPath)) {
    if (!isWindows || await isValidPythonExecutable(preferredPath, logger)) {
      logger.error(`[Python Detection] Using user-specified Python: ${preferredPath}`);
      return preferredPath;
    }
  }
  
  // 2. Environment variable
  const envPython = process.env.PYTHON_PATH || process.env.PYTHON_EXECUTABLE;
  if (envPython && await commandExists(envPython)) {
    if (!isWindows || await isValidPythonExecutable(envPython, logger)) {
      logger.error(`[Python Detection] Using environment variable Python: ${envPython}`);
      return envPython;
    }
  }
  
  // 3. Auto-detection with platform-specific priority
  let pythonCommands: string[];
  
  if (isWindows) {
    // On Windows, prioritize 'py' launcher which handles versions better
    pythonCommands = ['py', 'python3', 'python', 'python3.11', 'python3.10', 'python3.9'];
  } else {
    // On Unix-like systems, prefer python3 over python
    pythonCommands = ['python3', 'python', 'python3.11', 'python3.10', 'python3.9'];
  }
  
  for (const cmd of pythonCommands) {
    if (await commandExists(cmd)) {
      // On Windows, validate it's not a Store alias
      if (!isWindows || await isValidPythonExecutable(cmd, logger)) {
        logger.error(`[Python Detection] Found working Python: ${cmd}`);
        return cmd;
      }
    }
  }
  
  // If no Python found, provide helpful error message
  throw new Error(
    'Python not found. Please install Python 3 or specify the Python path.\n' +
    'You can specify the Python path by:\n' +
    '  - Setting the pythonPath parameter when creating a debug session\n' +
    '  - Setting the PYTHON_PATH or PYTHON_EXECUTABLE environment variable\n' +
    '  - Ensuring python3 or python is in your system PATH' +
    (isWindows ? '\n  - Installing Python from python.org (not Microsoft Store)' : '')
  );
}

/**
 * Get Python version for a given executable
 * @param pythonPath Path to Python executable
 * @returns Python version string or null if unable to determine
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
        // Extract version from output like "Python 3.11.5"
        const match = output.match(/Python (\d+\.\d+\.\d+)/);
        resolve(match ? match[1] : output.trim());
      } else {
        resolve(null);
      }
    });
  });
}

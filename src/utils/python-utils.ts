/**
 * Python and debugpy utilities
 * 
 * Python and debugpy utilities
 * 
 * Utilities for detecting Python installations and checking debugpy availability
 */
import { promisify } from 'node:util';
import { exec as execCbDefault, ExecException as CPExecException } from 'node:child_process';
import { createLogger } from './logger.js';

const execAsyncDefault = promisify(execCbDefault);
const logger = createLogger('debug-mcp:python-utils');

/**
 * Interface for a function that executes a shell command.
 * Matches the signature of a promisified child_process.exec.
 */
export interface RunCmd { // Already exported, good.
  (command: string): Promise<{ stdout: string; stderr: string }>;
  // Add overloads if options are needed, e.g.:
  // (command: string, options: import('node:child_process').ExecOptions): Promise<{ stdout: string; stderr: string }>;
}

/**
 * Result of Python and debugpy detection
 */
export interface PythonDetectionResult { // Already exported, good.
  /** Path to Python executable, or empty if not found */
  pythonPath: string;
  /** Python version if found, or empty string */
  pythonVersion: string;
  /** Whether debugpy is available */
  debugpyAvailable: boolean;
  /** Error message if any, or empty string */
  error: string;
}

/**
 * Detect Python installation and debugpy availability.
 * @param runCmd - Optional command runner function for testing.
 * @param pythonCmdOverride - Optional Python command to use, bypassing defaults and MCP_PYTHON_CMD.
 * @returns Detection result.
 */
export async function detectPythonAndDebugpy(
  runCmd: RunCmd = execAsyncDefault,
  pythonCmdOverride?: string
): Promise<PythonDetectionResult> {
  
  const pythonExecutable = 
    pythonCmdOverride || 
    process.env.MCP_PYTHON_CMD || 
    (process.platform === 'win32' ? 'python' : 'python3');
  
  let pythonPath = '';
  let pythonVersion = '';
  let error = '';
  let debugpyAvailable = false;

  try {
    logger.debug(`Attempting to find Python using command: ${pythonExecutable}`);
    const { stdout } = await runCmd(`${pythonExecutable} --version`);
    pythonPath = pythonExecutable;
    pythonVersion = stdout.trim();
    logger.debug(`Found Python: ${pythonPath} (${pythonVersion})`);

    // Check if debugpy is installed
    try {
      await runCmd(`${pythonPath} -c "import debugpy"`);
      debugpyAvailable = true;
      logger.debug('debugpy is available');
    } catch (debugpyError: any) {
      debugpyAvailable = false;
      error = `debugpy not found for ${pythonPath}. Please install with: pip install debugpy. Details: ${debugpyError.message || debugpyError}`;
      logger.warn(error);
    }
  } catch (versionError: any) {
    error = `Python command '${pythonExecutable}' not found or failed. Please install Python 3.7+ or configure the correct Python command. Details: ${versionError.message || versionError}`;
    logger.warn(error);
    // Ensure all fields are returned even on early exit
    return { pythonPath: '', pythonVersion: '', debugpyAvailable: false, error };
  }
  
  // If python was found but debugpy was not, error would have been set in the debugpy catch block.
  // If both were found, error remains ''.
  return { pythonPath, pythonVersion, debugpyAvailable, error };
}

/**
 * Install debugpy using the specified Python executable.
 * @param pythonExecutablePath - Resolved path to the Python executable.
 * @param runCmd - Optional command runner function for testing.
 * @returns Whether installation was successful.
 */
export async function installDebugpy(
  pythonExecutablePath: string,
  runCmd: RunCmd = execAsyncDefault
): Promise<boolean> {
  if (!pythonExecutablePath) {
    logger.error('Cannot install debugpy: Python executable path is not provided.');
    return false;
  }
  logger.info(`Attempting to install debugpy using ${pythonExecutablePath}`);
  
  try {
    const { stdout, stderr } = await runCmd(`${pythonExecutablePath} -m pip install debugpy`);
    logger.debug(`pip install debugpy stdout: ${stdout}`);
    if (stderr) {
      logger.warn(`pip install debugpy stderr: ${stderr}`); // Changed to warn as pip can output warnings on success
    }
    
    // Verify installation
    await runCmd(`${pythonExecutablePath} -c "import debugpy"`);
    logger.info(`debugpy installed successfully using ${pythonExecutablePath}`);
    return true;
  } catch (err: any) {
    logger.error(`Failed to install debugpy using ${pythonExecutablePath}. Error: ${err.message || err}`, { error: err });
    return false;
  }
}

/**
 * Get help message for Python and debugpy setup
 */
export function getPythonHelpMessage(): string {
  const installPythonUrl = 'https://www.python.org/downloads/';
  const installDebugpyCmd = 'pip install debugpy';
  
  return `
Python Requirements for Debug MCP Server:

1. Python 3.7 or higher is required
   - Download from: ${installPythonUrl}
   - Make sure Python is added to your PATH during installation

2. The debugpy package is required
   - Install with: ${installDebugpyCmd}
   - Or: python -m pip install debugpy

If you have multiple Python installations, you can specify which one to use by setting
the PYTHON_PATH environment variable before starting the server.
`.trim();
}

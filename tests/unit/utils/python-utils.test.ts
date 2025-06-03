import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { ExecException } from 'child_process'; 
// Import types from the source file for consistency
import type { PythonDetectionResult, RunCmd } from '../../../src/utils/python-utils';

// Interface representing the module structure we get from dynamic import,
// matching the refactored signatures in src/utils/python-utils.ts
interface PythonUtilsModule {
  detectPythonAndDebugpy: (runCmd?: RunCmd, pythonCmdOverride?: string) => Promise<PythonDetectionResult>;
  installDebugpy: (pythonExecutablePath: string, runCmd?: RunCmd) => Promise<boolean>;
  getPythonHelpMessage: () => string;
}

type ExecCallback = (error: ExecException | null, stdout: string, stderr: string) => void;

// Define the mock for exec. This will be used by jest.unstable_mockModule.
// Use a generic jest.Mock type to avoid issues with __promisify__ property.
const execMock = jest.fn();

// Mock 'child_process' before any imports that might use it.
// This must be at the top level and use `await`.
await jest.unstable_mockModule('child_process', () => ({
  __esModule: true, // Important for ESM mocks
  // Spread actual module if other exports are needed and should be real,
  // but for python-utils, only 'exec' is used.
  // ...jest.requireActual('child_process'),
  exec: execMock,
}));

// Dynamically import the module under test AFTER the mock is in place.
// All functions from python-utils will be properties of this 'pythonUtilsModule' object.
const pythonUtilsModule = await import('../../../src/utils/python-utils') as PythonUtilsModule;
import { promisify } from 'node:util'; // Import promisify for tests

// Helper to create the mock function for exec, matching the RunCmd interface
// The actual exec function from child_process has multiple overloads,
// but promisify typically uses the (command, options?, callback) or (command, callback) signature.
// Our RunCmd interface is (command: string): Promise<{ stdout: string; stderr: string }>,
// so the mock for the underlying callback version should be:
// (command: string, callback: (error, stdout, stderr))
// or (command: string, options: object, callback: (error, stdout, stderr))

const createCallbackMock = (stdout: string, stderr: string, error?: Error | null) => {
  // This function is the implementation for our callback-style execMock
  return (cmd: string, optionsOrCallback: any, callback?: ExecCallback) => {
    // cb here is the actual callback that node's promisify will provide to execMock
    const cbInternal = (typeof optionsOrCallback === 'function' ? optionsOrCallback : callback) as 
      (err: ExecException | null, resultValue?: { stdout: string, stderr: string }) => void;

    if (error) {
      // When execMock's callback is called with an error, the promisified version will reject.
      cbInternal(error as ExecException, undefined);
    } else {
      // When execMock's callback is called with (null, value), promisified version resolves to 'value'.
      // We want 'value' to be { stdout, stderr } to match RunCmd interface.
      cbInternal(null, { stdout, stderr });
    }
    return {} as any; // Simulate ChildProcess return, not strictly needed for promisify
  };
};

describe('Python Utilities', () => {
  const defaultPythonCmd = process.platform === 'win32' ? 'python' : 'python3';

  beforeEach(() => {
    execMock.mockReset();
    // Default implementation: calls back with an error.
    // Specific tests will override this with mockImplementationOnce.
    execMock.mockImplementation(createCallbackMock('', 'Default mock error stderr', new Error('Unhandled execMock call')) as any);
  });

  describe('detectPythonAndDebugpy', () => {
    it('should detect Python and debugpy if default python command is valid', async () => {
      execMock
        .mockImplementationOnce(createCallbackMock('Python 3.9.0', '') as any) // python --version
        .mockImplementationOnce(createCallbackMock('', '') as any); // python -c "import debugpy"

      const runCmdForTest = promisify(execMock as any) as RunCmd;
      const result = await pythonUtilsModule.detectPythonAndDebugpy(runCmdForTest);
      expect(result.pythonPath).toBe(defaultPythonCmd);
      expect(result.pythonVersion).toBe('Python 3.9.0');
      expect(result.debugpyAvailable).toBe(true);
      expect(result.error).toBe('');
      expect(execMock).toHaveBeenCalledTimes(2);
      expect(execMock).toHaveBeenNthCalledWith(1, `${defaultPythonCmd} --version`, expect.any(Function));
      expect(execMock).toHaveBeenNthCalledWith(2, `${defaultPythonCmd} -c "import debugpy"`, expect.any(Function));
    });

    it('should use pythonCmdOverride if provided and valid', async () => {
      const overrideCmd = 'custompython';
      execMock
        .mockImplementationOnce(createCallbackMock('Python 3.10.0 (custom)', '') as any) // custompython --version
        .mockImplementationOnce(createCallbackMock('', '') as any); // custompython -c "import debugpy"

      const runCmdForTest = promisify(execMock as any) as RunCmd;
      const result = await pythonUtilsModule.detectPythonAndDebugpy(runCmdForTest, overrideCmd);
      expect(result.pythonPath).toBe(overrideCmd);
      expect(result.pythonVersion).toBe('Python 3.10.0 (custom)');
      expect(result.debugpyAvailable).toBe(true);
      expect(result.error).toBe('');
      expect(execMock).toHaveBeenCalledTimes(2);
    });
    
    it('should detect Python but not debugpy if debugpy import fails', async () => {
      execMock
        .mockImplementationOnce(createCallbackMock('Python 3.8.5', '') as any) // python --version
        .mockImplementationOnce(createCallbackMock('', 'Error from mock', new Error('ModuleNotFoundError')) as any); // python -c "import debugpy" (fails)

      const runCmdForTest = promisify(execMock as any) as RunCmd;
      const result = await pythonUtilsModule.detectPythonAndDebugpy(runCmdForTest);
      expect(result.pythonPath).toBe(defaultPythonCmd);
      expect(result.pythonVersion).toBe('Python 3.8.5');
      expect(result.debugpyAvailable).toBe(false);
      expect(result.error).toContain('debugpy not found');
      expect(execMock).toHaveBeenCalledTimes(2);
    });

    it('should return error if Python version check fails', async () => {
      execMock.mockImplementation(createCallbackMock('', 'Error from mock', new Error('Command not found')) as any);

      const runCmdForTest = promisify(execMock as any) as RunCmd;
      const result = await pythonUtilsModule.detectPythonAndDebugpy(runCmdForTest);
      expect(result.pythonPath).toBe('');
      expect(result.pythonVersion).toBe('');
      expect(result.debugpyAvailable).toBe(false);
      expect(result.error).toContain(`Python command '${defaultPythonCmd}' not found or failed`);
      expect(execMock).toHaveBeenCalledTimes(1); // Only one attempt for version
    });

    it('should use MCP_PYTHON_CMD environment variable if pythonCmdOverride is not provided', async () => {
      const originalEnvVar = process.env.MCP_PYTHON_CMD;
      const envPythonCmd = 'env_python';
      process.env.MCP_PYTHON_CMD = envPythonCmd;

      execMock
        .mockImplementationOnce(createCallbackMock('Python 3.11.0 (env)', '') as any) // env_python --version
        .mockImplementationOnce(createCallbackMock('', '') as any); // env_python -c "import debugpy"

      const runCmdForTest = promisify(execMock as any) as RunCmd;
      // Call detectPythonAndDebugpy without pythonCmdOverride, so it uses process.env
      const result = await pythonUtilsModule.detectPythonAndDebugpy(runCmdForTest); 
      
      expect(result.pythonPath).toBe(envPythonCmd);
      expect(result.pythonVersion).toBe('Python 3.11.0 (env)');
      expect(result.debugpyAvailable).toBe(true);
      expect(execMock).toHaveBeenCalledTimes(2);

      // Restore original environment variable
      if (originalEnvVar === undefined) {
        delete process.env.MCP_PYTHON_CMD;
      } else {
        process.env.MCP_PYTHON_CMD = originalEnvVar;
      }
    });
  });

  describe('installDebugpy', () => {
    const testPythonPath = 'my/python/path';
    it('should return true if debugpy installs successfully, and log stderr warnings', async () => {
      execMock
        .mockImplementationOnce(createCallbackMock('Successfully installed debugpy', 'PIP_WARNING_TEST_MESSAGE') as any) // pip install with stderr
        .mockImplementationOnce(createCallbackMock('', '') as any); // import debugpy (verify)

      const runCmdForTest = promisify(execMock as any) as RunCmd;
      const success = await pythonUtilsModule.installDebugpy(testPythonPath, runCmdForTest);
      expect(success).toBe(true);
      expect(execMock).toHaveBeenNthCalledWith(1, `${testPythonPath} -m pip install debugpy`, expect.any(Function));
      expect(execMock).toHaveBeenNthCalledWith(2, `${testPythonPath} -c "import debugpy"`, expect.any(Function));
      expect(execMock).toHaveBeenCalledTimes(2);
    });

    it('should return false if pip install fails', async () => {
      execMock.mockImplementationOnce(createCallbackMock('', 'pip error', new Error('pip install failed')) as any);

      const runCmdForTest = promisify(execMock as any) as RunCmd;
      const success = await pythonUtilsModule.installDebugpy(testPythonPath, runCmdForTest);
      expect(success).toBe(false);
      expect(execMock).toHaveBeenCalledTimes(1);
    });

    it('should return false if verification after install fails', async () => {
      execMock
        .mockImplementationOnce(createCallbackMock('Successfully installed debugpy', '') as any) // pip install success
        .mockImplementationOnce(createCallbackMock('', 'import error', new Error('import failed')) as any); // import debugpy (verify fails)

      const runCmdForTest = promisify(execMock as any) as RunCmd;
      const success = await pythonUtilsModule.installDebugpy(testPythonPath, runCmdForTest);
      expect(success).toBe(false);
      expect(execMock).toHaveBeenCalledTimes(2);
    });

    it('should return false if pythonExecutablePath is empty', async () => {
      const runCmdForTest = promisify(execMock as any) as RunCmd; // Though execMock won't be called
      const success = await pythonUtilsModule.installDebugpy('', runCmdForTest);
      expect(success).toBe(false);
      expect(execMock).not.toHaveBeenCalled();
    });
  });

  describe('getPythonHelpMessage', () => {
    it('should return a non-empty help string', () => {
      // This function does not use exec.
      const message = pythonUtilsModule.getPythonHelpMessage();
      expect(message).toBeDefined();
      expect(message.length).toBeGreaterThan(0);
      expect(message).toContain('Python Requirements');
      expect(message).toContain('pip install debugpy');
    });
  });

  describe('getPythonHelpMessage', () => {
    it('should return a non-empty help string', () => {
      // This function does not use exec, so no mocking needed for it.
      const message = pythonUtilsModule.getPythonHelpMessage();
      expect(message).toBeDefined();
      expect(message.length).toBeGreaterThan(0);
      expect(message).toContain('Python Requirements');
      expect(message).toContain('pip install debugpy');
    });
  });
});

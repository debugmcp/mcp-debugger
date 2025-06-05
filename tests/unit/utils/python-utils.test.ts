/**
 * Unit tests for Python utilities
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import type { RunCmd } from '../../../src/utils/python-utils.js';

// Mock child_process before importing python-utils
vi.mock('child_process', () => ({
  exec: vi.fn()
}));

// Import after mocking
const { detectPythonAndDebugpy, installDebugpy, getPythonHelpMessage } = 
  await import('../../../src/utils/python-utils.js');

describe('Python Utilities', () => {
  const mockExec = execCallback as any;
  const defaultPythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  let originalEnv: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = process.env.MCP_PYTHON_CMD;
    delete process.env.MCP_PYTHON_CMD;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.MCP_PYTHON_CMD = originalEnv;
    } else {
      delete process.env.MCP_PYTHON_CMD;
    }
  });

  describe('detectPythonAndDebugpy', () => {
    it('should detect Python and debugpy if both are available', async () => {
      // Create a custom runCmd that will be passed to the function
      const mockRunCmd = vi.fn()
        .mockResolvedValueOnce({ stdout: 'Python 3.9.0', stderr: '' }) // python --version
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // python -c "import debugpy"

      const result = await detectPythonAndDebugpy(mockRunCmd);

      expect(result).toEqual({
        pythonPath: defaultPythonCmd,
        pythonVersion: 'Python 3.9.0',
        debugpyAvailable: true,
        error: ''
      });

      expect(mockRunCmd).toHaveBeenCalledTimes(2);
      expect(mockRunCmd).toHaveBeenCalledWith(`${defaultPythonCmd} --version`);
      expect(mockRunCmd).toHaveBeenCalledWith(`${defaultPythonCmd} -c "import debugpy"`);
    });

    it('should use pythonCmdOverride if provided', async () => {
      const customPython = '/usr/local/bin/python3.10';
      const mockRunCmd = vi.fn()
        .mockResolvedValueOnce({ stdout: 'Python 3.10.5', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await detectPythonAndDebugpy(mockRunCmd, customPython);

      expect(result.pythonPath).toBe(customPython);
      expect(result.pythonVersion).toBe('Python 3.10.5');
      expect(result.debugpyAvailable).toBe(true);
      expect(mockRunCmd).toHaveBeenCalledWith(`${customPython} --version`);
    });

    it('should use MCP_PYTHON_CMD environment variable if set', async () => {
      process.env.MCP_PYTHON_CMD = '/opt/python/bin/python';
      
      const mockRunCmd = vi.fn()
        .mockResolvedValueOnce({ stdout: 'Python 3.11.0', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await detectPythonAndDebugpy(mockRunCmd);

      expect(result.pythonPath).toBe('/opt/python/bin/python');
      expect(mockRunCmd).toHaveBeenCalledWith('/opt/python/bin/python --version');
    });

    it('should detect Python but not debugpy if debugpy is not installed', async () => {
      const mockRunCmd = vi.fn()
        .mockResolvedValueOnce({ stdout: 'Python 3.8.10', stderr: '' })
        .mockRejectedValueOnce(new Error('ModuleNotFoundError: No module named debugpy'));

      const result = await detectPythonAndDebugpy(mockRunCmd);

      expect(result.pythonPath).toBe(defaultPythonCmd);
      expect(result.pythonVersion).toBe('Python 3.8.10');
      expect(result.debugpyAvailable).toBe(false);
      expect(result.error).toContain('debugpy not found');
    });

    it('should return error if Python is not found', async () => {
      const mockRunCmd = vi.fn()
        .mockRejectedValueOnce(new Error('Command not found: python'));

      const result = await detectPythonAndDebugpy(mockRunCmd);

      expect(result).toEqual({
        pythonPath: '',
        pythonVersion: '',
        debugpyAvailable: false,
        error: expect.stringContaining(`Python command '${defaultPythonCmd}' not found`)
      });

      expect(mockRunCmd).toHaveBeenCalledTimes(1);
    });

    it('should use default runCmd if not provided', async () => {
      // Mock the exec function to simulate successful Python detection
      (mockExec as any).mockImplementation((cmd: string, callback: any) => {
        if (cmd.includes('--version')) {
          callback(null, 'Python 3.9.7', '');
        } else if (cmd.includes('import debugpy')) {
          callback(null, '', '');
        }
      });

      const result = await detectPythonAndDebugpy();

      expect(result.pythonPath).toBe(defaultPythonCmd);
      expect(result.pythonVersion).toBe('Python 3.9.7');
      expect(result.debugpyAvailable).toBe(true);
    });
  });

  describe('installDebugpy', () => {
    it('should install debugpy successfully', async () => {
      const pythonPath = '/usr/bin/python3';
      const mockRunCmd = vi.fn()
        .mockResolvedValueOnce({ 
          stdout: 'Successfully installed debugpy-1.6.0', 
          stderr: 'WARNING: pip is out of date' 
        })
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // verification

      const result = await installDebugpy(pythonPath, mockRunCmd);

      expect(result).toBe(true);
      expect(mockRunCmd).toHaveBeenCalledTimes(2);
      expect(mockRunCmd).toHaveBeenCalledWith(`${pythonPath} -m pip install debugpy`);
      expect(mockRunCmd).toHaveBeenCalledWith(`${pythonPath} -c "import debugpy"`);
    });

    it('should return false if pip install fails', async () => {
      const pythonPath = '/usr/bin/python3';
      const mockRunCmd = vi.fn()
        .mockRejectedValueOnce(new Error('pip: command not found'));

      const result = await installDebugpy(pythonPath, mockRunCmd);

      expect(result).toBe(false);
      expect(mockRunCmd).toHaveBeenCalledTimes(1);
    });

    it('should return false if verification fails after install', async () => {
      const pythonPath = '/usr/bin/python3';
      const mockRunCmd = vi.fn()
        .mockResolvedValueOnce({ stdout: 'Successfully installed debugpy', stderr: '' })
        .mockRejectedValueOnce(new Error('ModuleNotFoundError'));

      const result = await installDebugpy(pythonPath, mockRunCmd);

      expect(result).toBe(false);
      expect(mockRunCmd).toHaveBeenCalledTimes(2);
    });

    it('should return false if pythonExecutablePath is empty', async () => {
      const mockRunCmd = vi.fn();

      const result = await installDebugpy('', mockRunCmd);

      expect(result).toBe(false);
      expect(mockRunCmd).not.toHaveBeenCalled();
    });

    it('should use default runCmd if not provided', async () => {
      const pythonPath = '/usr/bin/python3';
      
      // Mock the exec function for default runCmd
      (mockExec as any).mockImplementation((cmd: string, callback: any) => {
        if (cmd.includes('pip install')) {
          callback(null, 'Successfully installed debugpy', '');
        } else if (cmd.includes('import debugpy')) {
          callback(null, '', '');
        }
      });

      const result = await installDebugpy(pythonPath);

      expect(result).toBe(true);
    });
  });

  describe('getPythonHelpMessage', () => {
    it('should return a comprehensive help message', () => {
      const message = getPythonHelpMessage();

      expect(message).toBeDefined();
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(100);
      expect(message).toContain('Python Requirements');
      expect(message).toContain('debugpy');
      expect(message).toContain('pip install debugpy');
      expect(message).toContain('MCP_PYTHON_CMD');
    });

    it('should include platform-specific default Python command', () => {
      const message = getPythonHelpMessage();
      const expectedDefault = process.platform === 'win32' ? 'python' : 'python3';
      
      expect(message).toContain(expectedDefault);
    });
  });
});

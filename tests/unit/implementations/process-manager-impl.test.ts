/**
 * Unit tests for ProcessManagerImpl
 */
import { vi } from 'vitest';
import { ProcessManagerImpl } from '../../../src/implementations/process-manager-impl.js';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  exec: vi.fn()
}));

// Import after mock
import { spawn, exec } from 'child_process';

// Cast to jest mocks
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;
const mockExec = exec as jest.MockedFunction<typeof exec>;

describe('ProcessManagerImpl', () => {
  let processManager: ProcessManagerImpl;

  beforeEach(() => {
    processManager = new ProcessManagerImpl();
    vi.clearAllMocks();
  });

  describe('spawn', () => {
    it('should spawn a process with given command and args', () => {
      const mockProcess = {
        pid: 12345,
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        kill: vi.fn()
      };
      mockSpawn.mockReturnValue(mockProcess as any);

      const result = processManager.spawn('node', ['--version'], {
        cwd: '/test/dir',
        env: { NODE_ENV: 'test' }
      });

      expect(mockSpawn).toHaveBeenCalledWith('node', ['--version'], {
        cwd: '/test/dir',
        env: { NODE_ENV: 'test' }
      });
      expect(result).toBe(mockProcess);
    });

    it('should spawn a process without options', () => {
      const mockProcess = {
        pid: 12345,
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        kill: vi.fn()
      };
      mockSpawn.mockReturnValue(mockProcess as any);

      const result = processManager.spawn('ls', ['-la']);

      expect(mockSpawn).toHaveBeenCalledWith('ls', ['-la'], undefined);
      expect(result).toBe(mockProcess);
    });

    it('should handle spawn errors', () => {
      mockSpawn.mockImplementation(() => {
        throw new Error('Command not found');
      });

      expect(() => processManager.spawn('invalid-command', [])).toThrow('Command not found');
    });
  });

  describe('exec', () => {
    it('should execute a command and return result', async () => {
      mockExec.mockImplementation(((command: string, callback: any) => {
        callback(null, 'output', 'error output');
        return {} as any;
      }) as any);

      const result = await processManager.exec('echo "test"');

      expect(mockExec).toHaveBeenCalledWith('echo "test"', expect.any(Function));
      expect(result).toEqual({
        stdout: 'output',
        stderr: 'error output'
      });
    });

    it('should handle exec errors', async () => {
      const error = new Error('Command failed');
      mockExec.mockImplementation(((command: string, callback: any) => {
        callback(error, '', '');
        return {} as any;
      }) as any);

      await expect(processManager.exec('invalid-command')).rejects.toThrow('Command failed');
    });

    it('should handle exec with non-error code', async () => {
      const error: any = new Error('Command failed');
      error.code = 1;
      mockExec.mockImplementation(((command: string, callback: any) => {
        callback(error, 'partial output', 'error output');
        return {} as any;
      }) as any);

      await expect(processManager.exec('failing-command')).rejects.toThrow('Command failed');
    });
  });
});

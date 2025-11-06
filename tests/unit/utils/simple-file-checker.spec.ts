/**
 * Unit tests for SimpleFileChecker - TRUE HANDS-OFF APPROACH
 */
import { describe, it, expect, beforeEach, vi, MockedFunction } from 'vitest';
import { SimpleFileChecker, createSimpleFileChecker } from '../../../src/utils/simple-file-checker.js';
import { IFileSystem, IEnvironment } from '../../../src/interfaces/external-dependencies.js';

describe('SimpleFileChecker', () => {
  let mockFileSystem: IFileSystem;
  let mockEnvironment: IEnvironment;
  let mockLogger: { debug: MockedFunction<(msg: string, meta?: unknown) => void> };
  let checker: SimpleFileChecker;

  beforeEach(() => {
    // Create mock file system
    mockFileSystem = {
      pathExists: vi.fn() as MockedFunction<(path: string) => Promise<boolean>>,
      existsSync: vi.fn() as MockedFunction<(path: string) => boolean>,
      stat: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      exists: vi.fn(),
      mkdir: vi.fn(),
      readdir: vi.fn(),
      unlink: vi.fn(),
      rmdir: vi.fn(),
      ensureDir: vi.fn(),
      ensureDirSync: vi.fn(),
      remove: vi.fn(),
      copy: vi.fn(),
      outputFile: vi.fn(),
    };

    // Create mock environment
    mockEnvironment = {
      get: vi.fn() as MockedFunction<(key: string) => string | undefined>,
      getAll: vi.fn(),
      getCurrentWorkingDirectory: vi.fn() as MockedFunction<() => string>,
    };

    // Create mock logger
    mockLogger = {
      debug: vi.fn()
    };

    // Create checker instance
    checker = new SimpleFileChecker(mockFileSystem, mockEnvironment, mockLogger);
  });

  describe('Host Mode (no container)', () => {
    beforeEach(() => {
      (mockEnvironment.get as MockedFunction<(key: string) => string | undefined>)
        .mockReturnValue(undefined); // Not in container mode
    });

    it('should check file existence without path manipulation', async () => {
      const testPath = 'src/file.ts';
      (mockFileSystem.pathExists as MockedFunction<(path: string) => Promise<boolean>>)
        .mockResolvedValue(true);

      const result = await checker.checkExists(testPath);

      expect(result).toEqual({
        exists: true,
        originalPath: testPath,
        effectivePath: testPath // No manipulation in host mode
      });
      expect(mockFileSystem.pathExists).toHaveBeenCalledWith(testPath);
    });

    it('should handle non-existent files', async () => {
      const testPath = 'missing.ts';
      (mockFileSystem.pathExists as MockedFunction<(path: string) => Promise<boolean>>)
        .mockResolvedValue(false);

      const result = await checker.checkExists(testPath);

      expect(result).toEqual({
        exists: false,
        originalPath: testPath,
        effectivePath: testPath
      });
    });

    it('should handle system errors', async () => {
      const testPath = 'error.ts';
      const error = new Error('Permission denied');
      (mockFileSystem.pathExists as MockedFunction<(path: string) => Promise<boolean>>)
        .mockRejectedValue(error);

      const result = await checker.checkExists(testPath);

      expect(result).toEqual({
        exists: false,
        originalPath: testPath,
        effectivePath: testPath,
        errorMessage: 'Cannot check file existence: Permission denied'
      });
    });
  });

  describe('Container Mode', () => {
    beforeEach(() => {
      (mockEnvironment.get as MockedFunction<(key: string) => string | undefined>)
        .mockImplementation((key) => {
          if (key === 'MCP_CONTAINER') return 'true';
          if (key === 'MCP_WORKSPACE_ROOT') return '/workspace';
          return undefined;
        });
    });

    it('should prepend /workspace/ to relative paths', async () => {
      const testPath = 'src/file.ts';
      (mockFileSystem.pathExists as MockedFunction<(path: string) => Promise<boolean>>)
        .mockResolvedValue(true);

      const result = await checker.checkExists(testPath);

      expect(result).toEqual({
        exists: true,
        originalPath: testPath,
        effectivePath: '/workspace/src/file.ts'
      });
      expect(mockFileSystem.pathExists).toHaveBeenCalledWith('/workspace/src/file.ts');
    });

    it('should always prepend /workspace/ in container mode', async () => {
      const testPath = '/workspace/src/file.ts';
      (mockFileSystem.pathExists as MockedFunction<(path: string) => Promise<boolean>>)
        .mockResolvedValue(true);

      const result = await checker.checkExists(testPath);

      expect(result).toEqual({
        exists: true,
        originalPath: testPath,
        effectivePath: '/workspace//workspace/src/file.ts' // Always prepends in container mode
      });
      expect(mockFileSystem.pathExists).toHaveBeenCalledWith('/workspace//workspace/src/file.ts');
    });

    it('should handle any path format (no interpretation)', async () => {
      // This is the key test - we don't interpret Windows paths, just add prefix
      const windowsLikePath = 'C:\\Users\\test\\file.ts';
      (mockFileSystem.pathExists as MockedFunction<(path: string) => Promise<boolean>>)
        .mockResolvedValue(true);

      const result = await checker.checkExists(windowsLikePath);

      expect(result).toEqual({
        exists: true,
        originalPath: windowsLikePath,
        effectivePath: '/workspace/C:\\Users\\test\\file.ts' // Simple prefix, no interpretation
      });
      expect(mockFileSystem.pathExists).toHaveBeenCalledWith('/workspace/C:\\Users\\test\\file.ts');
    });
  });

  describe('Factory function', () => {
    it('should create SimpleFileChecker instance', () => {
      const instance = createSimpleFileChecker(mockFileSystem, mockEnvironment, mockLogger);
      expect(instance).toBeInstanceOf(SimpleFileChecker);
    });
  });
});

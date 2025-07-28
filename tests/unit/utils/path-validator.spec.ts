/**
 * Unit tests for PathValidator
 */
import { describe, it, expect, beforeEach, vi, MockedFunction } from 'vitest';
import { PathValidator, createPathValidator } from '../../../src/utils/path-validator.js';
import { IFileSystem, IEnvironment } from '../../../src/interfaces/external-dependencies.js';
import path from 'path';
import { Stats } from 'fs';

describe('PathValidator', () => {
  let mockFileSystem: IFileSystem;
  let mockEnvironment: IEnvironment;
  let mockLogger: { debug: MockedFunction<(msg: string, meta?: unknown) => void> };
  let validator: PathValidator;

  beforeEach(() => {
    // Create mock file system
    mockFileSystem = {
      pathExists: vi.fn() as MockedFunction<(path: string) => Promise<boolean>>,
      existsSync: vi.fn() as MockedFunction<(path: string) => boolean>,
      stat: vi.fn() as MockedFunction<(path: string) => Promise<Stats>>,
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

    // Set default behavior
    (mockEnvironment.get as MockedFunction<(key: string) => string | undefined>)
      .mockReturnValue(undefined);
    (mockEnvironment.getCurrentWorkingDirectory as MockedFunction<() => string>)
      .mockReturnValue('C:\\Users\\test\\project');

    // Create validator instance
    validator = new PathValidator(mockFileSystem, mockEnvironment, mockLogger);
  });

  describe('Host Mode', () => {
    beforeEach(() => {
      (mockEnvironment.get as MockedFunction<(key: string) => string | undefined>)
        .mockReturnValue(undefined); // Not in container mode
    });

    it('should validate an existing absolute path', async () => {
      const testPath = 'C:\\Users\\test\\project\\src\\file.ts';
      (mockFileSystem.pathExists as MockedFunction<(path: string) => Promise<boolean>>)
        .mockResolvedValue(true);

      const result = await validator.validateFilePath(testPath);

      expect(result).toEqual({
        isValid: true,
        resolvedPath: testPath,
        originalPath: testPath,
        isContainer: false
      });
      expect(mockFileSystem.pathExists).toHaveBeenCalledWith(testPath);
    });

    it('should validate an existing relative path', async () => {
      const testPath = 'src/file.ts';
      const expectedAbsolute = 'C:\\Users\\test\\project\\src\\file.ts';
      (mockFileSystem.pathExists as MockedFunction<(path: string) => Promise<boolean>>)
        .mockResolvedValue(true);

      const result = await validator.validateFilePath(testPath);

      expect(result).toEqual({
        isValid: true,
        resolvedPath: expectedAbsolute,
        originalPath: testPath,
        isContainer: false
      });
      expect(mockFileSystem.pathExists).toHaveBeenCalledWith(expectedAbsolute);
    });

    it('should handle non-existent files', async () => {
      const testPath = 'src/missing.ts';
      const expectedAbsolute = 'C:\\Users\\test\\project\\src\\missing.ts';
      (mockFileSystem.pathExists as MockedFunction<(path: string) => Promise<boolean>>)
        .mockResolvedValue(false);

      const result = await validator.validateFilePath(testPath);

      expect(result.isValid).toBe(false);
      expect(result.resolvedPath).toBe(expectedAbsolute);
      expect(result.originalPath).toBe(testPath);
      expect(result.isContainer).toBe(false);
      expect(result.errorMessage).toContain(`File not found: '${testPath}'`);
      expect(result.errorMessage).toContain(`Resolved path: '${expectedAbsolute}'`);
      expect(result.errorMessage).toContain('Container mode: false');
      expect(result.errorMessage).toContain('Check that the file exists and the path is correct');
    });

    it('should normalize paths with redundant segments', async () => {
      const testPath = 'src/../src/./file.ts';
      const expectedNormalized = 'C:\\Users\\test\\project\\src\\file.ts';
      (mockFileSystem.pathExists as MockedFunction<(path: string) => Promise<boolean>>)
        .mockResolvedValue(true);

      const result = await validator.validateFilePath(testPath);

      expect(result.resolvedPath).toBe(expectedNormalized);
      expect(mockFileSystem.pathExists).toHaveBeenCalledWith(expectedNormalized);
    });

    it('should handle symlinks when allowed', async () => {
      const testPath = 'src/symlink.ts';
      const expectedAbsolute = 'C:\\Users\\test\\project\\src\\symlink.ts';
      
      (mockFileSystem.pathExists as MockedFunction<(path: string) => Promise<boolean>>)
        .mockResolvedValue(true);
      
      const mockStats = {
        isSymbolicLink: vi.fn().mockReturnValue(true)
      } as unknown as Stats;
      
      (mockFileSystem.stat as MockedFunction<(path: string) => Promise<Stats>>)
        .mockResolvedValue(mockStats);

      const result = await validator.validateFilePath(testPath, { allowSymlinks: true });

      expect(result.isValid).toBe(true);
      expect(mockFileSystem.stat).toHaveBeenCalledWith(expectedAbsolute);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[PathValidator] Path is a symlink: C:\\Users\\test\\project\\src\\symlink.ts'
      );
    });
  });

  describe('Container Mode', () => {
    beforeEach(() => {
      (mockEnvironment.get as MockedFunction<(key: string) => string | undefined>)
        .mockReturnValue('true'); // In container mode
    });

    it('should prepend /workspace to relative paths', async () => {
      const testPath = 'src/file.ts';
      const expectedResolved = '/workspace/src/file.ts';
      (mockFileSystem.pathExists as MockedFunction<(path: string) => Promise<boolean>>)
        .mockResolvedValue(true);

      const result = await validator.validateFilePath(testPath);

      expect(result).toEqual({
        isValid: true,
        resolvedPath: expectedResolved,
        originalPath: testPath,
        isContainer: true
      });
      expect(mockFileSystem.pathExists).toHaveBeenCalledWith(expectedResolved);
    });

    it('should handle Windows absolute paths in container mode', async () => {
      const testPath = 'C:\\Users\\test\\project\\src\\file.ts';
      const expectedResolved = '/workspace/Users/test/project/src/file.ts';
      (mockFileSystem.pathExists as MockedFunction<(path: string) => Promise<boolean>>)
        .mockResolvedValue(true);

      const result = await validator.validateFilePath(testPath);

      expect(result).toEqual({
        isValid: true,
        resolvedPath: expectedResolved,
        originalPath: testPath,
        isContainer: true
      });
    });

    it('should not double-prepend /workspace', async () => {
      const testPath = '/workspace/src/file.ts';
      (mockFileSystem.pathExists as MockedFunction<(path: string) => Promise<boolean>>)
        .mockResolvedValue(true);

      const result = await validator.validateFilePath(testPath);

      expect(result.resolvedPath).toBe(testPath);
      expect(mockFileSystem.pathExists).toHaveBeenCalledWith(testPath);
    });

    it('should provide container-specific error messages', async () => {
      const testPath = 'src/missing.ts';
      const expectedResolved = '/workspace/src/missing.ts';
      (mockFileSystem.pathExists as MockedFunction<(path: string) => Promise<boolean>>)
        .mockResolvedValue(false);

      const result = await validator.validateFilePath(testPath);

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('Container mode: true');
      expect(result.errorMessage).toContain('In container mode, ensure your file is mounted in the /workspace directory');
    });
  });

  describe('Synchronous validation', () => {
    it('should validate synchronously', () => {
      const testPath = 'src/file.ts';
      const expectedAbsolute = 'C:\\Users\\test\\project\\src\\file.ts';
      (mockFileSystem.existsSync as MockedFunction<(path: string) => boolean>)
        .mockReturnValue(true);

      const result = validator.validateFilePathSync(testPath);

      expect(result).toEqual({
        isValid: true,
        resolvedPath: expectedAbsolute,
        originalPath: testPath,
        isContainer: false
      });
      expect(mockFileSystem.existsSync).toHaveBeenCalledWith(expectedAbsolute);
    });

    it('should handle errors in sync validation', () => {
      const testPath = 'src/file.ts';
      (mockFileSystem.existsSync as MockedFunction<(path: string) => boolean>)
        .mockImplementation(() => { throw new Error('Permission denied'); });

      const result = validator.validateFilePathSync(testPath);

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('Path validation error: Permission denied');
    });
  });

  describe('Caching', () => {
    it('should cache successful validations', async () => {
      const testPath = 'src/file.ts';
      (mockFileSystem.pathExists as MockedFunction<(path: string) => Promise<boolean>>)
        .mockResolvedValue(true);

      // First call
      await validator.validateFilePath(testPath);
      expect(mockFileSystem.pathExists).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await validator.validateFilePath(testPath);
      expect(mockFileSystem.pathExists).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('[PathValidator] Cache hit for:')
      );
    });

    it('should respect cache duration', async () => {
      const testPath = 'src/file.ts';
      (mockFileSystem.pathExists as MockedFunction<(path: string) => Promise<boolean>>)
        .mockResolvedValue(true);

      // Use very short cache duration
      await validator.validateFilePath(testPath, { cacheDuration: 0 });
      await validator.validateFilePath(testPath, { cacheDuration: 0 });

      // Should not use cache
      expect(mockFileSystem.pathExists).toHaveBeenCalledTimes(2);
    });

    it('should clear cache on demand', async () => {
      const testPath = 'src/file.ts';
      (mockFileSystem.pathExists as MockedFunction<(path: string) => Promise<boolean>>)
        .mockResolvedValue(true);

      await validator.validateFilePath(testPath);
      validator.clearCache();
      await validator.validateFilePath(testPath);

      expect(mockFileSystem.pathExists).toHaveBeenCalledTimes(2);
    });

    it('should provide cache statistics', () => {
      const stats = validator.getCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty paths', async () => {
      const result = await validator.validateFilePath('');
      expect(result.isValid).toBe(false);
    });

    it('should handle paths with special characters', async () => {
      const testPath = 'src/file with spaces.ts';
      const expectedAbsolute = 'C:\\Users\\test\\project\\src\\file with spaces.ts';
      (mockFileSystem.pathExists as MockedFunction<(path: string) => Promise<boolean>>)
        .mockResolvedValue(true);

      const result = await validator.validateFilePath(testPath);
      expect(result.resolvedPath).toBe(expectedAbsolute);
    });

    it('should handle paths with unicode characters', async () => {
      const testPath = 'src/文件.ts';
      const expectedAbsolute = 'C:\\Users\\test\\project\\src\\文件.ts';
      (mockFileSystem.pathExists as MockedFunction<(path: string) => Promise<boolean>>)
        .mockResolvedValue(true);

      const result = await validator.validateFilePath(testPath);
      expect(result.resolvedPath).toBe(expectedAbsolute);
    });

    it('should handle stat failures gracefully', async () => {
      const testPath = 'src/file.ts';
      (mockFileSystem.pathExists as MockedFunction<(path: string) => Promise<boolean>>)
        .mockResolvedValue(true);
      (mockFileSystem.stat as MockedFunction<(path: string) => Promise<Stats>>)
        .mockRejectedValue(new Error('Stat failed'));

      const result = await validator.validateFilePath(testPath);
      
      expect(result.isValid).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('[PathValidator] Could not stat file'),
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe('Factory function', () => {
    it('should create PathValidator instances', () => {
      const instance = createPathValidator(mockFileSystem, mockEnvironment, mockLogger);
      expect(instance).toBeInstanceOf(PathValidator);
    });

    it('should work without logger', () => {
      const instance = createPathValidator(mockFileSystem, mockEnvironment);
      expect(instance).toBeInstanceOf(PathValidator);
    });
  });

  describe('Cross-platform path handling', () => {
    it('should handle Unix-style paths on Windows', async () => {
      const testPath = 'src/subdir/file.ts';
      const expectedWindows = 'C:\\Users\\test\\project\\src\\subdir\\file.ts';
      (mockFileSystem.pathExists as MockedFunction<(path: string) => Promise<boolean>>)
        .mockResolvedValue(true);

      const result = await validator.validateFilePath(testPath);
      
      // Path.resolve will normalize to the OS-specific format
      expect(result.resolvedPath).toBe(expectedWindows);
    });
  });

  describe('Performance logging', () => {
    it('should log validation duration', async () => {
      const testPath = 'src/file.ts';
      (mockFileSystem.pathExists as MockedFunction<(path: string) => Promise<boolean>>)
        .mockResolvedValue(true);

      await validator.validateFilePath(testPath);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('[PathValidator] Validation completed in'),
        expect.objectContaining({
          originalPath: testPath,
          resolvedPath: expect.any(String),
          isContainer: false
        })
      );
    });
  });
});

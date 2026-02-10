/**
 * Unit tests for FileSystemImpl
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fsExtra from 'fs-extra';

// Mock fs-extra before importing FileSystemImpl
vi.mock('fs-extra', () => {
  return {
    default: {
      pathExists: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      ensureDir: vi.fn(),
      remove: vi.fn(),
      copy: vi.fn(),
      outputFile: vi.fn(),
      access: vi.fn(), // For FileSystemImpl's 'exists' method
      mkdir: vi.fn(),
      readdir: vi.fn(),
      rmdir: vi.fn(),
      stat: vi.fn(),
      unlink: vi.fn(),
      ensureDirSync: vi.fn(),
      readJson: vi.fn(), // Keep existing from original mock
      writeJson: vi.fn(), // Keep existing from original mock
      copySync: vi.fn(), // Keep existing from original mock
      // Add any other functions from fs-extra that FileSystemImpl might use,
      // even if not directly tested here, to prevent unexpected errors.
      // For now, this covers what's explicitly in the tests.
    },
    // If FileSystemImpl used named exports like `import { readFile } from 'fs-extra'`,
    // they would be mocked here, e.g., readFile: vi.fn().
    // Since it uses `fsExtra.readFile`, they are on the `default` export.
  };
});

import { FileSystemImpl } from '../../../src/implementations/file-system-impl.js';

describe('FileSystemImpl', () => {
  let fileSystem: FileSystemImpl;

  beforeEach(() => {
    vi.clearAllMocks();
    fileSystem = new FileSystemImpl();
  });

  describe('pathExists', () => {
    it('should return true when path exists', async () => {
      (fsExtra.pathExists as any).mockResolvedValue(true);
      
      const result = await fileSystem.pathExists('/path/to/file');
      
      expect(result).toBe(true);
      expect(fsExtra.pathExists).toHaveBeenCalledWith('/path/to/file');
    });

    it('should return false when path does not exist', async () => {
      (fsExtra.pathExists as any).mockResolvedValue(false);
      
      const result = await fileSystem.pathExists('/nonexistent/path');
      
      expect(result).toBe(false);
      expect(fsExtra.pathExists).toHaveBeenCalledWith('/nonexistent/path');
    });

    it('should propagate errors', async () => {
      const error = new Error('Permission denied');
      (fsExtra.pathExists as any).mockRejectedValue(error);
      
      await expect(fileSystem.pathExists('/restricted/path')).rejects.toThrow('Permission denied');
    });
  });

  describe('readFile', () => {
    it('should read file content as string with explicit encoding', async () => {
      const content = 'file content';
      (fsExtra.readFile as any).mockResolvedValue(content);
      
      const result = await fileSystem.readFile('/path/to/file.txt', 'utf8');
      
      expect(result).toBe(content);
      expect(fsExtra.readFile).toHaveBeenCalledWith('/path/to/file.txt', 'utf8');
    });

    it('should read file content with default utf-8 encoding', async () => {
      const content = 'file content';
      (fsExtra.readFile as any).mockResolvedValue(content);
      
      const result = await fileSystem.readFile('/path/to/file.txt');
      
      expect(result).toBe(content);
      expect(fsExtra.readFile).toHaveBeenCalledWith('/path/to/file.txt', 'utf-8');
    });

    it('should handle read errors', async () => {
      (fsExtra.readFile as any).mockRejectedValue(new Error('File not found'));
      
      await expect(fileSystem.readFile('/missing/file')).rejects.toThrow('File not found');
    });
  });

  describe('writeFile', () => {
    it('should write string content to file', async () => {
      const content = 'new content';
      (fsExtra.writeFile as any).mockResolvedValue(undefined);
      
      await fileSystem.writeFile('/path/to/file.txt', content);
      
      expect(fsExtra.writeFile).toHaveBeenCalledWith('/path/to/file.txt', content);
    });

    it('should write buffer content to file', async () => {
      const buffer = Buffer.from('binary content');
      (fsExtra.writeFile as any).mockResolvedValue(undefined);
      
      await fileSystem.writeFile('/path/to/file.bin', buffer);
      
      expect(fsExtra.writeFile).toHaveBeenCalledWith('/path/to/file.bin', buffer);
    });

    it('should handle write errors', async () => {
      (fsExtra.writeFile as any).mockRejectedValue(new Error('Disk full'));
      
      await expect(fileSystem.writeFile('/path/to/file', 'content')).rejects.toThrow('Disk full');
    });
  });

  describe('ensureDir', () => {
    it('should ensure directory exists', async () => {
      (fsExtra.ensureDir as any).mockResolvedValue(undefined);
      
      await fileSystem.ensureDir('/path/to/directory');
      
      expect(fsExtra.ensureDir).toHaveBeenCalledWith('/path/to/directory');
    });

    it('should handle directory creation errors', async () => {
      (fsExtra.ensureDir as any).mockRejectedValue(new Error('Permission denied'));
      
      await expect(fileSystem.ensureDir('/restricted/dir')).rejects.toThrow('Permission denied');
    });
  });

  describe('remove', () => {
    it('should remove file or directory', async () => {
      (fsExtra.remove as any).mockResolvedValue(undefined);
      
      await fileSystem.remove('/path/to/remove');
      
      expect(fsExtra.remove).toHaveBeenCalledWith('/path/to/remove');
    });

    it('should handle removal errors', async () => {
      (fsExtra.remove as any).mockRejectedValue(new Error('Resource busy'));
      
      await expect(fileSystem.remove('/busy/resource')).rejects.toThrow('Resource busy');
    });
  });

  describe('copy', () => {
    it('should copy files or directories', async () => {
      (fsExtra.copy as any).mockResolvedValue(undefined);
      
      await fileSystem.copy('/source/path', '/dest/path');
      
      expect(fsExtra.copy).toHaveBeenCalledWith('/source/path', '/dest/path');
    });

    it('should handle copy errors', async () => {
      (fsExtra.copy as any).mockRejectedValue(new Error('Source not found'));
      
      await expect(fileSystem.copy('/missing', '/dest')).rejects.toThrow('Source not found');
    });
  });

  describe('outputFile', () => {
    it('should output file with content', async () => {
      (fsExtra.outputFile as any).mockResolvedValue(undefined);
      
      await fileSystem.outputFile('/path/to/new/file.txt', 'content');
      
      expect(fsExtra.outputFile).toHaveBeenCalledWith('/path/to/new/file.txt', 'content');
    });

    it('should handle output errors', async () => {
      (fsExtra.outputFile as any).mockRejectedValue(new Error('Invalid path'));
      
      await expect(fileSystem.outputFile('/invalid/path', 'content')).rejects.toThrow('Invalid path');
    });
  });

  describe('exists', () => {
    it('should return true when path exists', async () => {
      (fsExtra.access as any).mockResolvedValue(undefined);
      
      const result = await fileSystem.exists('/path/to/check');
      
      expect(result).toBe(true);
      expect(fsExtra.access).toHaveBeenCalledWith('/path/to/check');
    });

    it('should return false when path does not exist', async () => {
      (fsExtra.access as any).mockRejectedValue(new Error('ENOENT'));
      
      const result = await fileSystem.exists('/nonexistent/path');
      
      expect(result).toBe(false);
      expect(fsExtra.access).toHaveBeenCalledWith('/nonexistent/path');
    });
  });

  describe('directory operations', () => {
    it('should create directory without options', async () => {
      (fsExtra.mkdir as any).mockResolvedValue(undefined);
      
      await fileSystem.mkdir('/new/directory');
      
      expect(fsExtra.mkdir).toHaveBeenCalledWith('/new/directory', undefined);
    });

    it('should create directory with recursive option', async () => {
      (fsExtra.mkdir as any).mockResolvedValue(undefined);
      
      await fileSystem.mkdir('/new/deep/directory', { recursive: true });
      
      expect(fsExtra.mkdir).toHaveBeenCalledWith('/new/deep/directory', { recursive: true });
    });

    it('should read directory contents', async () => {
      const files = ['file1.txt', 'file2.txt', 'subdir'];
      (fsExtra.readdir as any).mockResolvedValue(files);
      
      const result = await fileSystem.readdir('/directory');
      
      expect(result).toEqual(files);
      expect(fsExtra.readdir).toHaveBeenCalledWith('/directory');
    });

    it('should remove directory without recursive option', async () => {
      (fsExtra.rmdir as any).mockResolvedValue(undefined);
      
      await fileSystem.rmdir('/empty/directory');
      
      expect(fsExtra.rmdir).toHaveBeenCalledWith('/empty/directory');
    });

    it('should remove directory recursively using remove', async () => {
      (fsExtra.remove as any).mockResolvedValue(undefined);
      
      await fileSystem.rmdir('/directory/with/contents', { recursive: true });
      
      expect(fsExtra.remove).toHaveBeenCalledWith('/directory/with/contents');
      expect(fsExtra.rmdir).not.toHaveBeenCalled();
    });
  });

  describe('file operations', () => {
    it('should get file stats', async () => {
      const stats = {
        isFile: () => true,
        isDirectory: () => false,
        size: 1024,
        mtime: new Date()
      };
      (fsExtra.stat as any).mockResolvedValue(stats as any);
      
      const result = await fileSystem.stat('/path/to/file');
      
      expect(result).toBe(stats);
      expect(fsExtra.stat).toHaveBeenCalledWith('/path/to/file');
    });

    it('should unlink file', async () => {
      (fsExtra.unlink as any).mockResolvedValue(undefined);
      
      await fileSystem.unlink('/path/to/file');
      
      expect(fsExtra.unlink).toHaveBeenCalledWith('/path/to/file');
    });
  });

  describe('ensureDirSync', () => {
    it('should ensure directory exists synchronously', () => {
      (fsExtra.ensureDirSync as any).mockReturnValue(undefined);
      
      fileSystem.ensureDirSync('/sync/directory');
      
      expect(fsExtra.ensureDirSync).toHaveBeenCalledWith('/sync/directory');
    });

    it('should handle sync errors', () => {
      (fsExtra.ensureDirSync as any).mockImplementation(() => {
        throw new Error('Sync error');
      });
      
      expect(() => fileSystem.ensureDirSync('/error/path')).toThrow('Sync error');
    });
  });
});

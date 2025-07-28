/**
 * Unit tests for line reader utility
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { LineReader, createLineReader } from '../../../src/utils/line-reader.js';
import { IFileSystem } from '../../../src/interfaces/external-dependencies.js';
import { Stats } from 'fs';

// Mock file system
const createMockFileSystem = (): IFileSystem => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  exists: vi.fn(),
  mkdir: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
  unlink: vi.fn(),
  rmdir: vi.fn(),
  ensureDir: vi.fn(),
  ensureDirSync: vi.fn(),
  pathExists: vi.fn(),
  existsSync: vi.fn(),
  remove: vi.fn(),
  copy: vi.fn(),
  outputFile: vi.fn()
});

describe('LineReader', () => {
  let fileSystem: IFileSystem;
  let lineReader: LineReader;
  let mockLogger: { debug: (msg: string, meta?: unknown) => void };

  beforeEach(() => {
    fileSystem = createMockFileSystem();
    mockLogger = { debug: vi.fn() };
    lineReader = createLineReader(fileSystem, mockLogger);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getLineContext', () => {
    it('should return line context for valid file and line number', async () => {
      const fileContent = `def hello():
    print("Hello")
    return True

def world():
    print("World")
    return False`;
      
      vi.mocked(fileSystem.stat).mockResolvedValue({
        size: fileContent.length,
        isSymbolicLink: () => false
      } as Stats);
      
      vi.mocked(fileSystem.readFile).mockResolvedValue(fileContent);

      const result = await lineReader.getLineContext('/test/file.py', 2, { contextLines: 1 });

      expect(result).toBeTruthy();
      expect(result?.lineContent).toBe('    print("Hello")');
      expect(result?.surrounding).toHaveLength(3); // line 1, 2, 3
      expect(result?.surrounding[0]).toEqual({ line: 1, content: 'def hello():' });
      expect(result?.surrounding[1]).toEqual({ line: 2, content: '    print("Hello")' });
      expect(result?.surrounding[2]).toEqual({ line: 3, content: '    return True' });
    });

    it('should handle edge case at start of file', async () => {
      const fileContent = `First line
Second line
Third line`;
      
      vi.mocked(fileSystem.stat).mockResolvedValue({
        size: fileContent.length,
        isSymbolicLink: () => false
      } as Stats);
      
      vi.mocked(fileSystem.readFile).mockResolvedValue(fileContent);

      const result = await lineReader.getLineContext('/test/file.txt', 1, { contextLines: 2 });

      expect(result).toBeTruthy();
      expect(result?.lineContent).toBe('First line');
      expect(result?.surrounding).toHaveLength(3); // lines 1, 2, 3
    });

    it('should handle edge case at end of file', async () => {
      const fileContent = `Line 1
Line 2
Line 3`;
      
      vi.mocked(fileSystem.stat).mockResolvedValue({
        size: fileContent.length,
        isSymbolicLink: () => false
      } as Stats);
      
      vi.mocked(fileSystem.readFile).mockResolvedValue(fileContent);

      const result = await lineReader.getLineContext('/test/file.txt', 3, { contextLines: 2 });

      expect(result).toBeTruthy();
      expect(result?.lineContent).toBe('Line 3');
      expect(result?.surrounding).toHaveLength(3); // lines 1, 2, 3
    });

    it('should return null for line number out of range', async () => {
      const fileContent = `Line 1
Line 2`;
      
      vi.mocked(fileSystem.stat).mockResolvedValue({
        size: fileContent.length,
        isSymbolicLink: () => false
      } as Stats);
      
      vi.mocked(fileSystem.readFile).mockResolvedValue(fileContent);

      const result = await lineReader.getLineContext('/test/file.txt', 5, { contextLines: 1 });

      expect(result).toBeNull();
    });

    it('should return null for binary files', async () => {
      const binaryContent = 'Some text\0with null bytes\0';
      
      vi.mocked(fileSystem.stat).mockResolvedValue({
        size: binaryContent.length,
        isSymbolicLink: () => false
      } as Stats);
      
      vi.mocked(fileSystem.readFile).mockResolvedValue(binaryContent);

      const result = await lineReader.getLineContext('/test/binary.bin', 1);

      expect(result).toBeNull();
    });

    it('should return null for files exceeding max size', async () => {
      vi.mocked(fileSystem.stat).mockResolvedValue({
        size: 11 * 1024 * 1024, // 11MB
        isSymbolicLink: () => false
      } as Stats);

      const result = await lineReader.getLineContext('/test/large.txt', 1);

      expect(result).toBeNull();
      expect(fileSystem.readFile).not.toHaveBeenCalled();
    });

    it('should use cache for repeated reads', async () => {
      const fileContent = `Line 1
Line 2
Line 3`;
      
      vi.mocked(fileSystem.stat).mockResolvedValue({
        size: fileContent.length,
        isSymbolicLink: () => false
      } as Stats);
      
      vi.mocked(fileSystem.readFile).mockResolvedValue(fileContent);

      // First read
      const result1 = await lineReader.getLineContext('/test/file.txt', 1);
      expect(result1).toBeTruthy();
      expect(fileSystem.readFile).toHaveBeenCalledTimes(1);

      // Second read should use cache
      const result2 = await lineReader.getLineContext('/test/file.txt', 2);
      expect(result2).toBeTruthy();
      expect(fileSystem.readFile).toHaveBeenCalledTimes(1); // Still only called once
    });

    it('should handle empty files gracefully', async () => {
      vi.mocked(fileSystem.stat).mockResolvedValue({
        size: 0,
        isSymbolicLink: () => false
      } as Stats);
      
      vi.mocked(fileSystem.readFile).mockResolvedValue('');

      const result = await lineReader.getLineContext('/test/empty.txt', 1);

      expect(result).toBeNull();
    });

    it('should handle Windows line endings correctly', async () => {
      const fileContent = 'Line 1\r\nLine 2\r\nLine 3';
      
      vi.mocked(fileSystem.stat).mockResolvedValue({
        size: fileContent.length,
        isSymbolicLink: () => false
      } as Stats);
      
      vi.mocked(fileSystem.readFile).mockResolvedValue(fileContent);

      const result = await lineReader.getLineContext('/test/windows.txt', 2);

      expect(result).toBeTruthy();
      expect(result?.lineContent).toBe('Line 2');
      expect(result?.surrounding[1].content).toBe('Line 2');
    });
  });

  describe('getMultiLineContext', () => {
    it('should return multiple lines within range', async () => {
      const fileContent = `Line 1
Line 2
Line 3
Line 4
Line 5`;
      
      vi.mocked(fileSystem.stat).mockResolvedValue({
        size: fileContent.length,
        isSymbolicLink: () => false
      } as Stats);
      
      vi.mocked(fileSystem.readFile).mockResolvedValue(fileContent);

      const result = await lineReader.getMultiLineContext('/test/file.txt', 2, 4);

      expect(result).toEqual(['Line 2', 'Line 3', 'Line 4']);
    });

    it('should handle out of range gracefully', async () => {
      const fileContent = `Line 1
Line 2`;
      
      vi.mocked(fileSystem.stat).mockResolvedValue({
        size: fileContent.length,
        isSymbolicLink: () => false
      } as Stats);
      
      vi.mocked(fileSystem.readFile).mockResolvedValue(fileContent);

      const result = await lineReader.getMultiLineContext('/test/file.txt', 1, 5);

      expect(result).toEqual(['Line 1', 'Line 2']);
    });
  });

  describe('cache management', () => {
    it('should clear cache when requested', async () => {
      const fileContent = 'Test content';
      
      vi.mocked(fileSystem.stat).mockResolvedValue({
        size: fileContent.length,
        isSymbolicLink: () => false
      } as Stats);
      
      vi.mocked(fileSystem.readFile).mockResolvedValue(fileContent);

      // First read
      await lineReader.getLineContext('/test/file.txt', 1);
      expect(fileSystem.readFile).toHaveBeenCalledTimes(1);

      // Clear cache
      lineReader.clearCache();

      // Next read should hit file system again
      await lineReader.getLineContext('/test/file.txt', 1);
      expect(fileSystem.readFile).toHaveBeenCalledTimes(2);
    });

    it('should provide cache statistics', () => {
      const stats = lineReader.getCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('itemCount');
      expect(stats.size).toBe(0);
      expect(stats.itemCount).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle file read errors gracefully', async () => {
      vi.mocked(fileSystem.stat).mockRejectedValue(new Error('File not found'));

      const result = await lineReader.getLineContext('/test/missing.txt', 1);

      expect(result).toBeNull();
    });

    it('should handle stat errors during binary check', async () => {
      vi.mocked(fileSystem.stat).mockResolvedValueOnce({
        size: 100,
        isSymbolicLink: () => false
      } as Stats);
      
      vi.mocked(fileSystem.readFile).mockResolvedValueOnce('Normal text content');
      vi.mocked(fileSystem.stat).mockRejectedValueOnce(new Error('Stat error'));

      const result = await lineReader.getLineContext('/test/file.txt', 1);

      expect(result).toBeTruthy();
      expect(result?.lineContent).toBe('Normal text content');
    });
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import {
  findJavaExecutable,
  getJavaVersion,
  getJavaSearchPaths
} from '@debugmcp/adapter-java';

vi.mock('child_process', async (importOriginal: any) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    spawn: vi.fn()
  };
});

const mockSpawn = vi.mocked(spawn);

describe('java-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe('findJavaExecutable', () => {
    it('should return preferred path when it validates', async () => {
      mockSpawn.mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => {
          proc.stderr.emit('data', Buffer.from('openjdk version "17.0.1"\n'));
          proc.emit('exit', 0);
        });
        return proc;
      });

      const result = await findJavaExecutable('/custom/java');
      expect(result).toBe('/custom/java');
    });

    it('should throw when preferred path is invalid', async () => {
      mockSpawn.mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => proc.emit('error', new Error('ENOENT')));
        return proc;
      });

      await expect(findJavaExecutable('/nonexistent/java'))
        .rejects.toThrow('not valid');
    });

    it('should use JAVA_HOME when set', async () => {
      const originalJavaHome = process.env.JAVA_HOME;
      const testJdkPath = path.join(path.sep, 'test', 'jdk');
      process.env.JAVA_HOME = testJdkPath;

      mockSpawn.mockImplementation((_cmd) => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => {
          proc.stderr.emit('data', Buffer.from('openjdk version "17.0.1"\n'));
          proc.emit('exit', 0);
        });
        return proc;
      });

      try {
        const result = await findJavaExecutable();
        // Normalize both paths for comparison (handles / vs \ on different platforms)
        expect(result.split(path.sep).join('/')).toContain('test/jdk');
      } finally {
        if (originalJavaHome) {
          process.env.JAVA_HOME = originalJavaHome;
        } else {
          delete process.env.JAVA_HOME;
        }
      }
    });

    it('should fall back to PATH java', async () => {
      const originalJavaHome = process.env.JAVA_HOME;
      delete process.env.JAVA_HOME;

      let callCount = 0;
      mockSpawn.mockImplementation((cmd) => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => {
          callCount++;
          if (cmd === 'java') {
            proc.stderr.emit('data', Buffer.from('openjdk version "17.0.1"\n'));
            proc.emit('exit', 0);
          } else {
            proc.emit('error', new Error('ENOENT'));
          }
        });
        return proc;
      });

      try {
        const result = await findJavaExecutable();
        expect(result).toBe('java');
      } finally {
        if (originalJavaHome) process.env.JAVA_HOME = originalJavaHome;
      }
    });

    it('should throw when java not found anywhere', async () => {
      const originalJavaHome = process.env.JAVA_HOME;
      delete process.env.JAVA_HOME;

      mockSpawn.mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => proc.emit('error', new Error('ENOENT')));
        return proc;
      });

      try {
        await expect(findJavaExecutable()).rejects.toThrow('Java not found');
      } finally {
        if (originalJavaHome) process.env.JAVA_HOME = originalJavaHome;
      }
    });
  });

  describe('getJavaVersion', () => {
    it('should parse standard version string from stderr', async () => {
      mockSpawn.mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => {
          proc.stderr.emit('data', Buffer.from('openjdk version "17.0.1" 2021-10-19\nOpenJDK Runtime Environment\n'));
          proc.emit('exit', 0);
        });
        return proc;
      });

      const version = await getJavaVersion('java');
      expect(version).toBe('17.0.1');
    });

    it('should parse legacy version format', async () => {
      mockSpawn.mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => {
          proc.stderr.emit('data', Buffer.from('java version "1.8.0_301"\n'));
          proc.emit('exit', 0);
        });
        return proc;
      });

      const version = await getJavaVersion('java');
      expect(version).toBe('1.8.0_301');
    });

    it('should return null on spawn error', async () => {
      mockSpawn.mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => proc.emit('error', new Error('spawn failed')));
        return proc;
      });

      const version = await getJavaVersion('java');
      expect(version).toBeNull();
    });

    it('should return null on non-zero exit code', async () => {
      mockSpawn.mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => proc.emit('exit', 1));
        return proc;
      });

      const version = await getJavaVersion('java');
      expect(version).toBeNull();
    });
  });

  describe('getJavaSearchPaths', () => {
    it('should return platform-specific paths', () => {
      const paths = getJavaSearchPaths();
      expect(Array.isArray(paths)).toBe(true);
      expect(paths.length).toBeGreaterThan(0);
    });

    it('should include JAVA_HOME/bin when set', () => {
      const originalJavaHome = process.env.JAVA_HOME;
      const customJdkPath = path.join(path.sep, 'custom', 'jdk');
      process.env.JAVA_HOME = customJdkPath;

      try {
        const paths = getJavaSearchPaths();
        // Normalize path for comparison (handles / vs \ on different platforms)
        expect(paths[0].split(path.sep).join('/')).toContain('custom/jdk/bin');
      } finally {
        if (originalJavaHome) {
          process.env.JAVA_HOME = originalJavaHome;
        } else {
          delete process.env.JAVA_HOME;
        }
      }
    });

    it('should include PATH entries', () => {
      const paths = getJavaSearchPaths();
      // PATH entries are always appended
      if (process.env.PATH) {
        // Use platform-appropriate PATH separator (: on Unix, ; on Windows)
        const pathSeparator = process.platform === 'win32' ? ';' : ':';
        const pathEntries = process.env.PATH.split(pathSeparator);
        // At least some PATH entries should be in the search paths
        expect(paths.some(p => pathEntries.includes(p))).toBe(true);
      }
    });
  });
});

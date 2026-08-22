import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import {
  findJavaExecutable,
  findJavacExecutable,
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
      const testJdkPath = path.join(path.sep, 'test', 'jdk');
      vi.stubEnv('JAVA_HOME', testJdkPath);

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

      const result = await findJavaExecutable();
      // Normalize both paths for comparison (handles / vs \ on different platforms)
      expect(result.split(path.sep).join('/')).toContain('test/jdk');
    });

    it('should fall back to PATH java', async () => {
      vi.stubEnv('JAVA_HOME', undefined);

      mockSpawn.mockImplementation((cmd) => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => {
          if (cmd === 'java') {
            proc.stderr.emit('data', Buffer.from('openjdk version "17.0.1"\n'));
            proc.emit('exit', 0);
          } else {
            proc.emit('error', new Error('ENOENT'));
          }
        });
        return proc;
      });

      const result = await findJavaExecutable();
      expect(result).toBe('java');
    });

    it('should throw when java not found anywhere', async () => {
      vi.stubEnv('JAVA_HOME', undefined);

      mockSpawn.mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => proc.emit('error', new Error('ENOENT')));
        return proc;
      });

      await expect(findJavaExecutable()).rejects.toThrow('Java not found');
    });
  });

  describe('findJavacExecutable (issue #423)', () => {
    const ext = process.platform === 'win32' ? '.exe' : '';

    const validatingSpawn = (validPaths: string[]) => {
      mockSpawn.mockImplementation(((cmd: string) => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => {
          if (validPaths.includes(cmd)) {
            proc.stdout.emit('data', Buffer.from('javac 21.0.6\n'));
            proc.emit('exit', 0);
          } else {
            proc.emit('error', new Error('ENOENT'));
          }
        });
        return proc;
      }) as any);
    };

    it('returns the javac sibling of a resolved java path', async () => {
      const javaPath = path.join(path.sep, 'jdk', 'bin', `java${ext}`);
      const javacPath = path.join(path.sep, 'jdk', 'bin', `javac${ext}`);
      validatingSpawn([javacPath]);

      await expect(findJavacExecutable(javaPath)).resolves.toBe(javacPath);
    });

    it('falls back to JAVA_HOME/bin/javac when the sibling does not validate', async () => {
      const home = path.join(path.sep, 'opt', 'jdk21');
      vi.stubEnv('JAVA_HOME', home);
      const javacHome = path.join(home, 'bin', `javac${ext}`);
      validatingSpawn([javacHome]);

      await expect(findJavacExecutable(path.join(path.sep, 'elsewhere', 'java'))).resolves.toBe(javacHome);
    });

    it('falls back to bare javac on PATH', async () => {
      vi.stubEnv('JAVA_HOME', '');
      validatingSpawn(['javac']);

      await expect(findJavacExecutable()).resolves.toBe('javac');
    });

    it('returns null when no javac validates anywhere', async () => {
      vi.stubEnv('JAVA_HOME', '');
      validatingSpawn([]);

      await expect(findJavacExecutable(path.join(path.sep, 'jdk', 'bin', 'java'))).resolves.toBeNull();
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
      const customJdkPath = path.join(path.sep, 'custom', 'jdk');
      vi.stubEnv('JAVA_HOME', customJdkPath);

      const paths = getJavaSearchPaths();
      // Normalize path for comparison (handles / vs \ on different platforms)
      expect(paths[0].split(path.sep).join('/')).toContain('custom/jdk/bin');
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

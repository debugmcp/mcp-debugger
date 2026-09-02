import { describe, it, expect, beforeEach, vi } from 'vitest';
import path from 'path';

// Mock fs module
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    statSync: vi.fn()
  };
});

// Mock child_process module
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    execSync: vi.fn(),
    execFileSync: vi.fn()
  };
});

import { existsSync, mkdirSync, statSync } from 'fs';
import { execFileSync } from 'child_process';
import { resolveJdiBridgeClassDir, ensureJdiBridgeCompiled, ensureJdiBridge, isJdiBridgeStale } from '@debugmcp/adapter-java';

const mockExistsSync = vi.mocked(existsSync);
const mockMkdirSync = vi.mocked(mkdirSync);
const mockStatSync = vi.mocked(statSync);
const mockExecFileSync = vi.mocked(execFileSync);

/** Make both the source and the class exist, with the given mtimes (ms). */
function bridgeOnDisk(opts: { sourceMtime: number; classMtime: number; javac?: boolean }): void {
  mockExistsSync.mockImplementation((p: any) => {
    const pathStr = p.toString();
    if (pathStr.includes('JdiDapServer.class')) return true;
    if (pathStr.includes('JdiDapServer.java')) return true;
    if (pathStr.includes('javac')) return opts.javac ?? true;
    return false;
  });
  mockStatSync.mockImplementation(((p: any) => {
    const pathStr = p.toString();
    if (pathStr.endsWith('JdiDapServer.java')) return { mtimeMs: opts.sourceMtime } as any;
    if (pathStr.endsWith('JdiDapServer.class')) return { mtimeMs: opts.classMtime } as any;
    throw new Error(`ENOENT: ${pathStr}`);
  }) as any);
}

describe('jdi-resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    // Default: nothing exists
    mockExistsSync.mockReturnValue(false);
    mockStatSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });
  });

  describe('resolveJdiBridgeClassDir', () => {
    it('should return JDI_BRIDGE_DIR when env var is set and class exists', () => {
      vi.stubEnv('JDI_BRIDGE_DIR', '/custom/jdi/bridge');
      mockExistsSync.mockImplementation((p: any) => {
        return p === path.join('/custom/jdi/bridge', 'JdiDapServer.class');
      });

      const result = resolveJdiBridgeClassDir();
      expect(result).toBe('/custom/jdi/bridge');
    });

    it('should skip JDI_BRIDGE_DIR when class does not exist there', () => {
      vi.stubEnv('JDI_BRIDGE_DIR', '/invalid/path');
      mockExistsSync.mockReturnValue(false);

      const result = resolveJdiBridgeClassDir();
      expect(result).toBeNull();
    });

    it('should search candidate paths when env var not set', () => {
      vi.stubEnv('JDI_BRIDGE_DIR', undefined);

      // Simulate class found in one of the candidate paths
      // Use path.join pattern to match platform-specific separators
      const expectedPattern = path.join('java', 'out', 'JdiDapServer.class');
      mockExistsSync.mockImplementation((p: any) => {
        return p.toString().includes(expectedPattern);
      });

      const result = resolveJdiBridgeClassDir();
      expect(result).not.toBeNull();
      expect(result).toContain('java');
      expect(result).toContain('out');
    });

    it('should return null when class not found in any path', () => {
      vi.stubEnv('JDI_BRIDGE_DIR', undefined);
      mockExistsSync.mockReturnValue(false);

      const result = resolveJdiBridgeClassDir();
      expect(result).toBeNull();
    });

    it('should handle exceptions in existsSync gracefully', () => {
      vi.stubEnv('JDI_BRIDGE_DIR', undefined);
      mockExistsSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = resolveJdiBridgeClassDir();
      expect(result).toBeNull();
    });
  });

  describe('ensureJdiBridgeCompiled', () => {
    it('should return existing path when already compiled', () => {
      // Simulate class already exists
      mockExistsSync.mockImplementation((p: any) => {
        return p.toString().includes('JdiDapServer.class');
      });

      const result = ensureJdiBridgeCompiled();
      expect(result).not.toBeNull();
      // Should not call compilation commands
      expect(mockExecFileSync).not.toHaveBeenCalled();
    });

    it('should return null when source not found', () => {
      // No class exists, no source exists
      mockExistsSync.mockReturnValue(false);

      const result = ensureJdiBridgeCompiled();
      expect(result).toBeNull();
    });

    it('should find javac from JAVA_HOME', () => {
      vi.stubEnv('JAVA_HOME', '/usr/lib/jvm/java-21');

      // Class doesn't exist, but source does, and JAVA_HOME javac exists
      mockExistsSync.mockImplementation((p: any) => {
        const pathStr = p.toString();
        if (pathStr.includes('JdiDapServer.class')) return false;
        if (pathStr.includes('JdiDapServer.java')) return true;
        if (pathStr.includes('javac')) return true;
        return false;
      });

      mockExecFileSync.mockReturnValue(Buffer.from(''));

      ensureJdiBridgeCompiled();

      // Should have called javac
      expect(mockMkdirSync).toHaveBeenCalled();
      expect(mockExecFileSync).toHaveBeenCalled();
    });

    it('should find javac from PATH using which', () => {
      vi.stubEnv('JAVA_HOME', undefined);

      // Class doesn't exist, source exists, JAVA_HOME javac doesn't exist
      mockExistsSync.mockImplementation((p: any) => {
        const pathStr = p.toString();
        if (pathStr.includes('JdiDapServer.class')) return false;
        if (pathStr.includes('JdiDapServer.java')) return true;
        return false;
      });

      // which/where javac returns a path; the compile call returns empty output
      mockExecFileSync.mockImplementation(((cmd: string) =>
        cmd === 'which' || cmd === 'where' ? '/usr/bin/javac\n' : Buffer.from('')) as any);

      ensureJdiBridgeCompiled();

      expect(mockExecFileSync).toHaveBeenCalledWith(
        expect.stringMatching(/^(which|where)$/),
        ['javac'],
        expect.objectContaining({ windowsHide: true })
      );
      expect(mockExecFileSync).toHaveBeenCalledWith(
        '/usr/bin/javac',
        expect.arrayContaining(['--release', '21']),
        expect.anything()
      );
    });

    it('should return null when javac not found', () => {
      vi.stubEnv('JAVA_HOME', undefined);

      // Source exists but javac not found
      mockExistsSync.mockImplementation((p: any) => {
        const pathStr = p.toString();
        if (pathStr.includes('JdiDapServer.java')) return true;
        return false;
      });

      // which/where javac fails
      mockExecFileSync.mockImplementation(() => {
        throw new Error('not found');
      });

      const result = ensureJdiBridgeCompiled();
      expect(result).toBeNull();
    });

    it('should return null when compilation fails', () => {
      vi.stubEnv('JAVA_HOME', '/usr/lib/jvm/java-21');

      mockExistsSync.mockImplementation((p: any) => {
        const pathStr = p.toString();
        if (pathStr.includes('JdiDapServer.class')) return false;
        if (pathStr.includes('JdiDapServer.java')) return true;
        if (pathStr.includes('javac')) return true;
        return false;
      });

      // Compilation fails
      mockExecFileSync.mockImplementation(() => {
        throw new Error('compilation error');
      });

      const result = ensureJdiBridgeCompiled();
      expect(result).toBeNull();
    });

    it('should compile with correct arguments', () => {
      vi.stubEnv('JAVA_HOME', '/usr/lib/jvm/java-21');

      mockExistsSync.mockImplementation((p: any) => {
        const pathStr = p.toString();
        if (pathStr.includes('JdiDapServer.class')) return false;
        if (pathStr.includes('JdiDapServer.java')) return true;
        if (pathStr.includes('javac')) return true;
        return false;
      });

      mockExecFileSync.mockReturnValue(Buffer.from(''));

      ensureJdiBridgeCompiled();

      // Verify javac was called with correct arguments
      expect(mockExecFileSync).toHaveBeenCalledWith(
        expect.stringContaining('javac'),
        expect.arrayContaining(['--release', '21']),
        expect.any(Object)
      );
    });
  });

  describe('staleness (issue #646)', () => {
    it('a fresh class (class newer than source) is used without compiling', () => {
      vi.stubEnv('JAVA_HOME', '/usr/lib/jvm/java-21');
      bridgeOnDisk({ sourceMtime: 1000, classMtime: 2000 });

      const status = ensureJdiBridge();

      expect(status.dir).toContain(path.join('java', 'out'));
      expect(status).toMatchObject({ stale: false, recompiled: false });
      expect(status.error).toBeUndefined();
      expect(mockExecFileSync).not.toHaveBeenCalled();
      expect(isJdiBridgeStale()).toBe(false);
    });

    it('a stale class (source newer) is recompiled into <source>/out', () => {
      vi.stubEnv('JAVA_HOME', '/usr/lib/jvm/java-21');
      bridgeOnDisk({ sourceMtime: 3000, classMtime: 2000 });
      mockExecFileSync.mockReturnValue(Buffer.from(''));

      expect(isJdiBridgeStale()).toBe(true);
      const status = ensureJdiBridge();

      expect(status).toMatchObject({ stale: false, recompiled: true });
      expect(status.dir).toContain(path.join('java', 'out'));
      expect(status.sourceFile).toContain('JdiDapServer.java');
      expect(mockMkdirSync).toHaveBeenCalled();
      expect(mockExecFileSync).toHaveBeenCalledWith(
        expect.stringContaining('javac'),
        expect.arrayContaining(['--release', '21', '-d']),
        expect.objectContaining({ stdio: ['ignore', 'pipe', 'pipe'] })
      );
      // The path-only wrapper agrees
      expect(ensureJdiBridgeCompiled()).toBe(status.dir);
    });

    it('a stale class with no javac is returned as stale, with the reason', () => {
      vi.stubEnv('JAVA_HOME', undefined);
      bridgeOnDisk({ sourceMtime: 3000, classMtime: 2000, javac: false });
      mockExecFileSync.mockImplementation(() => {
        throw new Error('not found');
      });

      const status = ensureJdiBridge();

      expect(status.dir).toContain(path.join('java', 'out'));
      expect(status).toMatchObject({ stale: true, recompiled: false });
      expect(status.error).toMatch(/javac not found/);
      // Only the which/where probe ran — never a compile
      expect(mockExecFileSync).toHaveBeenCalledTimes(1);
      expect(mockExecFileSync).toHaveBeenCalledWith(expect.stringMatching(/^(which|where)$/), ['javac'], expect.anything());
      expect(ensureJdiBridgeCompiled()).toBe(status.dir);
    });

    it('a stale class whose recompile fails is returned as stale, carrying javac stderr', () => {
      vi.stubEnv('JAVA_HOME', '/usr/lib/jvm/java-21');
      bridgeOnDisk({ sourceMtime: 3000, classMtime: 2000 });
      mockExecFileSync.mockImplementation(() => {
        const err = new Error('Command failed: javac') as Error & { stderr: Buffer };
        err.stderr = Buffer.from('JdiDapServer.java:42: error: cannot find symbol\n  foo();\n');
        throw err;
      });

      const status = ensureJdiBridge();

      expect(status).toMatchObject({ stale: true, recompiled: false });
      expect(status.dir).toContain(path.join('java', 'out'));
      expect(status.error).toContain('javac failed: JdiDapServer.java:42: error: cannot find symbol');
    });

    it('JDI_BRIDGE_DIR is an explicit override: never stat-compared, never recompiled', () => {
      vi.stubEnv('JDI_BRIDGE_DIR', '/custom/jdi/bridge');
      vi.stubEnv('JAVA_HOME', '/usr/lib/jvm/java-21');
      bridgeOnDisk({ sourceMtime: 3000, classMtime: 2000 });

      expect(isJdiBridgeStale()).toBe(false);
      const status = ensureJdiBridge();

      expect(status).toMatchObject({ dir: '/custom/jdi/bridge', stale: false, recompiled: false });
      expect(mockStatSync).not.toHaveBeenCalled();
      expect(mockExecFileSync).not.toHaveBeenCalled();
    });

    it('a class with no shipped source is never stale (stat failures mean "not stale")', () => {
      mockExistsSync.mockImplementation((p: any) => p.toString().includes('JdiDapServer.class'));

      expect(isJdiBridgeStale()).toBe(false);
      const status = ensureJdiBridge();
      expect(status).toMatchObject({ stale: false, recompiled: false, sourceFile: null });
      expect(status.dir).not.toBeNull();
      expect(mockExecFileSync).not.toHaveBeenCalled();
    });

    it('isJdiBridgeStale is false when no class exists at all', () => {
      mockExistsSync.mockImplementation((p: any) => p.toString().includes('JdiDapServer.java'));
      expect(isJdiBridgeStale()).toBe(false);
    });
  });
});

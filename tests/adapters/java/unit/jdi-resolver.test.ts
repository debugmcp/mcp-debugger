import { describe, it, expect, beforeEach, vi } from 'vitest';
import path from 'path';

// Mock fs module
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    existsSync: vi.fn(),
    mkdirSync: vi.fn()
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

import { existsSync, mkdirSync } from 'fs';
import { execSync, execFileSync } from 'child_process';
import { resolveJdiBridgeClassDir, ensureJdiBridgeCompiled } from '@debugmcp/adapter-java';

const mockExistsSync = vi.mocked(existsSync);
const mockMkdirSync = vi.mocked(mkdirSync);
const mockExecSync = vi.mocked(execSync);
const mockExecFileSync = vi.mocked(execFileSync);

describe('jdi-resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: nothing exists
    mockExistsSync.mockReturnValue(false);
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

      // which javac returns a path
      mockExecSync.mockReturnValue('/usr/bin/javac\n');
      mockExecFileSync.mockReturnValue(Buffer.from(''));

      ensureJdiBridgeCompiled();

      expect(mockExecSync).toHaveBeenCalled();
      expect(mockExecFileSync).toHaveBeenCalled();
    });

    it('should return null when javac not found', () => {
      vi.stubEnv('JAVA_HOME', undefined);

      // Source exists but javac not found
      mockExistsSync.mockImplementation((p: any) => {
        const pathStr = p.toString();
        if (pathStr.includes('JdiDapServer.java')) return true;
        return false;
      });

      // which javac fails
      mockExecSync.mockImplementation(() => {
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
});

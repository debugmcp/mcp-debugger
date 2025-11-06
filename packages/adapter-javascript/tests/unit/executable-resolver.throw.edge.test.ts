import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { FileSystem, NodeFileSystem } from '@debugmcp/shared';
import { whichInPath, findNode, isWindows, setDefaultFileSystem } from '../../src/utils/executable-resolver.js';

/**
 * Mock implementation of FileSystem for testing
 */
class MockFileSystem implements FileSystem {
  private existsMock: ((path: string) => boolean) | null = null;
  private readFileMock: ((path: string, encoding: string) => string) | null = null;

  setExistsMock(mock: (path: string) => boolean): void {
    this.existsMock = mock;
  }

  setReadFileMock(mock: (path: string, encoding: string) => string): void {
    this.readFileMock = mock;
  }

  existsSync(path: string): boolean {
    if (this.existsMock) {
      return this.existsMock(path);
    }
    return false;
  }

  readFileSync(path: string, encoding: string): string {
    if (this.readFileMock) {
      return this.readFileMock(path, encoding);
    }
    return '';
  }
}

const WIN = isWindows();

function withPath(paths: string[]) {
  const prev = process.env.PATH;
  process.env.PATH = paths.join(path.delimiter);
  return () => {
    process.env.PATH = prev;
  };
}

describe('utils/executable-resolver: throw/edge coverage', () => {
  let restoreEnv: (() => void) | null = null;
  let mockFileSystem: MockFileSystem;

  beforeEach(() => {
    restoreEnv = null;
    mockFileSystem = new MockFileSystem();
    // Set mock as default
    setDefaultFileSystem(mockFileSystem);
  });

  afterEach(() => {
    if (restoreEnv) {
      restoreEnv();
      restoreEnv = null;
    }
    // Reset to a new NodeFileSystem for other tests
    setDefaultFileSystem(new NodeFileSystem());
  });

  it('whichInPath: empty PATH returns undefined', () => {
    restoreEnv = withPath([]);
    const found = whichInPath(WIN ? ['node.exe', 'node'] : ['node'], mockFileSystem);
    expect(found).toBeUndefined();
  });

  it('whichInPath: first candidate throws, second resolves (dir-first then name order continues after catch)', () => {
    if (!WIN) {
      // On POSIX, test with two different directories instead
      const dir1 = path.resolve(process.cwd(), '.bin-throw1');
      const dir2 = path.resolve(process.cwd(), '.bin-throw2');
      restoreEnv = withPath([dir1, dir2]);

      const first = path.join(dir1, 'node');
      const second = path.join(dir2, 'node');

      mockFileSystem.setExistsMock((p: string) => {
        if (p === first) {
          throw new Error('fs error');
        }
        return p === second;
      });

      const found = whichInPath(['node'], mockFileSystem);
      expect(found).toBe(path.resolve(second));
    } else {
      // On Windows, test with different extensions in same dir
      const dir = path.resolve(process.cwd(), '.bin-throw');
      restoreEnv = withPath([dir]);

      const first = path.join(dir, 'node.exe');
      const second = path.join(dir, 'node');

      mockFileSystem.setExistsMock((p: string) => {
        if (p === first) {
          throw new Error('fs error');
        }
        return p === second;
      });

      const found = whichInPath(['node.exe', 'node'], mockFileSystem);
      expect(found).toBe(path.resolve(second));
    }
  });

  it('findNode: execPath check throws, PATH empty -> deterministic fallback to resolved process.execPath', async () => {
    restoreEnv = withPath([]);
    mockFileSystem.setExistsMock((p: string) => {
      if (p === process.execPath) {
        throw new Error('fs error'); // simulate permission or transient fs error
      }
      return false;
    });

    const resolved = await findNode(undefined, mockFileSystem);
    expect(resolved).toBe(path.resolve(process.execPath));
  });

  it('findNode: execPath missing, PATH first candidate throws, second exists -> returns second', async () => {
    if (!WIN) {
      // On POSIX, use two different directories
      const dir1 = path.resolve(process.cwd(), '.bin-throw-a');
      const dir2 = path.resolve(process.cwd(), '.bin-throw-b');
      restoreEnv = withPath([dir1, dir2]);

      const cand1 = path.join(dir1, 'node');
      const cand2 = path.join(dir2, 'node');

      mockFileSystem.setExistsMock((p: string) => {
        if (p === process.execPath) return false; // skip execPath
        if (p === cand1) throw new Error('fs error cand1');
        if (p === cand2) return true;
        return false;
      });

      const resolved = await findNode(undefined, mockFileSystem);
      expect(resolved).toBe(path.resolve(cand2));
    } else {
      // On Windows, use different extensions in same directory
      const dir = path.resolve(process.cwd(), '.bin-throw2');
      restoreEnv = withPath([dir]);

      const cand1 = path.join(dir, 'node.exe');
      const cand2 = path.join(dir, 'node');

      mockFileSystem.setExistsMock((p: string) => {
        if (p === process.execPath) return false; // skip execPath
        if (p === cand1) throw new Error('fs error cand1');
        if (p === cand2) return true;
        return false;
      });

      const resolved = await findNode(undefined, mockFileSystem);
      expect(resolved).toBe(path.resolve(cand2));
    }
  });
});

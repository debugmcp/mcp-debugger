import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import { FileSystem, NodeFileSystem } from '@debugmcp/shared';
import { findNode, whichInPath, isWindows, setDefaultFileSystem } from '../../src/utils/executable-resolver.js';

const WIN = isWindows();

/**
 * Mock implementation of FileSystem for testing
 */
class MockFileSystem implements FileSystem {
  private existsMock: ((path: string) => boolean) | null = null;

  setExistsMock(mock: (path: string) => boolean): void {
    this.existsMock = mock;
  }

  existsSync(path: string): boolean {
    if (this.existsMock) {
      return this.existsMock(path);
    }
    return false;
  }
}

function withPath(paths: string[]) {
  const orig = process.env.PATH;
  process.env.PATH = paths.join(path.delimiter);
  return () => {
    process.env.PATH = orig;
  };
}

describe('utils/executable-resolver: findNode and whichInPath', () => {
  let restoreEnv: (() => void) | null = null;
  let mockFileSystem: MockFileSystem;

  beforeEach(() => {
    restoreEnv = null;
    mockFileSystem = new MockFileSystem();
    // Set mock as default
    setDefaultFileSystem(mockFileSystem);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (restoreEnv) {
      restoreEnv();
      restoreEnv = null;
    }
    // Reset to a new NodeFileSystem for other tests
    setDefaultFileSystem(new NodeFileSystem());
  });

  it('findNode returns process.execPath when preferredPath not set and execPath exists', async () => {
    mockFileSystem.setExistsMock((p: string) => p === process.execPath);

    const resolved = await findNode();
    expect(resolved).toBe(path.resolve(process.execPath));
  });

  it('preferredPath takes precedence when it exists', async () => {
    const preferred = path.resolve('tmp', WIN ? 'node.exe' : 'node');
    mockFileSystem.setExistsMock((p: string) => p === preferred);

    const resolved = await findNode(preferred);
    expect(resolved).toBe(preferred);
  });

  it('PATH fallback: returns first match when execPath is bypassed', async () => {
    const binDir = path.resolve(process.cwd(), '.tmp_bin');
    const candidate = WIN ? path.join(binDir, 'node.exe') : path.join(binDir, 'node');

    // PATH includes binDir first
    restoreEnv = withPath([binDir, path.resolve(process.cwd(), '.other_bin')]);

    mockFileSystem.setExistsMock((p: string) => {
      if (p === process.execPath) {
        return false; // bypass execPath branch
      }
      return p === candidate;
    });

    const resolved = await findNode();
    expect(resolved).toBe(path.resolve(candidate));
  });

  it('whichInPath returns first existing match with dir-first precedence', () => {
    const dirA = path.resolve(process.cwd(), 'A');
    const dirB = path.resolve(process.cwd(), 'B');
    restoreEnv = withPath([dirA, dirB]);

    const names = ['nodeA', 'nodeB']; // candidate order is preserved per dir

    const target1 = path.join(dirB, 'nodeA'); // exists in later dir
    const target2 = path.join(dirA, 'nodeB'); // exists in earlier dir but second name

    mockFileSystem.setExistsMock((p: string) => {
      // Simulate only these two files exist
      return p === target1 || p === target2;
    });

    const found = whichInPath(names);
    // Expect dir-first then name order: should find dirA/nodeB before dirB/nodeA
    expect(found).toBe(path.resolve(target2));
  });

  it('negative: when execPath and PATH matches are "missing", findNode still returns process.execPath deterministically', async () => {
    restoreEnv = withPath([]); // empty PATH
    mockFileSystem.setExistsMock(() => false);

    const resolved = await findNode();
    // returns absolute process.execPath even if not verified
    expect(resolved).toBe(path.resolve(process.execPath));
  });
});

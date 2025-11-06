import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import { FileSystem, NodeFileSystem } from '@debugmcp/shared';
import { whichInPath, findNode, isWindows, setDefaultFileSystem } from '../../src/utils/executable-resolver.js';

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

const WIN = isWindows();

function withPath(paths: string[]) {
  const prev = process.env.PATH;
  process.env.PATH = paths.join(path.delimiter);
  return () => {
    process.env.PATH = prev;
  };
}

describe('utils/executable-resolver.edge', () => {
  let restoreEnv: (() => void) | null = null;
  let mockFileSystem: MockFileSystem;

  beforeEach(() => {
    restoreEnv = null;
    mockFileSystem = new MockFileSystem();
    setDefaultFileSystem(mockFileSystem);
  });

  afterEach(() => {
    if (restoreEnv) {
      restoreEnv();
      restoreEnv = null;
    }
    vi.restoreAllMocks();
    setDefaultFileSystem(new NodeFileSystem());
  });

  it('Windows: whichInPath prefers node.exe over node when both present in same dir (name order), POSIX: prefers node', () => {
    const dir = path.resolve(process.cwd(), '.bin-pref');
    restoreEnv = withPath([dir]);

    const nodeExe = path.join(dir, 'node.exe');
    const nodeBare = path.join(dir, 'node');

    mockFileSystem.setExistsMock((p: string) => {
      return p === nodeExe || p === nodeBare;
    });

    const names = WIN ? ['node.exe', 'node'] : ['node'];

    const found = whichInPath(names);
    if (WIN) {
      expect(found).toBe(path.resolve(nodeExe));
    } else {
      expect(found).toBe(path.resolve(nodeBare));
    }
  });

  it('Dir-first precedence across PATH; candidate ordering within each dir', () => {
    // PATH = A;B with names ['node.exe','node']
    const dirA = path.resolve(process.cwd(), 'A');
    const dirB = path.resolve(process.cwd(), 'B');
    restoreEnv = withPath([dirA, dirB]);

    const names = ['node.exe', 'node'];

    // In B we have node.exe; in A we only have node
    const aNode = path.join(dirA, 'node');
    const bNodeExe = path.join(dirB, 'node.exe');

    mockFileSystem.setExistsMock((p: string) => {
      return p === aNode || p === bNodeExe;
    });

    const found = whichInPath(names);
    // Contract: dir-first, then name order -> choose A/node before B/node.exe
    expect(found).toBe(path.resolve(aNode));
  });

  it('preferredPath relative but exists: findNode returns resolved absolute path', async () => {
    const rel = path.join('tmp', WIN ? 'node.exe' : 'node');
    // existsSync is checked against the raw preferred string
    mockFileSystem.setExistsMock((p: string) => p === rel);

    const resolved = await findNode(rel);
    expect(resolved).toBe(path.resolve(rel));
  });

  it('execPath non-existent but PATH candidate present -> returns PATH candidate; if none, deterministic fallback to process.execPath', async () => {
    const dir = path.resolve(process.cwd(), '.bin-path-candidate');
    restoreEnv = withPath([dir]);

    const candidate = WIN ? path.join(dir, 'node.exe') : path.join(dir, 'node');

    // First sub-case: PATH candidate present, execPath should be ignored if not existing
    mockFileSystem.setExistsMock((p: string) => {
      if (p === process.execPath) return false;
      return p === candidate;
    });
    const fromPath = await findNode();
    expect(fromPath).toBe(path.resolve(candidate));

    // Second sub-case: neither execPath nor PATH exist -> fallback to resolved execPath
    mockFileSystem.setExistsMock(() => false);
    const fallback = await findNode();
    expect(fallback).toBe(path.resolve(process.execPath));
  });
});

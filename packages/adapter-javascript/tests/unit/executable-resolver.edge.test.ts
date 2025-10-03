import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import type { PathLike } from 'fs';

// ESM-safe fs.existsSync delegate mock
let existsSyncMock: (p: PathLike) => boolean;
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  const existsDelegate: typeof actual.existsSync = (p: PathLike) =>
    existsSyncMock ? existsSyncMock(p) : actual.existsSync(p);
  return {
    ...actual,
    existsSync: existsDelegate
  };
});

import { whichInPath, findNode, isWindows } from '../../src/utils/executable-resolver.js';

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

  beforeEach(() => {
    restoreEnv = null;
    existsSyncMock = () => false;
  });

  afterEach(() => {
    if (restoreEnv) {
      restoreEnv();
      restoreEnv = null;
    }
    vi.restoreAllMocks();
  });

  it('Windows: whichInPath prefers node.exe over node when both present in same dir (name order), POSIX: prefers node', () => {
    const dir = path.resolve(process.cwd(), '.bin-pref');
    restoreEnv = withPath([dir]);

    const nodeExe = path.join(dir, 'node.exe');
    const nodeBare = path.join(dir, 'node');

    existsSyncMock = (p: PathLike) => {
      const s = String(p);
      return s === nodeExe || s === nodeBare;
    };

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

    existsSyncMock = (p: PathLike) => {
      const s = String(p);
      return s === aNode || s === bNodeExe;
    };

    const found = whichInPath(names);
    // Contract: dir-first, then name order -> choose A/node before B/node.exe
    expect(found).toBe(path.resolve(aNode));
  });

  it('preferredPath relative but exists: findNode returns resolved absolute path', async () => {
    const rel = path.join('tmp', WIN ? 'node.exe' : 'node');
    // existsSync is checked against the raw preferred string
    existsSyncMock = (p: PathLike) => String(p) === rel;

    const resolved = await findNode(rel);
    expect(resolved).toBe(path.resolve(rel));
  });

  it('execPath non-existent but PATH candidate present -> returns PATH candidate; if none, deterministic fallback to process.execPath', async () => {
    const dir = path.resolve(process.cwd(), '.bin-path-candidate');
    restoreEnv = withPath([dir]);

    const candidate = WIN ? path.join(dir, 'node.exe') : path.join(dir, 'node');

    // First sub-case: PATH candidate present, execPath should be ignored if not existing
    existsSyncMock = (p: PathLike) => {
      const s = String(p);
      if (s === process.execPath) return false;
      return s === candidate;
    };
    const fromPath = await findNode();
    expect(fromPath).toBe(path.resolve(candidate));

    // Second sub-case: neither execPath nor PATH exist -> fallback to resolved execPath
    existsSyncMock = () => false;
    const fallback = await findNode();
    expect(fallback).toBe(path.resolve(process.execPath));
  });
});

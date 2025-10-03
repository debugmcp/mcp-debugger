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

import { detectBinary } from '../../src/utils/typescript-detector.js';
import { isWindows } from '../../src/utils/executable-resolver.js';

const WIN = isWindows();

function withPath(paths: string[]) {
  const prev = process.env.PATH;
  process.env.PATH = paths.join(path.delimiter);
  return () => {
    process.env.PATH = prev;
  };
}

describe('utils/typescript-detector.edge: detectBinary ordering and PATH precedence', () => {
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

  it('Windows: local-first suffix ordering within a single dir: .cmd > .exe > bare', () => {
    if (!WIN) {
      // Not applicable on POSIX; ensure detectBinary returns undefined since nothing exists
      const found = detectBinary('tsx', path.resolve(process.cwd(), 'proj'));
      expect(found).toBeUndefined();
      return;
    }
    const cwd = path.resolve(process.cwd(), 'proj');
    const binDir = path.join(cwd, 'node_modules', '.bin');

    const cmd = path.join(binDir, 'tsx.cmd');
    const exe = path.join(binDir, 'tsx.exe');
    const bare = path.join(binDir, 'tsx');

    // Only .cmd and .exe exist; should pick .cmd
    existsSyncMock = (p: PathLike) => {
      const s = String(p);
      return s === cmd || s === exe; // bare absent
    };

    const found1 = detectBinary('tsx', cwd);
    expect(found1).toBe(path.resolve(cmd));

    // Now only .exe and bare exist; should pick .exe
    existsSyncMock = (p: PathLike) => {
      const s = String(p);
      return s === exe || s === bare;
    };
    const found2 = detectBinary('tsx', cwd);
    expect(found2).toBe(path.resolve(exe));
  });

  it('PATH precedence is dir-first across PATH entries, not name-first', () => {
    const A = path.resolve(process.cwd(), 'A');
    const B = path.resolve(process.cwd(), 'B');
    restoreEnv = withPath([A, B]);

    // For ts-node: In dir A we have bare; in dir B we have .cmd (Windows) or bare (POSIX).
    const aBare = path.join(A, 'ts-node');
    const bCmd = path.join(B, WIN ? 'ts-node.cmd' : 'ts-node');

    existsSyncMock = (p: PathLike) => {
      const s = String(p);
      // Local <cwd>/node_modules/.bin/* should be false for this test
      if (s.includes(path.join('node_modules', '.bin'))) return false;
      return s === aBare || s === bCmd;
    };

    const found = detectBinary('ts-node', path.resolve(process.cwd(), 'proj'));
    // Dir-first -> A wins even though .cmd might have higher suffix priority in B
    expect(found).toBe(path.resolve(aBare));
  });

  it('Windows PATH single dir with both .cmd and .exe prefers .cmd within same dir; POSIX prefers bare', () => {
    const D = path.resolve(process.cwd(), 'D');
    restoreEnv = withPath([D]);

    const cmd = path.join(D, 'tsx.cmd');
    const exe = path.join(D, 'tsx.exe');
    const bare = path.join(D, 'tsx');

    existsSyncMock = (p: PathLike) => {
      const s = String(p);
      return s === cmd || s === exe || s === bare;
    };

    const found = detectBinary('tsx', path.resolve(process.cwd(), 'proj'));
    if (WIN) {
      expect(found).toBe(path.resolve(cmd));
    } else {
      expect(found).toBe(path.resolve(bare));
    }
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import type { PathLike } from 'fs';

// ESM-safe fs.existsSync delegate mock that can throw
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

describe('utils/executable-resolver: throw/edge coverage', () => {
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

  it('whichInPath: empty PATH returns undefined', () => {
    restoreEnv = withPath([]);
    const found = whichInPath(WIN ? ['node.exe', 'node'] : ['node']);
    expect(found).toBeUndefined();
  });

  it('whichInPath: first candidate throws, second resolves (dir-first then name order continues after catch)', () => {
    const dir = path.resolve(process.cwd(), '.bin-throw');
    restoreEnv = withPath([dir]);

    const first = WIN ? path.join(dir, 'node.exe') : path.join(dir, 'node'); // first name
    const second = WIN ? path.join(dir, 'node') : path.join(dir, 'node'); // on POSIX only bare exists

    existsSyncMock = (p: PathLike) => {
      const s = String(p);
      if (s === first) {
        throw new Error('fs error');
      }
      return s === second;
    };

    const found = whichInPath(WIN ? ['node.exe', 'node'] : ['node']);
    expect(found).toBe(path.resolve(second));
  });

  it('findNode: execPath check throws, PATH empty -> deterministic fallback to resolved process.execPath', async () => {
    restoreEnv = withPath([]);
    existsSyncMock = (p: PathLike) => {
      const s = String(p);
      if (s === process.execPath) {
        throw new Error('fs error'); // simulate permission or transient fs error
      }
      return false;
    };

    const resolved = await findNode();
    expect(resolved).toBe(path.resolve(process.execPath));
  });

  it('findNode: execPath missing, PATH first candidate throws, second exists -> returns second', async () => {
    const dir = path.resolve(process.cwd(), '.bin-throw2');
    restoreEnv = withPath([dir]);

    const cand1 = WIN ? path.join(dir, 'node.exe') : path.join(dir, 'node'); // first in names
    const cand2 = WIN ? path.join(dir, 'node') : path.join(dir, 'node'); // on POSIX same

    existsSyncMock = (p: PathLike) => {
      const s = String(p);
      if (s === process.execPath) return false; // skip execPath
      if (s === cand1) throw new Error('fs error cand1');
      if (s === cand2) return true;
      return false;
    };

    const resolved = await findNode();
    expect(resolved).toBe(path.resolve(cand2));
  });
});

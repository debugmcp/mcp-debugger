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

describe('utils/typescript-detector: throw/edge coverage', () => {
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

  it('local bin check throws (first), falls back to PATH result', () => {
    const cwd = path.resolve(process.cwd(), 'proj-throw');
    const binDir = path.join(cwd, 'node_modules', '.bin');

    const localCmd = path.join(binDir, 'tsx.cmd');
    const localExe = path.join(binDir, 'tsx.exe');
    const localBare = path.join(binDir, 'tsx');

    const A = path.resolve(process.cwd(), 'A');
    restoreEnv = withPath([A]);

    const pathCmd = path.join(A, 'tsx.cmd');
    const pathBare = path.join(A, 'tsx');

    existsSyncMock = (p: PathLike) => {
      const s = String(p);
      // First local candidate throws (simulate fs error), other locals false
      if (s === localCmd || s === localExe || s === localBare) {
        if (s === localCmd) throw new Error('fs error');
        return false;
      }
      // On PATH, choose first existing respecting suffix preference
      if (WIN) {
        return s === pathCmd; // provide .cmd on PATH
      }
      return s === pathBare; // POSIX bare on PATH
    };

    const found = detectBinary('tsx', cwd);
    if (WIN) {
      expect(found).toBe(path.resolve(pathCmd));
    } else {
      expect(found).toBe(path.resolve(pathBare));
    }
  });

  it('no PATH and local throws for all candidates -> returns undefined', () => {
    const cwd = path.resolve(process.cwd(), 'proj-throw2');
    restoreEnv = withPath([]);

    existsSyncMock = () => {
      throw new Error('fs error');
    };

    const found = detectBinary('ts-node', cwd);
    expect(found).toBeUndefined();
  });
});

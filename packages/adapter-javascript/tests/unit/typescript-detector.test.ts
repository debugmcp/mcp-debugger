import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import type { PathLike } from 'fs';
// ESM-safe mock for fs.existsSync
let existsSyncMock: (p: PathLike) => boolean;
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  const existsDelegate: typeof actual.existsSync = (p: PathLike) =>
    existsSyncMock ? existsSyncMock(p) : actual.existsSync(p);
  return { ...actual, existsSync: existsDelegate };
});
import { detectTsRunners, clearCache } from '../../src/utils/typescript-detector.js';
import { isWindows } from '../../src/utils/executable-resolver.js';

const WIN = isWindows();
let callCount = 0;

function withPath(paths: string[]) {
  const orig = process.env.PATH;
  process.env.PATH = paths.join(path.delimiter);
  return () => {
    process.env.PATH = orig;
  };
}

describe('utils/typescript-detector: detectTsRunners', () => {
  let restoreEnv: (() => void) | null = null;

  beforeEach(() => {
    clearCache();
    restoreEnv = null;
    callCount = 0;
    existsSyncMock = () => {
      callCount++;
      return false;
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearCache();
    if (restoreEnv) {
      restoreEnv();
      restoreEnv = null;
    }
  });

  it('returns undefineds when no runners found (no local bins, empty PATH)', async () => {
    restoreEnv = withPath([]); // empty PATH
    existsSyncMock = () => {
      callCount++;
      return false;
    };

    const cwd = path.resolve(process.cwd(), 'proj-none');
    const res = await detectTsRunners(cwd);
    expect(res.tsx).toBeUndefined();
    expect(res.tsNode).toBeUndefined();
  });

  it('detects tsx locally when present in node_modules/.bin', async () => {
    const cwd = path.resolve(process.cwd(), 'proj-local-tsx');
    const localDir = path.join(cwd, 'node_modules', '.bin');

    const localTsx = WIN ? path.join(localDir, 'tsx.cmd') : path.join(localDir, 'tsx');

    // PATH irrelevant here
    restoreEnv = withPath([]);

    existsSyncMock = (p: PathLike) => {
      callCount++;
      return String(p) === localTsx;
    };

    const res = await detectTsRunners(cwd);
    expect(res.tsx).toBe(path.resolve(localTsx));
    expect(res.tsNode).toBeUndefined();
  });

  it('detects ts-node on PATH when not locally present', async () => {
    const cwd = path.resolve(process.cwd(), 'proj-path-ts-node');
    const binDir = path.resolve(process.cwd(), '.tmp_bin_tsnode');

    const pathCandidate = WIN ? path.join(binDir, 'ts-node.cmd') : path.join(binDir, 'ts-node');

    // PATH includes binDir
    restoreEnv = withPath([binDir]);

    // Local checks should be false; PATH candidate true
    existsSyncMock = (p: PathLike) => {
      callCount++;
      const s = String(p);
      // local checks (cwd/node_modules/.bin/*) negative
      if (s.includes(path.join(cwd, 'node_modules', '.bin'))) {
        return false;
      }
      return s === pathCandidate;
    };

    const res = await detectTsRunners(cwd);
    expect(res.tsNode).toBe(path.resolve(pathCandidate));
  });

  it('caches results across calls until clearCache is invoked', async () => {
    const cwd = path.resolve(process.cwd(), 'proj-cache');

    restoreEnv = withPath([]); // empty PATH

    existsSyncMock = () => {
      callCount++;
      return false;
    };

    const res1 = await detectTsRunners(cwd);
    expect(res1.tsx).toBeUndefined();
    expect(res1.tsNode).toBeUndefined();
    const callsAfterFirst = callCount;

    const res2 = await detectTsRunners(cwd);
    // No additional fs checks should occur due to cache
    expect(callCount).toBe(callsAfterFirst);
    expect(res2).toEqual(res1);

    // Now clear cache and change environment to add local tsx
    clearCache();
    const localDir = path.join(cwd, 'node_modules', '.bin');
    const localTsx = WIN ? path.join(localDir, 'tsx.cmd') : path.join(localDir, 'tsx');

    existsSyncMock = (p: PathLike) => {
      callCount++;
      return String(p) === localTsx;
    };
    callCount = 0;

    const res3 = await detectTsRunners(cwd);
    expect(res3.tsx).toBe(path.resolve(localTsx));
    // Ensure fs was consulted again after cache clear
    expect(callCount).toBeGreaterThan(0);
  });
});

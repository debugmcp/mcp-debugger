import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import { FileSystem, NodeFileSystem } from '@debugmcp/shared';
import { detectTsRunners, clearCache, setDefaultFileSystem } from '../../src/utils/typescript-detector.js';
import { isWindows } from '../../src/utils/executable-resolver.js';

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

  readFileSync(path: string, encoding: string): string {
    // Not used in typescript-detector
    return '';
  }
}

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
  let mockFileSystem: MockFileSystem;

  beforeEach(() => {
    clearCache();
    restoreEnv = null;
    callCount = 0;
    mockFileSystem = new MockFileSystem();
    setDefaultFileSystem(mockFileSystem);
    mockFileSystem.setExistsMock(() => {
      callCount++;
      return false;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearCache();
    if (restoreEnv) {
      restoreEnv();
      restoreEnv = null;
    }
    setDefaultFileSystem(new NodeFileSystem());
  });

  it('returns undefineds when no runners found (no local bins, empty PATH)', async () => {
    restoreEnv = withPath([]); // empty PATH
    mockFileSystem.setExistsMock(() => {
      callCount++;
      return false;
    });

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

    mockFileSystem.setExistsMock((p: string) => {
      callCount++;
      return p === localTsx;
    });

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
    mockFileSystem.setExistsMock((p: string) => {
      callCount++;
      // local checks (cwd/node_modules/.bin/*) negative
      if (p.includes(path.join(cwd, 'node_modules', '.bin'))) {
        return false;
      }
      return p === pathCandidate;
    });

    const res = await detectTsRunners(cwd);
    expect(res.tsNode).toBe(path.resolve(pathCandidate));
  });

  it('caches results across calls until clearCache is invoked', async () => {
    const cwd = path.resolve(process.cwd(), 'proj-cache');

    restoreEnv = withPath([]); // empty PATH

    mockFileSystem.setExistsMock(() => {
      callCount++;
      return false;
    });

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

    mockFileSystem.setExistsMock((p: string) => {
      callCount++;
      return p === localTsx;
    });
    callCount = 0;

    const res3 = await detectTsRunners(cwd);
    expect(res3.tsx).toBe(path.resolve(localTsx));
    // Ensure fs was consulted again after cache clear
    expect(callCount).toBeGreaterThan(0);
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { FileSystem, NodeFileSystem } from '@debugmcp/shared';
import { detectBinary, setDefaultFileSystem } from '../../src/utils/typescript-detector.js';
import { isWindows } from '../../src/utils/executable-resolver.js';

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

describe('utils/typescript-detector.edge: detectBinary ordering and PATH precedence', () => {
  let restoreEnv: (() => void) | null = null;
  let mockFileSystem: MockFileSystem;

  beforeEach(() => {
    restoreEnv = null;
    mockFileSystem = new MockFileSystem();
    setDefaultFileSystem(mockFileSystem);
    // Default: no files exist
    mockFileSystem.setExistsMock(() => false);
    mockFileSystem.setReadFileMock(() => '');
  });

  afterEach(() => {
    if (restoreEnv) {
      restoreEnv();
      restoreEnv = null;
    }
    // Restore the default filesystem
    setDefaultFileSystem(new NodeFileSystem());
  });

  it('Windows: local-first suffix ordering within a single dir: .cmd > .exe > bare', () => {
    if (!WIN) {
      // Not applicable on POSIX; ensure detectBinary returns undefined since nothing exists
      const found = detectBinary('tsx', path.resolve(process.cwd(), 'proj'), mockFileSystem);
      expect(found).toBeUndefined();
      return;
    }
    const cwd = path.resolve(process.cwd(), 'proj');
    const binDir = path.join(cwd, 'node_modules', '.bin');

    const cmd = path.join(binDir, 'tsx.cmd');
    const exe = path.join(binDir, 'tsx.exe');
    const bare = path.join(binDir, 'tsx');

    // Only .cmd and .exe exist; should pick .cmd
    mockFileSystem.setExistsMock((p: string) => {
      return p === cmd || p === exe; // bare absent
    });

    const found1 = detectBinary('tsx', cwd, mockFileSystem);
    expect(found1).toBe(path.resolve(cmd));

    // Now only .exe and bare exist; should pick .exe
    mockFileSystem.setExistsMock((p: string) => {
      return p === exe || p === bare;
    });
    const found2 = detectBinary('tsx', cwd, mockFileSystem);
    expect(found2).toBe(path.resolve(exe));
  });

  it('PATH precedence is dir-first across PATH entries, not name-first', () => {
    const A = path.resolve(process.cwd(), 'A');
    const B = path.resolve(process.cwd(), 'B');
    restoreEnv = withPath([A, B]);

    // For ts-node: In dir A we have bare; in dir B we have .cmd (Windows) or bare (POSIX).
    const aBare = path.join(A, 'ts-node');
    const bCmd = path.join(B, WIN ? 'ts-node.cmd' : 'ts-node');

    mockFileSystem.setExistsMock((p: string) => {
      // Local <cwd>/node_modules/.bin/* should be false for this test
      if (p.includes(path.join('node_modules', '.bin'))) return false;
      return p === aBare || p === bCmd;
    });

    const found = detectBinary('ts-node', path.resolve(process.cwd(), 'proj'), mockFileSystem);
    // Dir-first -> A wins even though .cmd might have higher suffix priority in B
    expect(found).toBe(path.resolve(aBare));
  });

  it('Windows PATH single dir with both .cmd and .exe prefers .cmd within same dir; POSIX prefers bare', () => {
    const D = path.resolve(process.cwd(), 'D');
    restoreEnv = withPath([D]);

    const cmd = path.join(D, 'tsx.cmd');
    const exe = path.join(D, 'tsx.exe');
    const bare = path.join(D, 'tsx');

    mockFileSystem.setExistsMock((p: string) => {
      return p === cmd || p === exe || p === bare;
    });

    const found = detectBinary('tsx', path.resolve(process.cwd(), 'proj'), mockFileSystem);
    if (WIN) {
      expect(found).toBe(path.resolve(cmd));
    } else {
      expect(found).toBe(path.resolve(bare));
    }
  });
});

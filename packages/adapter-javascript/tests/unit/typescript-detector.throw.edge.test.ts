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

describe('utils/typescript-detector: throw/edge coverage', () => {
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

    mockFileSystem.setExistsMock((p: string) => {
      // First local candidate throws (simulate fs error), other locals false
      if (p === localCmd || p === localExe || p === localBare) {
        if (p === localCmd) throw new Error('fs error');
        return false;
      }
      // On PATH, choose first existing respecting suffix preference
      if (WIN) {
        return p === pathCmd; // provide .cmd on PATH
      }
      return p === pathBare; // POSIX bare on PATH
    });

    const found = detectBinary('tsx', cwd, mockFileSystem);
    if (WIN) {
      expect(found).toBe(path.resolve(pathCmd));
    } else {
      expect(found).toBe(path.resolve(pathBare));
    }
  });

  it('no PATH and local throws for all candidates -> returns undefined', () => {
    const cwd = path.resolve(process.cwd(), 'proj-throw2');
    restoreEnv = withPath([]);

    mockFileSystem.setExistsMock(() => {
      throw new Error('fs error');
    });

    const found = detectBinary('ts-node', cwd, mockFileSystem);
    expect(found).toBeUndefined();
  });
});

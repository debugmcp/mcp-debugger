import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { FileSystem, NodeFileSystem } from '@debugmcp/shared';
import {
  determineOutFiles,
  isESMProject,
  hasTsConfigPaths,
  setDefaultFileSystem
} from '../../src/utils/config-transformer.js';

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

describe('utils/config-transformer: determineOutFiles', () => {
  it('returns user-provided outFiles when given', () => {
    const custom = ['dist/**/*.js', '!**/node_modules/**'];
    expect(determineOutFiles('/proj/app.ts', custom)).toEqual(custom);
  });

  it('returns default outFiles when not provided', () => {
    expect(determineOutFiles('/proj/app.ts')).toEqual(['**/*.js', '!**/node_modules/**']);
  });
});

describe('utils/config-transformer: isESMProject', () => {
  const projDir = path.resolve(process.cwd(), 'proj-esm');
  const programDir = path.join(projDir, 'src');
  let mockFileSystem: MockFileSystem;

  beforeEach(() => {
    mockFileSystem = new MockFileSystem();
    setDefaultFileSystem(mockFileSystem);
    // Default: no files exist
    mockFileSystem.setExistsMock(() => false);
    mockFileSystem.setReadFileMock(() => '');
  });

  afterEach(() => {
    // Restore the default filesystem
    setDefaultFileSystem(new NodeFileSystem());
  });

  it('returns true for .mjs program', () => {
    expect(isESMProject(path.join(programDir, 'main.mjs'), projDir)).toBe(true);
  });

  it('returns true for .mts program', () => {
    expect(isESMProject(path.join(programDir, 'main.mts'), projDir)).toBe(true);
  });

  it('returns true when package.json in program dir has type: module', () => {
    const pkgPath = path.join(programDir, 'package.json');
    mockFileSystem.setExistsMock((p) => String(p) === pkgPath);
    mockFileSystem.setReadFileMock((p, _enc) => {
      if (String(p) === pkgPath) {
        return JSON.stringify({ type: 'module' });
      }
      return '';
    });
    expect(isESMProject(path.join(programDir, 'main.js'), projDir)).toBe(true);
  });

  it('returns true when package.json in cwd has type: module', () => {
    const pkgPath = path.join(projDir, 'package.json');
    mockFileSystem.setExistsMock((p) => String(p) === pkgPath);
    mockFileSystem.setReadFileMock((p, _enc) => {
      if (String(p) === pkgPath) {
        return JSON.stringify({ type: 'module' });
      }
      return '';
    });
    expect(isESMProject(path.join(programDir, 'main.js'), projDir)).toBe(true);
  });

  it('returns true when tsconfig.json has module ESNext', () => {
    const tsconfigPath = path.join(programDir, 'tsconfig.json');
    mockFileSystem.setExistsMock((p) => String(p) === tsconfigPath);
    mockFileSystem.setReadFileMock((p, _enc) => {
      if (String(p) === tsconfigPath) {
        return JSON.stringify({ compilerOptions: { module: 'ESNext' } });
      }
      return '';
    });
    expect(isESMProject(path.join(programDir, 'main.ts'), projDir)).toBe(true);
  });

  it('returns true when tsconfig.json has module NodeNext in cwd', () => {
    const tsconfigPath = path.join(projDir, 'tsconfig.json');
    mockFileSystem.setExistsMock((p) => String(p) === tsconfigPath);
    mockFileSystem.setReadFileMock((p, _enc) => {
      if (String(p) === tsconfigPath) {
        return JSON.stringify({ compilerOptions: { module: 'NodeNext' } });
      }
      return '';
    });
    expect(isESMProject(path.join(programDir, 'main.ts'), projDir)).toBe(true);
  });

  it('returns false when no indicators present', () => {
    // Already set to return false in beforeEach
    expect(isESMProject(path.join(programDir, 'main.ts'), projDir)).toBe(false);
  });
});

describe('utils/config-transformer: hasTsConfigPaths', () => {
  const projDir = path.resolve(process.cwd(), 'proj-tspaths');
  let mockFileSystem: MockFileSystem;

  beforeEach(() => {
    mockFileSystem = new MockFileSystem();
    setDefaultFileSystem(mockFileSystem);
    // Default: no files exist
    mockFileSystem.setExistsMock(() => false);
    mockFileSystem.setReadFileMock(() => '');
  });

  afterEach(() => {
    // Restore the default filesystem
    setDefaultFileSystem(new NodeFileSystem());
  });

  it('returns true when tsconfig.json contains non-empty compilerOptions.paths', () => {
    const tsconfigPath = path.join(projDir, 'tsconfig.json');
    mockFileSystem.setExistsMock((p) => String(p) === tsconfigPath);
    mockFileSystem.setReadFileMock((p, _enc) => {
      if (String(p) === tsconfigPath) {
        return JSON.stringify({
          compilerOptions: {
            paths: {
              '@utils/*': ['./src/utils/*']
            }
          }
        });
      }
      return '';
    });
    expect(hasTsConfigPaths(projDir)).toBe(true);
  });

  it('returns false when tsconfig.json has empty or missing paths', () => {
    const tsconfigPath = path.join(projDir, 'tsconfig.json');
    mockFileSystem.setExistsMock((p) => String(p) === tsconfigPath);
    mockFileSystem.setReadFileMock((p, _enc) => {
      if (String(p) === tsconfigPath) {
        return JSON.stringify({
          compilerOptions: {
            paths: { }
          }
        });
      }
      return '';
    });
    expect(hasTsConfigPaths(projDir)).toBe(false);
  });

  it('returns false when tsconfig.json missing', () => {
    // Already set to return false in beforeEach
    expect(hasTsConfigPaths(projDir)).toBe(false);
  });
});

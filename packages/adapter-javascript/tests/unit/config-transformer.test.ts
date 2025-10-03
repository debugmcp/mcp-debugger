/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { PathLike } from 'fs';

// ESM-safe fs mocks using a delegate pattern
let existsSyncMock: (p: PathLike) => boolean;
let readFileSyncMock: (p: any, enc?: any) => string;
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  const existsDelegate: typeof actual.existsSync = (p: PathLike) =>
    existsSyncMock ? existsSyncMock(p) : actual.existsSync(p);
  const readFileDelegate: typeof actual.readFileSync = (p: any, enc?: any) =>
    readFileSyncMock ? (readFileSyncMock(p, enc)) : (actual.readFileSync as any)(p, enc);
  return {
    ...actual,
    existsSync: existsDelegate,
    readFileSync: readFileDelegate as any
  };
});

import * as path from 'path';
import { determineOutFiles, isESMProject, hasTsConfigPaths } from '../../src/utils/config-transformer.js';

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

  beforeEach(() => {
    existsSyncMock = () => false;
    readFileSyncMock = () => '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true for .mjs program', () => {
    expect(isESMProject(path.join(programDir, 'main.mjs'), projDir)).toBe(true);
  });

  it('returns true for .mts program', () => {
    expect(isESMProject(path.join(programDir, 'main.mts'), projDir)).toBe(true);
  });

  it('returns true when package.json in program dir has type: module', () => {
    const pkgPath = path.join(programDir, 'package.json');
    existsSyncMock = (p) => String(p) === pkgPath;
  readFileSyncMock = (p, enc) => {
      void enc;
      if (String(p) === pkgPath) {
        return JSON.stringify({ type: 'module' });
      }
      return '';
    };
    expect(isESMProject(path.join(programDir, 'main.js'), projDir)).toBe(true);
  });

  it('returns true when package.json in cwd has type: module', () => {
    const pkgPath = path.join(projDir, 'package.json');
    existsSyncMock = (p) => String(p) === pkgPath;
  readFileSyncMock = (p, enc) => {
      void enc;
      if (String(p) === pkgPath) {
        return JSON.stringify({ type: 'module' });
      }
      return '';
    };
    expect(isESMProject(path.join(programDir, 'main.js'), projDir)).toBe(true);
  });

  it('returns true when tsconfig.json has module ESNext', () => {
    const tsconfigPath = path.join(programDir, 'tsconfig.json');
    existsSyncMock = (p) => String(p) === tsconfigPath;
  readFileSyncMock = (p, enc) => {
      void enc;
      if (String(p) === tsconfigPath) {
        return JSON.stringify({ compilerOptions: { module: 'ESNext' } });
      }
      return '';
    };
    expect(isESMProject(path.join(programDir, 'main.ts'), projDir)).toBe(true);
  });

  it('returns true when tsconfig.json has module NodeNext in cwd', () => {
    const tsconfigPath = path.join(projDir, 'tsconfig.json');
    existsSyncMock = (p) => String(p) === tsconfigPath;
  readFileSyncMock = (p, enc) => {
      void enc;
      if (String(p) === tsconfigPath) {
        return JSON.stringify({ compilerOptions: { module: 'NodeNext' } });
      }
      return '';
    };
    expect(isESMProject(path.join(programDir, 'main.ts'), projDir)).toBe(true);
  });

  it('returns false when no indicators present', () => {
    existsSyncMock = () => false;
    expect(isESMProject(path.join(programDir, 'main.ts'), projDir)).toBe(false);
  });
});

describe('utils/config-transformer: hasTsConfigPaths', () => {
  const projDir = path.resolve(process.cwd(), 'proj-tspaths');

  beforeEach(() => {
    existsSyncMock = () => false;
    readFileSyncMock = () => '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true when tsconfig.json contains non-empty compilerOptions.paths', () => {
    const tsconfigPath = path.join(projDir, 'tsconfig.json');
    existsSyncMock = (p) => String(p) === tsconfigPath;
  readFileSyncMock = (p, enc) => {
      void enc;
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
    };
    expect(hasTsConfigPaths(projDir)).toBe(true);
  });

  it('returns false when tsconfig.json has empty or missing paths', () => {
    const tsconfigPath = path.join(projDir, 'tsconfig.json');
    existsSyncMock = (p) => String(p) === tsconfigPath;
  readFileSyncMock = (p, enc) => {
      void enc;
      if (String(p) === tsconfigPath) {
        return JSON.stringify({
          compilerOptions: {
            paths: { }
          }
        });
      }
      return '';
    };
    expect(hasTsConfigPaths(projDir)).toBe(false);
  });

  it('returns false when tsconfig.json missing', () => {
    existsSyncMock = () => false;
    expect(hasTsConfigPaths(projDir)).toBe(false);
  });
});

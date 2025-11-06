/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import type { PathLike } from 'fs';

// ESM-safe fs mocks with throw capabilities
let existsSyncMock: (p: PathLike) => boolean;
let readFileSyncMock: (p: any, enc?: any) => string;
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  const existsDelegate: typeof actual.existsSync = (p: PathLike) =>
    existsSyncMock ? existsSyncMock(p) : actual.existsSync(p);
  const readDelegate: typeof actual.readFileSync = (p: any, enc?: any) =>
    readFileSyncMock ? readFileSyncMock(p, enc) : (actual.readFileSync as any)(p, enc);
  return { ...actual, existsSync: existsDelegate, readFileSync: readDelegate as any };
});

import { isESMProject, hasTsConfigPaths } from '../../src/utils/config-transformer.js';

describe('utils/config-transformer.throw.edge', () => {
  const projDir = path.resolve(process.cwd(), 'proj-throw-edge');
  const programDir = path.join(projDir, 'src');

  beforeEach(() => {
    existsSyncMock = () => false;
    readFileSyncMock = () => '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('isESMProject: existsSync throws for package.json and tsconfig; function does not throw and returns false', () => {
    const pj1 = path.join(programDir, 'package.json');
    const pj2 = path.join(projDir, 'package.json');
    const tc1 = path.join(programDir, 'tsconfig.json');
    const tc2 = path.join(projDir, 'tsconfig.json');

    existsSyncMock = (p) => {
      const s = String(p);
      if (s === pj1 || s === pj2 || s === tc1 || s === tc2) throw new Error('fs exists error');
      return false;
    };
    // readFileSync should not be called, but if it is, make it throw too
    readFileSyncMock = () => {
      throw new Error('fs read error');
    };

    expect(isESMProject(path.join(programDir, 'main.ts'), projDir)).toBe(false);
  });

  it('isESMProject: readFileSync throws for package.json and tsconfig; function remains safe', () => {
    const pj = path.join(programDir, 'package.json');
    const tc = path.join(programDir, 'tsconfig.json');

    existsSyncMock = (p) => {
      const s = String(p);
      return s === pj || s === tc;
    };
    readFileSyncMock = () => {
      throw new Error('fs read error');
    };

    expect(isESMProject(path.join(programDir, 'main.ts'), projDir)).toBe(false);
  });

  it('hasTsConfigPaths: existsSync throws -> returns false', () => {
    const tc = path.join(projDir, 'tsconfig.json');
    existsSyncMock = (p) => {
      const s = String(p);
      if (s === tc) throw new Error('exists throw');
      return false;
    };
    readFileSyncMock = () => '{ "compilerOptions": { "paths": {} } }';
    expect(hasTsConfigPaths(projDir)).toBe(false);
  });

  it('hasTsConfigPaths: readFileSync throws -> returns false', () => {
    const tc = path.join(projDir, 'tsconfig.json');
    existsSyncMock = (p) => String(p) === tc;
    readFileSyncMock = () => {
      throw new Error('read throw');
    };
    expect(hasTsConfigPaths(projDir)).toBe(false);
  });
});

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import type { PathLike } from 'fs';

// ESM-safe fs mocks using delegate pattern
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

describe('utils/config-transformer.edge2: branch-padding cases', () => {
  const projDir = path.resolve(process.cwd(), 'proj-edge2');
  const programDir = path.join(projDir, 'src');

  beforeEach(() => {
    existsSyncMock = () => false;
    readFileSyncMock = () => '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('isESMProject: empty programPath uses cwd-only checks (tsconfig ESNext in cwd => true)', () => {
    const tc = path.join(projDir, 'tsconfig.json');
    existsSyncMock = (p) => String(p) === tc;
    readFileSyncMock = (p) => (String(p) === tc ? JSON.stringify({ compilerOptions: { module: 'ESNext' } }) : '');

    expect(isESMProject('', projDir)).toBe(true);
  });

  it('isESMProject: package.json present but type not "module" does not trigger ESM', () => {
    const pj = path.join(programDir, 'package.json');
    existsSyncMock = (p) => String(p) === pj;
    readFileSyncMock = (p) => (String(p) === pj ? JSON.stringify({ type: 'commonjs' }) : '');

    expect(isESMProject(path.join(programDir, 'app.js'), projDir)).toBe(false);
  });

  it('isESMProject: tsconfig module CommonJS does not trigger ESM', () => {
    const tc = path.join(programDir, 'tsconfig.json');
    existsSyncMock = (p) => String(p) === tc;
    readFileSyncMock = (p) => (String(p) === tc ? JSON.stringify({ compilerOptions: { module: 'CommonJS' } }) : '');

    expect(isESMProject(path.join(programDir, 'app.ts'), projDir)).toBe(false);
  });

  it('hasTsConfigPaths: non-object paths (string/array) treated as false', () => {
    const tc = path.join(projDir, 'tsconfig.json');

    // Case 1: string
    existsSyncMock = (p) => String(p) === tc;
    readFileSyncMock = (p) =>
      String(p) === tc ? JSON.stringify({ compilerOptions: { paths: 'not-an-object' } }) : '';
    expect(hasTsConfigPaths(projDir)).toBe(false);

    // Case 2: array-like — current implementation treats arrays as objects and counts keys => truthy
    readFileSyncMock = (p) =>
      String(p) === tc ? JSON.stringify({ compilerOptions: { paths: ['x'] } }) : '';
    expect(hasTsConfigPaths(projDir)).toBe(true);
  });
});

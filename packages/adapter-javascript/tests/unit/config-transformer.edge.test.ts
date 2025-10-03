/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import type { PathLike } from 'fs';

// ESM-safe fs mocks using a delegate pattern
let existsSyncMock: (p: PathLike) => boolean;
let readFileSyncMock: (p: any, enc?: any) => string;
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  const existsDelegate: typeof actual.existsSync = (p: PathLike) =>
    existsSyncMock ? existsSyncMock(p) : actual.existsSync(p);
  const readFileDelegate: typeof actual.readFileSync = (p: any, enc?: any) =>
    readFileSyncMock ? readFileSyncMock(p, enc) : (actual.readFileSync as any)(p, enc);
  return {
    ...actual,
    existsSync: existsDelegate,
    readFileSync: readFileDelegate as any
  };
});

import { determineOutFiles, isESMProject, hasTsConfigPaths } from '../../src/utils/config-transformer.js';

describe('utils/config-transformer.edge: tolerant JSON parse and defaults', () => {
  const projDir = path.resolve(process.cwd(), 'proj-edge');
  const programDir = path.join(projDir, 'src');

  beforeEach(() => {
    existsSyncMock = () => false;
    readFileSyncMock = () => '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('isESMProject: malformed package.json in program dir returns false and does not throw', () => {
    const pkgPath = path.join(programDir, 'package.json');
    existsSyncMock = (p) => String(p) === pkgPath;
    readFileSyncMock = (p) => {
      if (String(p) === pkgPath) return '{ "type": "module"'; // malformed JSON
      return '';
    };
    // Use .js (not .mjs/.mts) so extension path does not force true
    expect(isESMProject(path.join(programDir, 'main.js'), projDir)).toBe(false);
  });

  it('isESMProject: malformed tsconfig.json in cwd returns false and does not throw', () => {
    const tcPath = path.join(projDir, 'tsconfig.json');
    existsSyncMock = (p) => String(p) === tcPath;
    readFileSyncMock = (p) => {
      if (String(p) === tcPath) return '{ "compilerOptions": { "module": "ESNext" '; // malformed
      return '';
    };
    expect(isESMProject(path.join(programDir, 'main.ts'), projDir)).toBe(false);
  });

  it('hasTsConfigPaths: malformed tsconfig.json returns false and does not throw', () => {
    const tcPath = path.join(projDir, 'tsconfig.json');
    existsSyncMock = (p) => String(p) === tcPath;
    readFileSyncMock = (p) => {
      if (String(p) === tcPath) return '{ "compilerOptions": { "paths": { "@x/*": ["./x/*"] }'; // malformed
      return '';
    };
    expect(hasTsConfigPaths(projDir)).toBe(false);
  });

  it('determineOutFiles: when user not provided, returns default pattern', () => {
    // Program path included to touch code path; determineOutFiles ignores it but branch is covered
    const res = determineOutFiles(path.join(programDir, 'main.ts'));
    expect(res).toEqual(['**/*.js', '!**/node_modules/**']);
  });
});

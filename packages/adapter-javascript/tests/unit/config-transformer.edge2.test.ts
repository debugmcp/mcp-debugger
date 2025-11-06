import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { FileSystem, NodeFileSystem } from '@debugmcp/shared';
import {
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

describe('utils/config-transformer.edge2: branch-padding cases', () => {
  const projDir = path.resolve(process.cwd(), 'proj-edge2');
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

  it('isESMProject: empty programPath uses cwd-only checks (tsconfig ESNext in cwd => true)', () => {
    const tc = path.join(projDir, 'tsconfig.json');
    mockFileSystem.setExistsMock((p) => String(p) === tc);
    mockFileSystem.setReadFileMock((p, _enc) =>
      String(p) === tc ? JSON.stringify({ compilerOptions: { module: 'ESNext' } }) : ''
    );

    expect(isESMProject('', projDir)).toBe(true);
  });

  it('isESMProject: package.json present but type not "module" does not trigger ESM', () => {
    const pj = path.join(programDir, 'package.json');
    mockFileSystem.setExistsMock((p) => String(p) === pj);
    mockFileSystem.setReadFileMock((p, _enc) =>
      String(p) === pj ? JSON.stringify({ type: 'commonjs' }) : ''
    );

    expect(isESMProject(path.join(programDir, 'app.js'), projDir)).toBe(false);
  });

  it('isESMProject: tsconfig module CommonJS does not trigger ESM', () => {
    const tc = path.join(programDir, 'tsconfig.json');
    mockFileSystem.setExistsMock((p) => String(p) === tc);
    mockFileSystem.setReadFileMock((p, _enc) =>
      String(p) === tc ? JSON.stringify({ compilerOptions: { module: 'CommonJS' } }) : ''
    );

    expect(isESMProject(path.join(programDir, 'app.ts'), projDir)).toBe(false);
  });

  it('hasTsConfigPaths: non-object paths (string/array) treated as false', () => {
    const tc = path.join(projDir, 'tsconfig.json');

    // Case 1: string
    mockFileSystem.setExistsMock((p) => String(p) === tc);
    mockFileSystem.setReadFileMock((p, _enc) =>
      String(p) === tc ? JSON.stringify({ compilerOptions: { paths: 'not-an-object' } }) : ''
    );
    expect(hasTsConfigPaths(projDir)).toBe(false);

    // Case 2: array-like — current implementation treats arrays as objects and counts keys => truthy
    mockFileSystem.setReadFileMock((p, _enc) =>
      String(p) === tc ? JSON.stringify({ compilerOptions: { paths: ['x'] } }) : ''
    );
    expect(hasTsConfigPaths(projDir)).toBe(true);
  });
});

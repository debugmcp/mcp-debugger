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

describe('utils/config-transformer.edge: tolerant JSON parse and defaults', () => {
  const projDir = path.resolve(process.cwd(), 'proj-edge');
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

  it('isESMProject: malformed package.json in program dir returns false and does not throw', () => {
    const pkgPath = path.join(programDir, 'package.json');
    mockFileSystem.setExistsMock((p) => String(p) === pkgPath);
    mockFileSystem.setReadFileMock((p, _enc) => {
      if (String(p) === pkgPath) return '{ "type": "module"'; // malformed JSON
      return '';
    });
    // Use .js (not .mjs/.mts) so extension path does not force true
    expect(isESMProject(path.join(programDir, 'main.js'), projDir)).toBe(false);
  });

  it('isESMProject: malformed tsconfig.json in cwd returns false and does not throw', () => {
    const tcPath = path.join(projDir, 'tsconfig.json');
    mockFileSystem.setExistsMock((p) => String(p) === tcPath);
    mockFileSystem.setReadFileMock((p, _enc) => {
      if (String(p) === tcPath) return '{ "compilerOptions": { "module": "ESNext" '; // malformed
      return '';
    });
    expect(isESMProject(path.join(programDir, 'main.ts'), projDir)).toBe(false);
  });

  it('hasTsConfigPaths: malformed tsconfig.json returns false and does not throw', () => {
    const tcPath = path.join(projDir, 'tsconfig.json');
    mockFileSystem.setExistsMock((p) => String(p) === tcPath);
    mockFileSystem.setReadFileMock((p, _enc) => {
      if (String(p) === tcPath) return '{ "compilerOptions": { "paths": { "@x/*": ["./x/*"] }'; // malformed
      return '';
    });
    expect(hasTsConfigPaths(projDir)).toBe(false);
  });

  it('determineOutFiles: when user not provided, returns default pattern', () => {
    // Program path included to touch code path; determineOutFiles ignores it but branch is covered
    const res = determineOutFiles(path.join(programDir, 'main.ts'));
    expect(res).toEqual(['**/*.js', '!**/node_modules/**']);
  });
});

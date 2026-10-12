/**
 * The one mock file system (issue #742): every IFileSystem member, "everything exists"
 * defaults that survive the global vi.resetAllMocks(), overrides spread last, and the three
 * import paths are the same function. createMockAdapterDependencies() keeps its negatives.
 */
import { describe, expect, it, vi } from 'vitest';
import { createMockFileSystem } from '../../test-utils/helpers/test-utils.js';
import { createMockFileSystem as fromDependencies } from '../../test-utils/helpers/test-dependencies.js';
import {
  createMockFileSystem as fromAdapterDependencies,
  createMockAdapterDependencies
} from '../../test-utils/helpers/adapter-dependencies.js';

const MEMBERS = [
  'readFile', 'readTail', 'writeFile', 'exists', 'mkdir', 'readdir', 'stat', 'unlink', 'rmdir',
  'ensureDir', 'ensureDirSync', 'pathExists', 'existsSync', 'remove', 'copy', 'outputFile'
] as const;

describe('createMockFileSystem (issue #742)', () => {
  it('is one function behind the three import paths', () => {
    expect(fromDependencies).toBe(createMockFileSystem);
    expect(fromAdapterDependencies).toBe(createMockFileSystem);
  });

  it('defines all sixteen IFileSystem members as mocks', () => {
    const fs = createMockFileSystem();
    for (const member of MEMBERS) {
      expect(vi.isMockFunction(fs[member]), member).toBe(true);
    }
    expect(Object.keys(fs).sort()).toEqual([...MEMBERS].sort());
  });

  it('answers "everything exists" by default', async () => {
    const fs = createMockFileSystem();
    await expect(fs.pathExists('/x')).resolves.toBe(true);
    await expect(fs.exists('/x')).resolves.toBe(true);
    expect(fs.existsSync('/x')).toBe(true);
    await expect(fs.readFile('/x')).resolves.toBe('');
    await expect(fs.readTail('/x', 16)).resolves.toBe('');
    await expect(fs.readdir('/x')).resolves.toEqual([]);
    const stat = await fs.stat('/x');
    expect(stat.isFile()).toBe(true);
    expect(stat.isDirectory()).toBe(false);
    await expect(fs.ensureDir('/x')).resolves.toBeUndefined();
    expect(fs.ensureDirSync('/x')).toBeUndefined();
  });

  it('spreads overrides last', async () => {
    const fs = createMockFileSystem({ pathExists: vi.fn(async () => false) });
    await expect(fs.pathExists('/x')).resolves.toBe(false);
    expect(fs.existsSync('/x')).toBe(true);
  });

  it('keeps its defaults across vi.resetAllMocks(), which the setup file runs after every test', async () => {
    const fs = createMockFileSystem();
    vi.resetAllMocks();
    await expect(fs.pathExists('/x')).resolves.toBe(true);
    await expect(fs.readFile('/x')).resolves.toBe('');
    expect(fs.existsSync('/x')).toBe(true);
  });

  it('createMockAdapterDependencies sets the three existence probes to false explicitly', async () => {
    const { fileSystem } = createMockAdapterDependencies();
    await expect(fileSystem.pathExists('/x')).resolves.toBe(false);
    await expect(fileSystem.exists('/x')).resolves.toBe(false);
    expect(fileSystem.existsSync('/x')).toBe(false);
    await expect(fileSystem.readFile('/x')).resolves.toBe('');
  });
});

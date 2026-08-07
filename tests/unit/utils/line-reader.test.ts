import { describe, it, expect, vi } from 'vitest';
import { LineReader } from '../../../src/utils/line-reader.js';
import type { IFileSystem } from '@debugmcp/shared';

interface FakeFile {
  content: string;
  mtimeMs: number;
}

function makeFs(files: Record<string, FakeFile>) {
  const readFile = vi.fn(async (path: string) => files[path].content);
  const stat = vi.fn(async (path: string) => ({
    size: files[path].content.length,
    mtimeMs: files[path].mtimeMs,
  }));
  const fs = { readFile, stat } as unknown as IFileSystem;
  return { fs, readFile, stat };
}

describe('LineReader caching', () => {
  it('serves repeated reads from cache while the file is unchanged', async () => {
    const { fs, readFile } = makeFs({
      '/a.py': { content: 'one\ntwo\nthree', mtimeMs: 1000 },
    });
    const reader = new LineReader(fs);

    await reader.getLineContext('/a.py', 2);
    await reader.getLineContext('/a.py', 2);

    expect(readFile).toHaveBeenCalledTimes(1);
  });

  it('re-reads the file when its mtime changes', async () => {
    const files: Record<string, FakeFile> = {
      '/a.py': { content: 'one\ntwo\nthree', mtimeMs: 1000 },
    };
    const { fs, readFile } = makeFs(files);
    const reader = new LineReader(fs);

    const before = await reader.getLineContext('/a.py', 2);
    expect(before?.lineContent).toBe('two');

    files['/a.py'] = { content: 'one\nTWO EDITED\nthree', mtimeMs: 2000 };
    const after = await reader.getLineContext('/a.py', 2);

    expect(after?.lineContent).toBe('TWO EDITED');
    expect(readFile).toHaveBeenCalledTimes(2);
  });
});

describe('LineReader.getFileLines', () => {
  it('returns all lines of a text file', async () => {
    const { fs } = makeFs({
      '/a.py': { content: 'one\ntwo\nthree', mtimeMs: 1000 },
    });
    const reader = new LineReader(fs);

    expect(await reader.getFileLines('/a.py')).toEqual(['one', 'two', 'three']);
  });

  it('returns null for binary content', async () => {
    const { fs } = makeFs({
      '/bin': { content: 'abc\0def', mtimeMs: 1000 },
    });
    const reader = new LineReader(fs);

    expect(await reader.getFileLines('/bin')).toBeNull();
  });

  it('returns null when the file cannot be read', async () => {
    const readFile = vi.fn(async () => {
      throw new Error('ENOENT');
    });
    const stat = vi.fn(async () => {
      throw new Error('ENOENT');
    });
    const reader = new LineReader({ readFile, stat } as unknown as IFileSystem);

    expect(await reader.getFileLines('/missing')).toBeNull();
  });
});

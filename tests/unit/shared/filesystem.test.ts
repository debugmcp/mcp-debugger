import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  NodeFileSystem,
  setDefaultFileSystem,
  getDefaultFileSystem
} from '../../../packages/shared/src/interfaces/filesystem.js';

describe('NodeFileSystem', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delegates existsSync and readFileSync to node fs', () => {
    const nodeFs = new NodeFileSystem();
    const fixture = path.resolve(process.cwd(), 'package.json');

    expect(nodeFs.existsSync(fixture)).toBe(true);
    const content = nodeFs.readFileSync(fixture, 'utf8');
    expect(content).toContain('"name"');
  });

  it('returns safe defaults when fs throws', () => {
    const nodeFs = new NodeFileSystem();

    (nodeFs as unknown as { fs: typeof fs }).fs = {
      existsSync: vi.fn(() => {
        throw new Error('fail');
      }),
      readFileSync: vi.fn(() => {
        throw new Error('fail');
      })
    } as unknown as typeof fs;

    expect(nodeFs.existsSync('/nope')).toBe(false);
    expect(nodeFs.readFileSync('/nope', 'utf8')).toBe('');
  });

  it('allows overriding the default filesystem instance', () => {
    const stub = {
      existsSync: vi.fn().mockReturnValue(true),
      readFileSync: vi.fn().mockReturnValue('stub')
    };

    setDefaultFileSystem(stub);
    expect(getDefaultFileSystem().existsSync('any')).toBe(true);
    expect(getDefaultFileSystem().readFileSync('any', 'utf8')).toBe('stub');

    // Reset to real implementation to avoid cross-test pollution
    setDefaultFileSystem(new NodeFileSystem());
  });
});

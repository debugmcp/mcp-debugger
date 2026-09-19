/**
 * Unit tests for the build key (issue #759): one artifact directory per
 * (compiler version, flags, source contents) combination.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { computeBuildKey, hashFileContents, BUILD_KEY_LENGTH, type BuildKeyInput } from '../../../src/build/build-key.js';

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');

const baseInput = (): BuildKeyInput => ({
  cobcVersion: 'cobc (GnuCOBOL) 3.2.0',
  argv: ['-x', '-g', '-fdump=ALL', '-std=ibm'],
  files: [
    { path: '/src/hello.cob', contentHash: sha256('hello') },
    { path: '/src/copy.cpy', contentHash: sha256('copy') }
  ]
});

describe('hashFileContents', () => {
  const tempDirs: string[] = [];
  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('is the sha256 hex digest of the bytes the reader returns', () => {
    const read = (p: string): Buffer => Buffer.from(`contents of ${p}`);
    expect(hashFileContents('/any/file.cob', read)).toBe(sha256('contents of /any/file.cob'));
  });

  it('reads the real file by default', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cobol-build-key-'));
    tempDirs.push(dir);
    const file = path.join(dir, 'hello.cob');
    fs.writeFileSync(file, 'IDENTIFICATION DIVISION.');

    expect(hashFileContents(file)).toBe(sha256('IDENTIFICATION DIVISION.'));
  });
});

describe('computeBuildKey', () => {
  it('is a short lowercase hex string of the documented length', () => {
    const key = computeBuildKey(baseInput());
    expect(key).toMatch(/^[0-9a-f]+$/);
    expect(key).toHaveLength(BUILD_KEY_LENGTH);
    expect(BUILD_KEY_LENGTH).toBe(12);
  });

  it('is deterministic for identical input', () => {
    expect(computeBuildKey(baseInput())).toBe(computeBuildKey(baseInput()));
  });

  it('does not depend on the order the files are listed in', () => {
    const input = baseInput();
    const reversed: BuildKeyInput = { ...input, files: [...input.files].reverse() };
    expect(computeBuildKey(reversed)).toBe(computeBuildKey(input));
  });

  it('treats file paths case-insensitively (Windows spellings of the same file)', () => {
    const input = baseInput();
    const upper: BuildKeyInput = { ...input, files: input.files.map((f) => ({ ...f, path: f.path.toUpperCase() })) };
    expect(computeBuildKey(upper)).toBe(computeBuildKey(input));
  });

  it('changes when a file\'s contents change', () => {
    const input = baseInput();
    const edited: BuildKeyInput = { ...input, files: [{ ...input.files[0], contentHash: sha256('hello v2') }, input.files[1]] };
    expect(computeBuildKey(edited)).not.toBe(computeBuildKey(input));
  });

  it('changes when the compiler version changes', () => {
    const input = baseInput();
    expect(computeBuildKey({ ...input, cobcVersion: 'cobc (GnuCOBOL) 3.1.2.0' })).not.toBe(computeBuildKey(input));
  });

  it('changes when the argv changes, including its order', () => {
    const input = baseInput();
    expect(computeBuildKey({ ...input, argv: [...input.argv, '--debug'] })).not.toBe(computeBuildKey(input));
    expect(computeBuildKey({ ...input, argv: [...input.argv].reverse() })).not.toBe(computeBuildKey(input));
  });

  it('changes when a file is added or renamed', () => {
    const input = baseInput();
    expect(computeBuildKey({ ...input, files: [...input.files, { path: '/src/extra.cpy', contentHash: sha256('x') }] })).not.toBe(computeBuildKey(input));
    expect(computeBuildKey({ ...input, files: [{ ...input.files[0], path: '/src/other.cob' }, input.files[1]] })).not.toBe(computeBuildKey(input));
  });

  it('accepts an empty file list', () => {
    expect(computeBuildKey({ ...baseInput(), files: [] })).toHaveLength(BUILD_KEY_LENGTH);
  });
});

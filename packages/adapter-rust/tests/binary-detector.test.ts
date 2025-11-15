import { describe, it, expect, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { detectBinaryFormat } from '../src/utils/binary-detector.js';

const TEMP_PREFIX = 'binary-detector-test-';

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
}

async function writeBinary(dir: string, name: string, contents: Buffer | string): Promise<string> {
  const filePath = path.join(dir, name);
  await fs.writeFile(filePath, contents);
  return filePath;
}

const tempDirs: string[] = [];

afterEach(async () => {
  while (tempDirs.length) {
    const dir = tempDirs.pop();
    if (!dir) continue;
    try {
      const entries = await fs.readdir(dir);
      for (const entry of entries) {
        await fs.rm(path.join(dir, entry), { force: true });
      }
      await fs.rmdir(dir);
    } catch {
      // ignore cleanup errors
    }
  }
});

describe('detectBinaryFormat', () => {
  it('detects MSVC binaries via RSDS signature and PDB', async () => {
    const dir = await createTempDir();
    tempDirs.push(dir);

    const exeBuffer = Buffer.from(
      'MZ' +
      'RSDS' +
      '....' +
      'vcruntime140.dll' +
      'ucrtbase.dll',
      'ascii'
    );

    const exePath = await writeBinary(dir, 'app.exe', exeBuffer);
    await writeBinary(dir, 'app.pdb', 'fake pdb');

    const info = await detectBinaryFormat(exePath);
    expect(info.hasPDB).toBe(true);
    expect(info.hasRSDS).toBe(true);
    expect(info.imports).toContain('vcruntime140.dll');
    expect(info.imports).toContain('ucrtbase.dll');
    expect(info.debugInfoType).toBe('pdb');
    expect(info.format).toBe('msvc');
  });

  it('detects GNU binaries via DWARF hints', async () => {
    const dir = await createTempDir();
    tempDirs.push(dir);

    const exeBuffer = Buffer.from(
      'MZ' +
      '.debug_info' +
      '....' +
      'msvcrt.dll',
      'ascii'
    );

    const exePath = await writeBinary(dir, 'gnu.exe', exeBuffer);

    const info = await detectBinaryFormat(exePath);
    expect(info.hasPDB).toBe(false);
    expect(info.hasRSDS).toBe(false);
    expect(info.imports).toContain('msvcrt.dll');
    expect(info.debugInfoType).toBe('dwarf');
    expect(info.format).toBe('gnu');
  });

  it('handles unknown binaries gracefully', async () => {
    const dir = await createTempDir();
    tempDirs.push(dir);

    const exePath = await writeBinary(dir, 'unknown.exe', Buffer.from('MZUNKNOWN', 'ascii'));

    const info = await detectBinaryFormat(exePath);
    expect(info.format).toBe('unknown');
    expect(info.hasPDB).toBe(false);
    expect(info.hasRSDS).toBe(false);
    expect(info.debugInfoType).toBe('none');
  });
});

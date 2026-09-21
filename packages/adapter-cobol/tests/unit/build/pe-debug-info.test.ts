import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inspectPeDebugInfo } from '../../../src/build/pe-debug-info.js';
import { peFixture } from './pe-fixture.js';

describe('prebuilt PE debug information', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(path.join(os.tmpdir(), 'cobol-pe-')); });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));
  async function inspect(buffer: Buffer) {
    const file = path.join(dir, 'app.exe');
    writeFileSync(file, buffer);
    return inspectPeDebugInfo(file);
  }

  it.each([false, true])('finds DWARF through the COFF string table in PE32=%s', async pe32 => {
    expect(await inspect(peFixture({ dwarf: true, pe32, stringOffset: 2 * 1024 * 1024 }))).toBe('dwarf');
  });
  it('accepts DWARF plus an actual CodeView record and a sibling PDB', async () => {
    writeFileSync(path.join(dir, 'app.pdb'), 'pdb');
    expect(await inspect(peFixture({ dwarf: true, pdb: true }))).toBe('dwarf');
  });
  it.each([false, true])('identifies actual PDB CodeView records (NB10=%s)', async nb10 => {
    expect(await inspect(peFixture({ pdb: true, nb10 }))).toBe('pdb-only');
  });
  it('does not mistake unrelated strings or a sibling PDB for debug information', async () => {
    const buffer = peFixture();
    buffer.write('RSDS .debug_info dwarf other.pdb', 0x600);
    writeFileSync(path.join(dir, 'app.pdb'), 'pdb');
    expect(await inspect(buffer)).toBe('unknown');
  });
  it('leaves external DWARF references unknown instead of rejecting a mixed binary', async () => {
    expect(await inspect(peFixture({ pdb: true, debugName: '.gnu_debuglink' }))).toBe('unknown');
  });
  it.each([0, 63, 130, 300, 1100])('tolerates a truncated file (%i bytes)', async length => {
    expect(await inspect(peFixture({ pdb: true }).subarray(0, length))).toBe('unknown');
  });
  it('handles absent files, non-PE files and invalid section-name offsets', async () => {
    expect(await inspectPeDebugInfo(path.join(dir, 'missing.exe'))).toBe('unknown');
    expect(await inspect(Buffer.alloc(100))).toBe('unknown');
    const buffer = peFixture({ dwarf: true, pdb: true });
    buffer.write('/999999', 0x80 + 24 + 240 + 40);
    expect(await inspect(buffer)).toBe('unknown');
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';

// Mock child_process spawnSync for PDB conversion tests
vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process');
  return { ...actual, spawnSync: vi.fn() };
});

// Mock fs for PDB conversion tests
const {
  existsSyncMock,
  readdirSyncMock,
  copyFileSyncMock,
  unlinkSyncMock
} = vi.hoisted(() => ({
  existsSyncMock: vi.fn(),
  readdirSyncMock: vi.fn(),
  copyFileSyncMock: vi.fn(),
  unlinkSyncMock: vi.fn()
}));
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: existsSyncMock,
    readdirSync: readdirSyncMock,
    copyFileSync: copyFileSyncMock,
    unlinkSync: unlinkSyncMock
  };
});

// Mock dotnet-utils isPortablePdb
const { isPortablePdbMock } = vi.hoisted(() => ({
  isPortablePdbMock: vi.fn()
}));
vi.mock('../../src/utils/dotnet-utils.js', () => ({
  isPortablePdb: isPortablePdbMock
}));

import { spawnSync } from 'child_process';
import {
  DapFrameParser,
  signHandshake,
  convertPdbs,
  restorePdbBackups
} from '../../src/utils/vsdbg-bridge.js';

const spawnSyncMock = spawnSync as unknown as vi.Mock;

// ===== DapFrameParser =====

describe('DapFrameParser', () => {
  let parser: DapFrameParser;

  beforeEach(() => {
    parser = new DapFrameParser();
  });

  it('parses a single complete DAP frame', () => {
    const body = '{"type":"request","command":"handshake"}';
    const frame = Buffer.from(`Content-Length: ${body.length}\r\n\r\n${body}`);

    const results = parser.feed(frame);

    expect(results).toHaveLength(1);
    expect(results[0].toString('utf8')).toBe(body);
  });

  it('parses multiple complete DAP frames in one chunk', () => {
    const body1 = '{"type":"event","event":"initialized"}';
    const body2 = '{"type":"response","command":"initialize"}';
    const data = Buffer.from(
      `Content-Length: ${body1.length}\r\n\r\n${body1}` +
      `Content-Length: ${body2.length}\r\n\r\n${body2}`
    );

    const results = parser.feed(data);

    expect(results).toHaveLength(2);
    expect(results[0].toString('utf8')).toBe(body1);
    expect(results[1].toString('utf8')).toBe(body2);
  });

  it('handles frames split across multiple chunks', () => {
    const body = '{"type":"request","command":"handshake","arguments":{"value":"abc123"}}';
    const full = `Content-Length: ${body.length}\r\n\r\n${body}`;
    const splitPoint = Math.floor(full.length / 2);

    const chunk1 = Buffer.from(full.slice(0, splitPoint));
    const chunk2 = Buffer.from(full.slice(splitPoint));

    const results1 = parser.feed(chunk1);
    expect(results1).toHaveLength(0);

    const results2 = parser.feed(chunk2);
    expect(results2).toHaveLength(1);
    expect(results2[0].toString('utf8')).toBe(body);
  });

  it('buffers incomplete frames and returns nothing', () => {
    const body = '{"type":"request"}';
    const partial = Buffer.from(`Content-Length: ${body.length}\r\n\r\n${body.slice(0, 5)}`);

    const results = parser.feed(partial);
    expect(results).toHaveLength(0);
    expect(parser.hasData()).toBe(true);
  });

  it('returns remainder of unparsed data', () => {
    const body = '{"type":"event"}';
    const full = `Content-Length: ${body.length}\r\n\r\n${body}`;
    const extra = 'Content-Len';
    const data = Buffer.from(full + extra);

    const results = parser.feed(data);
    expect(results).toHaveLength(1);

    const remainder = parser.getRemainder();
    expect(remainder.toString('utf8')).toBe(extra);
  });

  it('starts with no data', () => {
    expect(parser.hasData()).toBe(false);
    expect(parser.getRemainder().length).toBe(0);
  });

  it('handles frame split in the middle of Content-Length header', () => {
    const body = '{"seq":1}';
    const full = `Content-Length: ${body.length}\r\n\r\n${body}`;

    // Split in the middle of "Content-Length"
    const results1 = parser.feed(Buffer.from('Content-Le'));
    expect(results1).toHaveLength(0);

    const results2 = parser.feed(Buffer.from(full.slice('Content-Le'.length)));
    expect(results2).toHaveLength(1);
    expect(results2[0].toString('utf8')).toBe(body);
  });
});

// ===== signHandshake =====

describe('signHandshake', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it('returns empty string when vsdaPath is null', () => {
    const result = signHandshake('challenge123', null);

    expect(result).toBe('');
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('WARNING: vsda.node path not provided')
    );
  });

  it('returns empty string when vsda.node cannot be loaded', () => {
    // Use a path that will definitely fail to load
    const result = signHandshake('challenge123', '/nonexistent/vsda.node');

    expect(result).toBe('');
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('WARNING: Failed to sign handshake')
    );
  });
});

// ===== PDB Conversion =====

describe('convertPdbs', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it('skips directories that do not exist', () => {
    existsSyncMock.mockReturnValue(false);

    const backups = convertPdbs(['/nonexistent'], '/path/Pdb2Pdb.exe');

    expect(backups).toHaveLength(0);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('PDB scan dir not found')
    );
  });

  it('skips PDBs that are already portable', () => {
    existsSyncMock.mockReturnValue(true);
    readdirSyncMock.mockReturnValue(['test.pdb']);
    isPortablePdbMock.mockReturnValue(true);

    const backups = convertPdbs(['/some/dir'], '/path/Pdb2Pdb.exe');

    expect(backups).toHaveLength(0);
    expect(spawnSyncMock).not.toHaveBeenCalled();
  });

  it('skips PDBs with no matching DLL', () => {
    existsSyncMock.mockImplementation((p: string) => {
      if (p === '/some/dir') return true;
      // No matching DLL
      return false;
    });
    readdirSyncMock.mockReturnValue(['orphan.pdb']);
    isPortablePdbMock.mockReturnValue(false);

    const backups = convertPdbs(['/some/dir'], '/path/Pdb2Pdb.exe');

    expect(backups).toHaveLength(0);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('No matching DLL')
    );
  });

  it('converts Windows PDB and creates backup', () => {
    existsSyncMock.mockReturnValue(true);
    readdirSyncMock.mockReturnValue(['MyLib.pdb']);
    isPortablePdbMock.mockReturnValue(false);
    copyFileSyncMock.mockReturnValue(undefined);
    spawnSyncMock.mockReturnValue({ status: 0, stderr: Buffer.alloc(0) });

    const backups = convertPdbs(['/some/dir'], '/path/Pdb2Pdb.exe');

    expect(backups).toHaveLength(1);
    expect(backups[0].original).toContain('MyLib.pdb');
    expect(backups[0].backup).toContain('MyLib.pdb.backup');
    expect(copyFileSyncMock).toHaveBeenCalled();
    expect(spawnSyncMock).toHaveBeenCalledWith(
      '/path/Pdb2Pdb.exe',
      expect.arrayContaining([expect.stringContaining('MyLib.dll')]),
      expect.any(Object)
    );
  });

  it('handles Pdb2Pdb failure gracefully', () => {
    existsSyncMock.mockReturnValue(true);
    readdirSyncMock.mockReturnValue(['Broken.pdb']);
    isPortablePdbMock.mockReturnValue(false);
    copyFileSyncMock.mockReturnValue(undefined);
    spawnSyncMock.mockReturnValue({ status: 1, stderr: Buffer.from('conversion error') });

    const backups = convertPdbs(['/some/dir'], '/path/Pdb2Pdb.exe');

    // Still has backup entry since backup was created before failure
    expect(backups).toHaveLength(1);
    // copyFileSync should have been called twice: once for backup, once for restore
    expect(copyFileSyncMock).toHaveBeenCalledTimes(2);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('WARNING: Pdb2Pdb failed')
    );
  });
});

// ===== restorePdbBackups =====

describe('restorePdbBackups', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it('restores files from backups', () => {
    existsSyncMock.mockReturnValue(true);
    copyFileSyncMock.mockReturnValue(undefined);
    unlinkSyncMock.mockReturnValue(undefined);

    restorePdbBackups([
      { original: '/dir/MyLib.pdb', backup: '/dir/MyLib.pdb.backup' }
    ]);

    expect(copyFileSyncMock).toHaveBeenCalledWith('/dir/MyLib.pdb.backup', '/dir/MyLib.pdb');
    expect(unlinkSyncMock).toHaveBeenCalledWith('/dir/MyLib.pdb.backup');
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('Restored /dir/MyLib.pdb')
    );
  });

  it('skips missing backups gracefully', () => {
    existsSyncMock.mockReturnValue(false);

    restorePdbBackups([
      { original: '/dir/Missing.pdb', backup: '/dir/Missing.pdb.backup' }
    ]);

    expect(copyFileSyncMock).not.toHaveBeenCalled();
    expect(unlinkSyncMock).not.toHaveBeenCalled();
  });

  it('handles restore errors gracefully', () => {
    existsSyncMock.mockReturnValue(true);
    copyFileSyncMock.mockImplementation(() => { throw new Error('permission denied'); });

    restorePdbBackups([
      { original: '/dir/Locked.pdb', backup: '/dir/Locked.pdb.backup' }
    ]);

    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('WARNING: Failed to restore')
    );
  });

  it('handles empty backup array', () => {
    restorePdbBackups([]);

    expect(copyFileSyncMock).not.toHaveBeenCalled();
    expect(unlinkSyncMock).not.toHaveBeenCalled();
  });
});

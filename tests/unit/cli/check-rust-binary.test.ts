import { describe, it, expect, beforeEach, vi, afterAll } from 'vitest';

const statMock = vi.fn();
const detectBinaryFormatMock = vi.fn();

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    promises: {
      ...actual.promises,
      stat: (...args: Parameters<typeof statMock>) => statMock(...args)
    }
  };
});

vi.mock('@debugmcp/adapter-rust', () => ({
  detectBinaryFormat: (...args: Parameters<typeof detectBinaryFormatMock>) =>
    detectBinaryFormatMock(...args)
}));

const { handleCheckRustBinaryCommand } = await import('../../../src/cli/commands/check-rust-binary.js');

const stdoutWrite = vi.fn<[string | Uint8Array, unknown?], boolean>(() => true);
const stderrWrite = vi.fn<[string | Uint8Array, unknown?], boolean>(() => true);
const originalStdoutWrite = process.stdout.write;
const originalStderrWrite = process.stderr.write;

beforeEach(() => {
  statMock.mockReset();
  detectBinaryFormatMock.mockReset();
  stdoutWrite.mockReset();
  stderrWrite.mockReset();
  process.stdout.write = stdoutWrite as unknown as typeof process.stdout.write;
  process.stderr.write = stderrWrite as unknown as typeof process.stderr.write;
});

afterAll(() => {
  process.stdout.write = originalStdoutWrite;
  process.stderr.write = originalStderrWrite;
});

describe('handleCheckRustBinaryCommand', () => {
  it('throws when binary path missing', async () => {
    await expect(handleCheckRustBinaryCommand('')).rejects.toThrow('path to the Rust executable');
  });

  it('reports stat errors to stderr and rethrows', async () => {
    statMock.mockRejectedValue(new Error('not found'));
    await expect(handleCheckRustBinaryCommand('/missing/bin')).rejects.toThrow('not found');
    const errorOutput = stderrWrite.mock.calls.map(([arg]) => String(arg)).join('');
    expect(errorOutput).toContain('not found');
  });

  it('throws when provided path is not a file', async () => {
    statMock.mockResolvedValue({
      isFile: () => false
    });
    await expect(handleCheckRustBinaryCommand('/tmp')).rejects.toThrow(
      'Path does not point to a file'
    );
  });

  it('analyzes binary and prints summary as JSON', async () => {
    statMock.mockResolvedValue({
      isFile: () => true
    });
    detectBinaryFormatMock.mockResolvedValue({
      format: 'gnu',
      debugInfoType: 'dwarf',
      hasPDB: false,
      hasRSDS: false,
      imports: ['libstdc++.so', 'libgcc_s.so']
    });

    await handleCheckRustBinaryCommand('app', { json: true });

    expect(detectBinaryFormatMock).toHaveBeenCalled();
    const output = stdoutWrite.mock.calls.map(([arg]) => String(arg)).join('');
    expect(output).toContain('"format": "gnu"');
  });

  it('prints human-readable summary for MSVC binaries', async () => {
    statMock.mockResolvedValue({
      isFile: () => true
    });
    detectBinaryFormatMock.mockResolvedValue({
      format: 'msvc',
      debugInfoType: 'pdb',
      hasPDB: true,
      hasRSDS: true,
      imports: ['MSVCP140.dll']
    });

    await handleCheckRustBinaryCommand('target.exe');

    const output = stdoutWrite.mock.calls.map(([arg]) => String(arg)).join('');
    expect(output).toContain('Binary Analysis');
    expect(output).toContain('Limited support');
    expect(output).toContain('MSVCP140.dll');
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { RubyAdapterFactory } from '../../src/ruby-adapter-factory.js';
import { RubyDebugAdapter } from '../../src/ruby-debug-adapter.js';
import { DebugLanguage } from '@debugmcp/shared';

vi.mock('../../src/utils/ruby-utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/utils/ruby-utils.js')>();
  return {
    ...actual,
    findRubyExecutable: vi.fn(),
    getRubyVersion: vi.fn(),
    findRdbgExecutable: vi.fn(),
    getRdbgVersion: vi.fn()
  };
});

const { findRubyExecutable, getRubyVersion, findRdbgExecutable, getRdbgVersion } =
  await import('../../src/utils/ruby-utils.js');

const dependencies = {
  fileSystem: {} as never,
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  environment: {} as never
};

describe('RubyAdapterFactory', () => {
  afterEach(() => vi.clearAllMocks());

  it('creates a RubyDebugAdapter', () => {
    const adapter = new RubyAdapterFactory().createAdapter(dependencies as never);
    expect(adapter).toBeInstanceOf(RubyDebugAdapter);
    expect(adapter.language).toBe(DebugLanguage.RUBY);
  });

  it('exposes Ruby metadata', () => {
    const metadata = new RubyAdapterFactory().getMetadata();
    expect(metadata.language).toBe(DebugLanguage.RUBY);
    expect(metadata.displayName).toBe('Ruby');
    expect(metadata.fileExtensions).toEqual(expect.arrayContaining(['.rb', '.rake', '.gemspec']));
  });

  it('validates a healthy toolchain', async () => {
    vi.mocked(findRubyExecutable).mockResolvedValue('/usr/bin/ruby');
    vi.mocked(getRubyVersion).mockResolvedValue('3.3.0');
    vi.mocked(findRdbgExecutable).mockResolvedValue('/usr/bin/rdbg');
    vi.mocked(getRdbgVersion).mockResolvedValue('1.11.0');

    const result = await new RubyAdapterFactory().validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.details).toMatchObject({
      rubyPath: '/usr/bin/ruby',
      rubyVersion: '3.3.0',
      rdbgPath: '/usr/bin/rdbg',
      rdbgVersion: '1.11.0'
    });
  });

  it('rejects Ruby versions below 2.7', async () => {
    vi.mocked(findRubyExecutable).mockResolvedValue('/usr/bin/ruby');
    vi.mocked(getRubyVersion).mockResolvedValue('2.6.10');
    vi.mocked(findRdbgExecutable).mockResolvedValue('/usr/bin/rdbg');
    vi.mocked(getRdbgVersion).mockResolvedValue('1.9.0');

    const result = await new RubyAdapterFactory().validate();
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/2\.7 or higher/);
  });

  it('reports missing ruby and rdbg as errors', async () => {
    vi.mocked(findRubyExecutable).mockRejectedValue(new Error('Ruby not found'));
    vi.mocked(findRdbgExecutable).mockRejectedValue(new Error('rdbg not found'));

    const result = await new RubyAdapterFactory().validate();
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('Ruby'), expect.stringContaining('rdbg')])
    );
  });

  it('warns when versions cannot be determined', async () => {
    vi.mocked(findRubyExecutable).mockResolvedValue('/usr/bin/ruby');
    vi.mocked(getRubyVersion).mockResolvedValue(null);
    vi.mocked(findRdbgExecutable).mockResolvedValue('/usr/bin/rdbg');
    vi.mocked(getRdbgVersion).mockResolvedValue(null);

    const result = await new RubyAdapterFactory().validate();
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(2);
  });
});

/**
 * Unit tests for CobolAdapterFactory (issue #759): metadata, validate() and the
 * doctor row from describeToolchain(). Discovery is mocked — no CodeLLDB, no cobc.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DebugLanguage } from '@debugmcp/shared';
import type { AdapterDependencies, FactoryValidationResult } from '@debugmcp/shared';

vi.mock('@debugmcp/codelldb-common', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  resolveCodeLLDBExecutableWithSource: vi.fn(),
  getCodeLLDBVersion: vi.fn()
}));

vi.mock('../../src/build/index.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/build/index.js')>()),
  findCobc: vi.fn(),
  probeCobcVersion: vi.fn()
}));

import { resolveCodeLLDBExecutableWithSource, getCodeLLDBVersion } from '@debugmcp/codelldb-common';
import { findCobc, probeCobcVersion, type CobcLocation } from '../../src/build/index.js';
import { CobolAdapterFactory } from '../../src/cobol-adapter-factory.js';
import { CobolDebugAdapter } from '../../src/cobol-debug-adapter.js';

const cobc: CobcLocation = {
  path: '/opt/gnucobol/bin/cobc',
  binDir: '/opt/gnucobol/bin',
  prefix: '/opt/gnucobol',
  versionLine: 'cobc (GnuCOBOL) 3.2.0',
  version: '3.2.0',
  configDir: '/opt/gnucobol/share/gnucobol/config'
};

const validation = (details?: Record<string, unknown>): FactoryValidationResult => ({
  valid: true,
  errors: [],
  warnings: [],
  ...(details ? { details } : {})
});

const codelldbDetails = {
  codelldbPath: '/opt/codelldb/adapter/codelldb',
  codelldbVersion: '1.11.5',
  codelldbSource: 'vendored'
};

const createDependencies = (): AdapterDependencies => ({
  fileSystem: {} as AdapterDependencies['fileSystem'],
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  environment: {
    get: vi.fn().mockReturnValue(undefined),
    getAll: vi.fn().mockReturnValue({}),
    getCurrentWorkingDirectory: vi.fn().mockReturnValue(process.cwd())
  } as unknown as AdapterDependencies['environment']
});

describe('CobolAdapterFactory.getMetadata', () => {
  it('describes the cobol language, its extensions and spawn-style attach', () => {
    const metadata = new CobolAdapterFactory().getMetadata();

    expect(metadata).toMatchObject({
      language: DebugLanguage.COBOL,
      displayName: 'COBOL',
      fileExtensions: ['.cob', '.cbl', '.cobol', '.cpy'],
      modes: { launch: true, attach: 'spawn' }
    });
    expect(metadata.language).toBe('cobol');
  });

  it('creates a CobolDebugAdapter', () => {
    const adapter = new CobolAdapterFactory().createAdapter(createDependencies());
    expect(adapter).toBeInstanceOf(CobolDebugAdapter);
    expect(adapter.language).toBe(DebugLanguage.COBOL);
  });
});

describe('CobolAdapterFactory.validate', () => {
  beforeEach(() => {
    vi.mocked(resolveCodeLLDBExecutableWithSource).mockResolvedValue({ path: '/vendor/codelldb', source: 'vendored' });
    vi.mocked(getCodeLLDBVersion).mockResolvedValue('1.11.8');
    vi.mocked(findCobc).mockResolvedValue(cobc);
  });

  it('records both toolchains in details when everything is present', async () => {
    const result = await new CobolAdapterFactory().validate();

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.details).toEqual({
      codelldbPath: '/vendor/codelldb',
      codelldbVersion: '1.11.8',
      codelldbSource: 'vendored',
      cobcPath: cobc.path,
      cobcVersion: '3.2.0',
      cobcConfigDir: cobc.configDir,
      platform: process.platform,
      arch: process.arch,
      timestamp: expect.any(String)
    });
  });

  it('errors without CodeLLDB', async () => {
    vi.mocked(resolveCodeLLDBExecutableWithSource).mockResolvedValue(null);

    const result = await new CobolAdapterFactory().validate();

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([expect.stringMatching(/CodeLLDB not found/)]);
    expect(getCodeLLDBVersion).not.toHaveBeenCalled();
    expect(result.details).toMatchObject({ cobcPath: cobc.path });
    expect((result.details as Record<string, unknown>).codelldbPath).toBeUndefined();
  });

  it('warns without cobc and leaves the cobc details empty', async () => {
    vi.mocked(findCobc).mockResolvedValue(null);

    const result = await new CobolAdapterFactory().validate();

    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([expect.stringMatching(/GnuCOBOL \(cobc\) not found.*COBC_PATH/)]);
    const details = result.details as Record<string, unknown>;
    expect(details.cobcPath).toBeUndefined();
    expect(details.cobcVersion).toBeUndefined();
    expect(details.cobcConfigDir).toBeUndefined();
    expect(details).toMatchObject({ codelldbPath: '/vendor/codelldb', codelldbSource: 'vendored' });
  });

  it('leaves the CodeLLDB version empty when the version file cannot be read', async () => {
    vi.mocked(getCodeLLDBVersion).mockResolvedValue(null);

    const result = await new CobolAdapterFactory().validate();

    expect(result.valid).toBe(true);
    expect((result.details as Record<string, unknown>).codelldbVersion).toBeUndefined();
  });
});

describe('CobolAdapterFactory.describeToolchain', () => {
  it('renders the GnuCOBOL cell from validate()\'s path and version without probing again', async () => {
    const description = await new CobolAdapterFactory().describeToolchain(
      validation({ ...codelldbDetails, cobcPath: cobc.path, cobcVersion: '3.2.0', cobcConfigDir: cobc.configDir, platform: 'linux', arch: 'x64', timestamp: 'now' })
    );

    expect(probeCobcVersion).not.toHaveBeenCalled();
    expect(description).toEqual({
      runtime: { label: 'GnuCOBOL (cobc)', path: cobc.path, version: '3.2.0' },
      backend: { label: 'CodeLLDB', path: '/opt/codelldb/adapter/codelldb', version: '1.11.5', source: 'vendored' }
    });
  });

  it('probes the banner when validate() found cobc but recorded no version', async () => {
    vi.mocked(probeCobcVersion).mockResolvedValue('cobc (GnuCOBOL) 3.1.2.0');

    const description = await new CobolAdapterFactory().describeToolchain(validation({ cobcPath: cobc.path }));

    expect(probeCobcVersion).toHaveBeenCalledWith(cobc.path);
    // Note: the probe's raw banner is shown, whereas validate() records the parsed x.y.z.
    expect(description).toEqual({ runtime: { label: 'GnuCOBOL (cobc)', path: cobc.path, version: 'cobc (GnuCOBOL) 3.1.2.0' } });
  });

  it('falls back to the bare path when the banner probe returns nothing or fails', async () => {
    vi.mocked(probeCobcVersion).mockResolvedValue(null);
    expect(await new CobolAdapterFactory().describeToolchain(validation({ cobcPath: cobc.path })))
      .toEqual({ runtime: { label: 'GnuCOBOL (cobc)', path: cobc.path } });

    vi.mocked(probeCobcVersion).mockRejectedValue(new Error('spawn failed'));
    expect(await new CobolAdapterFactory().describeToolchain(validation({ cobcPath: cobc.path })))
      .toEqual({ runtime: { label: 'GnuCOBOL (cobc)', path: cobc.path } });
  });

  it('does not probe at all when validate() found no cobc, and still renders the CodeLLDB cell', async () => {
    const description = await new CobolAdapterFactory().describeToolchain(validation(codelldbDetails));

    expect(probeCobcVersion).not.toHaveBeenCalled();
    expect(description).toEqual({
      backend: { label: 'CodeLLDB', path: '/opt/codelldb/adapter/codelldb', version: '1.11.5', source: 'vendored' }
    });
  });

  it('renders empty cells when validate() produced no details', async () => {
    expect(await new CobolAdapterFactory().describeToolchain({ valid: false, errors: [], warnings: [] })).toEqual({});
  });

  it('skips the banner probe when the advisory budget is exhausted', async () => {
    const description = await new CobolAdapterFactory().describeToolchain(validation({ cobcPath: cobc.path }), { timeoutMs: 50 });

    expect(probeCobcVersion).not.toHaveBeenCalled();
    expect(description).toEqual({ runtime: { label: 'GnuCOBOL (cobc)', path: cobc.path } });
  });

  it('still resolves with the detail-derived cells when the banner probe hangs, inside the budget', async () => {
    vi.mocked(probeCobcVersion).mockReturnValue(new Promise(() => undefined));

    const description = await new CobolAdapterFactory().describeToolchain(
      validation({ ...codelldbDetails, cobcPath: cobc.path }),
      { timeoutMs: 300 }
    );

    expect(description).toEqual({
      runtime: { label: 'GnuCOBOL (cobc)', path: cobc.path },
      backend: { label: 'CodeLLDB', path: '/opt/codelldb/adapter/codelldb', version: '1.11.5', source: 'vendored' }
    });
  });
});

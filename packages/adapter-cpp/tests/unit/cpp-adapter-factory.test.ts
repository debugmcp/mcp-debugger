import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DebugLanguage } from '@debugmcp/shared';
import { CppAdapterFactory } from '../../src/cpp-adapter-factory.js';
import { getCompilerInfo } from '../../src/utils/compile-utils.js';

vi.mock('../../src/utils/compile-utils.js', () => ({
  findAnyCompiler: vi.fn(),
  getCompilerInfo: vi.fn()
}));

const getCompilerInfoMock = vi.mocked(getCompilerInfo);

const validation = (details: Record<string, unknown>) => ({
  valid: true,
  errors: [],
  warnings: [],
  details
});

describe('CppAdapterFactory', () => {
  it('returns accurate adapter metadata', () => {
    const metadata = new CppAdapterFactory().getMetadata();

    expect(metadata).toMatchObject({
      language: DebugLanguage.CPP,
      displayName: 'C/C++',
      modes: { launch: true, attach: 'spawn' }
    });
  });
});

describe('CppAdapterFactory.describeToolchain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCompilerInfoMock.mockReset();
  });

  it('reuses the validate()-discovered compiler command and shows its version banner', async () => {
    getCompilerInfoMock.mockResolvedValue({ command: 'g++', version: 'g++ (GCC) 13.2.0' });

    const description = await new CppAdapterFactory().describeToolchain(
      validation({
        codelldbPath: '/opt/codelldb/adapter/codelldb',
        codelldbVersion: '1.11.5',
        codelldbSource: 'platform-package',
        compiler: 'g++',
        platform: 'linux',
        arch: 'x64',
        timestamp: 'now'
      })
    );

    expect(getCompilerInfoMock).toHaveBeenCalledWith('g++');
    expect(description).toEqual({
      runtime: { label: 'C/C++ compiler', version: 'g++ (GCC) 13.2.0' },
      backend: {
        label: 'CodeLLDB',
        path: '/opt/codelldb/adapter/codelldb',
        version: '1.11.5',
        source: 'platform-package'
      }
    });
  });

  it('falls back to the bare command when no version banner was captured', async () => {
    getCompilerInfoMock.mockResolvedValue({ command: 'g++', version: null });

    const description = await new CppAdapterFactory().describeToolchain(
      validation({ compiler: 'g++' })
    );

    expect(description).toEqual({
      runtime: { label: 'C/C++ compiler', path: 'g++' }
    });
  });

  it('falls back to the bare command when the banner probe fails outright', async () => {
    getCompilerInfoMock.mockRejectedValue(new Error('spawn failed'));

    const description = await new CppAdapterFactory().describeToolchain(
      validation({ compiler: 'g++' })
    );

    expect(description).toEqual({
      runtime: { label: 'C/C++ compiler', path: 'g++' }
    });
  });

  it('does not probe at all when validate() found no compiler', async () => {
    const description = await new CppAdapterFactory().describeToolchain(
      validation({
        codelldbPath: '/opt/codelldb/adapter/codelldb',
        codelldbVersion: '1.11.5',
        codelldbSource: 'vendored'
      })
    );

    expect(getCompilerInfoMock).not.toHaveBeenCalled();
    expect(description).toEqual({
      backend: {
        label: 'CodeLLDB',
        path: '/opt/codelldb/adapter/codelldb',
        version: '1.11.5',
        source: 'vendored'
      }
    });
  });

  it('renders empty cells when validate() produced no details', async () => {
    expect(
      await new CppAdapterFactory().describeToolchain({ valid: false, errors: [], warnings: [] })
    ).toEqual({});
  });
});

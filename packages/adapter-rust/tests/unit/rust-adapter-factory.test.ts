import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { EventEmitter } from 'events';
import { DebugLanguage } from '@debugmcp/shared';
import { RustAdapterFactory } from '../../src/rust-adapter-factory.js';

const spawnMock: Mock = vi.fn();

vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process');
  return {
    ...actual,
    spawn: (...args: Parameters<typeof actual.spawn>) => spawnMock(...args)
  };
});

// CodeLLDB resolution is filesystem-only; pin it so validate() is about cargo.
vi.mock('../../src/utils/codelldb-resolver.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  resolveCodeLLDBExecutableWithSource: vi.fn(async () => ({ path: '/mock/codelldb', source: 'vendored' })),
  getCodeLLDBVersion: vi.fn(async () => '1.11.8')
}));

const cargoChild = (stdout: string, code: number) => {
  const proc = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  queueMicrotask(() => {
    proc.stdout.emit('data', Buffer.from(stdout));
    proc.emit('exit', code, null);
    proc.emit('close', code, null);
  });
  return proc;
};

beforeEach(() => {
  spawnMock.mockReset();
});

describe('RustAdapterFactory', () => {
  it('returns accurate adapter metadata', () => {
    const metadata = new RustAdapterFactory().getMetadata();

    expect(metadata).toMatchObject({
      language: DebugLanguage.RUST,
      displayName: 'Rust',
      fileExtensions: ['.rs'],
      modes: { launch: true, attach: 'none' }
    });
  });
});

// Issue #968: the toolchain probe is one `cargo -vV`, not three shell spawns.
describe('RustAdapterFactory.validate', () => {
  it('probes the toolchain with a single cargo -vV and reports its version and host', async () => {
    spawnMock.mockImplementation(() =>
      cargoChild('cargo 1.94.1 (29ea6fb6a 2026-03-24)\nrelease: 1.94.1\nhost: x86_64-unknown-linux-gnu\n', 0)
    );

    const result = await new RustAdapterFactory().validate();

    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(spawnMock.mock.calls[0].slice(0, 2)).toEqual(['cargo', ['-vV']]);
    expect(result).toMatchObject({ valid: true, errors: [], warnings: [] });
    expect(result.details).toMatchObject({
      cargoVersion: '1.94.1',
      hostTriple: 'x86_64-unknown-linux-gnu',
      codelldbPath: '/mock/codelldb',
      codelldbSource: 'vendored'
    });
  });

  it('keeps the MSVC warning, now read from cargo', async () => {
    spawnMock.mockImplementation(() => cargoChild('cargo 1.94.1 (x)\nhost: x86_64-pc-windows-msvc\n', 0));

    const result = await new RustAdapterFactory().validate();

    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([
      'Rust MSVC toolchain detected. CodeLLDB works best with the GNU toolchain (x86_64-pc-windows-gnu) or DWARF debug info.'
    ]);
  });

  it('warns that cargo is missing when it cannot be spawned', async () => {
    spawnMock.mockImplementation(() => {
      const proc = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter };
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();
      queueMicrotask(() => proc.emit('error', new Error('spawn cargo ENOENT')));
      return proc;
    });

    const result = await new RustAdapterFactory().validate();

    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual(['Cargo not found. Install Rust from https://rustup.rs/']);
    expect(result.details).toMatchObject({ cargoVersion: undefined, hostTriple: undefined });
  });
});

describe('RustAdapterFactory.describeToolchain', () => {
  it('renders Rust and CodeLLDB cells from its own validate() details', async () => {
    const description = await new RustAdapterFactory().describeToolchain({
      valid: true,
      errors: [],
      warnings: [],
      details: {
        codelldbPath: '/opt/codelldb/adapter/codelldb',
        codelldbVersion: '1.11.5',
        codelldbSource: 'vendored',
        cargoVersion: 'cargo 1.82.0',
        hostTriple: 'x86_64-unknown-linux-gnu',
        platform: 'linux',
        arch: 'x64',
        timestamp: 'now'
      }
    });

    expect(description).toEqual({
      runtime: { label: 'Rust', version: 'cargo 1.82.0' },
      backend: {
        label: 'CodeLLDB',
        path: '/opt/codelldb/adapter/codelldb',
        version: '1.11.5',
        source: 'vendored'
      }
    });
  });

  it('omits undetected components and renders empty cells without details', async () => {
    const factory = new RustAdapterFactory();

    expect(
      await factory.describeToolchain({
        valid: false,
        errors: ['CodeLLDB not found'],
        warnings: [],
        details: { cargoVersion: 'cargo 1.82.0' }
      })
    ).toEqual({ runtime: { label: 'Rust', version: 'cargo 1.82.0' } });

    expect(
      await factory.describeToolchain({ valid: false, errors: [], warnings: [] })
    ).toEqual({});
  });
});

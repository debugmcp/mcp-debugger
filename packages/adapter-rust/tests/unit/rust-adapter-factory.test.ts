import { describe, it, expect } from 'vitest';
import { DebugLanguage } from '@debugmcp/shared';
import { RustAdapterFactory } from '../../src/rust-adapter-factory.js';

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

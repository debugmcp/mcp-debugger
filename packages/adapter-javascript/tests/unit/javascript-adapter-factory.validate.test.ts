import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { JavascriptAdapterFactory } from '../../src/index.js';

function norm(p: unknown): string {
  return typeof p === 'string' ? p.replace(/\\+/g, '/') : '';
}

function isVendorPath(p: unknown): boolean {
  return norm(p).endsWith('/vendor/js-debug/vsDebugServer.js');
}

describe('JavascriptAdapterFactory.validate', () => {
  const originalPath = process.env.PATH;
  let versionDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    // Save original process.version descriptor so we can restore it
    versionDescriptor = Object.getOwnPropertyDescriptor(process, 'version');
  });

  afterEach(() => {
    // Restore PATH
    process.env.PATH = originalPath;
    // Restore process.version
    if (versionDescriptor) {
      Object.defineProperty(process, 'version', versionDescriptor);
    }
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('returns valid when Node >= 14 and vendor present (warnings may vary by TS runner presence)', async () => {
    // Vendor present
    vi.spyOn(fs, 'existsSync').mockImplementation((p: unknown) => {
      return isVendorPath(p);
    });
    // Keep PATH controlled (no runners => may warn)
    process.env.PATH = '';

    const factory = new JavascriptAdapterFactory();
    const res = await factory.validate();

    expect(res.valid).toBe(true);
    expect(res.errors).toEqual([]);
    // Warning may or may not include TS runner depending on environment; just ensure array exists
    expect(Array.isArray(res.warnings)).toBe(true);
  });

  it('flags error when Node version is too old (< 14)', async () => {
    // Force Node v12
    Object.defineProperty(process, 'version', {
      configurable: true,
      get: () => 'v12.22.0'
    });

    // Vendor present
    vi.spyOn(fs, 'existsSync').mockImplementation((p: unknown) => {
      return isVendorPath(p);
    });
    process.env.PATH = '';

    const factory = new JavascriptAdapterFactory();
    const res = await factory.validate();

    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.includes('Node.js 14+ required') && e.includes('v12.22.0'))).toBe(true);
  });

  it('flags error when js-debug vendor is missing', async () => {
    // Vendor missing
    vi.spyOn(fs, 'existsSync').mockImplementation(() => false);
    process.env.PATH = '';

    const factory = new JavascriptAdapterFactory();
    const res = await factory.validate();

    expect(res.valid).toBe(false);
    expect(res.errors).toContain('js-debug adapter not found. Run build script to vendor js-debug');
  });

  it('emits warning when no TS runner (tsx or ts-node) is found', async () => {
    // Vendor present, but no TS runners anywhere
    vi.spyOn(fs, 'existsSync').mockImplementation((p: unknown) => {
      return isVendorPath(p);
    });
    process.env.PATH = '';

    const factory = new JavascriptAdapterFactory();
    const res = await factory.validate();

    expect(res.valid).toBe(true);
    expect(res.errors).toEqual([]);
    expect(res.warnings).toContain('No TypeScript runner found. Install tsx or ts-node for TS debugging');
  });

  it('does not warn about TS runner when tsx is present on PATH', async () => {
    const isWin = process.platform === 'win32';
    const fakeBin = isWin ? 'C:\\\\fake\\\\bin' : '/tmp/fake/bin';

    // Vendor present + simulate tsx in PATH
    vi.spyOn(fs, 'existsSync').mockImplementation((p: unknown) => {
      const s = norm(p);
      if (isVendorPath(s)) return true;

      // Simulate PATH tsx presence for platform variants
      const tsxNoExt = norm(path.join(fakeBin, 'tsx'));
      const tsxCmd = norm(path.join(fakeBin, 'tsx.cmd'));
      const tsxExe = norm(path.join(fakeBin, 'tsx.exe'));
      if (s === tsxNoExt || s === tsxCmd || s === tsxExe) {
        return true;
      }
      return false;
    });

    // Set PATH to include our fake bin
    const delim = path.delimiter;
    process.env.PATH = [fakeBin].join(delim);

    const factory = new JavascriptAdapterFactory();
    const res = await factory.validate();

    expect(res.valid).toBe(true);
    expect(res.errors).toEqual([]);
    expect(res.warnings).not.toContain('No TypeScript runner found. Install tsx or ts-node for TS debugging');
  });
});

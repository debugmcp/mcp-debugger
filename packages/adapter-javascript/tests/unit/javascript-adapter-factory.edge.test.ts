/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { JavascriptAdapterFactory } from '../../src/index.js';

function norm(p: unknown): string {
  return typeof p === 'string' ? (p as string).replace(/\\+/g, '/') : '';
}
function isVendorPath(p: unknown): boolean {
  return norm(p).endsWith('/vendor/js-debug/vsDebugServer.js');
}

describe('JavascriptAdapterFactory.validate (edge branches)', () => {
  const originalPath = process.env.PATH;
  let versionDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    versionDescriptor = Object.getOwnPropertyDescriptor(process, 'version');
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.PATH = originalPath;
    if (versionDescriptor) {
      Object.defineProperty(process, 'version', versionDescriptor);
    }
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('vendor existsSync throws -> treated as missing (error path catch branch)', async () => {
    // Simulate fs.existsSync throwing when checking vendor path
    vi.spyOn(fs, 'existsSync').mockImplementation((p: unknown) => {
      const s = norm(p);
      if (isVendorPath(s)) {
        throw new Error('fs error');
      }
      return false;
    });
    process.env.PATH = '';

    const factory = new JavascriptAdapterFactory();
    const res = await factory.validate();

    expect(res.valid).toBe(false);
    expect(res.errors).toContain('js-debug adapter not found. Run build script to vendor js-debug');
  });

  it('TS runner detection: both tsx and ts-node found in first PATH dir triggers early break, no warning', async () => {
    // Vendor present
    vi.spyOn(fs, 'existsSync').mockImplementation((p: unknown) => {
      const s = norm(p);
      if (isVendorPath(s)) return true;

      // Simulate A contains both tsx and ts-node for platform variants
      const A = path.resolve(process.cwd(), 'A');
      const tsxNoExt = norm(path.join(A, 'tsx'));
      const tsxCmd = norm(path.join(A, 'tsx.cmd'));
      const tsxExe = norm(path.join(A, 'tsx.exe'));
      const tsnodeNoExt = norm(path.join(A, 'ts-node'));
      const tsnodeCmd = norm(path.join(A, 'ts-node.cmd'));
      const tsnodeExe = norm(path.join(A, 'ts-node.exe'));

      if ([tsxNoExt, tsxCmd, tsxExe, tsnodeNoExt, tsnodeCmd, tsnodeExe].includes(s)) {
        return true;
      }
      // Any other path -> not found
      return false;
    });

    const A = path.resolve(process.cwd(), 'A');
    const B = path.resolve(process.cwd(), 'B');
    process.env.PATH = [A, B].join(path.delimiter);

    const factory = new JavascriptAdapterFactory();
    const res = await factory.validate();

    expect(res.valid).toBe(true);
    expect(res.errors).toEqual([]);
    expect(res.warnings).not.toContain('No TypeScript runner found. Install tsx or ts-node for TS debugging');
    // Extra sanity: both found indicators
    expect((res.details as any)?.tsxFound).toBe(true);
    expect((res.details as any)?.tsNodeFound).toBe(true);
  });

  it('existsSafe swallows fs errors for PATH entries (no throw) and still returns a result', async () => {
    // Vendor present
    vi.spyOn(fs, 'existsSync').mockImplementation((p: unknown) => {
      const s = norm(p);
      if (isVendorPath(s)) return true;

      // Throw for some PATH entries, return false for others
      if (s.includes('/throw-this/')) {
        throw new Error('fs path error');
      }
      return false;
    });

    const A = path.resolve(process.cwd(), 'throw-this');
    const B = path.resolve(process.cwd(), 'other');
    process.env.PATH = [A, B].join(path.delimiter);

    const factory = new JavascriptAdapterFactory();
    const res = await factory.validate();

    // Should complete without throwing; validity depends solely on vendor (true)
    expect(res.valid).toBe(true);
    // Warning likely present because no runner positively found; accept any array
    expect(Array.isArray(res.warnings)).toBe(true);
  });
});

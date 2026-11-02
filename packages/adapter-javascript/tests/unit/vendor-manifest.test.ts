/**
 * Drift guard for the js-debug pin (issue #1049), the twin of the CodeLLDB one in
 * packages/codelldb-common/tests/codelldb-resolver.test.ts. The vendor script trusts
 * the manifest's shape, so a half-edited bump — version moved, asset name or derived
 * digest not — must fail here, not in the first `pnpm install` after the merge.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const manifestPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../vendor-manifest.json');
const pin = JSON.parse(readFileSync(manifestPath, 'utf8'))['js-debug'] as {
  version: string;
  upstream: string;
  assets: Record<string, string>;
  derived?: Record<string, string>;
};
const HEX64 = /^[0-9a-f]{64}$/;

describe('js-debug vendor-manifest.json (issue #1049)', () => {
  it('pins a release tag of the upstream repository', () => {
    expect(pin.version).toMatch(/^v\d+\.\d+\.\d+$/);
    expect(pin.upstream).toBe('https://github.com/microsoft/vscode-js-debug');
  });

  it('names exactly the DAP tarball of that tag, with its sha256', () => {
    expect(Object.keys(pin.assets)).toEqual([`js-debug-dap-${pin.version}.tar.gz`]);
    for (const digest of Object.values(pin.assets)) expect(digest).toMatch(HEX64);
  });

  it('records the derived digest the vendor script enforces', () => {
    expect(pin.derived?.['vsDebugServer.js']).toMatch(HEX64);
  });
});

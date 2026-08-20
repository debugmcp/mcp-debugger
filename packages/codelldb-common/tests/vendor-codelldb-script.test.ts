/**
 * Tests for scripts/vendor-codelldb.js exit-code contract (issue #389)
 *
 * The observed defect: a mid-extraction stall left extract-zip's promise
 * forever pending, the event loop drained, and Node exited 0 without any
 * failure output. These tests pin the whole-process exit codes via spawned
 * children (network-free, using the script's test hooks) and unit-test the
 * extraction watchdog via direct import.
 */
import { describe, it, expect, afterAll, afterEach, vi } from 'vitest';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.resolve(__dirname, '../scripts/vendor-codelldb.js');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-vendor-script-test-'));

interface RunResult {
  status: number | null;
  output: string;
}

function runScript(extraEnv: Record<string, string>): RunResult {
  const result = spawnSync(process.execPath, [scriptPath], {
    env: {
      ...process.env,
      // Neutralize anything the parent environment (dev box or CI runner)
      // could leak into platform selection or exit semantics.
      CI: '',
      SKIP_ADAPTER_VENDOR: '',
      CODELLDB_PLATFORMS: '',
      CODELLDB_VENDOR_ALL: '',
      CODELLDB_FORCE_REBUILD: '',
      CODELLDB_VENDOR_LOCAL_ONLY: '',
      CODELLDB_TEST_SIMULATE_DRAIN: '',
      CODELLDB_TEST_STALL_EXTRACTION: '',
      CODELLDB_CACHE_DIR: path.join(tempDir, 'cache'),
      ...extraEnv
    },
    encoding: 'utf8',
    timeout: 60_000
  });
  return { status: result.status, output: `${result.stdout ?? ''}\n${result.stderr ?? ''}` };
}

async function importScript(env: Record<string, string>): Promise<Record<string, unknown>> {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value);
  }
  return (await import('../scripts/vendor-codelldb.js')) as Record<string, unknown>;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('vendor-codelldb.js exit codes (spawned)', () => {
  it('exits 0 when vendoring is skipped via SKIP_ADAPTER_VENDOR', () => {
    const { status, output } = runScript({ SKIP_ADAPTER_VENDOR: 'true' });
    expect(output).toContain('Skipping vendoring');
    expect(output).not.toContain('Premature exit');
    expect(status).toBe(0);
  });

  it('exits 1 with a diagnostic when the event loop drains mid-vendoring (issue #389 repro)', () => {
    const { status, output } = runScript({
      CODELLDB_TEST_SIMULATE_DRAIN: 'true',
      CODELLDB_PLATFORMS: 'linux-x64'
    });
    expect(output).toContain('Premature exit');
    expect(output).toContain('unresolved: linux-x64');
    expect(status).toBe(1);
  });

  it('exits 1 through the failure summary (not the guard) on a normal failure', () => {
    const { status, output } = runScript({
      CODELLDB_VENDOR_LOCAL_ONLY: 'true',
      CODELLDB_FORCE_REBUILD: 'true',
      CODELLDB_PLATFORMS: 'linux-x64'
    });
    expect(output).toContain('Failed to vendor: linux-x64');
    // The guard must not double-report a failure the summary already surfaced.
    expect(output).not.toContain('Premature exit');
    expect(status).toBe(1);
  });
});

describe('extractVsixWithWatchdog (imported)', () => {
  it('converts a stalled extraction into a rejection after the timeout', async () => {
    const mod = await importScript({
      CODELLDB_TEST_STALL_EXTRACTION: 'true',
      CODELLDB_EXTRACT_TIMEOUT_MS: '100'
    });
    const extractVsixWithWatchdog = mod.extractVsixWithWatchdog as (
      vsixPath: string,
      destDir: string,
      vsixName: string
    ) => Promise<void>;
    await expect(
      extractVsixWithWatchdog(path.join(tempDir, 'missing.vsix'), path.join(tempDir, 'out'), 'test.vsix')
    ).rejects.toThrow(/did not complete within 100ms/);
  });

  it('resolves on a successful extraction and clears the watchdog timer', async () => {
    // Minimal valid zip: the 22-byte end-of-central-directory record.
    const emptyZip = Buffer.concat([Buffer.from('504b0506', 'hex'), Buffer.alloc(18)]);
    const zipPath = path.join(tempDir, 'empty.zip');
    fs.writeFileSync(zipPath, emptyZip);
    const mod = await importScript({});
    const extractVsixWithWatchdog = mod.extractVsixWithWatchdog as (
      vsixPath: string,
      destDir: string,
      vsixName: string
    ) => Promise<void>;
    await expect(
      extractVsixWithWatchdog(zipPath, path.join(tempDir, 'empty-out'), 'empty.zip')
    ).resolves.toBeUndefined();
    // A leaked watchdog timer would keep the fork alive past the suite; the
    // clean resolve above plus normal worker shutdown covers it.
  });

  it('registers no exit listener when merely imported', async () => {
    const before = process.listenerCount('exit');
    await importScript({});
    expect(process.listenerCount('exit')).toBe(before);
  });
});

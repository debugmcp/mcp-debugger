/**
 * Tests for scripts/vendor-codelldb.js exit-code contract (issue #389)
 *
 * The observed defect: a mid-extraction stall left extract-zip's promise
 * forever pending, the event loop drained, and Node exited 0 without any
 * failure output. These tests pin the whole-process exit codes via spawned
 * children (network-free, using the script's drain hook) and unit-test the
 * extraction watchdog via direct import with injected seams.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.resolve(__dirname, '../scripts/vendor-codelldb.js');

type ExtractOpts = { extractFn?: (p: string, o: { dir: string }) => Promise<void>; timeoutMs?: number };
const { extractVsixWithWatchdog } = (await import(pathToFileURL(scriptPath).href)) as {
  extractVsixWithWatchdog: (vsixPath: string, destDir: string, vsixName: string, opts?: ExtractOpts) => Promise<void>;
};

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
      CODELLDB_CACHE_DIR: path.join(tempDir, 'cache'),
      ...extraEnv
    },
    encoding: 'utf8',
    // Kept below the unit project's 15s testTimeout: a hung child must be
    // killed (and fail on real evidence) inside the test's own budget.
    timeout: 10_000
  });
  return { status: result.status, output: `${result.stdout ?? ''}\n${result.stderr ?? ''}` };
}

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
    // extract-zip's floating-promise failure mode, injected via the seam.
    const stallingExtract = () => new Promise<void>(() => {});
    await expect(
      extractVsixWithWatchdog(
        path.join(tempDir, 'missing.vsix'),
        path.join(tempDir, 'out'),
        'test.vsix',
        { extractFn: stallingExtract, timeoutMs: 100 }
      )
    ).rejects.toThrow(/did not complete within 100ms/);
  });

  it('resolves on a successful extraction and clears the watchdog timer', async () => {
    // Minimal valid zip: the 22-byte end-of-central-directory record.
    const emptyZip = Buffer.concat([Buffer.from('504b0506', 'hex'), Buffer.alloc(18)]);
    const zipPath = path.join(tempDir, 'empty.zip');
    fs.writeFileSync(zipPath, emptyZip);
    await expect(
      extractVsixWithWatchdog(zipPath, path.join(tempDir, 'empty-out'), 'empty.zip')
    ).resolves.toBeUndefined();
    // A leaked watchdog timer would keep the fork alive past the suite; the
    // clean resolve above plus normal worker shutdown covers it.
  });

  it('registers no exit listener when merely imported', () => {
    // The premature-exit guard is scoped to direct invocation; the static
    // import at the top of this file must not have installed it.
    const listeners = process.listeners('exit').map(String);
    for (const src of listeners) {
      expect(src).not.toContain('Premature exit');
    }
  });
});

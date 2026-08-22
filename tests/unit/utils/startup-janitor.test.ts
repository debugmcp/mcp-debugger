/**
 * Unit tests for the startup janitor (issue #399): one shared process scan
 * feeding both orphan reapers, an env opt-out, and the stale session-run
 * log sweep (deferred here from issue #403).
 */
import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { runStartupJanitor, sweepStaleSessionRuns } from '../../../src/utils/startup-janitor.js';
import type { ScannedProcess } from '../../../src/utils/process-scan.js';

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
}

describe('runStartupJanitor', () => {
  const jvmRow: ScannedProcess = {
    pid: 100,
    args: ['java', '-Dmcp.debugger.jvm=true', '-Dmcp.debugger.owner_pid=7', 'Main']
  };
  const proxyRow: ScannedProcess = {
    pid: 200,
    args: ['node', 'dist/proxy/proxy-bootstrap.js', '--mcp-owner-pid=7', '--mcp-session-id=s1']
  };
  const noiseRow: ScannedProcess = { pid: 300, args: ['bash'] };

  it('scans once and feeds both reapers from the same result', async () => {
    const scan = vi.fn().mockResolvedValue([jvmRow, proxyRow, noiseRow]);
    const reapJvms = vi.fn().mockResolvedValue({ scanned: 1, killed: [], skipped: [], errors: [] });
    const reapProxies = vi.fn().mockResolvedValue({ scanned: 1, killed: [], skipped: [], errors: [] });

    await runStartupJanitor({
      logger: makeLogger(),
      selfPid: 1,
      env: {},
      scan,
      reapJvms,
      reapProxies,
      sweep: vi.fn().mockResolvedValue({ removedRuns: 0 })
    });

    expect(scan).toHaveBeenCalledTimes(1);
    expect(scan).toHaveBeenCalledWith({ windowsProcessNames: ['java.exe', 'node.exe'] });

    // Each reaper received a lister derived from the shared scan
    const jvmLister = reapJvms.mock.calls[0][0].lister;
    await expect(jvmLister()).resolves.toEqual([
      { pid: 100, ownerPid: 7, sessionTag: '' }
    ]);
    const proxyLister = reapProxies.mock.calls[0][0].lister;
    await expect(proxyLister()).resolves.toEqual([
      { pid: 200, ownerPid: 7, sessionId: 's1' }
    ]);
  });

  it('skips the reapers entirely when MCP_SKIP_ORPHAN_REAPERS=1', async () => {
    const scan = vi.fn();
    const reapJvms = vi.fn();
    const reapProxies = vi.fn();

    await runStartupJanitor({
      logger: makeLogger(),
      selfPid: 1,
      env: { MCP_SKIP_ORPHAN_REAPERS: '1' },
      scan,
      reapJvms,
      reapProxies,
      sweep: vi.fn().mockResolvedValue({ removedRuns: 0 })
    });

    expect(scan).not.toHaveBeenCalled();
    expect(reapJvms).not.toHaveBeenCalled();
    expect(reapProxies).not.toHaveBeenCalled();
  });

  it('logs kill counts and never throws when a reaper rejects', async () => {
    const logger = makeLogger();
    const scan = vi.fn().mockResolvedValue([]);
    const reapJvms = vi.fn().mockResolvedValue({
      scanned: 1,
      killed: [{ pid: 100, ownerPid: 7, sessionTag: 't' }],
      skipped: [],
      errors: []
    });
    const reapProxies = vi.fn().mockRejectedValue(new Error('reaper exploded'));

    await expect(runStartupJanitor({
      logger,
      selfPid: 1,
      env: {},
      scan,
      reapJvms,
      reapProxies,
      sweep: vi.fn().mockResolvedValue({ removedRuns: 0 })
    })).resolves.toBeUndefined();

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Reaped 1 orphan JVM'));
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('reaper exploded'));
  });
});

describe('sweepStaleSessionRuns', () => {
  function makeSessionsDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'janitor-sweep-test-'));
  }

  it('removes run dirs older than the age cap and keeps fresh ones', async () => {
    const base = makeSessionsDir();
    try {
      const staleRun = path.join(base, 'sess-1', 'run-1000');
      const freshRun = path.join(base, 'sess-1', 'run-2000');
      fs.mkdirSync(staleRun, { recursive: true });
      fs.mkdirSync(freshRun, { recursive: true });
      fs.writeFileSync(path.join(staleRun, 'proxy-sess-1.log'), 'old');
      fs.writeFileSync(path.join(freshRun, 'dap-trace-sess-1.ndjson'), 'new');
      const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      fs.utimesSync(staleRun, old, old);

      const result = await sweepStaleSessionRuns({ baseDir: base });

      expect(result.removedRuns).toBe(1);
      expect(fs.existsSync(staleRun)).toBe(false);
      expect(fs.existsSync(freshRun)).toBe(true);
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  });

  it('removes a session dir once all its runs are gone', async () => {
    const base = makeSessionsDir();
    try {
      const staleRun = path.join(base, 'sess-2', 'run-1000');
      fs.mkdirSync(staleRun, { recursive: true });
      fs.writeFileSync(path.join(staleRun, 'proxy-sess-2.log'), 'old');
      const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      fs.utimesSync(staleRun, old, old);

      await sweepStaleSessionRuns({ baseDir: base });

      expect(fs.existsSync(path.join(base, 'sess-2'))).toBe(false);
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  });

  it('is silent and safe when the base dir does not exist', async () => {
    await expect(
      sweepStaleSessionRuns({ baseDir: path.join(os.tmpdir(), 'janitor-nonexistent-xyz') })
    ).resolves.toEqual({ removedRuns: 0 });
  });
});

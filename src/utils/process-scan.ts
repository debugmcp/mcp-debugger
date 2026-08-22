/**
 * Shared cross-platform process scan (issue #399).
 *
 * Both orphan reapers need the same raw data — (pid, argv) for running
 * processes — and used to gather it independently: two /proc walks on Linux,
 * two identical `ps -ww -A` execs on Darwin. One scan now produces the rows
 * and each reaper contributes a matcher over them. Windows stays one
 * name-filtered CIM query per process name (java.exe / node.exe): a single
 * unfiltered Win32_Process query would be strictly more expensive than the
 * two filtered ones.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import { forEachBounded } from './bounded-concurrency.js';
import { PROC_SCAN_CONCURRENCY } from './proc-scan-concurrency.js';

const execFileAsync = promisify(execFile);

const LIST_TIMEOUT_MS = 5000;
const LIST_MAX_BUFFER = 10 * 1024 * 1024;

export interface ScannedProcess {
  pid: number;
  args: string[];
}

export interface ProcessScanOptions {
  /** win32 only: Win32_Process Name filters, one CIM query per name. */
  windowsProcessNames: string[];
}

export async function scanProcessArgs(options: ProcessScanOptions): Promise<ScannedProcess[]> {
  switch (process.platform) {
    case 'linux':
      return scanLinux();
    case 'darwin':
      return scanDarwin();
    case 'win32':
      return scanWindows(options.windowsProcessNames);
    default:
      return [];
  }
}

/** @internal Exposed for unit tests; not part of the public module API. */
export async function scanLinux(): Promise<ScannedProcess[]> {
  let entries: string[];
  try {
    entries = await fs.readdir('/proc');
  } catch {
    return [];
  }
  const result: ScannedProcess[] = [];
  await forEachBounded(entries, PROC_SCAN_CONCURRENCY, async (entry) => {
    if (!/^\d+$/.test(entry)) return;
    const pid = Number(entry);
    let raw: string;
    try {
      raw = await fs.readFile(`/proc/${entry}/cmdline`, 'utf8');
    } catch {
      return; // disappeared, or permission denied
    }
    const args = raw.split('\0').filter((s) => s.length > 0);
    result.push({ pid, args });
  });
  return result;
}

/** @internal Exposed for unit tests; not part of the public module API. */
export async function scanDarwin(): Promise<ScannedProcess[]> {
  // -ww disables column truncation; otherwise long cmdlines lose the marker
  // args the reapers depend on. -A lists all users' processes (matchers
  // filter by owner_pid liveness anyway).
  const { stdout } = await execFileAsync('ps', ['-ww', '-A', '-o', 'pid=,command='], {
    timeout: LIST_TIMEOUT_MS,
    maxBuffer: LIST_MAX_BUFFER,
  });
  const result: ScannedProcess[] = [];
  for (const line of stdout.split('\n')) {
    const trimmed = line.replace(/\s+$/, '');
    if (!trimmed) continue;
    const match = trimmed.match(/^\s*(\d+)\s+(.*)$/);
    if (!match) continue;
    const pid = Number(match[1]);
    const args = match[2].split(/\s+/).filter(Boolean);
    result.push({ pid, args });
  }
  return result;
}

/** @internal Exposed for unit tests; not part of the public module API. */
export async function scanWindows(processNames: string[]): Promise<ScannedProcess[]> {
  const result: ScannedProcess[] = [];
  for (const name of processNames) {
    // Get-CimInstance is the modern path; wmic is deprecated and missing on
    // fresh Windows 11 installs. ConvertTo-Json -Compress keeps stdout small.
    // -NoProfile skips loading user profile scripts (faster, more deterministic).
    const ps = `Get-CimInstance Win32_Process -Filter "Name='${name}'" | Select-Object ProcessId, CommandLine | ConvertTo-Json -Compress`;
    let stdout: string;
    try {
      const r = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', ps], {
        timeout: LIST_TIMEOUT_MS,
        maxBuffer: LIST_MAX_BUFFER,
        windowsHide: true,
      });
      stdout = r.stdout;
    } catch {
      continue; // one failing query must not fail the others
    }
    const trimmed = stdout.trim();
    if (!trimmed) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }
    const items = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const obj = item as { ProcessId?: number; CommandLine?: string | null };
      const pid = obj.ProcessId;
      const cmdline = obj.CommandLine;
      if (typeof pid !== 'number' || typeof cmdline !== 'string') continue;
      // Naive whitespace split is enough for the reapers' marker args: they
      // never contain whitespace, and a fragmenting path keeps the fragment
      // holding the marker intact.
      const args = cmdline.split(/\s+/).filter(Boolean);
      result.push({ pid, args });
    }
  }
  return result;
}

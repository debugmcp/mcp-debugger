/**
 * Tests for assets/exitcode-shim.cjs (issue #247)
 *
 * js-debug never emits a DAP 'exited' event, so the debuggee itself records
 * its exit code via this NODE_OPTIONS preload; the proxy worker replays it as
 * a synthesized 'exited' event. These tests exercise the shim against real
 * node child processes.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const shimPath = path.resolve(__dirname, '../../assets/exitcode-shim.cjs');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-exitcode-shim-test-'));
let fileCounter = 0;

function nextExitFile(): string {
  return path.join(tempDir, `exit-${++fileCounter}.txt`);
}

function nodeOptionsFor(shim: string): string {
  // Same quoting the adapter uses: double quotes + forward slashes so
  // Windows paths with spaces survive NODE_OPTIONS parsing
  return `--require "${shim.replace(/\\/g, '/')}"`;
}

function runNode(script: string, exitFile: string, extraEnv: Record<string, string> = {}): number {
  try {
    execFileSync(process.execPath, ['-e', script], {
      env: {
        ...process.env,
        NODE_OPTIONS: nodeOptionsFor(shimPath),
        MCP_DEBUGGER_EXITCODE_FILE: exitFile,
        ...extraEnv
      },
      stdio: 'pipe'
    });
    return 0;
  } catch (err) {
    return (err as { status?: number }).status ?? -1;
  }
}

describe('exitcode-shim.cjs', () => {
  beforeEach(() => {
    expect(fs.existsSync(shimPath), `shim asset missing at ${shimPath}`).toBe(true);
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('records exit code 0 for a clean exit', () => {
    const exitFile = nextExitFile();
    const status = runNode('process.exit(0)', exitFile);
    expect(status).toBe(0);
    expect(fs.readFileSync(exitFile, 'utf8').trim()).toBe('0');
  });

  it('records a non-zero explicit exit code', () => {
    const exitFile = nextExitFile();
    const status = runNode('process.exit(7)', exitFile);
    expect(status).toBe(7);
    expect(fs.readFileSync(exitFile, 'utf8').trim()).toBe('7');
  });

  it('records exit code 1 for an uncaught throw', () => {
    const exitFile = nextExitFile();
    const status = runNode('throw new Error("boom")', exitFile);
    expect(status).toBe(1);
    expect(fs.readFileSync(exitFile, 'utf8').trim()).toBe('1');
  });

  it('only the root process writes; descendants inherit the claim and skip', () => {
    const exitFile = nextExitFile();
    // Parent spawns a child that exits 3 (inheriting env incl. NODE_OPTIONS,
    // so the child also loads the shim), then the parent exits 5. The file
    // must hold the ROOT's code even though the child exited last-but-first.
    const script = [
      "const { spawnSync } = require('child_process');",
      "spawnSync(process.execPath, ['-e', 'process.exit(3)'], { env: process.env, stdio: 'ignore' });",
      'process.exit(5);'
    ].join('\n');
    const status = runNode(script, exitFile);
    expect(status).toBe(5);
    expect(fs.readFileSync(exitFile, 'utf8').trim()).toBe('5');
  });

  // The claim is the first line of defence and a descendant can lose it — a
  // nested launch deliberately clears it. The root's file variable is the
  // second: the shim consumes it, so nothing below the root can address the
  // root's file even with the claim gone.
  it('no descendant can write the root file once the shim has consumed it (issue #731)', () => {
    const exitFile = nextExitFile();
    // The spawn happens in an 'exit' handler registered AFTER the shim's, so
    // it runs second and the descendant is the last writer of the two — the
    // ordering in which an inherited file variable actually corrupts the
    // root's recorded code.
    const script = [
      "const { spawnSync } = require('child_process');",
      "process.on('exit', () => {",
      "  spawnSync(process.execPath, ['-e', 'process.exit(9)'], {",
      "    env: { ...process.env, MCP_DEBUGGER_EXITCODE_CLAIMED: '' },",
      "    stdio: 'ignore'",
      '  });',
      '});',
      'process.exit(3);'
    ].join('\n');
    const status = runNode(script, exitFile);
    expect(status).toBe(3);
    expect(fs.readFileSync(exitFile, 'utf8').trim()).toBe('3');
  });

  it('an explicit empty claim re-arms the shim for a process whose parent had claimed it (issue #731)', () => {
    // A nested mcp-debugger inherits MCP_DEBUGGER_EXITCODE_CLAIMED=1 from the
    // outer session; its adapter hands the inner debuggee an explicit '' plus
    // a fresh file. The '' is a defensive explicit overlay that costs nothing:
    // js-debug builds the debuggee env on top of its own process env, which
    // the adapter scrubs too, so spelling the cleared claim out simply leaves
    // nothing to an ordering assumption.
    const exitFile = nextExitFile();
    const script = [
      "const { spawnSync } = require('child_process');",
      "spawnSync(process.execPath, ['-e', 'process.exit(4)'], {",
      "  env: { ...process.env, MCP_DEBUGGER_EXITCODE_CLAIMED: '', MCP_DEBUGGER_EXITCODE_FILE: process.env.INNER_EXIT_FILE },",
      "  stdio: 'ignore'",
      '});',
      'process.exit(0);'
    ].join('\n');
    const innerExitFile = nextExitFile();
    const status = runNode(script, exitFile, { INNER_EXIT_FILE: innerExitFile });
    expect(status).toBe(0);
    expect(fs.readFileSync(exitFile, 'utf8').trim()).toBe('0');
    expect(fs.readFileSync(innerExitFile, 'utf8').trim()).toBe('4');
  });

  it('does nothing when MCP_DEBUGGER_EXITCODE_FILE is unset', () => {
    const exitFile = nextExitFile();
    execFileSync(process.execPath, ['-e', 'process.exit(0)'], {
      env: { ...process.env, NODE_OPTIONS: nodeOptionsFor(shimPath) },
      stdio: 'pipe'
    });
    expect(fs.existsSync(exitFile)).toBe(false);
  });
});

/**
 * Tests for deriveSourceMapFromBinary (issue #363).
 *
 * Builds a real fixture at test time: a tiny C++ program compiled with g++ -g
 * from a temp "host" directory (absolute paths embedded in DWARF), then a
 * fake "workspace" directory with the same relative source layout.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync, execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { deriveSourceMapFromBinary } from '../src/source-map-derive.js';

function hasGpp(): boolean {
  try {
    execSync('g++ --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const GPP_AVAILABLE = hasGpp();

describe('deriveSourceMapFromBinary', () => {
  let hostRoot: string;      // simulated host project root (embedded in DWARF)
  let workspaceRoot: string; // simulated container workspace mount
  let binaryPath: string;

  beforeAll(() => {
    if (!GPP_AVAILABLE) return;
    hostRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'smd-host-'));
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'smd-ws-'));

    // Host layout: <hostRoot>/src/main.cpp compiled via its absolute path
    const hostSrcDir = path.join(hostRoot, 'src');
    fs.mkdirSync(hostSrcDir, { recursive: true });
    const sourcePath = path.join(hostSrcDir, 'main.cpp');
    fs.writeFileSync(sourcePath, 'int main(){return 0;}\n');
    binaryPath = path.join(hostRoot, 'main');
    execFileSync('g++', ['-g', '-O0', sourcePath, '-o', binaryPath]);

    // Workspace mirrors the same relative layout: <workspaceRoot>/src/main.cpp
    fs.mkdirSync(path.join(workspaceRoot, 'src'), { recursive: true });
    fs.copyFileSync(sourcePath, path.join(workspaceRoot, 'src', 'main.cpp'));
  }, 60_000);

  afterAll(() => {
    for (const dir of [hostRoot, workspaceRoot]) {
      if (dir) fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it.skipIf(!GPP_AVAILABLE)(
    'derives hostPrefix -> workspaceRoot when the workspace mirrors the source layout',
    () => {
      const map = deriveSourceMapFromBinary(binaryPath, workspaceRoot);
      expect(map[hostRoot]).toBe(workspaceRoot);
      expect(Object.keys(map).length).toBeLessThanOrEqual(3);
    }
  );

  it.skipIf(!GPP_AVAILABLE)(
    'returns no entries when the embedded paths are already under the workspace root (no-op)',
    () => {
      // Pretend the workspace root IS the host project root: every embedded
      // project path is already valid, so no mapping should be derived for it.
      const map = deriveSourceMapFromBinary(binaryPath, hostRoot);
      expect(map[hostRoot]).toBeUndefined();
      // No entry may map anything to hostRoot from within hostRoot itself
      for (const [prefix, target] of Object.entries(map)) {
        expect(prefix.startsWith(hostRoot)).toBe(false);
        expect(target).toBe(hostRoot);
      }
    }
  );

  it.skipIf(!GPP_AVAILABLE)('returns {} when nothing under the workspace matches', () => {
    const emptyWs = fs.mkdtempSync(path.join(os.tmpdir(), 'smd-empty-'));
    try {
      const map = deriveSourceMapFromBinary(binaryPath, emptyWs);
      expect(map).toEqual({});
    } finally {
      fs.rmSync(emptyWs, { recursive: true, force: true });
    }
  });

  it('returns {} for a nonexistent binary', () => {
    expect(deriveSourceMapFromBinary('/nonexistent/binary', '/workspace')).toEqual({});
  });

  it('returns {} for a directory path', () => {
    expect(deriveSourceMapFromBinary(os.tmpdir(), '/workspace')).toEqual({});
  });

  it.skipIf(!GPP_AVAILABLE)(
    'derives a root-rename mapping from comp_dir when compiled with a RELATIVE source path (gcc from repo root)',
    () => {
      // comp_dir = hostRoot, DW_AT_name = 'src/main.cpp' (relative). No
      // name suffix of hostRoot exists under the workspace, but the relative
      // source resolves at the workspace root -> hostRoot maps to workspace.
      const relBinary = path.join(hostRoot, 'main-rel');
      execFileSync('g++', ['-g', '-O0', path.join('src', 'main.cpp'), '-o', relBinary], { cwd: hostRoot });
      const map = deriveSourceMapFromBinary(relBinary, workspaceRoot);
      expect(map[hostRoot]).toBe(workspaceRoot);
    },
    60_000
  );

  it.skipIf(!GPP_AVAILABLE)(
    'derives a comp_dir -> workspace/<suffix> mapping for cargo-style project-subdir builds',
    () => {
      // Host: <hostRoot>/proj/src/lib.cpp compiled from cwd <hostRoot>/proj
      // with a relative path; workspace mirrors proj/src/lib.cpp. The
      // directory suffix 'proj' exists under the workspace and resolves the
      // relative source, so comp_dir maps to <workspace>/proj.
      const projDir = path.join(hostRoot, 'proj');
      fs.mkdirSync(path.join(projDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(projDir, 'src', 'lib.cpp'), 'int lib(){return 1;}\nint main(){return lib();}\n');
      const projBinary = path.join(projDir, 'lib');
      execFileSync('g++', ['-g', '-O0', path.join('src', 'lib.cpp'), '-o', projBinary], { cwd: projDir });

      fs.mkdirSync(path.join(workspaceRoot, 'proj', 'src'), { recursive: true });
      fs.copyFileSync(path.join(projDir, 'src', 'lib.cpp'), path.join(workspaceRoot, 'proj', 'src', 'lib.cpp'));

      const map = deriveSourceMapFromBinary(projBinary, workspaceRoot);
      expect(map[projDir]).toBe(path.join(workspaceRoot, 'proj'));
    },
    60_000
  );
});

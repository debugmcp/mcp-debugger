/**
 * Tests for deriveSourceMapFromBinary (issue #363).
 *
 * Hermetic on every platform: the scanner only looks for NUL-terminated
 * printable ASCII path strings in the binary — it cannot tell a DWARF
 * section from a hand-written file — so the fixture is a synthetic buffer
 * of embedded strings plus binary noise, written to a real temp file.
 * The workspace side uses real temp dirs/files so the statSync isDir/isFile
 * probes stay honest. No compiler required (the previous g++ fixture kept
 * 5 of these 7 scenarios permanently skipped on Windows and spent up to
 * 60s compiling in a 15s-timeout project).
 */
import { describe, it, expect, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { deriveSourceMapFromBinary } from '../src/source-map-derive.js';

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of tempDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort
    }
  }
});

/**
 * Write a synthetic "binary": embedded strings separated by NULs, wrapped in
 * non-printable noise bytes so string-boundary detection is exercised.
 */
function makeFixtureBinary(embeddedStrings: string[]): string {
  const dir = makeTempDir('smd-bin-');
  const noise = Buffer.from([0x01, 0x7f, 0x02, 0xc8, 0x00, 0x9a]);
  const parts: Buffer[] = [noise];
  for (const s of embeddedStrings) {
    parts.push(Buffer.from(s, 'latin1'), Buffer.from([0x00]));
  }
  parts.push(noise);
  const binaryPath = path.join(dir, 'fixture-binary');
  fs.writeFileSync(binaryPath, Buffer.concat(parts));
  return binaryPath;
}

/** Create a workspace dir containing the given relative files. */
function makeWorkspace(relativeFiles: string[]): string {
  const ws = makeTempDir('smd-ws-');
  for (const rel of relativeFiles) {
    const full = path.join(ws, ...rel.split('/'));
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, `// ${rel}\n`);
  }
  return ws;
}

describe('deriveSourceMapFromBinary', () => {
  describe('error prologue', () => {
    it('returns {} for a nonexistent binary', () => {
      expect(deriveSourceMapFromBinary('/nonexistent/binary', '/workspace')).toEqual({});
    });

    it('returns {} for a directory path', () => {
      expect(deriveSourceMapFromBinary(os.tmpdir(), '/workspace')).toEqual({});
    });

    it('returns {} for an empty file', () => {
      const dir = makeTempDir('smd-empty-');
      const empty = path.join(dir, 'empty');
      fs.writeFileSync(empty, Buffer.alloc(0));
      expect(deriveSourceMapFromBinary(empty, '/workspace')).toEqual({});
    });
  });

  describe('evidence 1: absolute source-file strings', () => {
    it('derives hostPrefix -> workspaceRoot when the workspace mirrors the source layout', () => {
      const ws = makeWorkspace(['src/main.cpp']);
      const binary = makeFixtureBinary(['/home/user/app/src/main.cpp']);

      const map = deriveSourceMapFromBinary(binary, ws);

      expect(map).toEqual({ '/home/user/app': ws });
    });

    it('picks the longest suffix that exists as a file under the workspace', () => {
      // Both src/main.cpp and nested/src/main.cpp exist; the longer suffix
      // wins, attributing less of the path to the host prefix.
      const ws = makeWorkspace(['nested/src/main.cpp', 'src/main.cpp']);
      const binary = makeFixtureBinary(['/build/agent/nested/src/main.cpp']);

      const map = deriveSourceMapFromBinary(binary, ws);

      expect(map).toEqual({ '/build/agent': ws });
    });

    it('handles Windows drive-letter host paths with backslash separators', () => {
      const ws = makeWorkspace(['src/main.cpp']);
      const binary = makeFixtureBinary(['C:\\Users\\dev\\app\\src\\main.cpp']);

      const map = deriveSourceMapFromBinary(binary, ws);

      expect(map).toEqual({ 'C:\\Users\\dev\\app': ws });
    });

    it('returns no entries when the embedded paths are already under the workspace root (no-op)', () => {
      const ws = makeWorkspace(['src/main.cpp']);
      const binary = makeFixtureBinary([`${ws}${path.sep}src${path.sep}main.cpp`]);

      expect(deriveSourceMapFromBinary(binary, ws)).toEqual({});
    });

    it('returns {} when nothing under the workspace matches', () => {
      const ws = makeWorkspace([]);
      const binary = makeFixtureBinary(['/home/user/app/src/main.cpp', '/home/user/app/src/other.cpp']);

      expect(deriveSourceMapFromBinary(binary, ws)).toEqual({});
    });

    it('skips rustc stdlib paths', () => {
      // /rustc/<hash>/ sources ship with the toolchain, not the project.
      const ws = makeWorkspace(['library/core/src/lib.rs']);
      const binary = makeFixtureBinary(['/rustc/abcdef1234567/library/core/src/lib.rs']);

      expect(deriveSourceMapFromBinary(binary, ws)).toEqual({});
    });

    it('normalizes a workspace root passed with trailing separators', () => {
      const ws = makeWorkspace(['src/main.cpp']);
      const binary = makeFixtureBinary(['/home/user/app/src/main.cpp']);

      const map = deriveSourceMapFromBinary(binary, ws + path.sep + path.sep);

      expect(map).toEqual({ '/home/user/app': ws });
    });
  });

  describe('evidence 2: compilation directories + relative sources', () => {
    it('derives comp_dir -> workspace/<suffix> for project-subdir builds (cargo shape)', () => {
      // comp_dir = /home/user/proj, relative source src/lib.cpp; the 'proj'
      // suffix exists under the workspace and resolves the relative source.
      const ws = makeWorkspace(['proj/src/lib.cpp']);
      const binary = makeFixtureBinary(['/home/user/proj', 'src/lib.cpp']);

      const map = deriveSourceMapFromBinary(binary, ws);

      expect(map).toEqual({ '/home/user/proj': path.join(ws, 'proj') });
    });

    it('derives a root-rename mapping when no dir suffix matches but relative sources resolve at the root', () => {
      // /home/user/myrepo mounted at <ws>: no name suffix in common, but
      // src/main.cpp resolves at the workspace root directly.
      const ws = makeWorkspace(['src/main.cpp']);
      const binary = makeFixtureBinary(['/home/user/myrepo', 'src/main.cpp']);

      const map = deriveSourceMapFromBinary(binary, ws);

      expect(map).toEqual({ '/home/user/myrepo': ws });
    });

    it('strips rustc macro-expansion decoration from relative sources', () => {
      const ws = makeWorkspace(['src/main.rs']);
      const binary = makeFixtureBinary(['/home/user/crate', 'src/main.rs/@/4gh7abcdef']);

      const map = deriveSourceMapFromBinary(binary, ws);

      expect(map).toEqual({ '/home/user/crate': ws });
    });

    it('never maps system directories', () => {
      const ws = makeWorkspace(['src/main.cpp']);
      const binary = makeFixtureBinary([
        '/usr/lib/gcc/x86_64-linux-gnu',
        '/opt/toolchain/bin-dir',
        'src/main.cpp'
      ]);

      expect(deriveSourceMapFromBinary(binary, ws)).toEqual({});
    });

    it('ignores directory evidence entirely when the binary has no relative sources', () => {
      const ws = makeWorkspace(['proj/src/lib.cpp']);
      const binary = makeFixtureBinary(['/home/user/proj']);

      expect(deriveSourceMapFromBinary(binary, ws)).toEqual({});
    });

    it('weights comp_dir mappings by how many relative sources they resolve', () => {
      // dirA resolves two relative sources, dirB resolves one (via root
      // rename): dirA must rank first.
      const ws = makeWorkspace(['app/src/a.cpp', 'app/src/b.cpp', 'src/a.cpp']);
      const binary = makeFixtureBinary([
        '/host/one/app',
        '/host/two/other',
        'src/a.cpp',
        'src/b.cpp'
      ]);

      const map = deriveSourceMapFromBinary(binary, ws);
      const keys = Object.keys(map);

      expect(map['/host/one/app']).toBe(path.join(ws, 'app'));
      expect(keys[0]).toBe('/host/one/app');
    });
  });

  describe('string extraction filters', () => {
    it('ignores implausible and too-short strings', () => {
      const ws = makeWorkspace(['src/main.cpp']);
      const binary = makeFixtureBinary([
        '/has space/src/main.cpp',   // space → implausible
        '/q<u>o/src/main.cpp',       // shell-ish chars → implausible
        'a.c',                        // under MIN_STRING_LENGTH
        './src/main.cpp'              // leading dot → not a relative source
      ]);

      expect(deriveSourceMapFromBinary(binary, ws)).toEqual({});
    });

    it('skips degenerate and non-project evidence candidates', () => {
      const ws = makeWorkspace(['src/main.cpp']);
      const binary = makeFixtureBinary([
        '/x.cpp',                    // absolute source with a single segment
        '//////',                    // absolute dir with zero segments
        '/rustc/abc123def',          // toolchain comp_dir
        `${ws}${path.sep}sub`,       // comp_dir already under the workspace
        'src/main.cpp'               // relative source to activate dir evidence
      ]);

      expect(deriveSourceMapFromBinary(binary, ws)).toEqual({});
    });

    it('caps the derived map at 3 entries ranked by evidence count', () => {
      // Four host prefixes with 4/3/2/1 supporting absolute sources.
      const wsFiles: string[] = [];
      const embedded: string[] = [];
      const prefixes = [
        { prefix: '/host/alpha', files: ['src/a1.cpp', 'src/a2.cpp', 'src/a3.cpp', 'src/a4.cpp'] },
        { prefix: '/host/beta', files: ['lib/b1.cpp', 'lib/b2.cpp', 'lib/b3.cpp'] },
        { prefix: '/host/gamma', files: ['inc/c1.hpp', 'inc/c2.hpp'] },
        { prefix: '/host/delta', files: ['etc2/d1.cpp'] }
      ];
      for (const { prefix, files } of prefixes) {
        for (const rel of files) {
          wsFiles.push(rel);
          embedded.push(`${prefix}/${rel}`);
        }
      }
      const ws = makeWorkspace(wsFiles);
      const binary = makeFixtureBinary(embedded);

      const map = deriveSourceMapFromBinary(binary, ws);
      const keys = Object.keys(map);

      expect(keys).toHaveLength(3);
      expect(keys).toEqual(['/host/alpha', '/host/beta', '/host/gamma']);
      expect(keys).not.toContain('/host/delta');
      for (const target of Object.values(map)) {
        expect(target).toBe(ws);
      }
    });
  });
});

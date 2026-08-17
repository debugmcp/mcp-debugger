/**
 * Best-effort source-map derivation for host-built binaries debugged inside a
 * container (issue #363).
 *
 * Host-built binaries embed host-absolute source paths in their DWARF debug
 * info. When the server runs in a container with the project mounted at
 * /workspace, breakpoint requests use /workspace paths and CodeLLDB never
 * matches them against the DWARF paths — file+line breakpoints silently never
 * bind. This module scans the binary for embedded path strings and derives
 * `hostPrefix -> containerPath` sourceMap entries by finding path suffixes
 * that exist under the mounted workspace.
 *
 * Two evidence sources, covering the two ways compilers record paths:
 *  1. Absolute source-FILE strings (gcc/clang invoked with an absolute path):
 *     the longest path suffix that exists as a file under the workspace
 *     yields the mapping directly.
 *  2. Absolute DIRECTORY strings (DW_AT_comp_dir — cargo and relative-path
 *     gcc/clang invocations record a relative source name plus an absolute
 *     compilation directory): a directory suffix existing under the
 *     workspace, validated by joining the binary's RELATIVE source strings
 *     (e.g. 'src/main.rs', with rustc's '/@/<hash>' decoration stripped),
 *     yields `compDir -> workspace/<suffix>`. When no suffix matches (the
 *     comp dir IS the mounted root under a different name), a relative
 *     source resolving at the workspace root maps `compDir -> workspace`.
 */
import * as fs from 'fs';
import * as path from 'path';

/** Read at most this many bytes from the binary. */
const MAX_SCAN_BYTES = 64 * 1024 * 1024;

/** Minimum length for an embedded string to be considered. */
const MIN_STRING_LENGTH = 6;

/** Maximum number of derived sourceMap entries. */
const MAX_ENTRIES = 3;

/** Source-ish file extensions found in DWARF path strings. */
const SOURCE_EXT_RE = /\.(c|cc|cpp|cxx|c\+\+|h|hh|hpp|hxx|inl|rs|s|asm|m|mm)$/i;

/** Directory prefixes that are never a user project root. */
const SYSTEM_DIR_RE = /^\/(usr|lib|lib64|etc|opt|proc|sys|dev|run|rustc|snap|nix)(\/|$)/;

/** Absolute path shapes: POSIX or Windows drive-letter. */
function isAbsolutePathString(s: string): boolean {
  return s.startsWith('/') || /^[A-Za-z]:[\\/]/.test(s);
}

/** Path-plausible strings: no spaces or shell-ish characters. */
function isPlausiblePath(s: string): boolean {
  return !/[ \t<>|"'`*?]/.test(s);
}

/**
 * Strip rustc's macro-expansion decoration ('src/main.rs/@/<hash>' ->
 * 'src/main.rs').
 */
function stripRustDecoration(s: string): string {
  const at = s.indexOf('/@/');
  return at === -1 ? s : s.slice(0, at);
}

interface ExtractedStrings {
  /** Absolute paths ending in a source extension */
  absoluteSources: Set<string>;
  /** Absolute directory-like paths (no source extension) */
  absoluteDirs: Set<string>;
  /** Relative source paths (contain a separator, source extension) */
  relativeSources: Set<string>;
}

/** Extract NUL-terminated printable ASCII path strings from a buffer. */
function extractPathStrings(buf: Buffer): ExtractedStrings {
  const absoluteSources = new Set<string>();
  const absoluteDirs = new Set<string>();
  const relativeSources = new Set<string>();
  let start = -1;
  for (let i = 0; i <= buf.length; i++) {
    const byte = i < buf.length ? buf[i] : 0;
    const printable = byte >= 0x20 && byte <= 0x7e;
    if (printable) {
      if (start === -1) start = i;
    } else {
      if (start !== -1 && i - start >= MIN_STRING_LENGTH) {
        const raw = buf.toString('latin1', start, i);
        const s = stripRustDecoration(raw);
        if (isPlausiblePath(s)) {
          if (isAbsolutePathString(s)) {
            if (SOURCE_EXT_RE.test(s)) {
              absoluteSources.add(s);
            } else if (s.length <= 512) {
              absoluteDirs.add(s);
            }
          } else if (SOURCE_EXT_RE.test(s) && /[\\/]/.test(s) && !s.startsWith('.')) {
            relativeSources.add(s);
          }
        }
      }
      start = -1;
    }
  }
  return { absoluteSources, absoluteDirs, relativeSources };
}

function splitSegments(p: string): { rootAnchor: string; sep: string; segments: string[] } {
  const isWindowsStyle = /^[A-Za-z]:[\\/]/.test(p);
  const sep = isWindowsStyle && p.includes('\\') ? '\\' : '/';
  const rootAnchor = isWindowsStyle ? p.slice(0, 3) : '/';
  const segments = p
    .slice(rootAnchor.length)
    .split(/[\\/]+/)
    .filter((s) => s.length > 0);
  return { rootAnchor, sep, segments };
}

function isUnderWorkspace(embedded: string, normalizedWorkspace: string): boolean {
  return (
    embedded === normalizedWorkspace ||
    embedded.startsWith(normalizedWorkspace + '/') ||
    embedded.startsWith(normalizedWorkspace + '\\')
  );
}

/**
 * Derive a CodeLLDB sourceMap for a host-built binary whose sources are
 * mounted under `workspaceRoot`. Best-effort by design: returns {} on any
 * error or when nothing matches. Entries are ranked by how many embedded
 * paths they explain, capped at 3.
 */
export function deriveSourceMapFromBinary(
  binaryPath: string,
  workspaceRoot: string
): Record<string, string> {
  try {
    const stat = fs.statSync(binaryPath);
    if (!stat.isFile()) return {};

    const bytesToRead = Math.min(stat.size, MAX_SCAN_BYTES);
    const buf = Buffer.alloc(bytesToRead);
    const fd = fs.openSync(binaryPath, 'r');
    try {
      let offset = 0;
      while (offset < bytesToRead) {
        const read = fs.readSync(fd, buf, offset, bytesToRead - offset, offset);
        if (read <= 0) break;
        offset += read;
      }
    } finally {
      fs.closeSync(fd);
    }

    const normalizedWorkspace = workspaceRoot.replace(/[\\/]+$/, '');
    const { absoluteSources, absoluteDirs, relativeSources } = extractPathStrings(buf);
    // mapping: hostPrefix -> { target, count }
    const mappings = new Map<string, { target: string; count: number }>();
    const bump = (hostPrefix: string, target: string, weight = 1): void => {
      const existing = mappings.get(hostPrefix);
      if (existing && existing.target === target) {
        existing.count += weight;
      } else if (!existing) {
        mappings.set(hostPrefix, { target, count: weight });
      }
    };

    const isDir = (p: string): boolean => {
      try {
        return fs.statSync(p).isDirectory();
      } catch {
        return false;
      }
    };
    const isFile = (p: string): boolean => {
      try {
        return fs.statSync(p).isFile();
      } catch {
        return false;
      }
    };

    // Evidence 1: absolute source files — longest file suffix under the workspace.
    for (const embedded of absoluteSources) {
      if (/^\/rustc\/[0-9a-f]{7,}\//i.test(embedded)) continue;
      if (isUnderWorkspace(embedded, normalizedWorkspace)) continue;

      const { rootAnchor, sep, segments } = splitSegments(embedded);
      if (segments.length < 2) continue;

      for (let suffixLen = segments.length - 1; suffixLen >= 1; suffixLen--) {
        const suffixSegments = segments.slice(segments.length - suffixLen);
        const candidate = path.join(normalizedWorkspace, ...suffixSegments);
        if (isFile(candidate)) {
          const prefixSegments = segments.slice(0, segments.length - suffixLen);
          const hostPrefix = rootAnchor === '/'
            ? '/' + prefixSegments.join(sep)
            : rootAnchor + prefixSegments.join(sep);
          bump(hostPrefix, normalizedWorkspace);
          break;
        }
      }
    }

    // Evidence 2: absolute compilation directories, validated by the
    // binary's relative source strings.
    if (relativeSources.size > 0) {
      for (const dir of absoluteDirs) {
        if (SYSTEM_DIR_RE.test(dir)) continue;
        if (/^\/rustc\//i.test(dir)) continue;
        if (isUnderWorkspace(dir, normalizedWorkspace)) continue;

        const { rootAnchor, sep, segments } = splitSegments(dir);
        if (segments.length < 1) continue;
        void rootAnchor;
        void sep;

        // Longest directory suffix that exists under the workspace AND
        // resolves at least one relative source.
        let mapped = false;
        for (let suffixLen = Math.min(segments.length - 1, 8); suffixLen >= 1 && !mapped; suffixLen--) {
          const suffixSegments = segments.slice(segments.length - suffixLen);
          const candidateDir = path.join(normalizedWorkspace, ...suffixSegments);
          if (!isDir(candidateDir)) continue;
          let matches = 0;
          for (const rel of relativeSources) {
            if (isFile(path.join(candidateDir, ...rel.split(/[\\/]+/)))) {
              matches++;
            }
          }
          if (matches > 0) {
            bump(dir, candidateDir, matches);
            mapped = true;
          }
        }
        // Root-rename case: the comp dir IS the mounted root under a
        // different name (e.g. /home/user/myrepo mounted at /workspace) —
        // no name suffix matches, but the relative sources resolve at the
        // workspace root directly.
        if (!mapped) {
          let matches = 0;
          for (const rel of relativeSources) {
            if (isFile(path.join(normalizedWorkspace, ...rel.split(/[\\/]+/)))) {
              matches++;
            }
          }
          if (matches > 0) {
            bump(dir, normalizedWorkspace, matches);
          }
        }
      }
    }

    const ranked = Array.from(mappings.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, MAX_ENTRIES);

    const sourceMap: Record<string, string> = {};
    for (const [hostPrefix, { target }] of ranked) {
      sourceMap[hostPrefix] = target;
    }
    return sourceMap;
  } catch {
    return {};
  }
}

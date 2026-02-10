# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/glob.py
@source-hash: c9e5f9ae0752660e
@generated: 2026-02-09T18:14:23Z

**Core Purpose:** Filename globbing utility implementing POSIX shell-style pathname expansion with support for wildcards (`*`, `?`, `[seq]`), recursive patterns (`**`), and directory file descriptors.

**Public API (L11-29):**
- `glob(pathname, *, root_dir=None, dir_fd=None, recursive=False, include_hidden=False)` (L13-29): Returns list of paths matching pattern
- `iglob(pathname, *, root_dir=None, dir_fd=None, recursive=False, include_hidden=False)` (L31-58): Iterator version of glob
- `escape(pathname)` (L239-249): Escapes special characters in pathname

**Core Algorithm (`_iglob` L60-99):**
Recursive pattern matching engine that:
1. Splits pathname into directory and basename components
2. Handles literal paths (no wildcards) directly via filesystem checks
3. For wildcards, delegates to specialized globbing functions
4. Recursively processes directory parts with wildcards

**Specialized Globbing Functions:**
- `_glob0(dirname, basename, dir_fd, dironly, include_hidden)` (L111-120): Handles literal basenames
- `_glob1(dirname, pattern, dir_fd, dironly, include_hidden)` (L105-109): Handles wildcard patterns in single directory
- `_glob2(dirname, pattern, dir_fd, dironly, include_hidden)` (L133-138): Handles recursive `**` patterns

**Directory Traversal (L142-189):**
- `_iterdir(dirname, dir_fd, dironly)` (L142-174): Low-level directory iteration with file descriptor support
- `_listdir(dirname, dir_fd, dironly)` (L176-178): Converts iterator to list
- `_rlistdir(dirname, dir_fd, dironly, include_hidden)` (L181-189): Recursive directory listing

**Utility Functions:**
- `has_magic(s)` (L223-228): Detects wildcard characters using regex (L220-221)
- `_ishidden(path)` (L230-231): Checks if path starts with dot
- `_isrecursive(pattern)` (L233-237): Checks if pattern is `**`
- `_lexists(pathname, dir_fd)` (L192-201): File existence check with dir_fd support
- `_isdir(pathname, dir_fd)` (L203-212): Directory check with dir_fd support
- `_join(dirname, basename)` (L214-218): Optimized path joining for empty components

**Key Features:**
- Hidden file handling: By default excludes dot-prefixed files unless `include_hidden=True`
- Recursive globbing: `**` pattern matches zero or more directory levels
- Security auditing: Calls `sys.audit()` for glob operations (L43-44)
- File descriptor support: Enables relative path operations from specific directory FDs
- Cross-platform: Handles both string and bytes paths

**Legacy API (L124-128):**
- `glob0(dirname, pattern)` and `glob1(dirname, pattern)`: Simplified interfaces for backward compatibility

**Constants:**
- `_dir_open_flags` (L252): Directory opening flags for file descriptor operations
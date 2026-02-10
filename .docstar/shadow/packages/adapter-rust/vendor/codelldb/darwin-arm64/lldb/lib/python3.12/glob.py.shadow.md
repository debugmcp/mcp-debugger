# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/glob.py
@source-hash: c9e5f9ae0752660e
@generated: 2026-02-09T18:07:05Z

**Purpose**: Standard Python glob module providing filename pattern matching with shell-style wildcards. This is a vendored copy bundled with the CodeLLDB debugger adapter for Rust, providing cross-platform file globbing functionality.

**Core API Functions**:
- `glob(pathname, *, root_dir=None, dir_fd=None, recursive=False, include_hidden=False)` (L13-29): Main entry point returning list of paths matching pattern
- `iglob(pathname, *, root_dir=None, dir_fd=None, recursive=False, include_hidden=False)` (L31-58): Iterator version of glob with audit logging via `sys.audit`
- `escape(pathname)` (L239-249): Escapes special glob characters by wrapping them in square brackets

**Internal Pattern Matching**:
- `_iglob(pathname, root_dir, dir_fd, recursive, dironly, include_hidden=False)` (L60-99): Core recursive globbing implementation that handles pattern parsing and directory traversal
- `_glob0(dirname, basename, dir_fd, dironly, include_hidden=False)` (L111-120): Handles literal basename matching (no wildcards)
- `_glob1(dirname, pattern, dir_fd, dironly, include_hidden=False)` (L105-109): Handles single-level wildcard matching using `fnmatch.filter`
- `_glob2(dirname, pattern, dir_fd, dironly, include_hidden=False)` (L133-138): Handles recursive '**' pattern matching

**Directory Operations**:
- `_iterdir(dirname, dir_fd, dironly)` (L142-174): Low-level directory iteration using `os.scandir`, handles file descriptors and encoding
- `_listdir(dirname, dir_fd, dironly)` (L176-178): Converts iterator to list
- `_rlistdir(dirname, dir_fd, dironly, include_hidden=False)` (L181-189): Recursive directory listing with hidden file filtering

**Utility Functions**:
- `has_magic(s)` (L223-228): Detects glob metacharacters using regex patterns `magic_check` (L220) and `magic_check_bytes` (L221)
- `_ishidden(path)` (L230-231): Checks if path starts with dot
- `_isrecursive(pattern)` (L233-237): Checks if pattern is '**'
- `_lexists(pathname, dir_fd)` (L192-201): File existence check with dir_fd support
- `_isdir(pathname, dir_fd)` (L203-212): Directory check with dir_fd support
- `_join(dirname, basename)` (L214-218): Optimized path joining for empty components

**Key Features**:
- Supports file descriptor-based operations for security (`dir_fd` parameter)
- Hidden file handling (dot files) with `include_hidden` flag
- Recursive matching with '**' pattern
- Security auditing integration via `sys.audit()` calls (L43-44)
- Byte string and unicode string support throughout

**Dependencies**: `os`, `re`, `fnmatch`, `itertools`, `stat`, `sys`, `contextlib`

**Global Constants**: `_dir_open_flags` (L252) combines `O_RDONLY` and `O_DIRECTORY` flags for secure directory opening.
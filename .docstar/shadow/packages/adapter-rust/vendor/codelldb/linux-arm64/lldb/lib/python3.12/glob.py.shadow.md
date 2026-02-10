# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/glob.py
@source-hash: c9e5f9ae0752660e
@generated: 2026-02-09T18:08:45Z

## Purpose
Standard Python glob module providing filename pattern matching using shell-style wildcards. Core functionality for finding pathnames matching Unix shell-style patterns with support for `*`, `?`, `[seq]`, and recursive `**` patterns.

## Key Functions

**Main Public API:**
- `glob(pathname, ...)` (L13-29): Returns list of paths matching pattern, wrapper around iglob
- `iglob(pathname, ...)` (L31-58): Iterator version yielding matching paths, handles audit logging and recursive pattern preprocessing
- `escape(pathname)` (L239-249): Escapes special glob characters by wrapping in square brackets

**Core Pattern Matching Engine:**
- `_iglob(pathname, root_dir, dir_fd, recursive, dironly, include_hidden)` (L60-99): Main recursive globbing engine, handles magic pattern detection and directory traversal
- `_glob1(dirname, pattern, dir_fd, dironly, include_hidden)` (L105-109): Non-recursive glob inside literal directory using fnmatch
- `_glob0(dirname, basename, dir_fd, dironly, include_hidden)` (L111-120): Literal basename matching (no wildcards)
- `_glob2(dirname, pattern, dir_fd, dironly, include_hidden)` (L133-138): Recursive `**` pattern handler

**Directory Operations:**
- `_iterdir(dirname, dir_fd, dironly)` (L142-174): Low-level directory iteration with os.scandir, handles file descriptor and encoding
- `_listdir(dirname, dir_fd, dironly)` (L176-178): Converts iterator to list
- `_rlistdir(dirname, dir_fd, dironly, include_hidden)` (L181-189): Recursive directory listing

**Utility Functions:**
- `has_magic(s)` (L223-228): Detects glob metacharacters using regex
- `_ishidden(path)` (L230-231): Checks if path starts with dot
- `_isrecursive(pattern)` (L233-237): Detects `**` recursive pattern
- `_lexists(pathname, dir_fd)` (L192-201): os.path.lexists with dir_fd support
- `_isdir(pathname, dir_fd)` (L203-212): os.path.isdir with dir_fd support
- `_join(dirname, basename)` (L214-218): Optimized path joining

## Architecture
- **Pattern Detection**: Uses compiled regexes `magic_check` and `magic_check_bytes` (L220-221) to identify wildcard patterns
- **Directory File Descriptor Support**: All operations support dir_fd parameter for relative path operations
- **Recursive Handling**: Special `**` pattern triggers recursive directory traversal via `_glob2` and `_rlistdir`
- **Hidden File Control**: `include_hidden` parameter controls whether dot-files are matched by wildcards
- **Security**: Audit events logged via `sys.audit()` (L43-44)

## Key Parameters
- `root_dir`: Base directory for relative patterns
- `dir_fd`: File descriptor for relative operations
- `recursive`: Enable `**` recursive matching
- `include_hidden`: Whether wildcards match dot-files
- `dironly`: Internal flag to return only directories

## Dependencies
- `os`, `sys`: Core OS operations
- `fnmatch`: Shell-style pattern matching
- `re`: Regex for magic character detection
- `itertools`: Iterator utilities
- `stat`: File type checking
- `contextlib`: Resource management
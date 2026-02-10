# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/os.py
@source-hash: 8ee68b66c92cae2c
@generated: 2026-02-09T18:07:22Z

The Python standard library's `os` module - provides cross-platform OS interface abstraction.

## Core Architecture

**Platform Detection & Module Loading (L52-94)**: Uses `sys.builtin_module_names` to detect underlying OS ('posix' or 'nt') and dynamically imports platform-specific modules. Sets platform constants (`name`, `linesep`) and path handling module (`posixpath` or `ntpath`).

**Function Capability Detection (L102-187)**: When `_have_functions` exists, builds capability sets (`supports_dir_fd`, `supports_effective_ids`, `supports_fd`, `supports_follow_symlinks`) by checking compile-time feature flags (HAVE_FACCESSAT, etc.) to determine which functions support advanced parameters.

## Key Functions

**Directory Operations**:
- `makedirs(name, mode=0o777, exist_ok=False)` (L200-230): Recursive directory creation with race condition handling
- `removedirs(name)` (L232-252): Recursive directory removal upward until non-empty directory found
- `renames(old, new)` (L254-278): Combined rename with directory creation/cleanup

**Directory Traversal**:
- `walk(top, topdown=True, onerror=None, followlinks=False)` (L286-439): Core directory tree traversal generator yielding (dirpath, dirnames, filenames) tuples
- `fwalk(top=".", topdown=True, onerror=None, *, follow_symlinks=False, dir_fd=None)` (L444-570): File descriptor-based walk for symlink race protection, yields 4-tuples with dirfd

**Process Execution**:
- `exec*()` family (L572-651): Various exec wrappers (`execl`, `execle`, `execlp`, `execlpe`, `execvp`, `execvpe`)
- `_execvpe(file, args, env=None)` (L622-651): Core PATH-searching execution with fallback error handling
- `spawn*()` family (L871-1007): Unix-only process spawning when fork/execv available but spawnv isn't

**Environment Variables**:
- `_Environ` class (L701-773): MutableMapping implementation wrapping OS environ with encoding/decoding
- `environ` (L804): Main environment dict instance
- `environb` (L824): Bytes version for non-Windows platforms
- `getenv(key, default=None)` (L808-812): Environment variable getter

**Filesystem Encoding**:
- `fsencode(filename)` (L841-851): Encode paths to filesystem encoding with surrogateescape
- `fsdecode(filename)` (L853-863): Decode paths from filesystem encoding
- `_fspath(path)` (L1071-1098): PathLike protocol implementation

**Other Utilities**:
- `get_exec_path(env=None)` (L654-695): Get PATH directories with bytes/str handling
- `popen(cmd, mode="r", buffering=-1)` (L1013-1057): Subprocess-based command execution
- `fdopen(fd, mode="r", ...)` (L1060-1066): File descriptor to file object conversion

## Notable Classes

**`PathLike` ABC (L1107-1122)**: Abstract base class defining `__fspath__()` protocol for path-like objects.

**`_wrap_close` (L1035-1056)**: Proxy for popen() streams that waits for subprocess completion on close.

**`_AddedDllDirectory` (L1126-1159)**: Windows-only context manager for DLL search path manipulation.

## Internal Helpers

- `_exists(name)` (L41-42): Check if name exists in globals
- `_get_exports_list(module)` (L44-48): Extract module's public API
- `_walk_symlinks_as_files` (L284): Sentinel for walk() symlink handling
- `_fwalk()` stack-based implementation (L496-568): Core fwalk logic with action constants

## Dependencies

- Platform modules: `posix` or `nt` 
- Standard library: `sys`, `stat`, `abc`, `subprocess`, `io`, `warnings`
- Internal: `_collections_abc`, filesystem encoding functions

## Key Invariants

- Platform detection is immutable after import
- Environment changes via environ/environb automatically call putenv/unsetenv
- Path encoding/decoding uses filesystem encoding with surrogateescape
- walk() maintains directory order and handles permissions/symlink errors gracefully
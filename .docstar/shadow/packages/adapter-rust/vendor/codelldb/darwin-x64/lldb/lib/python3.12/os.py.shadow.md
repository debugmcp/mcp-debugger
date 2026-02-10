# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/os.py
@source-hash: 8ee68b66c92cae2c
@generated: 2026-02-09T18:08:31Z

**Core Purpose**: Cross-platform OS abstraction module that provides unified interface for operating system operations on NT (Windows) and POSIX systems.

## Platform Detection & Initialization (L52-94)
- **Platform-specific imports**: Dynamically imports `posix` or `nt` modules based on `sys.builtin_module_names`
- **Path module selection**: Sets `os.path` to either `posixpath` or `ntpath`
- **Line separator config**: Sets `linesep` to '\n' (POSIX) or '\r\n' (NT)
- **Function availability detection**: Imports `_have_functions` when available for capability detection

## Capability Detection System (L102-188)
- **`supports_dir_fd` (L125)**: Set of functions supporting directory file descriptors
- **`supports_effective_ids` (L129)**: Set of functions supporting effective user/group IDs
- **`supports_fd` (L145)**: Set of functions accepting file descriptors
- **`supports_follow_symlinks` (L182)**: Set of functions supporting symlink following control
- **`_add()` helper (L104-106)**: Populates capability sets based on platform feature availability

## File System Operations

### Directory Management
- **`makedirs()` (L200-231)**: Recursive directory creation with race condition handling
- **`removedirs()` (L232-253)**: Recursive directory removal, pruning empty parents
- **`renames()` (L254-279)**: Enhanced rename with directory creation and cleanup

### Directory Traversal
- **`walk()` (L286-440)**: Standard directory tree walker yielding (dirpath, dirnames, filenames)
- **`fwalk()` (L444-570)**: File descriptor-based walker for symlink-race safety, yields 4-tuple with dirfd
- **`_fwalk()` (L496-569)**: Internal implementation using stack-based traversal

## Process Execution

### exec* Family (L572-651)
- **`execl/execle/execlp/execlpe()` (L572-601)**: List-based exec wrappers
- **`execvp/execvpe()` (L603-618)**: PATH-searching exec functions
- **`_execvpe()` (L622-651)**: Core implementation with PATH resolution and error handling

### spawn* Family (L871-1007)
- **Available on POSIX with fork**: Conditional definition based on platform capabilities
- **`_spawnvef()` (L882-908)**: Core spawn implementation using fork/exec pattern
- **Mode constants**: `P_WAIT=0`, `P_NOWAIT=1` for process synchronization control

## Environment Management

### Environment Variable Access
- **`_Environ` class (L701-773)**: MutableMapping implementing environment variable interface
- **Cross-platform encoding**: Handles string/bytes conversion and case sensitivity (NT vs POSIX)
- **`environ` (L804)**: Main environment variable mapping
- **`environb` (L824)**: Bytes-based environment for POSIX systems

### Utility Functions
- **`getenv()` (L808-812)**: Safe environment variable retrieval with defaults
- **`get_exec_path()` (L654-695)**: PATH parsing with bytes/string handling

## File System Encoding (L837-868)
- **`fsencode()` (L841-851)**: Encode filenames to filesystem encoding
- **`fsdecode()` (L853-863)**: Decode filenames from filesystem encoding
- **Error handling**: Uses 'surrogateescape' for lossless conversion

## Path Protocol Support
- **`PathLike` ABC (L1107-1123)**: Abstract base class defining `__fspath__` protocol
- **`_fspath()` (L1071-1098)**: Pure Python implementation of path conversion
- **`fspath`**: Uses C implementation when available, falls back to pure Python

## Platform-Specific Features

### Windows-only (L1125-1159)
- **`_AddedDllDirectory` (L1126-1142)**: Context manager for DLL search path management
- **`add_dll_directory()` (L1143-1159)**: Add paths to DLL resolution search

### File Operations
- **`popen()` (L1013-1057)**: Cross-platform subprocess pipe creation (not on VxWorks)
- **`_wrap_close` (L1035-1056)**: Proxy wrapper ensuring process cleanup
- **`fdopen()` (L1060-1067)**: File descriptor to file object conversion

## Key Dependencies
- Platform modules: `posix`/`nt` for low-level OS operations
- `sys`: Platform detection and filesystem encoding
- `subprocess`: Process creation for `popen()`
- `abc`/`_collections_abc`: Abstract base class infrastructure

## Architecture Notes
- **Lazy initialization**: Platform-specific modules imported conditionally
- **Capability-based design**: Functions grouped by platform feature availability
- **Encoding abstraction**: Unified interface hiding platform string/bytes differences
- **Error handling**: Consistent exception translation across platforms
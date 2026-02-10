# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/os.py
@source-hash: 8ee68b66c92cae2c
@generated: 2026-02-09T18:09:06Z

## Core Purpose

This is Python's OS interface abstraction module that provides cross-platform access to OS-specific functionality. It dynamically imports either POSIX or NT (Windows) modules based on the detected platform and exposes a unified API for file system operations, process management, and environment variable handling.

## Platform Detection & Initialization

**Dynamic OS Module Loading (L52-94)**: Core logic detects available OS modules (`posix` or `nt`) and imports the appropriate one. Sets critical constants:
- `name`: 'posix' or 'nt' 
- `linesep`: '\n' or '\r\n'
- `path`: posixpath or ntpath module

**Feature Detection (L102-187)**: If `_have_functions` exists, builds capability sets:
- `supports_dir_fd`: Functions supporting directory file descriptors
- `supports_effective_ids`: Functions supporting effective user/group IDs  
- `supports_fd`: Functions accepting file descriptors
- `supports_follow_symlinks`: Functions with symlink handling options

## Directory Utilities

**makedirs() (L200-230)**: Recursive directory creation with race condition handling and `exist_ok` parameter.

**removedirs() (L232-252)**: Removes directory and empty parent directories up the tree.

**renames() (L254-278)**: Atomic rename operation that creates intermediate directories and cleans up empty ones.

**walk() (L286-439)**: Directory tree traversal generator yielding `(dirpath, dirnames, filenames)` tuples. Supports top-down/bottom-up traversal and symlink following.

**fwalk() (L444-570)**: Enhanced walk() using file descriptors for race-condition safety. Only available when required OS features are supported. Returns 4-tuples with directory file descriptor.

## Process Execution

**exec*() family (L572-651)**: Multiple exec variants:
- `execl/execle/execlp/execlpe`: List-style argument variants
- `execvp/execvpe`: PATH-searching variants
- `_execvpe()` (L622-651): Core implementation handling PATH search

**spawn*() family (L871-1007)**: Process spawning functions (Unix-style when fork/execv available):
- `spawnv/spawnve/spawnvp/spawnvpe`: Vector argument variants
- `spawnl/spawnle/spawnlp/spawnlpe`: List argument variants
- `_spawnvef()` (L882-907): Internal spawning implementation

**popen() (L1013-1057)**: Subprocess pipe interface using subprocess module, with `_wrap_close` helper class for proper cleanup.

## Environment Handling

**_Environ class (L701-772)**: MutableMapping implementation wrapping OS environment with encoding/decoding:
- Automatic `putenv/unsetenv` calls on modifications
- Key/value encoding for platform compatibility
- Support for dict-like operations and operators

**Environment Creation (L774-805)**: 
- Windows: Case-insensitive keys, string values
- POSIX: Case-sensitive keys, filesystem encoding

**Access Functions**:
- `getenv()` (L808-812): String environment variable getter
- `getenvb()` (L829-833): Bytes environment variable getter (POSIX only)

## Filesystem Encoding

**_fscodec() (L837-868)**: Creates filesystem encoding/decoding functions:
- `fsencode()`: str/PathLike → bytes using filesystem encoding
- `fsdecode()`: bytes/PathLike → str using filesystem encoding

## Path Protocol

**PathLike ABC (L1107-1122)**: Abstract base class defining `__fspath__()` protocol for path-like objects.

**_fspath() (L1071-1098)**: Pure Python implementation of path protocol conversion, used as fallback when C implementation unavailable.

## Windows-Specific Features

**DLL Directory Management (L1125-1159)**: Windows-only functionality for managing DLL search paths via `add_dll_directory()` and `_AddedDllDirectory` context manager.

## Key Constants

**File Seeking (L193-195)**: `SEEK_SET`, `SEEK_CUR`, `SEEK_END` constants for file positioning.

## Critical Dependencies

- `sys`: Platform detection and audit hooks
- `stat`: File status constants  
- `_collections_abc`: Abstract base class utilities
- `subprocess`: Process creation for popen()
- Platform modules: `posix`/`nt` for OS-specific operations
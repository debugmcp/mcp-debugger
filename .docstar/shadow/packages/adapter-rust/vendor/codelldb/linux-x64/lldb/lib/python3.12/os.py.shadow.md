# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/os.py
@source-hash: 8ee68b66c92cae2c
@generated: 2026-02-09T18:10:06Z

## Python OS Module - Cross-Platform Operating System Interface

**Primary Purpose:** Provides unified cross-platform access to operating system functionality by dynamically importing either POSIX or Windows-specific modules and presenting a consistent interface.

### Core Architecture

**Platform Detection & Module Loading (L52-95):**
- Detects available OS modules from `sys.builtin_module_names`
- Imports `posix` module on Unix-like systems (L52-70) or `nt` module on Windows (L72-90)
- Sets platform-specific constants: `name`, `linesep`, path separators
- Imports corresponding path module (`posixpath` or `ntpath`) as `os.path`
- Dynamically extends `__all__` with platform-specific exports

**Feature Capability Detection (L102-188):**
- Conditionally builds feature support sets based on `_have_functions` from platform modules
- `supports_dir_fd` (L125): Functions supporting directory file descriptors
- `supports_effective_ids` (L129): Functions supporting effective user/group IDs  
- `supports_fd` (L145): Functions accepting file descriptors
- `supports_follow_symlinks` (L182): Functions supporting symlink following control

### High-Level Directory Operations

**makedirs() (L200-230):** Recursive directory creation with race condition handling and exist_ok option

**removedirs() (L232-252):** Recursive removal of empty parent directories after removing leaf

**renames() (L254-278):** Atomic rename with intermediate directory creation and cleanup

### Directory Tree Traversal

**walk() (L286-439):** 
- Generator yielding (dirpath, dirnames, filenames) tuples
- Supports top-down/bottom-up traversal, symlink following, error handling
- Uses internal `_walk_symlinks_as_files` sentinel (L284) for junction handling

**fwalk() (L444-570):** 
- File descriptor-based walk for symlink race protection
- Yields 4-tuples including directory file descriptor
- Uses state machine with action constants (L492-494)
- Only available when platform supports required fd operations (L442)

### Process Execution

**exec Family (L572-651):**
- `execl`, `execle`, `execlp`, `execlpe` (L572-601): List argument variants
- `execvp`, `execvpe` (L603-618): Vector argument variants with PATH search
- `_execvpe()` (L622-651): Internal implementation with PATH resolution

**spawn Family (L871-1007):** 
- Available on systems with fork+exec but no native spawn
- Modes: `P_WAIT`, `P_NOWAIT` (L873-874)
- Variants: `spawnv`, `spawnve`, `spawnvp`, `spawnvpe` and list-argument wrappers

### Environment Variables

**_Environ Class (L701-773):** 
- MutableMapping implementation wrapping platform environment
- Handles encoding/decoding between str and platform-native formats
- Automatically calls `putenv`/`unsetenv` on modifications
- Supports dict-like operations and set operations (union, etc.)

**Environment Creation (L774-815):**
- `_createenviron()` creates platform-appropriate environ instance
- Windows: uppercases keys, string-only values
- Unix: handles filesystem encoding with surrogateescape

**Access Functions:**
- `getenv()` (L808-812): Get environment variable with default
- `getenvb()` (L829-833): Bytes variant for non-Windows platforms

### File System Encoding

**Codec Functions (L837-868):**
- `fsencode()` (L841-851): Encode paths to filesystem encoding
- `fsdecode()` (L853-863): Decode paths from filesystem encoding
- Uses `sys.getfilesystemencoding()` with appropriate error handling

### Path-Like Protocol

**PathLike ABC (L1107-1123):** Abstract base class defining `__fspath__()` protocol

**_fspath() (L1071-1098):** Pure Python implementation for path-like object resolution

### Platform-Specific Features

**Windows DLL Directory Management (L1125-1159):**
- `_AddedDllDirectory` context manager class for DLL search path entries
- `add_dll_directory()` function for extending DLL search paths

### Utility Functions

**fdopen() (L1060-1066):** Create file object from file descriptor with proper text encoding

**popen() (L1013-1057):** Execute command in subprocess, return file-like object via `_wrap_close` proxy class

### Key Dependencies
- `sys`, `stat` for system information
- `_collections_abc` for ABC support  
- `subprocess` for popen implementation
- Platform modules (`posix`/`nt`) for low-level operations
- Path modules (`posixpath`/`ntpath`) imported as `os.path`

### Critical Invariants
- Exactly one of `posix` or `nt` must be available in builtin modules
- `os.path` always refers to platform-appropriate path module
- Environment modifications automatically sync with system environment
- File descriptor operations require platform capability support
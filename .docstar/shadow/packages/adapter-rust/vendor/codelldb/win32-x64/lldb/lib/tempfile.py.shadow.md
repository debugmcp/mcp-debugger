# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/tempfile.py
@source-hash: fb44155f430fac19
@generated: 2026-02-09T18:13:26Z

## Primary Purpose

Python's `tempfile` module providing safe, race-condition-free temporary file and directory creation with automatic cleanup. Core implementation focuses on secure name generation, platform-specific optimizations, and proper resource management.

## Key Components

### Random Name Generation
- `_RandomNameSequence` (L132-154): Thread-safe iterator generating 8-character random names using process ID-aware random number generator
- `_get_candidate_names()` (L229-240): Singleton factory with thread-safe lazy initialization using `_once_lock`

### Directory Discovery & Validation
- `_candidate_tempdir_list()` (L156-181): Platform-aware temp directory discovery (Windows: AppData/Local/Temp, SystemRoot/Temp; Unix: /tmp, /var/tmp, /usr/tmp)
- `_get_default_tempdir()` (L183-225): Validates temp directories by attempting file creation/write/delete operations with 100 attempts per directory

### Core Creation Functions
- `_mkstemp_inner()` (L243-270): Atomic file creation with exclusive flags (`O_CREAT|O_EXCL`), handles Windows permission edge cases
- `mkstemp()` (L321-357): Public API for secure temporary file creation, returns (fd, path) tuple
- `mkdtemp()` (L360-398): Directory creation with 0o700 permissions
- `mktemp()` (L400-429): **DEPRECATED** unsafe name-only generation (race condition prone)

### High-Level File Wrappers
- `_TemporaryFileWrapper` (L475-535): Proxy object delegating to underlying file with automatic cleanup via `_TemporaryFileCloser`
- `NamedTemporaryFile()` (L537-597): Creates wrapper with configurable deletion behavior, uses Windows `O_TEMPORARY` flag when available
- `TemporaryFile()` (L610-683): POSIX-specific implementation with `O_TMPFILE` optimization (L608, L634-655) falling back to unlink-after-create

### Advanced Classes
- `SpooledTemporaryFile` (L685-857): Memory-efficient wrapper starting as BytesIO/StringIO, rolling over to real file when size threshold exceeded
- `TemporaryDirectory` (L860-951): Context manager with robust cleanup via `_rmtree()` handling permission errors and junction points

## Critical Architecture Decisions

### Platform Adaptations
- Windows: Uses `O_TEMPORARY` for automatic deletion, special permission error handling for existing directories
- POSIX: Leverages `O_TMPFILE` when available (L608-655), falls back to create-then-unlink pattern
- Thread safety via `_once_lock` for singleton initialization (L73, L234-239, L305-310)

### Security Features
- Exclusive file creation flags prevent race conditions
- 0o600 permissions for files, 0o700 for directories
- Random name generation with process ID isolation
- Maximum retry limits (`TMP_MAX`) prevent infinite loops

### Resource Management
- `_TemporaryFileCloser` (L432-472): Separation of concerns for cleanup logic
- `weakref.finalize()` for garbage collection cleanup (L885-888)
- Method caching in `_TemporaryFileWrapper.__getattr__()` with circular reference prevention (L489-506)

## Key Dependencies
- `os`: Core file system operations and platform detection
- `io`: File object creation and text encoding handling  
- `weakref`: Finalizer-based cleanup for `TemporaryDirectory`
- `shutil`: Recursive directory removal
- `random.Random`: Cryptographically-suitable randomness for name generation

## Global State
- `tempdir` (L299): User-configurable base directory
- `template` (L69): Default prefix "tmp" 
- `_name_sequence` (L227): Lazily-initialized global random name generator
- `_O_TMPFILE_WORKS` (L608): Runtime feature detection flag
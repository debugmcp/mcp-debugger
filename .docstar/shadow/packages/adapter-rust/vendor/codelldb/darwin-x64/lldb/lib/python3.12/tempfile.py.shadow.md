# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/tempfile.py
@source-hash: fb44155f430fac19
@generated: 2026-02-09T18:08:18Z

Python standard library tempfile module providing secure temporary file and directory creation capabilities. Part of LLDB's vendored Python environment for debugging Rust code.

## Primary Purpose
Implements thread-safe, cross-platform temporary file/directory creation with automatic cleanup. Provides both low-level (mkstemp, mkdtemp) and high-level (NamedTemporaryFile, TemporaryDirectory) interfaces while preventing race conditions.

## Key Constants & Configuration
- `TMP_MAX` (L61-63): Maximum retry attempts (10000)
- `template` (L69): Default filename prefix ("tmp")
- `tempdir` (L299): Global temporary directory cache
- `_text_openflags`/`_bin_openflags` (L52-58): OS file creation flags with security bits

## Core Name Generation
- `_RandomNameSequence` (L132-154): Thread-safe random name generator using process-aware RNG, produces 8-character alphanumeric strings
- `_get_candidate_names()` (L229-240): Singleton factory for name sequence with thread-safe lazy initialization

## Directory Discovery
- `_candidate_tempdir_list()` (L156-181): Platform-specific temp directory search order (env vars → OS defaults → current dir)
- `_get_default_tempdir()` (L183-225): Validates writable temp directories by creating/writing test files

## Low-Level Safe Interfaces
- `mkstemp()` (L321-357): Creates unique temporary file, returns (fd, path) tuple
- `mkdtemp()` (L360-398): Creates unique temporary directory, returns path
- `_mkstemp_inner()` (L243-270): Core file creation logic with retry mechanism and audit logging

## High-Level File Classes
- `_TemporaryFileWrapper` (L475-535): Proxy for temporary files with automatic cleanup, delegates attribute access to underlying file object
- `_TemporaryFileCloser` (L432-472): Handles cleanup lifecycle, prevents double-deletion
- `NamedTemporaryFile()` (L537-597): Factory function returning file-like object with visible filename
- `TemporaryFile()` (L602-683): Platform-conditional implementation using O_TMPFILE on POSIX or fallback to unlinked files

## Advanced Features
- `SpooledTemporaryFile` (L685-857): Memory-backed file that rolls over to disk after size threshold, implements full file protocol
- `TemporaryDirectory` (L860-951): Context manager for temporary directories with robust recursive cleanup using custom `_rmtree` implementation

## Platform Handling
- Windows-specific: Uses O_TEMPORARY flag for automatic deletion (L570-571)
- POSIX-specific: Leverages O_TMPFILE when available with graceful fallback (L608-664)
- Cross-platform symlink handling in `_dont_follow_symlinks()` (L272-277)

## Security Features
- All files created with 0o600 permissions (user read/write only)
- Race condition prevention through O_EXCL flag
- Process-aware RNG seeding prevents predictable names across forks
- Audit logging for security-sensitive operations (L254, L382)

## Type System Integration
- `_infer_return_type()` (L85-111): Determines str/bytes return types from input parameters
- `_sanitize_params()` (L114-129): Normalizes and validates input parameters
- Support for PathLike objects and mixed str/bytes handling

## Cleanup Architecture
Uses weakref finalizers for automatic cleanup with explicit cleanup methods for deterministic resource management. Handles Windows junction points and permission issues in directory removal.
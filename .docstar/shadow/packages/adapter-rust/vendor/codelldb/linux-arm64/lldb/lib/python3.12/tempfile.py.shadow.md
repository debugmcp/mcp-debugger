# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/tempfile.py
@source-hash: fb44155f430fac19
@generated: 2026-02-09T18:09:23Z

## Purpose
Python's standard library `tempfile` module providing secure temporary file and directory creation with race condition protection. Part of LLDB's Python environment in a Rust adapter package.

## Key Constants and Configuration
- `TMP_MAX` (L60-63): Maximum attempts to generate unique names (10,000 or OS-defined)
- `template` (L69): Default prefix "tmp" for temporary names
- `tempdir` (L299): Global temp directory cache, lazily initialized
- `_text_openflags`/`_bin_openflags` (L52-58): OS file flags for secure file creation

## Core Name Generation
- `_RandomNameSequence` (L132-154): Thread-safe iterator generating 8-character random names using lowercase letters, digits, and underscore. Process-aware RNG initialization to handle forking.
- `_get_candidate_names()` (L229-240): Singleton access to global name sequence with thread-safe lazy initialization

## Directory Discovery
- `_candidate_tempdir_list()` (L156-181): Prioritized list of temp directories from environment vars (TMPDIR/TEMP/TMP), OS-specific paths, and current directory fallback
- `_get_default_tempdir()` (L183-225): Tests candidate directories by creating/writing/deleting test files, returns first usable directory

## Low-Level Safe Interfaces  
- `mkstemp()` (L321-357): Creates unique temporary file, returns (fd, path) tuple. Supports text/binary modes, custom prefix/suffix/directory
- `mkdtemp()` (L360-398): Creates unique temporary directory with 0o700 permissions
- `_mkstemp_inner()` (L243-270): Shared implementation for file creation with retry logic and security audit logging

## High-Level File Wrappers
- `_TemporaryFileCloser` (L432-472): Cleanup handler managing file deletion with platform-specific logic for Windows delete-on-close
- `_TemporaryFileWrapper` (L475-535): File proxy delegating operations to underlying file while managing cleanup lifecycle. Supports context managers and iteration.
- `NamedTemporaryFile()` (L537-597): Creates temporary file with name access, configurable deletion behavior
- `TemporaryFile()` (L610-683): Anonymous temporary file using O_TMPFILE on supported systems, fallback to unlinked named files

## Advanced Classes
- `SpooledTemporaryFile` (L685-857): Memory-efficient temporary file starting as BytesIO/StringIO, rolling over to disk file when size threshold exceeded or fileno needed
- `TemporaryDirectory` (L860-951): Context manager for temporary directories with robust cleanup using weakref finalizers and custom rmtree implementation handling permission errors

## Utility Functions
- `_infer_return_type()` (L85-111): Determines str vs bytes return type from input parameters
- `_sanitize_params()` (L114-129): Normalizes prefix/suffix/dir parameters with type consistency
- `gettempdir()`/`gettempdirb()` (L313-319): Public accessors for temp directory as str/bytes
- `_resetperms()` (L279-286): Security function removing immutable flags and setting writable permissions

## Deprecated Interface
- `mktemp()` (L400-429): Unsafe filename generation without creation (race condition prone, commented-out warnings)

## Platform Adaptations
- Windows: Uses O_TEMPORARY flag for automatic deletion, special PermissionError handling
- POSIX: O_TMPFILE support detection with fallback mechanisms
- Cygwin: Treated as non-POSIX for unlinking behavior
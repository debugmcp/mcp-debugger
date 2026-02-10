# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/tempfile.py
@source-hash: fb44155f430fac19
@generated: 2026-02-09T18:07:33Z

**Primary Purpose**: Standard library module providing safe, race-condition-free temporary file and directory creation utilities for Python applications. Core responsibility is managing unique temporary file/directory names and automatic cleanup.

**Key Constants & Configuration**:
- `TMP_MAX` (L60-63): Maximum retry attempts for unique name generation (10000 or OS-defined)
- `template` (L69): Default prefix "tmp" for temporary files
- `tempdir` (L299): Global temporary directory cache, populated lazily

**Core Name Generation**:
- `_RandomNameSequence` (L132-154): Thread-safe iterator generating 8-character random strings using lowercase letters, digits, and underscore. Handles process forking by tracking PID changes (L144-148)
- `_get_candidate_names()` (L229-240): Thread-safe singleton accessor for global name sequence generator

**Directory Discovery**:
- `_candidate_tempdir_list()` (L156-181): Platform-aware temporary directory discovery checking environment variables (TMPDIR, TEMP, TMP), then OS-specific paths (/tmp on Unix, AppData on Windows)
- `_get_default_tempdir()` (L183-225): Validates candidate directories by creating/writing test files, returns first usable directory

**Low-Level Safe Interfaces**:
- `mkstemp()` (L321-357): Creates unique temporary file, returns (fd, path) tuple. Supports text/binary modes, custom prefix/suffix/directory
- `mkdtemp()` (L360-398): Creates unique temporary directory with 0o700 permissions
- `_mkstemp_inner()` (L243-270): Common file creation logic with retry mechanism and platform-specific permission handling

**High-Level File Interfaces**:
- `NamedTemporaryFile()` (L537-597): Returns file-like wrapper with automatic deletion. Uses `_TemporaryFileWrapper` (L475-535) for method delegation and cleanup management via `_TemporaryFileCloser` (L432-472)
- `TemporaryFile()` (L610-683): Platform-conditional implementation - on POSIX systems attempts O_TMPFILE for unnamed files, falls back to unlinking after creation
- `SpooledTemporaryFile` (L685-857): Memory-efficient implementation starting with BytesIO/StringIO, rolling over to disk file when size threshold exceeded

**Directory Management**:
- `TemporaryDirectory` (L860-951): Context manager for temporary directories with robust cleanup via `_rmtree()` (L891-930) handling permission errors and platform-specific issues. Uses weakref finalizers for cleanup safety

**Type & Parameter Handling**:
- `_infer_return_type()` (L85-111): Determines str vs bytes return type based on input parameters, prevents mixing
- `_sanitize_params()` (L114-129): Normalizes prefix/suffix/dir parameters with consistent type handling

**Unsafe Legacy Interface**:
- `mktemp()` (L400-429): Deprecated function returning filename without creating file (race condition prone)

**Platform Compatibility**:
- Conditional `TemporaryFile` implementation (L599-602) - aliases to `NamedTemporaryFile` on non-POSIX systems
- Windows-specific O_TEMPORARY flag support for delete-on-close (L570-571)
- O_TMPFILE detection and fallback handling (L608, L634-665)
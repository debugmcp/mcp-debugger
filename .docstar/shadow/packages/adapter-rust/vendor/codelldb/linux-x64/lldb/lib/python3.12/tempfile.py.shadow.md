# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/tempfile.py
@source-hash: fb44155f430fac19
@generated: 2026-02-09T18:10:16Z

## Purpose
Python's tempfile module providing thread-safe temporary file and directory creation with automatic cleanup. Located in an LLDB Python environment as part of the CodeLLDB debugger extension.

## Core Architecture

### Constants & Configuration
- **TMP_MAX** (L60-63): Maximum attempts for unique name generation (10000 or os.TMP_MAX)
- **template** (L69): Default prefix "tmp" for temporary names
- **_text_openflags/_bin_openflags** (L52-58): Platform-specific file creation flags with O_EXCL for atomicity

### Random Name Generation
- **_RandomNameSequence** (L132-154): Thread-safe iterator generating 8-character random names using alphanumeric characters. Reinitializes RNG on process fork detection (L143-148).
- **_get_candidate_names()** (L229-240): Lazy singleton initialization with thread-safe locking

### Directory Discovery
- **_candidate_tempdir_list()** (L156-181): Platform-aware temp directory search (TMPDIR/TEMP/TMP env vars, then OS-specific paths)
- **_get_default_tempdir()** (L183-225): Validates writable temp directories by creating test files
- **gettempdir()/gettempdirb()** (L313-319): Public str/bytes accessors with lazy initialization

### Low-Level Creation
- **_mkstemp_inner()** (L243-270): Core atomic file creation with security audit logging (L254)
- **mkstemp()** (L321-357): Creates temporary files returning (fd, path) tuple
- **mkdtemp()** (L360-398): Creates temporary directories with 0o700 permissions
- **mktemp()** (L400-429): **DEPRECATED** - generates names without creation (race condition prone)

### High-Level File Objects

#### NamedTemporaryFile (L537-597)
Full-featured temporary file with configurable deletion behavior. Uses **_TemporaryFileWrapper** (L475-535) for method delegation and **_TemporaryFileCloser** (L432-472) for cleanup management. Supports Windows O_TEMPORARY flag for OS-level deletion.

#### TemporaryFile (L599-683)  
Platform-dependent implementation:
- **POSIX**: Attempts O_TMPFILE for anonymous files, falls back to unlink-after-creation
- **Non-POSIX**: Aliases to NamedTemporaryFile

#### SpooledTemporaryFile (L685-857)
Memory-efficient temporary file starting as BytesIO/StringIO, automatically rolling to disk file when size threshold exceeded. Implements full file protocol with **rollover()** method (L717-730).

#### TemporaryDirectory (L860-951)
Context manager for temporary directories with robust cleanup via **_rmtree()** (L891-930) handling permission issues across platforms. Uses weakref finalizer for automatic cleanup.

### Type System Integration
- **_infer_return_type()** (L85-111): Determines str vs bytes return types from input parameters
- **_sanitize_params()** (L114-129): Normalizes prefix/suffix/dir parameters with type consistency

### Security Features
- All files created with 0o600 permissions (owner-only access)
- Atomic creation using O_EXCL flag prevents race conditions
- Audit logging for security monitoring
- Random name generation prevents prediction attacks

### Cross-Platform Compatibility
Handles Windows-specific behaviors (O_TEMPORARY, O_BINARY flags), POSIX O_TMPFILE support, and Cygwin limitations. Directory cleanup handles complex permission scenarios across filesystems.
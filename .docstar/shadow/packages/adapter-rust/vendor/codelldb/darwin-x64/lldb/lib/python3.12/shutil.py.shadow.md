# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/shutil.py
@source-hash: b43720627b9901a1
@generated: 2026-02-09T18:08:15Z

## shutil.py - File and Directory Utilities

This module provides high-level operations on files and directories for copying, archiving, and utility functions. It handles platform-specific optimizations and error cases comprehensively.

### Core Architecture

**Platform Detection (L36-51)**: Sets up platform-specific flags (`_WINDOWS`, `_USE_CP_SENDFILE`, `_HAS_FCOPYFILE`) and imports to enable optimized file operations on different systems.

**Compression Support Detection (L15-34)**: Dynamically detects availability of compression libraries (zlib, bz2, lzma) through import attempts, setting boolean flags for later use.

### Exception Hierarchy

- `Error(OSError)` (L67-68): Base exception for shutil operations
- `SameFileError(Error)` (L70-71): Raised when source and destination are identical
- `SpecialFileError(OSError)` (L73-75): For unsupported special files (pipes, etc.)
- `ExecError(OSError)` (L77-78): Command execution failures
- `ReadError(OSError)` (L80-81): Archive reading failures
- `RegistryError(Exception)` (L83-85): Archive format registry errors
- `_GiveupOnFastCopy(Exception)` (L87-90): Internal signal for fallback to regular copy

### File Copying Functions

**Fast Copy Implementations**:
- `_fastcopy_fcopyfile()` (L92-111): macOS-optimized copy using fcopyfile(3) syscall
- `_fastcopy_sendfile()` (L112-175): Linux sendfile(2) optimization with dynamic block sizing
- `_copyfileobj_readinto()` (L176-195): Memory-efficient copy using readinto()/memoryview

**Core Copy Functions**:
- `copyfileobj()` (L196-204): Basic file-like object copying with configurable buffer size
- `copyfile()` (L230-292): Main file copying with platform-specific optimizations, symlink handling, and same-file detection
- `copymode()` (L294-318): Copy permission bits with symlink awareness
- `copystat()` (L347-420): Copy metadata (permissions, timestamps, extended attributes) with platform-specific handling
- `copy()` (L421-437): Copy data and mode bits, handles directory destinations
- `copy2()` (L439-477): Copy data and all metadata, with Windows CopyFile2 optimization

### Directory Operations

**Tree Copying**:
- `ignore_patterns()` (L479-489): Creates ignore function for glob-style pattern matching
- `_copytree()` (L491-555): Internal recursive directory copying with comprehensive error handling
- `copytree()` (L557-603): Public interface for recursive directory copying with extensive options

**Tree Removal**:
- `_rmtree_unsafe()` (L619-639): Race-condition vulnerable removal using os.walk
- `_rmtree_safe_fd()` (L642-703): File descriptor-based removal protecting against symlink attacks
- `rmtree()` (L710-781): Main tree removal with platform-specific safety measures

### File Movement

**Move Operations**:
- `move()` (L805-869): Cross-platform file/directory moving with fallback strategies
- `_destinsrc()` (L871-878): Checks if destination is inside source directory
- `_is_immutable()` (L880-883): Detects immutable files on systems supporting file flags

### Archive Operations

**Creation**:
- `_make_tarball()` (L921-989): Creates tar archives with optional compression and ownership settings
- `_make_zipfile()` (L991-1046): Creates ZIP archives with directory traversal
- `make_archive()` (L1107-1168): Main archive creation interface with format registry

**Extraction**:
- `_unpack_zipfile()` (L1232-1260): Safe ZIP extraction with path traversal protection
- `_unpack_tarfile()` (L1262-1274): Tar archive extraction with filter support
- `unpack_archive()` (L1305-1351): Main extraction interface with format detection

**Registry System**:
- `_ARCHIVE_FORMATS` (L1055-1071): Format registry mapping names to creation functions
- `_UNPACK_FORMATS` (L1281-1296): Format registry for extraction functions
- Registration/unregistration functions (L1083-1105, L1200-1224) for custom formats

### Utility Functions

**System Information**:
- `disk_usage()` (L1362-1387): Platform-specific disk space reporting using statvfs/Windows APIs
- `get_terminal_size()` (L1422-1465): Terminal dimensions with environment variable fallback

**File System Utilities**:
- `chown()` (L1390-1420): Change file ownership with username/groupname resolution
- `which()` (L1486-1565): Locate executables in PATH with Windows PATHEXT support
- `_access_check()` (L1471-1473): File accessibility verification

### Internal Helpers

**File System Queries**:
- `_samefile()` (L206-222): Cross-platform same file detection
- `_stat()`, `_islink()` (L224-228): DirEntry-aware stat/link detection
- `_copyxattr()` (L320-345): Extended attributes copying when supported

**Path Utilities**:
- `_basename()` (L787-803): Basename with trailing slash handling
- `_ensure_directory()` (L1226-1230): Parent directory creation
- `_find_unpack_format()` (L1298-1303): Format detection by file extension

### Platform-Specific Features

The module extensively uses platform detection to enable optimizations:
- macOS: fcopyfile for fast copying, extended attributes
- Linux: sendfile for zero-copy transfers
- Windows: CopyFile2 API, PATHEXT handling, reparse points
- POSIX: Extended attributes, statvfs for disk usage

Buffer sizes and strategies are tuned per platform, with fallback mechanisms ensuring reliability across different systems.
# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/shutil.py
@source-hash: b43720627b9901a1
@generated: 2026-02-09T18:10:11Z

**Primary Purpose**: Python standard library module providing high-level file and directory operations including copying, moving, archiving, and unpacking files and directory trees.

## Core File Operations

**File Copying Functions**:
- `copyfileobj()` (L196-204): Copies data from file-like object to another, with optional buffer size
- `copyfile()` (L230-292): Efficient file copying with platform-specific optimizations, symlink handling, and same-file detection
- `copymode()` (L294-317): Copies permission bits between files, with symlink awareness
- `copystat()` (L347-419): Copies file metadata (permissions, timestamps, extended attributes)
- `copy()` (L421-437): High-level copy combining data and mode bits (equivalent to "cp" command)
- `copy2()` (L439-477): Enhanced copy preserving all metadata, with Windows CopyFile2 optimization

**Fast Copy Implementations**:
- `_fastcopy_fcopyfile()` (L92-110): macOS fcopyfile(3) syscall optimization
- `_fastcopy_sendfile()` (L112-174): Linux sendfile(2) zero-copy optimization
- `_copyfileobj_readinto()` (L176-194): Memory-efficient copying using readinto() and memoryview

## Directory Operations

**Directory Tree Management**:
- `copytree()` (L557-603): Recursively copies directory trees with extensive options for symlinks, ignore patterns, and custom copy functions
- `_copytree()` (L491-555): Internal implementation handling Windows junction points and error collection
- `rmtree()` (L710-781): Safely removes directory trees with race condition protection and platform-specific implementations
- `move()` (L805-869): Cross-filesystem move operation with fallback to copy+delete

**Tree Removal Implementations**:
- `_rmtree_unsafe()` (L619-639): Basic tree removal vulnerable to race conditions
- `_rmtree_safe_fd()` (L642-703): File descriptor-based removal protecting against symlink attacks

## Archive Operations

**Archive Creation**:
- `make_archive()` (L1107-1168): Creates tar/zip archives with compression support
- `_make_tarball()` (L921-989): Internal tar archive creation with owner/group settings
- `_make_zipfile()` (L991-1046): Internal ZIP archive creation

**Archive Extraction**:
- `unpack_archive()` (L1305-1351): Extracts archives with format auto-detection
- `_unpack_tarfile()` (L1262-1274): Internal tar extraction with security filtering
- `_unpack_zipfile()` (L1232-1260): Internal ZIP extraction with path traversal protection

**Format Registration**:
- Archive formats stored in `_ARCHIVE_FORMATS` dict (L1055-1071)
- Unpack formats in `_UNPACK_FORMATS` dict (L1281-1296)
- Dynamic registration via `register_archive_format()` (L1083-1102) and `register_unpack_format()` (L1200-1220)

## Utility Functions

**System Utilities**:
- `which()` (L1486-1565): Locates executable in PATH with Windows PATHEXT support
- `disk_usage()` (L1362-1372 Unix, L1379-1387 Windows): Returns disk space statistics
- `chown()` (L1390-1420): Changes file ownership with user/group name resolution
- `get_terminal_size()` (L1422-1465): Gets terminal dimensions with environment variable fallbacks

**Helper Functions**:
- `ignore_patterns()` (L479-489): Factory for glob-based ignore functions
- `_samefile()` (L206-222): Cross-platform same-file detection
- `_access_check()` (L1471-1473): File accessibility verification

## Platform Adaptations

**Compression Support Detection**:
- `_ZLIB_SUPPORTED`, `_BZ2_SUPPORTED`, `_LZMA_SUPPORTED` (L15-34): Runtime compression library detection
- Conditional format registration based on available libraries

**Platform Constants**:
- `_WINDOWS` (L36): Windows detection flag
- `_USE_CP_SENDFILE` (L51): Linux sendfile availability
- `_HAS_FCOPYFILE` (L52): macOS fcopyfile availability
- `COPY_BUFSIZE` (L48): Platform-optimized buffer size

## Exception Hierarchy

**Custom Exceptions** (L67-90):
- `Error(OSError)`: Base shutil exception
- `SameFileError(Error)`: Source and destination are same file
- `SpecialFileError(OSError)`: Operation on unsupported file types
- `ExecError(OSError)`: Command execution failure
- `ReadError(OSError)`: Archive reading failure
- `RegistryError(Exception)`: Format registration failure
- `_GiveupOnFastCopy(Exception)`: Internal fast-copy fallback signal

## Key Architectural Patterns

- **Fallback Strategy**: Fast platform-specific operations with standard fallbacks
- **Registry Pattern**: Pluggable archive/unpack format registration system
- **Security Focus**: Path traversal protection, symlink attack mitigation
- **Cross-Platform**: Unified interface with platform-specific optimizations
- **Error Handling**: Comprehensive exception hierarchy with detailed error contexts
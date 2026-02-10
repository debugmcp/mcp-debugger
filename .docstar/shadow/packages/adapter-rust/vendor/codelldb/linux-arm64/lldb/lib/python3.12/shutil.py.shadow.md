# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/shutil.py
@source-hash: b43720627b9901a1
@generated: 2026-02-09T18:09:20Z

## Python shutil Module - File and Directory Operations

**Primary Purpose**: Standard library module providing high-level file and directory operations for copying, moving, archiving, and system utilities. Part of Python 3.12 distribution within a LLDB debugging environment.

**Architecture**: Modular design with platform-specific optimizations for Windows/POSIX systems and fallback mechanisms for different compression formats.

### Core File Operations

**copyfileobj(fsrc, fdst, length=0) (L196-204)**: Low-level file-like object copying using buffered read/write operations with configurable buffer size.

**copyfile(src, dst, *, follow_symlinks=True) (L230-292)**: Efficient file copying with platform-specific optimizations:
- Uses `_fastcopy_fcopyfile()` (L92-110) on macOS for zero-copy operations
- Uses `_fastcopy_sendfile()` (L112-174) on Linux for kernel-level copying  
- Falls back to `_copyfileobj_readinto()` (L176-194) on Windows for memory-mapped operations
- Handles symlink detection and same-file protection via `_samefile()` (L206-222)

**copy(src, dst, *, follow_symlinks=True) (L421-437)** and **copy2(src, dst, *, follow_symlinks=True) (L439-477)**: High-level copy functions that combine file data copying with metadata preservation.

### Metadata Operations

**copymode(src, dst, *, follow_symlinks=True) (L294-317)**: Copies permission bits between files with symlink handling.

**copystat(src, dst, *, follow_symlinks=True) (L347-419)**: Comprehensive metadata copying including timestamps, permissions, and extended attributes via `_copyxattr()` (L320-345).

### Directory Operations

**copytree(src, dst, symlinks=False, ignore=None, copy_function=copy2, ignore_dangling_symlinks=False, dirs_exist_ok=False) (L557-603)**: Recursive directory tree copying implemented via `_copytree()` (L491-555) with configurable ignore patterns and symlink handling.

**rmtree(path, ignore_errors=False, onerror=None, *, onexc=None, dir_fd=None) (L710-781)**: Safe recursive directory removal with two implementations:
- `_rmtree_safe_fd()` (L642-703): File descriptor-based approach for race condition protection
- `_rmtree_unsafe()` (L619-639): Traditional approach for older systems

**move(src, dst, copy_function=copy2) (L805-869)**: Cross-filesystem move operation with rename optimization and fallback to copy+delete.

### Archive Operations

**Archive Creation**:
- `make_archive()` (L1107-1168): Main archive creation interface supporting multiple formats
- `_make_tarball()` (L921-989): TAR archive creation with compression support  
- `_make_zipfile()` (L991-1046): ZIP archive creation

**Archive Extraction**:
- `unpack_archive()` (L1305-1351): Format-detection and extraction interface
- `_unpack_tarfile()` (L1262-1274) and `_unpack_zipfile()` (L1232-1260): Format-specific extractors

**Registry System**: Dynamic format registration via `_ARCHIVE_FORMATS` (L1055-1071) and `_UNPACK_FORMATS` (L1281-1296) dictionaries.

### System Utilities

**which(cmd, mode=os.F_OK | os.X_OK, path=None) (L1486-1565)**: Cross-platform executable location with Windows PATHEXT support and PATH resolution.

**chown(path, user=None, group=None) (L1390-1420)**: Ownership changes with user/group name resolution via `_get_uid()` (L903-919) and `_get_gid()` (L885-901).

**disk_usage(path) (L362-372, L379-387)**: Platform-specific disk usage reporting using `os.statvfs()` or Windows APIs.

**get_terminal_size(fallback=(80, 24)) (L1422-1465)**: Terminal dimension detection with environment variable fallback.

### Platform Optimizations

**Fast Copy Detection**: Feature flags `_USE_CP_SENDFILE` (L51), `_HAS_FCOPYFILE` (L52), and `_use_fd_functions` (L705-708) enable platform-specific optimizations.

**Exception Handling**: Custom exception hierarchy with `Error` (L67), `SameFileError` (L70), `SpecialFileError` (L73), and others for operation-specific error reporting.

### Key Dependencies

- **os, sys, stat**: Core system interfaces
- **fnmatch, collections**: Pattern matching and data structures  
- **errno**: System error codes
- **tarfile, zipfile**: Archive format handlers (lazy imports)
- **zlib, bz2, lzma**: Compression libraries (optional)
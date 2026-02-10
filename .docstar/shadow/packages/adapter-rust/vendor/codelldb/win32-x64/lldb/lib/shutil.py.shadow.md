# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/shutil.py
@source-hash: b43720627b9901a1
@generated: 2026-02-09T18:13:25Z

This file implements Python's `shutil` module - a comprehensive file and directory manipulation library providing high-level operations for copying, moving, archiving, and managing filesystem objects.

## Primary Purpose
High-level file/directory operations with platform-aware optimizations, security considerations, and metadata preservation.

## Core Copy Operations

**copyfileobj (L196-204)**: Basic file-like object copying using buffered reads/writes. Entry point for all file copying.

**copyfile (L230-292)**: Efficient file copying with platform-specific optimizations:
- macOS: Uses `_fastcopy_fcopyfile` (L92-110) with `fcopyfile(3)` syscall
- Linux: Uses `_fastcopy_sendfile` (L112-174) with `sendfile(2)` syscall  
- Windows: Uses `_copyfileobj_readinto` (L176-194) with memory views
- Fallback: Standard `copyfileobj` for unsupported cases

**copy (L421-437)**: Copies file data + mode bits (equivalent to `cp`)
**copy2 (L439-477)**: Copies file data + full metadata via `copystat` (equivalent to `cp -p`)

## Metadata Operations

**copymode (L294-317)**: Copies only permission bits with symlink handling
**copystat (L347-419)**: Comprehensive metadata copying (permissions, timestamps, extended attributes, flags)
**_copyxattr (L320-345)**: Extended attribute copying (Linux/macOS specific)

## Directory Operations

**copytree (L557-603)**: Recursive directory copying with extensive options:
- Symlink handling (`symlinks` parameter)
- Ignore patterns (`ignore` parameter, see `ignore_patterns` L479-489)
- Custom copy functions
- Directory existence handling (`dirs_exist_ok`)
- Implementation in `_copytree` (L491-555)

**rmtree (L710-781)**: Secure recursive directory deletion:
- Race condition protection via `_rmtree_safe_fd` (L642-703) using file descriptors
- Fallback to `_rmtree_unsafe` (L619-639) for unsupported platforms
- Symlink attack prevention

**move (L805-869)**: Cross-platform file/directory moving with fallback strategies

## Archive Management

**Archive Creation**:
- `make_archive` (L1107-1168): Main interface supporting tar, gztar, bztar, xztar, zip
- `_make_tarball` (L921-989): Tar archive creation with compression options
- `_make_zipfile` (L991-1046): ZIP archive creation
- Format registry system via `_ARCHIVE_FORMATS` (L1055-1071)

**Archive Extraction**:
- `unpack_archive` (L1305-1351): Auto-detecting archive unpacker
- `_unpack_tarfile` (L1262-1274): Tar extraction with security filtering
- `_unpack_zipfile` (L1232-260): ZIP extraction with path traversal protection
- Format registry via `_UNPACK_FORMATS` (L1281-1296)

## Utility Functions

**which (L1486-1566)**: Cross-platform executable finder with PATH/PATHEXT handling
**chown (L1390-1420)**: Ownership changes with user/group name resolution
**disk_usage (L1362-1387)**: Disk space statistics (platform-specific implementations)
**get_terminal_size (L1422-1465)**: Terminal dimensions with environment variable fallback

## Platform Optimizations

**Compression Support Detection** (L15-34): Runtime detection of zlib, bz2, lzma availability
**Platform-Specific Imports** (L36-52): Conditional imports for Windows (`nt`, `_winapi`) vs POSIX (`posix`)
**Fast Copy Selection** (L51-52): Automatic selection of optimal copy mechanism per platform

## Exception Hierarchy
- `Error` (L67): Base exception for shutil operations  
- `SameFileError` (L70): Source/destination are same file
- `SpecialFileError` (L73): Operations on special files (pipes, devices)
- `ExecError` (L77): Command execution failures
- `ReadError` (L80): Archive reading failures
- `RegistryError` (L83): Archive format registry issues

## Security Features
- Same-file detection via `_samefile` (L206-222)
- Symlink attack prevention in `rmtree`
- Path traversal protection in archive extraction
- Special file type checking (pipes, devices)

## Key Constants
- `COPY_BUFSIZE` (L48): Platform-optimized buffer sizes (1MB Windows, 64KB others)
- `_WIN_DEFAULT_PATHEXT` (L55): Windows executable extensions
- Compression capability flags (`_ZLIB_SUPPORTED`, `_BZ2_SUPPORTED`, `_LZMA_SUPPORTED`)
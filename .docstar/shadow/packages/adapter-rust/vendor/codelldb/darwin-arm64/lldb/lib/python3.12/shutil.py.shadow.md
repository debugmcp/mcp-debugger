# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/shutil.py
@source-hash: b43720627b9901a1
@generated: 2026-02-09T18:07:37Z

## Purpose
Python's shutil module - comprehensive file and directory operations utility providing high-level filesystem operations including copying, moving, archiving, and tree management with platform-aware optimizations.

## Key Components

### Exception Hierarchy (L67-91)
- `Error(OSError)` (L67): Base exception for shutil operations
- `SameFileError(Error)` (L70): Raised when source and destination are identical
- `SpecialFileError(OSError)` (L73): For unsupported special files (named pipes, etc.)
- `ExecError(OSError)` (L77): Command execution failures
- `ReadError(OSError)` (L80): Archive reading failures
- `RegistryError(Exception)` (L83): Archive format registry issues
- `_GiveupOnFastCopy(Exception)` (L87): Internal signal to fallback to standard copy

### Platform Detection & Configuration (L36-55)
- `_WINDOWS` (L36): Windows platform detection
- Compression support flags: `_ZLIB_SUPPORTED`, `_BZ2_SUPPORTED`, `_LZMA_SUPPORTED` (L18,25,32)
- Performance optimizations: `_USE_CP_SENDFILE` (Linux), `_HAS_FCOPYFILE` (macOS) (L51-52)
- `COPY_BUFSIZE` (L48): Platform-specific buffer sizes (1MB Windows, 64KB others)

### High-Performance Copy Functions (L92-195)
- `_fastcopy_fcopyfile(fsrc, fdst, flags)` (L92): macOS-specific fcopyfile(3) syscall
- `_fastcopy_sendfile(fsrc, fdst)` (L112): Linux sendfile(2) zero-copy optimization
- `_copyfileobj_readinto(fsrc, fdst, length)` (L176): Windows optimized readinto() variant
- `copyfileobj(fsrc, fdst, length=0)` (L196): Generic file-like object copying

### Core File Operations (L230-477)
- `copyfile(src, dst, *, follow_symlinks=True)` (L230): Efficient data copying with platform optimizations
- `copymode(src, dst, *, follow_symlinks=True)` (L294): Permission bit copying
- `copystat(src, dst, *, follow_symlinks=True)` (L347): Complete metadata copying (permissions, timestamps, xattrs)
- `copy(src, dst, *, follow_symlinks=True)` (L421): Data + mode bits ("cp" equivalent)
- `copy2(src, dst, *, follow_symlinks=True)` (L439): Data + full metadata ("cp -p" equivalent)

### Tree Operations (L491-781)
- `copytree(src, dst, symlinks=False, ignore=None, copy_function=copy2, ...)` (L557): Recursive directory copying
- `_copytree(entries, src, dst, ...)` (L491): Internal implementation with DirEntry optimization
- `rmtree(path, ignore_errors=False, onerror=None, *, onexc=None, dir_fd=None)` (L710): Safe recursive deletion
- `_rmtree_safe_fd(stack, onexc)` (L642): Race-condition resistant fd-based deletion
- `_rmtree_unsafe(path, onexc)` (L619): Fallback walk-based deletion

### Move Operations (L805-884)
- `move(src, dst, copy_function=copy2)` (L805): Cross-filesystem aware file/directory moving
- `_destinsrc(src, dst)` (L871): Prevents moving directory into itself
- `_is_immutable(src)` (L880): macOS/BSD immutable flag detection

### Archive Creation (L921-1168)
- `make_archive(base_name, format, root_dir=None, ...)` (L1107): Multi-format archive creation
- `_make_tarball(base_name, base_dir, compress="gzip", ...)` (L921): Tar archive creation with compression
- `_make_zipfile(base_name, base_dir, ...)` (L991): ZIP archive creation
- `_ARCHIVE_FORMATS` (L1055): Registry of supported archive formats

### Archive Extraction (L1171-1351)
- `unpack_archive(filename, extract_dir=None, format=None, *, filter=None)` (L1305): Multi-format extraction
- `_unpack_zipfile(filename, extract_dir)` (L1232): ZIP extraction with path traversal protection
- `_unpack_tarfile(filename, extract_dir, *, filter=None)` (L1262): Tar extraction with filtering
- `_UNPACK_FORMATS` (L1281): Registry of supported extraction formats

### System Utilities (L1354-1566)
- `disk_usage(path)` (L1362/L1379): Cross-platform disk space information
- `chown(path, user=None, group=None)` (L1390): Ownership changes with name resolution
- `get_terminal_size(fallback=(80, 24))` (L1422): Terminal dimensions detection
- `which(cmd, mode=os.F_OK | os.X_OK, path=None)` (L1486): Executable location with PATHEXT support

### Helper Functions
- `ignore_patterns(*patterns)` (L479): Factory for copytree ignore callbacks
- `_samefile(src, dst)` (L206): Cross-platform file identity checking
- `_access_check(fn, mode)` (L1471): File accessibility verification
- `_get_uid(name)` / `_get_gid(name)` (L903,885): User/group name to ID resolution

## Architecture Notes
- Extensive platform-specific optimizations (sendfile, fcopyfile, CopyFile2)
- Race-condition awareness in rmtree operations using fd-based APIs where available
- Fallback chains for fast-copy operations when specialized methods fail
- Registry pattern for extensible archive format support
- DirEntry optimization for reduced filesystem calls in tree operations
- Security considerations: path traversal protection, symlink attack mitigation
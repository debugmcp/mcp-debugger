# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/tarfile.py
@source-hash: b133c7b6da239f81
@generated: 2026-02-09T18:09:28Z

## Python tarfile module implementation

**Primary Purpose**: Complete implementation of Python's tarfile module for reading and writing tar archives with compression support (gzip, bzip2, lzma).

### Core Classes

**TarInfo (L849-1644)**: Archive member metadata class
- Holds all information about a single file/directory in the tar archive
- Key attributes: name, mode, uid, gid, size, mtime, type, linkname (L888-906)
- Methods for header creation/parsing: `tobuf()`, `frombuf()` (L985, L1230)
- File type detection methods: `isreg()`, `isdir()`, `issym()`, `islnk()` (L1606-1643)
- Header format support: USTAR, GNU, PAX formats via `create_*_header()` methods (L1002-1085)

**TarFile (L1646-2811)**: Main interface for tar archive operations
- Constructor supports multiple modes: read ('r'), write ('w'), append ('a') (L1674-1772)
- Compression support via class methods: `gzopen()`, `bz2open()`, `xzopen()` (L1890-1976)
- Primary factory method: `open()` with format auto-detection (L1786-1879)
- Member access: `getmember()`, `getmembers()`, `getnames()` (L2010-2035)
- Extraction with security filters: `extractall()`, `extract()` (L2273-2335)
- Archive creation: `add()`, `addfile()` (L2174-2248)

### Stream and File Classes

**_Stream (L331-574)**: Handles compressed/uncompressed data streams
- Supports transparent compression detection (L352-356)
- Compression backends: zlib (gzip), bz2, lzma (L367-406)
- Buffered I/O with configurable buffer sizes (L362, L449-452)

**_FileInFile (L606-708)**: Virtual file object for archive members
- Provides file-like interface to data within tar archive
- Handles sparse files via block mapping (L620-635)
- Implements standard file methods: `read()`, `seek()`, `tell()` (L670-699)

**ExFileObject (L710-716)**: Buffered reader wrapper for extracted files

### Security and Filtering (L722-837)

**Filter System**: PEP 706 extraction security filters
- `data_filter()`: Restrictive filter for untrusted archives (L827-831)
- `tar_filter()`: Standard tar behavior (L821-825)
- `fully_trusted_filter()`: No restrictions (L818-819)
- Exception classes for security violations: `AbsolutePathError`, `OutsideDestinationError`, etc. (L726-753)

### Constants and Formats

**Tar Constants (L75-146)**: Standard tar format definitions
- Block/record sizes: `BLOCKSIZE` (512), `RECORDSIZE` (10240) (L79-80)
- File types: `REGTYPE`, `DIRTYPE`, `SYMTYPE`, `LNKTYPE`, etc. (L88-104)
- Format identifiers: `USTAR_FORMAT`, `GNU_FORMAT`, `PAX_FORMAT` (L106-109)

### Utility Functions

**String/Number Conversion** (L159-224):
- `stn()`: String to null-terminated bytes (L159-165)
- `nts()`: Null-terminated bytes to string (L167-173)
- `nti()`/`itn()`: Number field conversion with octal/binary encoding (L175-223)

**File Operations**:
- `copyfileobj()`: Enhanced file copying with length limits (L238-261)
- `calc_chksums()`: Header checksum calculation (L225-236)

### Key Architectural Decisions

1. **Multiple Format Support**: Handles USTAR, GNU, and PAX tar formats with format-specific processing methods
2. **Streaming Architecture**: `_Stream` class enables processing of compressed archives without full decompression
3. **Security-First Design**: Built-in extraction filters prevent common tar vulnerabilities (path traversal, etc.)
4. **Sparse File Support**: Efficient handling of sparse files through block mapping
5. **Platform Abstraction**: Handles cross-platform differences in file systems and permissions

### Dependencies

- Core: `os`, `sys`, `io`, `shutil`, `stat`, `struct`, `time`, `copy`, `re`
- Optional compression: `zlib`, `bz2`, `lzma` 
- Optional Unix features: `pwd`, `grp` for user/group name resolution (L51-58)

### CLI Interface

**main() function (L837-933)**: Command-line interface supporting:
- List archive contents (`-l`)
- Extract archives (`-e`) with filter support
- Create archives (`-c`) with auto-detected compression
- Test archive validity (`-t`)
# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/tarfile.py
@source-hash: b133c7b6da239f81
@generated: 2026-02-09T18:10:17Z

## Purpose
Python tarfile module providing comprehensive tar archive creation, reading, and extraction functionality. Supports multiple compression formats (gzip, bzip2, xz) and tar formats (POSIX, GNU, PAX) with security-focused extraction filters (PEP 706).

## Core Architecture

### Primary Classes

**TarFile (L1646-2810)** - Main interface to tar archives
- Constructor supports read/write/append modes with optional compression
- Key attributes: `mode`, `fileobj`, `format`, `encoding`, `extraction_filter`
- Manages internal state: `members` list, `offset` tracking, `pax_headers`

**TarInfo (L849-1644)** - Represents individual archive members
- Holds file metadata: `name`, `size`, `mode`, `uid/gid`, `mtime`, `type`
- Methods for header serialization: `tobuf()`, `create_*_header()` 
- Type checking: `isreg()`, `isdir()`, `issym()`, `islnk()` etc.
- Processing methods: `_proc_member()`, `_proc_pax()`, `_proc_sparse()`

### Stream Handling

**_Stream (L331-574)** - Compression-aware stream adapter
- Handles transparent compression detection and processing
- Supports gzip, bzip2, xz compression formats
- Manages buffered I/O with configurable buffer sizes

**_StreamProxy (L576-601)** - Compression type detection
- Examines file headers to identify compression format
- Used for transparent decompression in read mode

**_FileInFile (L606-708)** - Virtual file extraction
- Provides file-like interface to archive member data
- Handles sparse files with block mapping
- Used by `ExFileObject` for buffered member access

### Security & Filtering (L718-837)

**Extraction Filters** - Security controls per PEP 706
- `fully_trusted_filter()` (L818) - No restrictions
- `tar_filter()` (L821) - Basic safety checks
- `data_filter()` (L827) - Strict security filtering
- Custom filter exceptions: `FilterError` hierarchy (L723-753)

## Key Operations

### Archive Creation
- `TarFile.add()` (L2174) - Add files/directories recursively
- `TarFile.addfile()` (L2225) - Add from TarInfo + file object
- `TarFile.gettarinfo()` (L2037) - Create TarInfo from filesystem

### Archive Reading
- `TarFile.next()` (L2620) - Iterator interface for members
- `TarFile.getmember()` (L2010) - Find member by name
- `TarFile.extractfile()` (L2392) - Get file-like object for member

### Archive Extraction
- `TarFile.extractall()` (L2273) - Extract entire archive with filtering
- `TarFile.extract()` (L2318) - Extract single member
- Individual extract methods: `makefile()`, `makedir()`, `makelink()` etc.

## Format Support

### Constants & Types (L78-145)
- File type constants: `REGTYPE`, `DIRTYPE`, `SYMTYPE`, `LNKTYPE` etc.
- Format constants: `USTAR_FORMAT`, `GNU_FORMAT`, `PAX_FORMAT`
- Magic numbers: `POSIX_MAGIC`, `GNU_MAGIC`

### Compression Methods
- `TarFile.taropen()` (L1882) - Uncompressed tar
- `TarFile.gzopen()` (L1890) - Gzip compression  
- `TarFile.bz2open()` (L1923) - Bzip2 compression
- `TarFile.xzopen()` (L1951) - LZMA/XZ compression

## Utilities & Helpers

### Data Conversion (L159-236)
- `stn()` (L159) - String to null-terminated bytes
- `nts()` (L167) - Null-terminated bytes to string
- `nti()`/`itn()` (L175/L195) - Number field conversion
- `calc_chksums()` (L225) - Header checksum calculation

### Public Interface
- `open()` function (L2834) - Primary entry point
- `is_tarfile()` (L2816) - Archive validation
- `main()` (L2837) - Command-line interface

## Error Handling
Exception hierarchy rooted at `TarError` (L270-302):
- `ReadError`, `CompressionError`, `StreamError` 
- `HeaderError` subtypes for parsing issues
- Security-focused `FilterError` subtypes

## Cross-Platform Considerations
- Windows/Unix path handling in archive names
- Encoding management via `ENCODING` global (L150-153)
- Optional modules: `pwd`, `grp` for user/group resolution
- Symlink creation exception handling (L63)
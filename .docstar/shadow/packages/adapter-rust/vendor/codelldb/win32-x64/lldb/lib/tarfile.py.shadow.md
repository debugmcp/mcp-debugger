# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/tarfile.py
@source-hash: b133c7b6da239f81
@generated: 2026-02-09T18:13:28Z

## Purpose
Complete implementation of the Python tarfile module for reading from and writing to tar format archives, supporting multiple compression formats (gzip, bzip2, xz) and various tar formats (POSIX, GNU, PAX). This is a vendor copy within the CodeLLDB debugger distribution.

## Core Classes

### TarInfo (L849-1644)
Represents metadata for a single tar archive member. Contains file attributes like name, mode, size, timestamps, and type information.

**Key attributes:**
- File metadata: `name`, `mode`, `uid`, `gid`, `size`, `mtime` (L858-878)
- File type classification via `type` field and helper methods `isreg()`, `isdir()`, `issym()`, etc. (L606-643)
- PAX extended header support via `pax_headers` dict (L876)
- Sparse file support via `sparse` field (L878)

**Key methods:**
- `tobuf()` (L985): Serializes to tar header bytes for different formats
- `frombuf()` (L1230): Deserializes from tar header bytes
- `replace()` (L929): Creates modified copy with new attributes
- Format-specific header creation: `create_ustar_header()`, `create_gnu_header()`, `create_pax_header()` (L1002-1085)

### TarFile (L1646-2811)
Main interface for tar archive operations. Supports reading, writing, and extraction with multiple compression methods.

**Key attributes:**
- File handling: `fileobj`, `mode`, `name` (L1707-1708)
- Format control: `format`, `encoding`, `errors` (L1662-1666)
- Security: `extraction_filter` for safe extraction (L1672)
- Member tracking: `members` list, `_loaded` flag (L1735-1736)

**Key methods:**
- Archive creation: `open()` classmethod with compression auto-detection (L1786-1879)
- Compression-specific constructors: `gzopen()`, `bz2open()`, `xzopen()` (L1890-1976)
- Member access: `getmember()`, `getmembers()`, `getnames()` (L2010-2035)
- Content modification: `add()`, `addfile()` (L2174-2248)
- Extraction: `extract()`, `extractall()` with filter support (L2273-2336)
- Low-level iteration via `next()` and `__iter__()` (L2620-2790)

## Supporting Classes

### _Stream (L331-574)
Adapter between TarFile and stream-like objects, handling compression/decompression transparently. Supports gzip, bzip2, and xz compression.

### _FileInFile (L606-708)
File-like wrapper providing access to a portion of a larger file, used for extracting individual members. Supports sparse files via block mapping.

### ExFileObject (L710-716)
BufferedReader subclass for extracted file objects, combining _FileInFile with buffering.

## Utility Functions

**String/Number Conversion:**
- `stn()` (L159): String to null-terminated bytes
- `nts()` (L167): Null-terminated bytes to string  
- `nti()` (L175): Tar number field to Python int
- `itn()` (L195): Python number to tar field bytes

**File Operations:**
- `copyfileobj()` (L238): Enhanced file copying with length limits
- `calc_chksums()` (L225): Tar header checksum calculation

## Constants and Configuration

**Tar Format Constants (L78-109):**
- Block/record sizes: `BLOCKSIZE=512`, `RECORDSIZE=10240`
- Magic signatures: `GNU_MAGIC`, `POSIX_MAGIC`
- Format identifiers: `USTAR_FORMAT`, `GNU_FORMAT`, `PAX_FORMAT`

**File Type Constants (L88-104):**
- Standard types: `REGTYPE`, `DIRTYPE`, `SYMTYPE`, `LNKTYPE`
- GNU extensions: `GNUTYPE_LONGNAME`, `GNUTYPE_SPARSE`
- PAX extensions: `XHDTYPE`, `XGLTYPE`

## Security Features (PEP 706)

**Extraction Filters (L720-837):**
- `fully_trusted_filter()` (L818): No restrictions
- `tar_filter()` (L821): Basic safety checks
- `data_filter()` (L827): Strict data-only extraction
- Custom filter exceptions: `AbsolutePathError`, `OutsideDestinationError`, etc. (L726-753)

## Module Interface

**Public API via `__all__` (L66-72):**
- Main classes: `TarFile`, `TarInfo`
- Utility function: `is_tarfile()` (L2816-2832)
- Module-level `open()` function (L2834)
- Exception hierarchy and filter functions

**Command-line Interface:**
- `main()` function (L2837-2933) providing tar-like CLI functionality
- Supports list, extract, create, and test operations

## Architecture Notes

- Comprehensive format support: handles POSIX.1-1988 (ustar), GNU tar, and POSIX.1-2001 (PAX) formats
- Streaming and seekable file support via mode strings like 'r|gz' vs 'r:gz'
- Extensible design allowing subclassing of TarFile and TarInfo for custom behavior
- Error handling hierarchy with configurable error levels
- Cross-platform compatibility with Windows-specific handling
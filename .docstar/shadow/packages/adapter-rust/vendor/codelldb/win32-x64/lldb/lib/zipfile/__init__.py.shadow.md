# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/zipfile/__init__.py
@source-hash: eb37f9fb0bb23795
@generated: 2026-02-09T18:11:33Z

**Primary Purpose:**
Complete implementation of ZIP file format handling in Python - provides read/write/extract functionality for ZIP archives with support for multiple compression methods, ZIP64 extensions, and encrypted files.

**Core Architecture:**
- `ZipFile` (L1266-2063): Main class for ZIP file operations with modes 'r', 'w', 'x', 'a'
- `ZipInfo` (L360-594): Metadata container for individual ZIP entries with file attributes and compression info
- `ZipExtFile` (L839-1180): File-like object for reading compressed archive members
- `_ZipWriteFile` (L1182-1263): File-like object for writing new archive members
- `PyZipFile` (L2065-2237): Specialized subclass for Python library packaging

**Key Components:**

**File Format Constants & Structures (L52-192):**
- ZIP compression methods: `ZIP_STORED`, `ZIP_DEFLATED`, `ZIP_BZIP2`, `ZIP_LZMA`
- ZIP64 limits and version requirements
- Binary structure definitions for headers and central directory records

**Core Reading Functions:**
- `_EndRecData()` (L281-339): Locates and parses end-of-central-directory record
- `_EndRecData64()` (L238-278): Handles ZIP64 extended directory records
- `is_zipfile()` (L222-236): Quick validation of ZIP file format

**Compression Support:**
- `_get_compressor()/_get_decompressor()` (L745-776): Factory functions for compression objects
- `LZMACompressor/LZMADecompressor` (L655-704): Custom LZMA handling classes
- Dynamic import fallbacks for zlib, bz2, lzma modules (L17-32)

**Security & Utilities:**
- `_sanitize_filename()` (L341-357): Prevents directory traversal attacks
- `_ZipDecrypter()` (L617-652): Traditional ZIP encryption support
- Path sanitization for Windows illegal characters (L1747-1759)

**Key Operations:**
- Reading: `open()` returns `ZipExtFile` with decompression and decryption
- Writing: `open()` in write mode returns `_ZipWriteFile` with compression
- Extraction: `extract()/extractall()` with path validation and directory creation
- Directory creation: `mkdir()` for adding directories to archives

**ZIP64 Support:**
- Automatic detection when file sizes or counts exceed 32-bit limits
- Extended headers and directory records for large archives
- Controlled by `allowZip64` parameter

**Threading Safety:**
- `_SharedFile` (L779-817): Thread-safe file access wrapper
- `threading.RLock` used for concurrent access protection

**Command Line Interface:**
- `main()` (L2239-2307): Provides -l (list), -e (extract), -c (create), -t (test) operations

**Dependencies:**
- Core: `struct`, `io`, `os`, `threading`, `time`
- Compression: `zlib` (deflate), `bz2` (bzip2), `lzma` (LZMA)
- Optional: `binascii` (CRC32 fallback)

**Error Handling:**
- `BadZipFile`: Corrupt or invalid ZIP files
- `LargeZipFile`: Files requiring ZIP64 when disabled
- Comprehensive validation of headers, CRCs, and file integrity
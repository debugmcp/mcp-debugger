# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/gzip.py
@source-hash: 31e7275c5c20d1b4
@generated: 2026-02-09T18:07:11Z

**Purpose**: Python standard library module for reading and writing gzipped files with transparent compression/decompression, part of LLDB's bundled Python distribution.

**Core API**:
- `open(filename, mode, compresslevel)` (L28-71): Factory function that creates GzipFile instances and optionally wraps them in TextIOWrapper for text mode
- `compress(data, compresslevel, mtime)` (L602-617): One-shot compression function
- `decompress(data)` (L620-642): One-shot decompression function supporting concatenated gzip members

**Key Classes**:

**GzipFile** (L139-428): Main class implementing file-like interface for gzip files
- Inherits from `_compression.BaseStream`
- Constructor supports filename or fileobj, mode detection, compression levels 0-9
- Read mode: Uses `_GzipReader` wrapped in `io.BufferedReader` (L206-207)
- Write mode: Uses `_WriteBufferStream` wrapped in `io.BufferedWriter` (L227-228)
- Key methods: read/write/seek/tell/flush/close with mode-specific implementations
- Write operations track CRC32 and size for trailer generation (L248-249)

**_GzipReader** (L483-578): Low-level decompressor handling gzip format
- Inherits from `_compression.DecompressReader`
- Manages multi-member gzip files and header parsing
- Handles CRC validation and stream size verification in `_read_eof()` (L555-574)
- Uses `_PaddedFile` for buffering unused decompressor data

**_PaddedFile** (L78-118): Utility class for prepending data to file streams
- Minimal read-only wrapper that maintains a prepend buffer
- Essential for handling unused data from decompression operations

**_WriteBufferStream** (L124-137): Adapter connecting BufferedWriter to GzipFile's raw write method

**BadGzipFile** (L120-121): Exception class for invalid gzip file errors

**Constants**:
- Gzip flags: FTEXT, FHCRC, FEXTRA, FNAME, FCOMMENT (L16)
- Compression levels: _COMPRESS_LEVEL_FAST=1, _COMPRESS_LEVEL_TRADEOFF=6, _COMPRESS_LEVEL_BEST=9 (L20-22)
- Buffer sizes: READ_BUFFER_SIZE=128KB, _WRITE_BUFFER_SIZE=4*DEFAULT_BUFFER_SIZE (L24-25)

**Utility Functions**:
- `write32u(output, value)` (L73-76): Writes 32-bit little-endian unsigned integers
- `_read_exact(fp, n)` (L430-443): Ensures exactly n bytes are read, handling partial reads
- `_read_gzip_header(fp)` (L446-480): Parses gzip header and returns mtime
- `_create_simple_gzip_header(compresslevel, mtime)` (L581-599): Creates minimal gzip headers

**Architecture Notes**:
- Leverages Python's io module buffering infrastructure for performance
- Supports both single-shot operations and streaming file-like interface
- Handles concatenated gzip members correctly during decompression
- Uses zlib library for actual deflate/inflate operations with appropriate wbits settings
- CRC32 validation ensures data integrity
- File size stored as 32-bit value (mod 2^32) per gzip specification

**CLI Interface**: `main()` (L645-694) provides command-line gzip/gunzip functionality with compression level options.
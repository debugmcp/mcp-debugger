# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/gzip.py
@source-hash: 31e7275c5c20d1b4
@generated: 2026-02-09T18:14:34Z

## Core Purpose
Python's gzip module for reading and writing gzip-compressed files. Provides transparent compression/decompression with file-like interface while preventing random access (sequential only).

## Key Classes & Functions

### Primary Interface
- **`open()`** (L28-71): Main entry point. Creates GzipFile in binary mode or wraps in TextIOWrapper for text mode. Handles filename/fileobj validation and mode processing.
- **`compress()`** (L602-617): One-shot compression with configurable level and mtime. Optimizes for mtime=0 using zlib directly.
- **`decompress()`** (L620-643): One-shot decompression supporting concatenated gzip streams with CRC validation.

### Core Classes
- **`GzipFile`** (L139-428): Main file-like interface extending `_compression.BaseStream`. Handles both read/write modes with separate initialization paths. Uses buffered I/O internally.
  - Read mode: Creates `_GzipReader` wrapped in `BufferedReader` (L206-208)
  - Write mode: Uses `BufferedWriter` with `_WriteBufferStream` (L227-228)
  - Supports seeking (forward-only in write mode), tell(), flush(), close()

- **`_GzipReader`** (L483-578): Decompression engine extending `_compression.DecompressReader`. Handles multi-member gzip files, CRC validation, and stream concatenation.

- **`_PaddedFile`** (L78-118): Utility for prepending data to file streams. Used to handle unused decompressor data during multi-member processing.

- **`_WriteBufferStream`** (L124-137): Minimal adapter connecting BufferedWriter to GzipFile's raw write method.

### Exception & Constants
- **`BadGzipFile`** (L120-122): Exception for malformed gzip data
- Compression levels: `_COMPRESS_LEVEL_FAST=1`, `_COMPRESS_LEVEL_TRADEOFF=6`, `_COMPRESS_LEVEL_BEST=9` (L20-22)
- Buffer sizes: `READ_BUFFER_SIZE=128KB`, `_WRITE_BUFFER_SIZE=4*DEFAULT_BUFFER_SIZE` (L24-25)

## Critical Implementation Details

### Header Processing
- **`_write_gzip_header()`** (L259-289): Writes RFC 1952 compliant headers with optional filename, mtime, compression flags
- **`_read_gzip_header()`** (L446-480): Parses gzip magic, method, flags, and optional fields (FEXTRA, FNAME, FCOMMENT, FHCRC)
- **`_create_simple_gzip_header()`** (L581-599): Minimal header creation for compress() function

### Stream Management
- Mode separation: READ=1, WRITE=2 constants with separate code paths
- Write mode uses zlib compressor with CRC32 tracking and size accounting
- Read mode supports multi-member concatenated files with automatic member transitions
- Seek operations: forward-only in write mode (fills with zeros), full seeking in read mode via underlying buffer

### Data Flow Architecture
```
Write: data → BufferedWriter → _WriteBufferStream → _write_raw() → zlib.compress → fileobj
Read: fileobj → _PaddedFile → _GzipReader → BufferedReader → user
```

## Dependencies
- `zlib`: Core compression/decompression engine
- `_compression`: Base classes for stream handling
- `io`: Buffered I/O wrappers and text encoding
- `struct`: Binary data packing for headers/trailers

## Architectural Patterns
- Composition over inheritance: Uses buffered I/O wrappers rather than implementing buffering
- State machine: `_new_member` flag controls multi-member file processing
- Adapter pattern: `_WriteBufferStream` bridges BufferedWriter to custom write method
- Template method: `_compression.BaseStream` provides common file-like behavior
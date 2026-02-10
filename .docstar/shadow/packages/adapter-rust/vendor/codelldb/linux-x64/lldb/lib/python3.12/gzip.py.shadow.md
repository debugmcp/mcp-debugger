# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/gzip.py
@source-hash: 31e7275c5c20d1b4
@generated: 2026-02-09T18:09:46Z

## Python gzip Module Implementation

**Primary Purpose**: Complete implementation of gzip compression/decompression functionality, providing file-like interfaces for reading and writing gzipped data with support for both binary and text modes.

### Key Components

**Public API Functions**:
- `open()` (L28-71): Main entry point that returns either GzipFile or TextIOWrapper for text mode. Validates mode parameters and handles filename vs file object inputs.
- `compress()` (L602-617): One-shot compression function that creates complete gzip data with header and trailer
- `decompress()` (L620-642): One-shot decompression function that handles concatenated gzip members

**Core Classes**:
- `GzipFile` (L139-428): Main file-like class inheriting from `_compression.BaseStream`. Supports both read and write modes with buffered I/O. Key methods:
  - `__init__()` (L152-236): Complex initialization handling mode detection, file object wrapping, and compression setup
  - `write()` (L291-300) / `_write_raw()` (L302-317): Write operations with CRC calculation
  - `read()` (L319-324) / `read1()` (L326-337) / `peek()` (L339-344): Read operations delegating to internal buffer
  - `seek()` (L402-423): Supports seeking in write mode by writing null bytes, full seeking in read mode

**Internal Helper Classes**:
- `_PaddedFile` (L78-118): Wrapper that prepends data to file reads, used for handling unused decompressor data
- `_GzipReader` (L483-578): Decompression reader handling gzip headers, CRC validation, and member concatenation
- `_WriteBufferStream` (L124-137): Minimal wrapper connecting BufferedWriter to GzipFile's raw write method
- `BadGzipFile` (L120-121): Exception for invalid gzip data

**Utility Functions**:
- `write32u()` (L73-76): Writes 32-bit unsigned integers in little-endian format
- `_read_exact()` (L430-443): Ensures complete reads from potentially unbuffered streams
- `_read_gzip_header()` (L446-480): Parses gzip headers and handles optional fields
- `_create_simple_gzip_header()` (L581-599): Creates minimal gzip headers for compression

### Key Constants and Configuration
- Compression levels: `_COMPRESS_LEVEL_FAST=1`, `_COMPRESS_LEVEL_TRADEOFF=6`, `_COMPRESS_LEVEL_BEST=9` (L20-22)
- Buffer sizes: `READ_BUFFER_SIZE=131072`, `_WRITE_BUFFER_SIZE=32768` (L24-25)
- Gzip flags: `FTEXT`, `FHCRC`, `FEXTRA`, `FNAME`, `FCOMMENT` (L16)

### Architecture Patterns
- **Buffered I/O**: Uses `io.BufferedReader`/`io.BufferedWriter` for performance
- **Stream Composition**: Layers decompression, buffering, and optional text encoding
- **Member Concatenation**: Handles multiple gzip members in single files
- **Resource Management**: Proper cleanup with myfileobj tracking for auto-opened files

### Critical Invariants
- Write mode maintains CRC32 checksum and uncompressed size for trailer
- Read mode validates CRC and size for each gzip member
- Seeking in write mode only allows forward movement by writing null bytes
- Text mode requires valid encoding parameters and wraps binary GzipFile

### Dependencies
- `zlib`: Core compression/decompression functionality
- `io`: Buffered I/O and TextIOWrapper
- `_compression`: Base classes for stream handling
- Standard library: `struct`, `sys`, `time`, `os`, `builtins`
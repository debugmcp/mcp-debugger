# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/_compression.py
@source-hash: 3ad5d60627477a60
@generated: 2026-02-09T18:07:31Z

## Purpose

Internal compression utilities module providing base classes for gzip, lzma, and bz2 modules. Implements a streaming decompression reader with seeking support and I/O operation validation helpers.

## Key Components

### Constants
- `BUFFER_SIZE` (L6): Default buffer size for compressed data read chunks, set to `io.DEFAULT_BUFFER_SIZE`

### BaseStream (L9-31)
Abstract helper class extending `io.BufferedIOBase` that provides I/O operation validation methods:
- `_check_not_closed()` (L12-14): Validates file is not closed before operations
- `_check_can_read()` (L16-18): Ensures file supports reading operations  
- `_check_can_write()` (L20-22): Ensures file supports writing operations
- `_check_can_seek()` (L24-30): Validates both readable and seekable capabilities for seek operations

### DecompressReader (L33-162)
Core streaming decompression adapter that wraps any decompressor to provide `io.RawIOBase` interface:

**Initialization** (L39-57):
- Accepts file pointer, decompressor factory function, optional trailing error types, and decompressor arguments
- Manages position tracking (`_pos`), EOF state (`_eof`), and stream size (`_size`) 
- Supports multiple compressed streams via decompressor factory pattern

**Key Methods**:
- `read(size)` (L72-111): Main decompression logic with multi-stream support and trailing data handling
- `readall()` (L113-121): Reads entire stream using sys.maxsize chunks
- `seek(offset, whence)` (L130-158): Implements seeking by rewinding and reading forward when necessary
- `tell()` (L160-162): Returns current position in decompressed stream
- `_rewind()` (L124-128): Resets stream to beginning, recreating decompressor

**Architecture Patterns**:
- Factory pattern for decompressor creation enables handling multiple compressed streams
- Forward-only seeking with rewind-and-read-forward strategy for backward seeks
- Graceful handling of trailing invalid data via configurable exception catching
- Lazy stream size calculation for SEEK_END operations

**Critical Invariants**:
- Position tracking must remain consistent with actual decompressed data read
- Decompressor recreation required for each new compressed stream and backward seeks
- EOF detection triggers size calculation and prevents further reads
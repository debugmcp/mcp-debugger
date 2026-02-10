# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/_compression.py
@source-hash: 3ad5d60627477a60
@generated: 2026-02-09T18:10:19Z

## Purpose
Internal compression utilities providing base streaming infrastructure for gzip, lzma, and bz2 modules. Implements decompression reader adapter and common I/O validation patterns.

## Key Components

### BUFFER_SIZE (L6)
Global constant set to `io.DEFAULT_BUFFER_SIZE` for chunked compressed data reading operations.

### BaseStream (L9-31)
Abstract base class extending `io.BufferedIOBase` providing mode validation helpers:
- `_check_not_closed()` (L12-14): Validates file is open before I/O operations
- `_check_can_read()` (L16-18): Ensures readable mode for read operations  
- `_check_can_write()` (L20-22): Ensures writable mode for write operations
- `_check_can_seek()` (L24-31): Validates seeking capabilities, requires readable + seekable underlying file

### DecompressReader (L33-162)
Core decompression adapter implementing `io.RawIOBase` interface:

**Initialization (L39-58):**
- `fp`: Underlying file object for compressed data
- `decomp_factory`: Factory function creating decompressor instances
- `trailing_error`: Exception types to catch for invalid trailing data
- `decomp_args`: Arguments passed to decompressor factory
- Maintains position tracking (`_pos`), EOF state (`_eof`), and total size (`_size`)

**Key Methods:**
- `read(size)` (L72-111): Main decompression logic with multi-stream support, handles EOF transitions and decompressor recreation
- `readall()` (L113-121): Reads entire stream using chunked approach with `sys.maxsize` buffer
- `seek(offset, whence)` (L130-158): Implements seeking via rewind + forward read strategy
- `_rewind()` (L124-128): Resets stream to beginning, recreates decompressor
- `readinto(b)` (L66-70): Memory-efficient read into provided buffer

## Architecture Notes
- **Multi-stream Support**: Automatically handles concatenated compressed streams by detecting EOF and recreating decompressors
- **Seek Strategy**: Forward-only seeking via read-and-discard (no backwards seek except via rewind)
- **Error Handling**: Gracefully ignores trailing data using configurable exception types
- **Lazy Size Calculation**: Stream size determined only when needed for SEEK_END operations

## Dependencies
- `io`: Core I/O base classes and constants
- `sys`: For `maxsize` constant in readall operation
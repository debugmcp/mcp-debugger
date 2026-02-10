# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/_compression.py
@source-hash: 3ad5d60627477a60
@generated: 2026-02-09T18:08:26Z

## Purpose and Responsibility
Internal compression infrastructure for Python's `gzip`, `lzma`, and `bz2` modules. Provides base classes and adapters for unified decompression stream handling across different compression formats.

## Key Components

### Global Constants
- `BUFFER_SIZE` (L6): Default buffer size for reading compressed data chunks, inherited from `io.DEFAULT_BUFFER_SIZE`

### BaseStream Class (L9-31)
Abstract base class extending `io.BufferedIOBase` providing validation helpers for compression stream operations:
- `_check_not_closed()` (L12-14): Validates stream is open before I/O operations
- `_check_can_read()` (L16-18): Validates stream supports reading
- `_check_can_write()` (L20-22): Validates stream supports writing  
- `_check_can_seek()` (L24-30): Validates stream supports seeking (requires readable + seekable)

### DecompressReader Class (L33-162)
Core decompression adapter implementing `io.RawIOBase` interface. Wraps arbitrary decompressor objects to provide standard file-like read operations:

**Constructor** (L39-57):
- `fp`: Underlying file-like object for compressed data
- `decomp_factory`: Factory function creating decompressor instances
- `trailing_error`: Exception types to catch/ignore for invalid trailing data
- `**decomp_args`: Arguments passed to decompressor factory

**State Management**:
- `_eof` (L41): End-of-file flag
- `_pos` (L42): Current position in decompressed stream
- `_size` (L45): Total decompressed size (computed lazily)
- `_decompressor` (L53): Active decompressor instance

**Core Reading Logic**:
- `read()` (L72-111): Main read method with multi-stream support and automatic decompressor switching
- `readinto()` (L66-70): Buffer-based reading using memoryview optimization
- `readall()` (L113-121): Read entire stream using walrus operator and sys.maxsize chunks

**Stream Navigation**:
- `seek()` (L130-158): Seeking support with rewind-and-skip strategy for backward seeks
- `tell()` (L160-162): Returns current decompressed stream position
- `_rewind()` (L124-128): Reset to stream beginning

## Architecture Patterns

**Multi-Stream Handling**: Automatically detects and transitions between multiple compressed streams in single file (L82-94)

**Factory Pattern**: Uses decompressor factory for creating fresh instances when needed (stream boundaries, seeking)

**Error Tolerance**: Gracefully handles trailing data errors using configurable exception types (L92-94)

**Lazy Size Calculation**: Computes total decompressed size only when needed for SEEK_END operations (L137-141)

## Critical Invariants
- Position tracking must remain consistent across all operations
- Decompressor state must be reset for new streams or backward seeks
- EOF handling requires proper size calculation and state management
- Buffer operations must handle partial reads and empty results
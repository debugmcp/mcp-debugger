# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/_compression.py
@source-hash: 3ad5d60627477a60
@generated: 2026-02-09T18:12:44Z

**Purpose**: Internal compression infrastructure module providing base classes and stream adapters for Python's compression modules (gzip, lzma, bz2). Contains reusable I/O abstraction patterns for decompression operations.

**Key Components**:

- **BUFFER_SIZE (L6)**: Global constant set to `io.DEFAULT_BUFFER_SIZE` for compressed data read chunk sizing across all decompression operations.

- **BaseStream (L9-31)**: Abstract base class extending `io.BufferedIOBase` that provides common validation methods for file operations:
  - `_check_not_closed()` (L12-14): Validates file is open before operations
  - `_check_can_read()` (L16-18): Validates read permissions
  - `_check_can_write()` (L20-22): Validates write permissions  
  - `_check_can_seek()` (L24-30): Validates seek capability (read-only and seekable)

- **DecompressReader (L33-162)**: Core adapter class extending `io.RawIOBase` that bridges decompressor APIs to standard Python file-like interface:
  - **Initialization (L39-57)**: Accepts file pointer, decompressor factory, trailing error types, and decompressor arguments. Supports multiple compressed streams via factory pattern.
  - **Stream Management**: Tracks position (`_pos`), EOF state (`_eof`), and total size (`_size`) for seek operations
  - **Read Operations**:
    - `read()` (L72-111): Main decompression logic with multi-stream support and error handling
    - `readall()` (L113-121): Reads entire stream using `sys.maxsize` chunks
    - `readinto()` (L66-70): Memory-view based reading for buffer compatibility
  - **Seeking**: Full seek support with rewind capability (`_rewind()` L124-128, `seek()` L130-158)

**Architecture Patterns**:
- **Factory Pattern**: Decompressor creation via `_decomp_factory` enables handling multiple compression streams and backward seeks
- **Stream Chaining**: Automatic transition between consecutive compressed streams in single file
- **Error Resilience**: Configurable trailing data error handling via `_trailing_error` parameter
- **Lazy Size Calculation**: Stream size determined on-demand for SEEK_END operations

**Dependencies**: 
- `io` module for base classes and buffer operations
- `sys` module for maxsize constant in readall operations

**Critical Invariants**:
- Position tracking (`_pos`) must remain synchronized with actual decompressed data position
- EOF handling coordinates between decompressor state and stream state
- Seek operations maintain data integrity through rewind-and-skip strategy for backward seeks
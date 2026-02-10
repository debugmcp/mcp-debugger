# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/bz2.py
@source-hash: 76ab3252924e71e8
@generated: 2026-02-09T18:09:19Z

## bz2.py - libbzip2 Compression Interface

Python module providing transparent bzip2 compression/decompression functionality through file-like objects and utility functions.

### Key Components

**BZ2File Class (L26-269)**
- Primary file-like wrapper for bzip2 compression/decompression
- Inherits from `_compression.BaseStream` for standard file interface
- Supports both file paths and file objects as input
- Binary interface only (returns/accepts bytes)

Key methods:
- `__init__(filename, mode="r", compresslevel=9)` (L37): Constructor with mode validation and compressor setup
- `close()` (L97): Proper cleanup with compressor flushing
- `read(size=-1)` (L157): Delegates to internal BufferedReader
- `write(data)` (L214): Compresses data via BZ2Compressor before writing
- `seek(offset, whence)` (L245): Emulated seeking (potentially slow)

**Mode Management**
- Uses internal constants: `_MODE_CLOSED=0`, `_MODE_READ=1`, `_MODE_WRITE=3` (L20-23)
- Mode validation in constructor (L62-78) normalizes input modes
- Separate code paths for read vs write operations

**Compression Architecture**
- Read mode: Uses `_compression.DecompressReader` + `io.BufferedReader` (L91-93)
- Write mode: Uses `BZ2Compressor` instance stored in `self._compressor` (L68)
- Position tracking via `self._pos` for write operations (L95)

**Utility Functions**
- `open(filename, mode, ...)` (L271): High-level interface supporting text/binary modes with TextIOWrapper integration
- `compress(data, compresslevel)` (L313): One-shot compression
- `decompress(data)` (L324): One-shot decompression with concatenated stream support

### Dependencies
- `_bz2` module: Provides `BZ2Compressor` and `BZ2Decompressor` classes (L17)
- `_compression` module: Provides `BaseStream` and `DecompressReader` (L15)
- `io` module: BufferedReader and TextIOWrapper support (L13)

### Notable Patterns
- Delegation pattern: BZ2File delegates most I/O to internal buffer objects
- Resource management: Proper cleanup in `close()` with try/finally blocks
- Error handling: Validates compression levels (1-9) and mode strings
- Stream concatenation: `decompress()` handles multiple concatenated bzip2 streams (L330-343)
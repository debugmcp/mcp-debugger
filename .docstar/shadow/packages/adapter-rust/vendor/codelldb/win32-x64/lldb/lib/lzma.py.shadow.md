# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/lzma.py
@source-hash: 58fb9d2fdc8a8af7
@generated: 2026-02-09T18:14:26Z

## Purpose
Python interface module for LZMA compression/decompression using the liblzma library. Provides high-level file-like objects and convenience functions for XZ, legacy LZMA, and raw compressed data formats.

## Key Components

### Constants and Exports (L11-22)
- Exposes check algorithms: `CHECK_CRC32`, `CHECK_CRC64`, `CHECK_SHA256`
- Filter types: `FILTER_LZMA1/2`, `FILTER_DELTA`, architecture-specific filters
- Format specifiers: `FORMAT_AUTO`, `FORMAT_XZ`, `FORMAT_ALONE`, `FORMAT_RAW`
- Compression modes and presets

### Internal Mode Constants (L32-35)
- `_MODE_CLOSED = 0`, `_MODE_READ = 1`, `_MODE_WRITE = 3`
- Note: Value 2 explicitly marked as no longer used

### LZMAFile Class (L38-269)
Primary file-like interface inheriting from `_compression.BaseStream`.

**Constructor** (L49-132): 
- Accepts filename (str/bytes/PathLike) or file object
- Mode validation for read ("r", "rb") vs write ("w", "wb", "a", "ab", "x", "xb")
- Read mode: Creates `_compression.DecompressReader` with `LZMADecompressor`
- Write mode: Initializes `LZMACompressor` with format/check/preset/filters

**Key Methods**:
- `close()` (L134-156): Handles cleanup for both read/write modes
- File object interface: `readable()`, `writable()`, `seekable()` (L172-180)
- Read operations: `read()`, `read1()`, `readline()`, `peek()` (L182-222)
- Write operations: `write()` (L224-243) - compresses data through `_compressor`
- Positioning: `seek()`, `tell()` (L245-268) - seeking emulated and potentially slow

### Module Functions

**open()** (L271-316):
- High-level interface supporting both binary and text modes
- Text mode wraps LZMAFile in `io.TextIOWrapper`
- Validates mode combinations and text-specific arguments

**compress()** (L319-328):
- One-shot compression using `LZMACompressor`
- Returns compressed data + flush output

**decompress()** (L331-356):
- One-shot decompression with multi-stream support
- Handles concatenated LZMA streams by iterating until all data consumed
- Gracefully handles trailing non-LZMA data

## Dependencies
- Imports from `_lzma` C extension module for core functionality
- Uses `_compression.BaseStream` and `_compression.DecompressReader`
- Standard library: `builtins`, `io`, `os`

## Architecture Notes
- Follows Python's standard compression module pattern
- Separates low-level compression/decompression from high-level file interface
- Read mode uses buffered reader pattern for efficient I/O
- Write mode maintains position tracking (`_pos`) separate from underlying file
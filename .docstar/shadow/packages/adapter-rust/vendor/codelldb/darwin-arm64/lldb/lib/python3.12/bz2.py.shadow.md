# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/bz2.py
@source-hash: 76ab3252924e71e8
@generated: 2026-02-09T18:07:07Z

## Purpose

Python module providing bzip2 compression/decompression interface. Wraps the libbzip2 C library with file-like objects, incremental compressors, and one-shot utility functions.

## Key Classes & Functions

### BZ2File (L26-269)
Primary file-like object for bzip2 compression/decompression operations. Inherits from `_compression.BaseStream`.

**Constructor** `__init__(filename, mode="r", *, compresslevel=9)` (L37-96):
- Accepts filename (str/bytes/PathLike) or file object
- Supports modes: r/rb (read), w/wb (write), x/xb (exclusive create), a/ab (append)
- Sets up internal state: `_fp` (file pointer), `_mode` (operation mode), `_compressor` (for write modes)
- For read mode: wraps with `_compression.DecompressReader` and `io.BufferedReader`

**Core Methods**:
- `close()` (L97-119): Flushes compressor data, closes file handles
- `read(size=-1)` (L157-164): Reads uncompressed bytes via buffered reader
- `write(data)` (L214-233): Compresses data and writes to underlying file
- `seek(offset, whence=io.SEEK_SET)` (L245-261): Emulated seeking (potentially slow)
- `tell()` (L263-268): Returns current position

### Utility Functions

**open(filename, mode="rb", compresslevel=9, ...)** (L271-310):
- High-level interface supporting both binary and text modes
- For text mode: wraps BZ2File in `io.TextIOWrapper`
- Validates mode combinations and encoding parameters

**compress(data, compresslevel=9)** (L313-321):
- One-shot compression using BZ2Compressor
- Returns compressed data as bytes

**decompress(data)** (L324-344):
- One-shot decompression handling concatenated streams
- Iteratively processes multiple bzip2 streams in input data
- Returns concatenated decompressed results

## Dependencies & Imports

- `_bz2`: C extension providing BZ2Compressor/BZ2Decompressor classes (L17)
- `_compression`: Base classes and utilities for compression streams (L15)
- `io`, `os`: Standard library for file operations and buffering (L13-14)

## Internal State Management

**Mode Constants** (L20-23):
- `_MODE_CLOSED = 0`: File is closed
- `_MODE_READ = 1`: Read mode 
- `_MODE_WRITE = 3`: Write mode (note: value 2 is unused)

**BZ2File Internal State**:
- `_fp`: Underlying file object
- `_closefp`: Boolean flag for cleanup responsibility
- `_mode`: Current operation mode
- `_compressor`: BZ2Compressor instance (write modes only)
- `_buffer`: BufferedReader wrapper (read mode only)
- `_pos`: Current position tracker (write mode only)

## Key Patterns

- **Lazy decompression**: Read mode uses streaming decompressor with buffering
- **Concatenated stream support**: `decompress()` handles multiple bzip2 streams
- **Resource cleanup**: Proper exception handling in `close()` ensures cleanup
- **Mode validation**: Strict validation of file modes and compression levels
- **Buffer protocol support**: `write()` accepts any buffer-compatible object
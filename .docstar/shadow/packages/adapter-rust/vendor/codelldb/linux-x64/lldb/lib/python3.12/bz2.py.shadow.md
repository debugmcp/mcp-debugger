# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/bz2.py
@source-hash: 76ab3252924e71e8
@generated: 2026-02-09T18:09:33Z

## Purpose
Python standard library interface to libbzip2 compression library, providing file-like objects, streaming compression/decompression classes, and utility functions for bzip2 data handling.

## Key Classes

### BZ2File (L26-268)
Primary file-like interface for bzip2 compressed data with transparent compression/decompression.

**Constructor (L37-96):**
- `__init__(filename, mode="r", *, compresslevel=9)` - Opens bzip2 file or wraps existing file object
- Supports modes: 'r'/'rb' (read), 'w'/'wb' (write), 'x'/'xb' (exclusive create), 'a'/'ab' (append)
- Validates compresslevel 1-9 range
- Sets up appropriate compressor/decompressor based on mode

**Core Methods:**
- `close()` (L97-119) - Flushes compressor, closes underlying file, resets state
- `read(size=-1)` (L157-164) - Reads uncompressed bytes via buffered reader
- `write(data)` (L214-233) - Compresses and writes data, returns uncompressed byte count
- `seek(offset, whence)` (L245-261) - Emulated seeking (potentially slow)
- `tell()` (L263-268) - Returns current position

**State Management:**
- Uses mode constants: `_MODE_CLOSED=0`, `_MODE_READ=1`, `_MODE_WRITE=3` (L20-23)
- Tracks file pointer (`_fp`), close responsibility (`_closefp`), current mode (`_mode`)
- For read: wraps in `DecompressReader` + `BufferedReader` (L91-93)
- For write: maintains `BZ2Compressor` instance and position counter

## Utility Functions

### open() (L271-310)
High-level interface supporting both binary and text modes.
- Binary mode: direct BZ2File wrapper
- Text mode: wraps BZ2File in io.TextIOWrapper
- Validates mode/encoding parameter combinations

### compress() (L313-321)
One-shot compression function using BZ2Compressor with flush.

### decompress() (L324-344)
One-shot decompression handling concatenated streams.
- Loops through multiple compressed streams in input data
- Validates end-of-stream markers
- Accumulates results from multiple streams

## Dependencies
- `_bz2` module: provides `BZ2Compressor`, `BZ2Decompressor` classes (L17)
- `_compression.BaseStream`: parent class for BZ2File (L26)
- `_compression.DecompressReader`: streaming decompression wrapper (L91)
- Standard library: `io`, `os`, `builtins.open`

## Architecture Notes
- Inherits file interface methods from `_compression.BaseStream`
- Uses composition pattern: delegates to BufferedReader for read operations
- Maintains separate code paths for read vs write modes
- Supports both file paths and file-like objects as input
- Handles concatenated bzip2 streams in decompression
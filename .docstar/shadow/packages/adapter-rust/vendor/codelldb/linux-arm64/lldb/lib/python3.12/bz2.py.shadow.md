# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/bz2.py
@source-hash: 76ab3252924e71e8
@generated: 2026-02-09T18:09:21Z

## Purpose
Python wrapper module for libbzip2 compression library, providing high-level file interface and utility functions for bzip2 compression/decompression operations.

## Key Classes

### BZ2File (L26-269)
Main file-like class extending `_compression.BaseStream` for transparent bzip2 operations. Supports both file paths and file objects as input.

**Key Methods:**
- `__init__(filename, mode="r", *, compresslevel=9)` (L37-96): Constructor with mode validation and internal state setup
- `close()` (L97-119): Proper resource cleanup with compression finalization
- `read(size=-1)` (L157-164): Delegated to internal BufferedReader
- `write(data)` (L214-233): Compresses data using BZ2Compressor before writing
- `seek(offset, whence)` (L245-261): Emulated seeking (potentially slow)
- `tell()` (L263-268): Position tracking for both read/write modes

**Internal State:**
- `_fp`: Underlying file object
- `_mode`: Operation mode (_MODE_READ=1, _MODE_WRITE=3, _MODE_CLOSED=0)
- `_compressor`: BZ2Compressor instance for write operations
- `_buffer`: BufferedReader wrapping DecompressReader for read operations
- `_pos`: Write position tracking

## Module Functions

### open(filename, mode="rb", compresslevel=9, ...) (L271-310)
Factory function supporting both binary and text modes. Creates BZ2File and optionally wraps in TextIOWrapper for text mode.

### compress(data, compresslevel=9) (L313-321)
One-shot compression utility using BZ2Compressor.

### decompress(data) (L324-344)
One-shot decompression with concatenated stream support. Handles multiple compressed streams and validates proper termination.

## Dependencies
- `_bz2`: Low-level BZ2Compressor/BZ2Decompressor classes (L17)
- `_compression`: BaseStream parent class and DecompressReader (L15, L91)
- `io`: BufferedReader and TextIOWrapper support (L13)
- `os`: PathLike object support (L14)

## Architecture Notes
- Read mode uses DecompressReader→BufferedReader chain for efficient buffering
- Write mode directly manages BZ2Compressor and position tracking
- Mode constants skip value 2 (legacy artifact, L22)
- Supports concatenated bzip2 streams in decompress() via loop-and-retry pattern
- File interface delegation pattern: core operations delegated to _buffer (read) or _fp (write)
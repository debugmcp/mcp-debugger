# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/lzma.py
@source-hash: 58fb9d2fdc8a8af7
@generated: 2026-02-09T18:09:49Z

## Primary Purpose
High-level Python interface to the liblzma compression library, providing file-like objects and convenience functions for LZMA/XZ compression and decompression. Acts as a wrapper around the lower-level `_lzma` module.

## Key Classes and Functions

### LZMAFile (L38-269)
Main file-like class for transparent LZMA compression/decompression, inheriting from `_compression.BaseStream`. Supports both reading and writing compressed files.

**Constructor (L49-132):**
- Handles mode validation and format selection
- Creates LZMACompressor for write modes (L111-112)
- Sets up DecompressReader with BufferedReader for read mode (L130-132)
- Supports file paths, file objects, and PathLike objects

**Key Methods:**
- `close()` (L134-156): Flushes compressor and closes underlying file
- `read()` (L193-200), `read1()` (L202-212), `readline()` (L214-222): Delegate to BufferedReader
- `write()` (L224-243): Compresses data using internal compressor and writes to file
- `seek()` (L245-261), `tell()` (L263-268): Position management with seeking emulation
- Property methods: `closed` (L158-161), `readable()` (L172-175), `writable()` (L177-180), `seekable()` (L168-170)

### Convenience Functions

**`open()` (L271-316):**
- High-level file opening function supporting both binary and text modes
- Wraps LZMAFile in TextIOWrapper for text mode (L313-314)
- Validates mode and encoding arguments

**`compress()` (L319-328):**
- One-shot compression function
- Creates LZMACompressor, compresses data, and flushes

**`decompress()` (L331-356):**
- One-shot decompression with concatenated stream support
- Handles multiple LZMA streams in sequence (L340-355)
- Robust error handling for partial streams

## Important Dependencies
- `_lzma`: Low-level C extension providing LZMACompressor, LZMADecompressor, constants
- `_compression`: Provides BaseStream and DecompressReader infrastructure  
- `io`: BufferedReader for efficient reading, TextIOWrapper for text mode
- `builtins`, `os`: File handling utilities

## Key Constants and Modes
- Mode constants: `_MODE_CLOSED=0`, `_MODE_READ=1`, `_MODE_WRITE=3` (L32-35)
- Exports compression constants from `_lzma`: CHECK_*, FILTER_*, FORMAT_*, etc. (L11-22)

## Architectural Patterns
- **Delegation Pattern**: LZMAFile delegates I/O operations to BufferedReader (read mode) or underlying file object (write mode)
- **State Management**: Uses internal mode tracking to validate operations and manage resources
- **Resource Management**: Proper cleanup in `close()` with try/finally blocks
- **Stream Concatenation**: `decompress()` handles multiple concatenated LZMA streams automatically

## Critical Invariants
- Binary-only interface - all data must be bytes/bytearray
- Write mode requires immediate compressor creation; read mode uses lazy decompression
- Mode validation prevents invalid parameter combinations (e.g., check parameter in read mode)
- File position tracking maintained separately for write mode (`_pos` attribute)
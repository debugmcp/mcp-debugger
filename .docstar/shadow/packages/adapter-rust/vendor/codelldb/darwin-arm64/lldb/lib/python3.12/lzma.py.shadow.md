# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/lzma.py
@source-hash: 58fb9d2fdc8a8af7
@generated: 2026-02-09T18:07:11Z

## Primary Purpose
Python interface to liblzma compression library providing LZMA/XZ format compression and decompression. Supports both binary file I/O and streaming compression operations with multiple container formats (XZ, legacy LZMA, raw streams).

## Core Architecture
Built on `_compression.BaseStream` (L38) using the low-level `_lzma` module (L27-28) with high-level convenience wrappers. Uses composition pattern with `LZMACompressor`/`LZMADecompressor` for actual compression work.

## Key Classes

### LZMAFile (L38-269)
Primary file-like interface for LZMA compression. Extends `_compression.BaseStream`.

**Key Methods:**
- `__init__()` (L49-133): Complex initialization handling multiple modes (r/w/x/a), formats, and parameters
- `close()` (L134-156): Safe cleanup with proper resource management
- `read()/write()` (L193-243): Delegated I/O operations
- `seek()/tell()` (L245-268): Position management with emulated seeking

**Internal State:**
- `_mode`: Tracks file state using constants (L32-35)
- `_fp`: Underlying file object
- `_buffer`: `io.BufferedReader` for read mode (L132)
- `_compressor`: `LZMACompressor` instance for write mode (L111-112)

## Key Functions

### open() (L271-316)
High-level file opener supporting both binary and text modes. Wraps `LZMAFile` with optional `io.TextIOWrapper` for text mode.

### compress()/decompress() (L319-356)
One-shot compression utilities:
- `compress()` (L319-328): Simple block compression
- `decompress()` (L331-356): Complex multi-stream decompression with error handling

## Dependencies
- `_lzma`: Low-level C extension module (imported with `*`)
- `_compression.BaseStream`: Base class providing common stream functionality
- `io`: Standard I/O operations and buffering
- `builtins.open`: File opening operations

## Configuration Constants
Extensive constant definitions (L11-22) for:
- Integrity checks: `CHECK_*`
- Filter types: `FILTER_*`  
- Container formats: `FORMAT_*`
- Compression modes: `MODE_*`, `PRESET_*`

## Notable Patterns
- Mode validation with explicit error messages (L97-115)
- Resource cleanup using try/finally blocks (L142-156)
- Multi-stream decompression with graceful error handling (L339-356)
- Flexible input handling (file paths, file objects, PathLike)
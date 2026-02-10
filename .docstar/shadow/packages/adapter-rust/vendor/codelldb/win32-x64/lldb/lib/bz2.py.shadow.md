# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/bz2.py
@source-hash: 76ab3252924e71e8
@generated: 2026-02-09T18:12:53Z

## Purpose
Standard Python bzip2 module providing file interface and compression/decompression functionality. Part of Python's compression library ecosystem, offering both streaming and one-shot compression operations.

## Key Components

### BZ2File Class (L26-269)
Primary file-like object for bzip2 operations, inheriting from `_compression.BaseStream`:
- **Constructor** (L37-96): Handles file/stream initialization with mode validation and compression level setup
- **File Operations**: Standard file interface methods (read, write, seek, tell, close)
- **Mode Management**: Uses internal mode constants (_MODE_CLOSED=0, _MODE_READ=1, _MODE_WRITE=3)
- **Buffering**: Uses `io.BufferedReader` for read operations (L93), direct writing for write operations

Key methods:
- `close()` (L97-119): Handles proper cleanup with compression flushing
- `read()/read1()/readinto()` (L157-184): Delegated to internal buffer
- `write()` (L214-233): Compresses data before writing to underlying stream
- `seek()/tell()` (L245-268): Position management with emulated seeking

### Module Functions

#### open() (L271-310)
High-level interface supporting both binary and text modes:
- Validates mode combinations and text-specific arguments
- Returns BZ2File for binary mode, TextIOWrapper for text mode
- Default compression level 9, mode "rb"

#### compress() (L313-321)
One-shot compression utility:
- Creates BZ2Compressor, compresses data, and flushes
- Returns complete compressed bytes

#### decompress() (L324-344)
One-shot decompression with concatenated stream support:
- Handles multiple concatenated bzip2 streams
- Error recovery for trailing invalid data
- Validates end-of-stream markers

## Dependencies
- `_bz2`: Native compression implementation (BZ2Compressor, BZ2Decompressor)
- `_compression`: Base streaming infrastructure (BaseStream, DecompressReader)
- `io`: Buffer management and text wrapping
- `os`: Path handling

## Architecture Patterns
- **Stream Abstraction**: Follows Python's file-like object protocol
- **Mode-based Behavior**: Different code paths for read/write operations
- **Delegation Pattern**: Read operations delegated to BufferedReader, write operations use direct compression
- **Resource Management**: Proper cleanup with context manager support via inheritance

## Critical Constraints
- Binary-only interface (returns/accepts bytes)
- Compression levels must be 1-9
- Write mode requires flushing compressor data on close
- Seeking is emulated and potentially expensive
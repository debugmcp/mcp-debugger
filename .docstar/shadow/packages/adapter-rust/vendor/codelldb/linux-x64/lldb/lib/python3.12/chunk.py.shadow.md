# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/chunk.py
@source-hash: 4817eb94eeb8835c
@generated: 2026-02-09T18:09:33Z

**Primary Purpose**: Implements a file-like reader for IFF (Interchange File Format) chunks used in formats like AIFF, TIFF, and RealMedia. Provides sequential access to structured binary data with 4-byte ID + 4-byte size headers.

**Architecture**: Single-class module with deprecation warning for removal in Python 3.13.

## Key Components

### Chunk Class (L55-173)
Core class providing file-like interface for reading IFF chunk data structures.

**Constructor** `__init__(file, align=True, bigendian=True, inclheader=False)` (L56-80):
- Reads 4-byte chunk ID and 4-byte size header from file
- Supports big/little endian byte order via struct format strings
- Tracks seekability based on underlying file's tell() capability
- Handles alignment for word boundaries when `align=True`

**State Management**:
- `chunkname`: 4-byte chunk identifier (L65)
- `chunksize`: data size excluding/including header based on `inclheader` (L69,73)
- `size_read`: bytes consumed from chunk data (L74)
- `closed`: prevents operations after close() (L58)
- `seekable`: determined by underlying file capabilities (L76-80)

**File-like Interface**:
- `read(size=-1)` (L126-147): Primary data access with automatic alignment padding
- `seek(pos, whence=0)` (L102-119): Position-based navigation (seekable files only)
- `tell()` (L121-124): Current position within chunk
- `close()` (L90-95): Calls skip() to advance to next chunk boundary
- `isatty()` (L97-100): Always returns False

**Utility Methods**:
- `getname()` (L82-84): Returns chunk identifier
- `getsize()` (L86-88): Returns total chunk size
- `skip()` (L149-173): Advances to next chunk boundary, handles alignment

## Critical Behaviors

**Alignment Handling**: When `align=True` and chunk size is odd, automatically reads one extra padding byte (L142-146, L162-163)

**Error Conditions**: 
- EOFError on insufficient data during initialization (L67, L71)
- ValueError on operations after close() (L99, L109, L122, L133, L157)
- OSError/RuntimeError on invalid seek operations (L111, L117)

**End-of-Chunk Detection**: Returns empty bytes when `size_read >= chunksize` (L134-135)

## Dependencies
- `struct` module for binary data unpacking (L57, L69)
- `warnings` module for deprecation notice (L51, L53)
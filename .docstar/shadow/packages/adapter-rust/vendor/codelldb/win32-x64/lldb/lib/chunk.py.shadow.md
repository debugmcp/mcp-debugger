# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/chunk.py
@source-hash: 4817eb94eeb8835c
@generated: 2026-02-09T18:12:53Z

## Purpose and Responsibility

This file implements a utility for parsing IFF (Interchange File Format) chunks, commonly used in multimedia formats like AIFF, TIFF, and RMFF. The module provides a file-like interface for reading structured binary data organized as 4-byte ID + 4-byte size + payload chunks.

**DEPRECATION WARNING**: This module is deprecated and will be removed in Python 3.13 (L53).

## Key Classes

### Chunk (L55-173)
Primary class providing file-like interface for reading IFF chunks with automatic boundary alignment.

**Constructor** `__init__(file, align=True, bigendian=True, inclheader=False)` (L56-81):
- Reads 4-byte chunk ID and 4-byte size header immediately
- Configures endianness (`strflag`) and alignment behavior
- Determines if underlying file is seekable
- Raises `EOFError` if insufficient data for header

**Core Methods**:
- `getname()` (L82-84): Returns 4-byte chunk identifier
- `getsize()` (L86-88): Returns chunk payload size
- `read(size=-1)` (L126-147): Primary read method with automatic alignment padding
- `seek(pos, whence=0)` (L102-119): Seeks within chunk boundaries only
- `tell()` (L121-124): Returns current position within chunk
- `skip()` (L149-173): Efficiently skips to next chunk boundary
- `close()` (L90-95): Calls skip() then marks chunk as closed
- `isatty()` (L97-100): Always returns False (not a terminal)

## Key State Variables
- `chunkname`: 4-byte chunk identifier (L65)
- `chunksize`: Size of chunk payload in bytes (L69,L73)
- `size_read`: Current read position within chunk (L74)
- `offset`: File position at start of chunk data (L76)
- `seekable`: Whether underlying file supports seeking (L78,L80)
- `align`: Whether to pad odd-sized chunks to word boundaries (L59)
- `closed`: Prevents operations on closed chunks (L58)

## Important Dependencies
- `struct` module for binary data unpacking (L57,L69)
- `warnings` module for deprecation notice (L51,L53)

## Architectural Patterns
- **File-like Interface**: Implements standard file methods (read, seek, tell, close)
- **Boundary Alignment**: Automatically handles word-boundary padding for multimedia formats
- **Error Handling**: Converts struct errors to EOFError, validates chunk boundaries
- **Lazy Reading**: Only reads chunk header upfront, payload read on demand

## Critical Invariants
- Chunk size tracking: `size_read` never exceeds `chunksize`
- Boundary validation: seek operations constrained to chunk boundaries (L116-117)
- Alignment handling: Odd-sized chunks automatically padded when `align=True` (L142-146, L162-163)
- State consistency: All operations check `closed` flag and raise ValueError if closed

## Usage Pattern
Designed for sequential chunk processing in multimedia files:
1. Create Chunk instance at file position
2. Read chunk data using file-like methods  
3. Close/skip to advance to next chunk
4. Repeat until EOFError indicates end of file
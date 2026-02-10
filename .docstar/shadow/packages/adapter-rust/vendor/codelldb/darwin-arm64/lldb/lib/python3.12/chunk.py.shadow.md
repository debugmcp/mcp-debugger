# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/chunk.py
@source-hash: 4817eb94eeb8835c
@generated: 2026-02-09T18:07:04Z

## Purpose
Python module for reading IFF (Interchange File Format) chunks used in formats like AIFF, TIFF, and RMFF. Provides a file-like interface to sequentially read structured binary data chunks with 4-byte ID + 4-byte size headers.

## Key Components

### Chunk Class (L55-173)
Primary class implementing file-like interface for reading IFF chunks. Each instance represents one chunk with automatic boundary management.

**Constructor** `__init__(self, file, align=True, bigendian=True, inclheader=False)` (L56-80):
- Reads 4-byte chunk ID and 4-byte size from file
- Configures endianness (big-endian default) and word alignment 
- Tracks seekability based on underlying file's tell() capability
- Raises EOFError if insufficient data for header

**Core Methods:**
- `getname()` (L82-84): Returns 4-byte chunk identifier
- `getsize()` (L86-88): Returns chunk data size in bytes
- `read(size=-1)` (L126-147): Reads chunk data with automatic boundary alignment, handles padding bytes for word-aligned chunks
- `seek(pos, whence=0)` (L102-119): Positions within chunk (seekable files only)
- `tell()` (L121-124): Returns current position within chunk
- `skip()` (L149-173): Advances to next chunk boundary, with fallback for non-seekable files
- `close()` (L90-95): Calls skip() and marks chunk as closed
- `isatty()` (L97-100): Always returns False

## Dependencies
- `struct` module (imported in __init__): For unpacking binary size data
- `warnings` module (L51): For deprecation notice

## Key State Variables
- `chunkname`: 4-byte chunk identifier 
- `chunksize`: Size of chunk data (excluding 8-byte header by default)
- `size_read`: Bytes read so far from current chunk
- `offset`: File position at start of chunk data (seekable files)
- `seekable`: Boolean flag for seek capability
- `align`: Word-boundary alignment flag
- `closed`: Chunk state flag

## Usage Pattern
Designed for sequential chunk processing: instantiate Chunk at each chunk boundary, read data, then create new instance for next chunk. EOFError signals end of file.

## Architecture Notes
- Handles both big-endian and little-endian formats via struct format strings
- Automatic padding byte consumption for word-aligned chunks (odd sizes get +1 byte)
- Graceful degradation for non-seekable files (uses read-based skip)
- File-like interface enables transparent nesting of chunk readers
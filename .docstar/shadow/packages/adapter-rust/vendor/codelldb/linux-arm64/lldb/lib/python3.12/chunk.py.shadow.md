# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/chunk.py
@source-hash: 4817eb94eeb8835c
@generated: 2026-02-09T18:08:34Z

**Primary Purpose**: IFF (Interchange File Format) chunk reader for binary file formats like AIFF, TIFF, RMFF. Provides a file-like interface to read structured chunks with 8-byte headers (4-byte ID + 4-byte size).

**Core Architecture**: Single `Chunk` class (L55-173) that wraps a file-like object and provides bounded reading within chunk boundaries. Handles endianness, alignment, and seeking capabilities.

**Key Components**:

- `__init__(file, align=True, bigendian=True, inclheader=False)` (L56-80): Initializes chunk by reading 8-byte header, determines seekability, sets up endian format
- `getname()` (L82-84): Returns 4-byte chunk identifier 
- `getsize()` (L86-88): Returns chunk data size
- `read(size=-1)` (L126-147): Main reading method with automatic boundary enforcement and alignment padding
- `seek(pos, whence=0)` (L102-119): Supports relative/absolute positioning within chunk bounds
- `tell()` (L121-124): Returns current position within chunk
- `skip()` (L149-173): Advances to next chunk, handling alignment and fallback for non-seekable files
- `close()` (L90-95): Calls skip() then marks as closed

**Critical State Variables**:
- `chunksize`: Data payload size (excludes header if inclheader=False)
- `size_read`: Bytes consumed from current position
- `offset`: Absolute file position at chunk start (seekable files only)
- `seekable`: Whether underlying file supports tell()/seek()

**Alignment Handling**: When `align=True`, reads extra padding byte for odd-sized chunks (L142-146, L162-163)

**Error Boundaries**: 
- Raises `EOFError` on insufficient header data or unexpected end
- Raises `ValueError` for operations on closed chunks
- Raises `OSError`/`RuntimeError` for invalid seek operations

**Dependencies**: `struct` module for binary unpacking, `warnings` for deprecation notice (L53)

**Usage Pattern**: Designed for sequential chunk processing in IFF files - instantiate new Chunk for each chunk until EOFError signals end of file.
# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/gzip.py
@source-hash: 31e7275c5c20d1b4
@generated: 2026-02-09T18:08:57Z

## Primary Purpose

Python gzip module providing functions to read and write gzipped files using the deflate compression algorithm. Supports both binary and text modes with transparent compression/decompression.

## Key Classes and Functions

### Public Interface (L14)
- `open()` (L28-71): High-level function supporting both binary/text modes, wraps GzipFile
- `compress()` (L602-617): One-shot data compression with gzip headers/trailers  
- `decompress()` (L620-642): One-shot data decompression handling multiple members
- `GzipFile` (L139-428): Main class implementing file-like interface for gzip streams
- `BadGzipFile` (L120-121): Exception for invalid gzip file errors

### Core Implementation Classes

**GzipFile** (L139-428): Primary gzip file interface
- Inherits from `_compression.BaseStream`
- Supports READ/WRITE modes with buffered I/O
- Constructor (L152-235) handles file objects or filenames
- Read methods: `read()` (L319), `read1()` (L326), `peek()` (L339), `readline()` (L425)
- Write methods: `write()` (L291), `_write_raw()` (L302-317)
- Stream control: `seek()` (L402-423), `tell()` (L254), `flush()` (L370), `close()` (L350-368)
- Properties: `mtime` (L238-240), `closed` (L347-348)

**_GzipReader** (L483-578): Internal decompression reader
- Extends `_compression.DecompressReader`
- Handles multi-member gzip files with CRC validation
- Core read logic (L502-553) with EOF handling (L555-575)
- Member boundary detection and header parsing

**_PaddedFile** (L78-118): Utility wrapper for prepending data to file streams
- Supports `read()` (L89-100), `prepend()` (L102-109), `seek()` (L111-114)
- Used for handling unused decompressor data

**_WriteBufferStream** (L124-137): Bridge between BufferedWriter and GzipFile
- Minimal RawIOBase implementation calling `GzipFile._write_raw()`

## Key Constants and Configuration

- Compression levels: `_COMPRESS_LEVEL_FAST=1`, `_COMPRESS_LEVEL_TRADEOFF=6`, `_COMPRESS_LEVEL_BEST=9` (L20-22)
- Buffer sizes: `READ_BUFFER_SIZE=131072`, `_WRITE_BUFFER_SIZE=32768` (L24-25) 
- Gzip flags: `FTEXT=1`, `FHCRC=2`, `FEXTRA=4`, `FNAME=8`, `FCOMMENT=16` (L16)
- Mode constants: `READ=1`, `WRITE=2` (L18)

## Critical Implementation Details

### Header Processing
- `_write_gzip_header()` (L259-289): Creates RFC 1952 compliant headers with filename/mtime
- `_read_gzip_header()` (L446-480): Parses headers, handles optional fields
- `_create_simple_gzip_header()` (L581-599): Optimized header creation for compression functions

### Compression Pipeline
- Write mode uses `zlib.compressobj` with `BufferedWriter` wrapper (L220-228)
- Read mode uses `_GzipReader` with `BufferedReader` wrapper (L206-207)
- Raw deflate with negative wbits to avoid zlib headers

### Multi-member Support
- `decompress()` handles concatenated gzip streams (L624-642)
- `_GzipReader` automatically transitions between members (L513-530)
- CRC and length validation for each member (L560-565)

## Dependencies
- `zlib`: Core compression/decompression
- `_compression`: Base classes for stream handling  
- `io`: Buffered I/O wrappers and text encoding
- `struct`: Binary data packing/unpacking for headers/trailers

## Notable Patterns
- Delegation pattern: GzipFile delegates to internal buffered readers/writers
- State machine: _GzipReader tracks member boundaries with `_new_member` flag
- Error handling: Comprehensive validation of gzip format compliance
- Resource management: Proper cleanup of file objects in close() methods
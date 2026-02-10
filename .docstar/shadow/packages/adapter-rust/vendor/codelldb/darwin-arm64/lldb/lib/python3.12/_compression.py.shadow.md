# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/_compression.py
@source-hash: 3ad5d60627477a60
@generated: 2026-02-09T18:06:58Z

**Purpose:** Internal compression utility module providing base classes and stream adapters for Python's compression modules (gzip, lzma, bz2). Implements standardized I/O interfaces for decompression operations with seeking and multi-stream support.

**Key Classes:**

- **BaseStream (L9-31):** Abstract helper class extending `io.BufferedIOBase` providing common I/O state validation methods. Contains mode-checking utilities for read/write/seek operations that raise appropriate exceptions for invalid states.

- **DecompressReader (L33-162):** Core decompression adapter implementing `io.RawIOBase` interface. Wraps any decompressor factory to provide standardized file-like reading with full seeking support.

**Key Methods:**

- **BaseStream validation methods (L12-30):** `_check_not_closed()`, `_check_can_read()`, `_check_can_write()`, `_check_can_seek()` - raise ValueError/UnsupportedOperation for invalid operations
- **DecompressReader.__init__ (L39-58):** Initializes with file pointer, decompressor factory, optional trailing error types, and decompressor arguments
- **DecompressReader.read() (L72-111):** Main decompression logic handling multi-stream files, EOF detection, and size-bounded reading
- **DecompressReader.seek() (L130-158):** Implements full seeking by rewinding and forward-reading when necessary
- **DecompressReader._rewind() (L124-128):** Resets stream to beginning and reinitializes decompressor

**Architecture:**

- Uses composition pattern - wraps underlying file object and decompressor factory
- Supports multiple compressed streams in single file via automatic decompressor recreation
- Implements lazy size calculation for SEEK_END operations
- Handles trailing data gracefully via configurable exception catching
- Position tracking via `_pos` offset counter for seeking support

**Dependencies:** 
- `io` module for base classes and buffer operations
- `sys.maxsize` for unlimited buffer size in readall()

**Constants:**
- `BUFFER_SIZE = io.DEFAULT_BUFFER_SIZE` (L6) - chunk size for compressed data reads

**Critical Invariants:**
- `_pos` always reflects current position in decompressed stream
- `_size` set to actual size only after reaching EOF
- New decompressor created for each compressed stream and backward seeks
- EOF state (`_eof`) prevents unnecessary decompression attempts
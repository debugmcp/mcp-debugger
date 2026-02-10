# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/gzip.py
@source-hash: 31e7275c5c20d1b4
@generated: 2026-02-09T18:08:18Z

**Purpose**: Python standard library module providing gzip compression/decompression functionality with file-like interface compatibility.

**Core Components**:

- **`open()` (L28-71)**: Main entry point that creates GzipFile instances or wraps them in TextIOWrapper for text mode. Handles mode validation and parameter checking.

- **`GzipFile` (L139-428)**: Primary class extending `_compression.BaseStream`. Provides file-like interface for gzip operations with buffered I/O. Key methods:
  - `__init__` (L152-236): Constructor handling read/write mode setup, compression parameters
  - `_write_gzip_header` (L259-289): Writes RFC 1952 compliant gzip header with optional filename
  - `write/_write_raw` (L291-317): Write operations with CRC32 calculation and compression
  - `read/read1/peek` (L319-344): Read operations delegating to buffered reader
  - `seek` (L402-423): Seeking with write-mode zero-padding for forward seeks only
  - `close` (L350-368): Proper cleanup with CRC32/size trailer writing for write mode

- **`_GzipReader` (L483-578)**: Decompression reader extending `_compression.DecompressReader`. Handles:
  - Multi-member gzip file support with automatic member detection
  - CRC32 validation and size verification
  - EOF handling and padding consumption (L567-574)

- **`_PaddedFile` (L78-118)**: Utility class for prepending data to file streams, used for handling unused decompressor data.

- **`_WriteBufferStream` (L124-137)**: Minimal stream interface for connecting BufferedWriter to GzipFile's raw write method.

- **Utility Functions**:
  - `compress/decompress` (L602-642): One-shot compression/decompression with multi-member support
  - `_read_gzip_header` (L446-480): Header parsing with field extraction
  - `_create_simple_gzip_header` (L581-599): Optimized header generation
  - `write32u` (L73-76): Little-endian 32-bit unsigned integer writer

**Key Constants**:
- Compression levels: `_COMPRESS_LEVEL_FAST=1`, `_COMPRESS_LEVEL_TRADEOFF=6`, `_COMPRESS_LEVEL_BEST=9` (L20-22)
- Buffer sizes: `READ_BUFFER_SIZE=128KB`, `_WRITE_BUFFER_SIZE=4*DEFAULT_BUFFER_SIZE` (L24-25)
- Gzip flags: `FTEXT`, `FHCRC`, `FEXTRA`, `FNAME`, `FCOMMENT` (L16)

**Dependencies**: `zlib` (compression), `io` (buffered I/O), `_compression` (base stream classes), `struct` (binary packing)

**Architecture Notes**:
- Uses composition with BufferedReader/BufferedWriter for efficient I/O
- Implements proper gzip format compliance including CRC32 validation
- Supports concatenated gzip members and trailing zero padding
- Write mode only supports forward seeking via zero-padding
- Maintains compatibility with file-like interface expectations
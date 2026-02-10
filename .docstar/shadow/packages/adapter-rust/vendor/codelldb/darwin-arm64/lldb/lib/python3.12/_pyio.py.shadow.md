# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/_pyio.py
@source-hash: 22a2730be3230802
@generated: 2026-02-09T18:07:28Z

## Python Pure-Python IO Module Implementation

This file provides a complete pure-Python implementation of Python's IO system, serving as a fallback when the faster C implementation is unavailable. It implements the full IO hierarchy with text and binary stream classes, buffering, and encoding/decoding support.

### Core Functions

**`text_encoding(encoding, stacklevel=2)` (L43-67)**: Helper function that resolves text encoding, defaulting to UTF-8 mode or locale encoding. Emits EncodingWarning when encoding=None and warn_default_encoding flag is set.

**`open(file, mode="r", buffering=-1, ...)` (L76-280)**: Main file opening function that implements Python's built-in open(). Performs comprehensive mode validation, creates appropriate stream objects (FileIO→BufferedReader/Writer→TextIOWrapper chain), and handles buffering logic with platform-specific optimizations.

**`_open_code_with_warning(path)` (L284-298)**: Fallback implementation for opening code files, warns about missing hook support.

### Base Classes

**`IOBase` (L315-604)**: Abstract base class for all IO operations. Provides context manager support, common error checking methods (`_checkClosed`, `_checkReadable`, etc.), and default implementations for positioning, flushing, and iteration protocols.

**`RawIOBase` (L607-667)**: Base for raw binary IO. Implements `read()` in terms of `readinto()`, provides `readall()` using chunks, delegates actual IO operations to subclasses.

**`BufferedIOBase` (L670-773)**: Base for buffered IO objects. Defines interface for `read()`, `read1()`, `readinto()`, `readinto1()` and `write()` with BlockingIOError semantics. Contains `_readinto()` helper (L738-751) that converts between read methods.

### Mixin and Utility Classes

**`_BufferedIOMixin` (L776-881)**: Provides common functionality for buffered streams wrapping raw streams. Handles seeking, truncation, flushing, and property delegation to underlying raw stream. Includes pickling prevention and consistent repr formatting.

**`BytesIO` (L883-1024)**: In-memory binary stream using bytearray buffer. Implements full random access with automatic buffer expansion and provides `getvalue()`/`getbuffer()` for content access.

### Buffered Stream Implementations  

**`BufferedReader` (L1026-1224)**: Read-only buffered wrapper with read-ahead caching. Uses internal `_read_buf` and `_read_pos` for efficient sequential reading. Implements `peek()` (L1122-1142) and optimized `_readinto()` (L1163-1209) with direct buffer management.

**`BufferedWriter` (L1226-1328)**: Write-only buffered wrapper with write-behind caching. Accumulates writes in `_write_buf`, flushes when buffer exceeds threshold. Handles partial writes and BlockingIOError with buffer adjustment.

**`BufferedRWPair` (L1331-1402)**: Combines separate BufferedReader and BufferedWriter for bidirectional IO on separate read/write streams (e.g., pipes, sockets).

**`BufferedRandom` (L1404-1476)**: Random-access buffered stream supporting both read and write operations. Coordinates read/write buffers, handles mode switching, and implements complex seeking that accounts for buffered data.

### File Implementation

**`FileIO` (L1478-1819)**: Raw file IO implementation wrapping OS file descriptors. Handles mode parsing, file creation flags, platform-specific binary mode setup, and direct OS calls for read/write/seek operations. Includes comprehensive error handling and resource cleanup.

### Text Stream Support

**`TextIOBase` (L1821-1885)**: Abstract base for text streams, defines character-based interface.

**`IncrementalNewlineDecoder` (L1888-1971)**: Codec wrapper for universal newline support. Translates `\r\n` and `\r` to `\n`, tracks encountered newline types in `seennl` bitmask, handles partial newline sequences across decode boundaries.

**`TextIOWrapper` (L1973-2647)**: Main text stream implementation wrapping BufferedIOBase. Handles encoding/decoding, newline translation, line buffering, and complex seeking with codec state management. Key components:
- Encoder/decoder lazy initialization and reset logic
- `_decoded_chars` buffer for character-level operations  
- Complex `tell()`/`seek()` cookie system (L2309-2512) for position tracking through encoding layers
- Chunk-based reading with decode state snapshots

**`StringIO` (L2650-2698)**: In-memory text stream using BytesIO backend with UTF-8 encoding and surrogate handling.

### Key Architectural Patterns

- Layered IO stack: FileIO → BufferedReader/Writer → TextIOWrapper
- Extensive input validation and type checking throughout
- Thread-safe buffered operations using locks
- Platform abstraction for binary mode and file inheritance
- Codec state management for accurate text stream positioning
- Comprehensive error handling with specific exception types

The implementation maintains full compatibility with Python's C IO implementation while providing readable reference code for the complex IO subsystem.
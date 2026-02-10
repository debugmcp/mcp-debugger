# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/_pyio.py
@source-hash: 22a2730be3230802
@generated: 2026-02-09T18:12:59Z

Python implementation of the io module providing file and stream I/O interfaces. This module serves as a pure Python fallback when C io extensions are unavailable, commonly used in debugging contexts like LLDB.

## Core Functions

**text_encoding(encoding, stacklevel=2) (L43-67)**: Helper to determine text encoding, defaulting to locale or UTF-8 based on UTF-8 mode. Emits EncodingWarning when encoding is None.

**open(file, mode="r", buffering=-1, ...) (L76-280)**: Main file opening function supporting all standard modes (r/w/a/x/b/t/+). Returns appropriate stream objects based on mode - TextIOWrapper for text, BufferedReader/Writer/Random for binary. Handles extensive parameter validation and buffering logic.

**_open_code_with_warning(path) (L284-298)**: Fallback implementation for opening code files, warns about missing hook support.

## Base Classes

**IOBase (L315-604)**: Abstract base class for all I/O operations. Provides:
- Context manager protocol (__enter__/__exit__)
- Basic file operations (seek, tell, truncate, flush, close)  
- Capability checking (seekable, readable, writable)
- Iterator protocol for line-by-line reading
- Exception handling via _unsupported() method

**RawIOBase (L607-667)**: Base for raw binary I/O, extends IOBase. Implements read() via readinto(), provides readall() for EOF reading.

**BufferedIOBase (L670-773)**: Base for buffered I/O with enhanced read/write semantics. Supports read1() for single system calls and detach() for separating underlying streams.

## Mixin and Implementation Classes

**_BufferedIOMixin (L776-881)**: Mixin providing common buffered I/O functionality. Delegates most operations to underlying raw stream while adding buffering layer. Handles positioning, flushing, and stream properties.

**BytesIO (L883-1024)**: In-memory binary stream using bytearray buffer. Supports all standard I/O operations with internal position tracking.

**BufferedReader (L1026-1224)**: Buffered reading with configurable buffer size. Uses read-ahead buffering and thread-safe operations via _read_lock. Implements peek() for non-consuming reads.

**BufferedWriter (L1226-1328)**: Buffered writing with automatic flushing when buffer exceeds capacity. Thread-safe via _write_lock, handles partial writes and BlockingIOError.

**BufferedRWPair (L1331-1402)**: Combines separate reader/writer streams for bidirectional I/O, typically for sockets or pipes.

**BufferedRandom (L1404-1475)**: Random-access buffered I/O combining reader/writer functionality for seekable streams. Manages both read and write buffers with coordination.

**FileIO (L1478-1819)**: Raw file I/O implementation wrapping OS file descriptors. Handles mode parsing, file creation/opening, and direct OS read/write operations. Platform-specific handling for Windows text mode.

## Text I/O Classes

**TextIOBase (L1821-1885)**: Abstract base for text streams providing character-based interface over binary streams.

**IncrementalNewlineDecoder (L1888-1970)**: Codec for universal newline support, translating \\r\\n and \\r to \\n while tracking encountered newline types.

**TextIOWrapper (L1973-2647)**: Main text I/O implementation layering character encoding/decoding over BufferedIOBase. Features:
- Configurable encoding, error handling, newline processing
- Complex tell/seek support via cookie-based position tracking  
- Line buffering and write-through options
- Decoder state management for proper positioning

**StringIO (L2650-2698)**: Text I/O using in-memory string buffer, built on BytesIO with UTF-8 encoding.

## Constants and Configuration

- DEFAULT_BUFFER_SIZE (L27): 8KB default buffer size
- valid_seek_flags (L21-24): Supported seek whence values including OS-specific SEEK_HOLE/SEEK_DATA
- _IOBASE_EMITS_UNRAISABLE (L38): Controls exception reporting in finalizers
- UnsupportedOperation (L308-312): Exception for unsupported I/O operations

The module maintains compatibility with the C io implementation while providing pure Python alternatives for all major I/O operations.
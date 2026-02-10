# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/_pyio.py
@source-hash: 22a2730be3230802
@generated: 2026-02-09T18:08:45Z

## Pure Python I/O Module Implementation

This file provides a complete pure Python implementation of Python's `io` module, serving as a fallback when C extensions are unavailable. It implements the full I/O class hierarchy with text and binary stream handling.

### Core Functions

**`text_encoding(encoding, stacklevel=2)` (L43-67)**  
Helper function that resolves text encoding, defaulting to "locale" or "utf-8" based on UTF-8 mode. Emits EncodingWarning when encoding is None and warnings are enabled.

**`open(file, mode="r", buffering=-1, ...)` (L77-280)**  
Main file opening function that mimics builtin open(). Performs extensive mode validation, creates appropriate I/O stack (FileIO → BufferedReader/Writer → TextIOWrapper), and handles buffering logic including automatic buffer size detection via `os.fstat().st_blksize`.

**`_open_code_with_warning(path)` (L284-298)**  
Fallback implementation of `open_code()` that opens files for code execution with warning about missing hook support.

### I/O Base Classes

**`IOBase` (L315-604)**  
Abstract base class for all I/O operations. Provides:
- Position methods: `seek()`, `tell()`, `truncate()` 
- State methods: `flush()`, `close()`, `closed` property
- Capability checks: `readable()`, `writable()`, `seekable()`  
- Context manager protocol (`__enter__`/`__exit__`)
- Iterator protocol for line-by-line reading
- Internal helper `_unsupported()` for raising UnsupportedOperation

**`RawIOBase` (L607-667)**  
Base for raw binary I/O. Implements `read()` in terms of `readinto()` for efficiency. Provides `readall()` method that reads until EOF using `DEFAULT_BUFFER_SIZE` chunks.

**`BufferedIOBase` (L670-773)**  
Base for buffered I/O with enhanced `read()`/`readinto()` methods that never return None (unlike raw counterparts). Includes `read1()` for single-call reads and `detach()` for separating underlying streams.

### Concrete I/O Implementations

**`_BufferedIOMixin` (L776-881)**  
Mixin providing common buffered I/O functionality by delegating to underlying raw stream. Handles positioning, flushing, and property forwarding.

**`BytesIO` (L883-1024)**  
In-memory binary I/O using internal `_buffer` bytearray. Fully implements seek/read/write with proper position tracking via `_pos`. Provides `getvalue()` and `getbuffer()` for buffer access.

**`BufferedReader` (L1026-1224)**  
Buffered reading wrapper with internal read buffer (`_read_buf`) and read lock. Key features:
- Peek functionality for looking ahead without consuming
- Optimized `_read_unlocked()` with fast/slow path logic
- `readinto()` implementation with direct buffer copying
- Read position adjustment for accurate `tell()`

**`BufferedWriter` (L1226-1329)**  
Buffered writing wrapper with write buffer and lock. Handles buffer overflow, partial write recovery, and proper flushing semantics.

**`BufferedRWPair` (L1331-1402)**  
Combines separate BufferedReader and BufferedWriter for bidirectional I/O (e.g., sockets, pipes).

**`BufferedRandom` (L1404-1476)**  
Full random-access buffered I/O inheriting from both BufferedReader and BufferedWriter. Coordinates read/write buffers and implements proper seeking that flushes writes and invalidates read buffers.

**`FileIO` (L1478-1818)**  
Raw file I/O implementation wrapping OS file descriptors. Handles:
- Mode parsing and flag conversion
- File creation/opening with proper permissions  
- Platform-specific binary mode setting
- Comprehensive error handling for invalid operations

### Text I/O Classes

**`TextIOBase` (L1821-1885)**  
Abstract base for text I/O defining character-based interface with encoding/errors/newlines properties.

**`IncrementalNewlineDecoder` (L1888-1970)**  
Codec wrapper for universal newline translation, handling `\r\n`, `\r` → `\n` conversion and tracking encountered newline types via `seennl` bitmask.

**`TextIOWrapper` (L1973-2648)**  
Complete text I/O implementation layered over BufferedIOBase. Major features:
- Encoding/decoding with configurable error handling
- Universal newline support via IncrementalNewlineDecoder
- Complex position tracking with cookie-based seeking 
- Snapshotting for tell/seek reconstruction
- Line buffering and write-through modes
- `_read_chunk()` for efficient buffered text reading

**`StringIO` (L2650-2698)**  
In-memory text I/O using BytesIO backend with UTF-8 encoding and surrogatepass error handling.

### Key Architecture Patterns

- **Layered I/O Stack**: Raw → Buffered → Text with clean abstraction boundaries
- **Thread Safety**: Lock-based synchronization in buffered classes
- **Position Tracking**: Complex cookie system in TextIOWrapper for accurate seek/tell
- **Universal Newlines**: Centralized in IncrementalNewlineDecoder with state preservation
- **Error Handling**: Consistent UnsupportedOperation raising with descriptive messages

### Platform Considerations

- Windows-specific `_setmode` binary mode handling
- Automatic buffer size detection via `st_blksize` 
- Inheritable file descriptor management
- UTF-8 mode and locale encoding detection
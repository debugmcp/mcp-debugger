# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/_pyio.py
@source-hash: 22a2730be3230802
@generated: 2026-02-09T18:07:50Z

This file is the **pure Python implementation of the `io` module**, providing text and binary I/O classes as fallbacks when C extensions aren't available. It's part of the LLDB/CodeLLDB debugging adapter's Python environment.

## Primary Purpose
- Implements Python's I/O hierarchy in pure Python as alternatives to C-based implementations
- Provides file opening functionality, buffered I/O, text wrapping, and in-memory streams
- Serves as reference implementation and fallback for the standard `io` module

## Core Functions

**`text_encoding(encoding, stacklevel=2)` (L43-67)**  
Helper function that resolves encoding defaults, emitting warnings when encoding is None and system flags require it.

**`open(file, mode="r", buffering=-1, ...)` (L77-280)**  
Main file opening function (decorated with `@staticmethod`). Validates parameters, creates appropriate FileIO object, wraps with buffering layers, and adds text wrapper if needed. Returns different types based on mode: TextIOWrapper for text, BufferedReader/Writer/Random for binary.

## Base Classes

**`IOBase` (L315-603)**  
Abstract base class for all I/O operations. Provides:
- Context manager protocol (`__enter__`/`__exit__`)
- Iterator protocol for line-by-line reading
- Default implementations that raise `UnsupportedOperation`
- Stream state checking (`_checkClosed`, `_checkReadable`, `_checkWritable`)
- Position methods (`seek`, `tell`, `truncate`)

**`RawIOBase` (L607-664)**  
Base for unbuffered binary I/O. Implements `read()` in terms of `readinto()`. Provides `readall()` method for reading until EOF.

**`BufferedIOBase` (L670-772)**  
Base for buffered I/O objects. Defines interface for `read()`, `read1()`, `readinto()`, `readinto1()`, and `write()` with proper BlockingIOError semantics.

## Buffered I/O Implementations

**`_BufferedIOMixin` (L776-881)**  
Mixin providing common buffered I/O functionality by delegating to underlying raw stream. Handles seeking, truncation, flushing, and provides properties like `name`, `mode`, `closed`.

**`BufferedReader` (L1026-1224)**  
Readable buffered I/O with internal read buffer (`_read_buf`). Implements efficient buffering strategy, `peek()` functionality, and `read1()` for single system calls. Uses `_read_lock` for thread safety.

**`BufferedWriter` (L1226-1328)**  
Writable buffered I/O with internal write buffer (`_write_buf`). Handles buffer overflow by flushing, manages partial writes on BlockingIOError. Uses `_write_lock` for thread safety.

**`BufferedRandom` (L1404-1475)**  
Random access buffered I/O inheriting from both BufferedReader and BufferedWriter. Manages coordination between read and write buffers, ensuring proper seeking behavior.

**`BufferedRWPair` (L1331-1402)**  
Combines separate reader and writer objects for bidirectional I/O (like sockets/pipes).

## Concrete I/O Classes

**`BytesIO` (L883-1024)**  
In-memory binary stream using `bytearray` as backing store. Provides `getvalue()` and `getbuffer()` methods for accessing contents.

**`FileIO` (L1478-1818)**  
Raw file I/O implementation wrapping OS file descriptors. Handles mode parsing, file opening with proper flags, binary mode operations. Maps Python file modes to OS flags.

**`TextIOBase` (L1821-1884)**  
Abstract base for text I/O with properties for `encoding`, `errors`, `newlines`.

**`IncrementalNewlineDecoder` (L1888-1970)**  
Codec for universal newlines mode, translating `\r\n` and `\r` to `\n`. Tracks encountered newline types and handles pending `\r` characters.

**`TextIOWrapper` (L1973-2647)**  
Main text I/O implementation wrapping BufferedIOBase objects. Handles:
- Character encoding/decoding with configurable error handling
- Universal newlines translation
- Complex seeking via cookie-based position tracking
- Line buffering and write-through modes
- Decoder state management for proper `tell()`/`seek()` behavior

**`StringIO` (L2650-2697)**  
In-memory text stream using BytesIO as backing store with UTF-8 encoding.

## Key Design Patterns
- Layered architecture: Raw → Buffered → Text
- Delegation pattern in mixins and wrappers
- State machine approach for text encoding/decoding
- Extensive parameter validation with descriptive error messages
- Thread-safe buffering with locks
- Cookie-based seeking for text streams with complex position reconstruction

## Constants & Configuration
- `DEFAULT_BUFFER_SIZE = 8192` (L27)
- `valid_seek_flags` includes standard and platform-specific seek options (L21-24)
- Debug flags `_IOBASE_EMITS_UNRAISABLE`, `_CHECK_ERRORS` for development builds (L38-40)
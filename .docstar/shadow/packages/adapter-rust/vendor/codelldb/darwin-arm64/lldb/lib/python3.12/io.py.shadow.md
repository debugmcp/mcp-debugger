# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/io.py
@source-hash: 7cec3cb8ac004058
@generated: 2026-02-09T18:07:06Z

## Purpose
Python's standard I/O module providing high-level interfaces to stream handling. Acts as a facade over the C-implemented `_io` module, exposing public APIs and establishing abstract base class hierarchy for stream operations.

## Key Components

### Constants & Configuration
- `DEFAULT_BUFFER_SIZE` (L55-58): Buffer size for I/O operations, imported from `_io`
- `SEEK_SET`, `SEEK_CUR`, `SEEK_END` (L65-67): Standard seek position constants (0, 1, 2)

### Abstract Base Classes (L72-82)
- `IOBase` (L72-73): Root ABC for all I/O classes, inherits from `_io._IOBase`
- `RawIOBase` (L75-76): ABC for raw byte streams, extends IOBase
- `BufferedIOBase` (L78-79): ABC for buffered I/O operations
- `TextIOBase` (L81-82): ABC for text-based I/O with encoding/decoding

### Public API Exports (L44-49)
All major I/O classes, exceptions, and functions are re-exported from `_io` module:
- Stream classes: `FileIO`, `BytesIO`, `StringIO`, `BufferedReader`, `BufferedWriter`, `BufferedRWPair`, `BufferedRandom`, `TextIOWrapper`
- Core functions: `open`, `open_code`
- Exceptions: `BlockingIOError`, `UnsupportedOperation`

### Class Registration (L84-92)
- `FileIO` registered with `RawIOBase` (L84)
- Buffered classes registered with `BufferedIOBase` (L86-88)
- Text classes registered with `TextIOBase` (L90-91)

### Platform-Specific Support (L94-99)
- Conditional registration of `_WindowsConsoleIO` with `RawIOBase` if available

## Architecture
This module implements the facade pattern, providing a clean public interface while delegating actual implementation to the C-based `_io` module. The ABC hierarchy allows for proper isinstance() checks and method resolution order for I/O operations.

## Dependencies
- `_io`: Core C implementation module
- `abc`: Abstract base class support

## Critical Notes
- Exception module attribution modified (L62) to appear as originating from `io`
- All concrete implementations are imported from `_io`, this module only provides ABC wrappers
- Platform detection for Windows console I/O support
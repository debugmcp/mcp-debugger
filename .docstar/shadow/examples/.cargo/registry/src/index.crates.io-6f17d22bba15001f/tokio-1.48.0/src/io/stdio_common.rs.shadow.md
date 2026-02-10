# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/stdio_common.rs
@source-hash: 728b7b41edf4d8e4
@generated: 2026-02-09T18:06:38Z

## Purpose
Platform-specific AsyncWrite adapter for handling UTF-8 boundary issues in Windows stdio operations. Ensures well-formed UTF-8 bytes are passed to underlying writers on Windows while being transparent on other platforms.

## Core Components

### SplitByUtf8BoundaryIfWindows<W> (L12-14)
Generic wrapper struct around an inner AsyncWrite implementation. Contains single field `inner: W` for the wrapped writer.

### Constructor (L17-19)
Simple constructor `new(inner: W)` that wraps the provided writer.

### AsyncWrite Implementation (L28-107)
Primary logic in `poll_write` method (L32-92):
- **Platform Detection (L48-52)**: Bypasses processing on non-Windows platforms or small buffers
- **Buffer Truncation (L54)**: Limits buffer to `DEFAULT_MAX_BUF_SIZE` 
- **UTF-8 Detection (L68-74)**: Samples first `MAX_BYTES_PER_CHAR * MAGIC_CONST` bytes to determine if buffer contains UTF-8
- **Boundary Fixing (L76-89)**: Removes incomplete UTF-8 characters at buffer end by scanning backwards for valid UTF-8 start bytes

Standard `poll_flush` (L94-99) and `poll_shutdown` (L101-106) methods delegate directly to inner writer.

## Key Constants
- `MAX_BYTES_PER_CHAR = 4` (L23): Unicode standard maximum bytes per character
- `MAGIC_CONST = 8` (L26): Heuristic multiplier for UTF-8 detection sample size

## Algorithm Details
UTF-8 boundary detection exploits encoding structure where continuation bytes start with `0b10` prefix, while start bytes are either `< 0b1000_0000` (ASCII) or `>= 0b1100_0000` (multi-byte start).

## Dependencies
- `crate::io::AsyncWrite` for trait implementation
- `std::pin::Pin` and `std::task::{Context, Poll}` for async polling
- `crate::io::blocking::DEFAULT_MAX_BUF_SIZE` for buffer size limits

## Test Infrastructure (L109-222)
- `TextMockWriter` (L119-142): Validates UTF-8 compliance and buffer size constraints
- `LoggingMockWriter` (L144-177): Tracks write operations for performance analysis
- `test_splitter` (L179-191): Basic functionality test with repeated UTF-8 characters
- `test_pseudo_text` (L193-221): Edge case test with mixed text/binary data

## Architectural Notes
Windows-specific workaround for stdio UTF-8 handling issues. Uses heuristic approach with acceptable false positives for binary data detection. Performance-conscious design minimizes unnecessary buffer modifications.
# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/util/async_buf_read_ext.rs
@source-hash: 2ede863dffd658cd
@generated: 2026-02-09T18:02:45Z

## Purpose
Extension trait providing high-level async buffered reading utilities for types implementing `AsyncBufRead`. Acts as the async equivalent of std's `BufRead` extension methods.

## Key Components

### AsyncBufReadExt Trait (L12-354)
Main extension trait with utility methods for buffered async reading:

- **read_until** (L96-101): Reads bytes until delimiter or EOF, appending to Vec<u8>. Returns ReadUntil future. Cancel-safe with partial data preservation.
- **read_line** (L199-204): Reads UTF-8 line until newline (0xA). Returns ReadLine future. NOT cancel-safe - may lose partial data.
- **split** (L240-245): Creates Split stream splitting on byte delimiter. Returns iterator-like stream of Vec<u8> chunks.
- **fill_buf** (L277-282): Low-level buffer access, returns FillBuf future. Must be paired with consume(). Cancel-safe.
- **consume** (L299-304): Marks bytes as consumed from internal buffer. Required after fill_buf usage.
- **lines** (L348-353): Creates Lines stream for line-by-line iteration. Handles CRLF and LF terminators.

### Blanket Implementation (L357)
Implements AsyncBufReadExt for all types satisfying `AsyncBufRead + ?Sized`.

## Dependencies
- `fill_buf`, `lines`, `read_line`, `read_until`, `split` modules from crate::io::util
- `AsyncBufRead` trait from crate::io

## Architectural Patterns
- Extension trait pattern for ergonomic API surface
- Future-returning methods for async operation
- Conditional compilation via `cfg_io_util!` macro
- Blanket implementation for universal availability
- Cancel safety varies by method (documented per method)

## Critical Invariants
- fill_buf/consume must be used in pairs
- consume amount must not exceed fill_buf returned buffer size
- read_line is not cancel-safe unlike other methods
- All methods require Self: Unpin constraint

## Usage Context
Primary interface for high-level async buffered reading operations in Tokio applications. Provides ergonomic alternatives to poll-based AsyncBufRead methods.
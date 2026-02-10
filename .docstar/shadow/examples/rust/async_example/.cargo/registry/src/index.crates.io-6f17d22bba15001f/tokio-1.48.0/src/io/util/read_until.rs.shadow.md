# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/util/read_until.rs
@source-hash: c255c74ca44f0b83
@generated: 2026-02-09T18:02:48Z

## Purpose
Implements async buffered reading until a delimiter byte is found. This is the core implementation for Tokio's `read_until` functionality that reads from an async stream until encountering a specific byte (like newline).

## Key Components

### ReadUntil Future (L12-28)
- Pin-projected async future that reads until delimiter
- Fields:
  - `reader`: Mutable reference to async buffered reader
  - `delimiter`: Target byte to read until  
  - `buf`: Output buffer to append read data
  - `read`: Tracks bytes read during this operation (not total buffer size)
  - `_pin`: PhantomPinned for async trait compatibility
- Returns `io::Result<usize>` with number of bytes read

### Constructor Function (L30-45)
`read_until()` - Creates new ReadUntil future with zero initial read count

### Core Reading Logic (L47-71)
`read_until_internal()` - Main async reading implementation:
- Polls reader's `fill_buf()` for available data
- Uses `memchr::memchr()` for efficient delimiter search
- If delimiter found: copies data including delimiter, marks done
- If delimiter not found: copies all available data, continues loop
- Consumes processed bytes and updates read counter
- Returns when delimiter found or no more data available

### Future Implementation (L73-80)
Implements `Future` trait by delegating to `read_until_internal()`

## Dependencies
- `AsyncBufRead` trait for buffered async reading
- `memchr` for fast byte searching
- `pin_project_lite` for safe pin projection
- Standard async/futures infrastructure

## Key Behaviors
- Delimiter byte is included in output buffer
- Appends to existing buffer content (doesn't clear it)
- Tracks only bytes read in this operation, not total buffer size
- Handles EOF gracefully (returns available data)
- Uses efficient byte searching via memchr
- Zero-copy when possible through buffer slicing
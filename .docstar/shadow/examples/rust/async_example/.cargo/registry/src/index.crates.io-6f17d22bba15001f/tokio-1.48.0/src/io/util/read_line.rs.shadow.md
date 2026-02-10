# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/util/read_line.rs
@source-hash: ca6d5206db7dc6a7
@generated: 2026-02-09T18:02:49Z

## Purpose
Implements async line reading functionality for Tokio's AsyncBufReadExt trait. Provides UTF-8 validated line reading with proper error handling and memory management.

## Key Components

### ReadLine Future (L13-31)
Pinned future struct that manages async line reading state:
- `reader: &'a mut R` - Mutable reference to the async buffered reader
- `output: &'a mut String` - Target string buffer (temporarily emptied during operation)
- `buf: Vec<u8>` - Working byte buffer containing the original string's allocation
- `read: usize` - Tracks bytes appended during current operation
- `_pin: PhantomPinned` - Ensures !Unpin for async trait compatibility

### Constructor Function (L33-44)
`read_line<R>()` - Creates ReadLine future by moving string content to internal byte buffer using `mem::take()`, leaving output string empty until completion.

### Core Reading Logic (L94-109)
`read_line_internal()` - Main async reading implementation:
- Delegates to `read_until_internal()` to read until newline (b'\n')
- Converts byte buffer to UTF-8 string
- Handles both IO and UTF-8 validation errors via `finish_string_read()`

### Error Recovery (L46-92)
`finish_string_read()` - Centralized error handling for string operations:
- Manages four error state combinations (IO success/fail × UTF-8 success/fail)
- `truncate_on_io_error` parameter controls behavior differences between `read_line` and `read_to_string`
- `put_back_original_data()` (L46-50) restores original string content on UTF-8 errors

### Future Implementation (L111-119)
Poll implementation projects pinned fields and delegates to `read_line_internal()`.

## Dependencies
- `read_until_internal` from sibling module for byte-level reading
- `pin_project_lite` for safe pinned field projection
- Standard library futures and UTF-8 handling

## Key Patterns
- Memory allocation reuse: Original string's allocation moved to Vec<u8> to avoid reallocation
- UTF-8 validation deferred until after reading completion
- Comprehensive error state handling with proper cleanup
- Pinning for async trait method compatibility
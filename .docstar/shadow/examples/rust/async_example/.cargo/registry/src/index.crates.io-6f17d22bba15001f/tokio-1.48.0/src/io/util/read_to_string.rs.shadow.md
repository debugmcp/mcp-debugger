# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/util/read_to_string.rs
@source-hash: 49c8e96c00b35bef
@generated: 2026-02-09T18:02:49Z

**Primary Purpose:** Asynchronous reading from an `AsyncRead` source into a `String`, handling UTF-8 validation and memory management efficiently.

**Key Components:**

- **`ReadToString<'a, R>` struct (L17-30)**: Future that reads from an `AsyncRead` source into a mutable string reference. Uses pin projection for safe async operations.
  - `reader`: Reference to the async reader source
  - `output`: Target string buffer (temporarily emptied during operation)
  - `buf`: `VecWithInitialized<Vec<u8>>` wrapper for efficient byte buffer management
  - `read`: Counter tracking bytes read (handles pre-existing buffer content)
  - `_pin`: `PhantomPinned` marker making future `!Unpin` for async trait compatibility

- **`read_to_string()` constructor (L33-48)**: Creates `ReadToString` future by moving string contents into byte buffer, leaving output string empty during operation.

- **`read_to_string_internal()` core logic (L50-65)**: Performs actual async read operation:
  - Delegates to `read_to_end_internal()` for byte reading
  - Converts byte buffer to UTF-8 string via `String::from_utf8()`
  - Uses `finish_string_read()` utility for final validation and output assignment

- **`Future` implementation (L67-78)**: Standard async polling interface using pin projection to safely access mutable fields.

**Dependencies:**
- `read_to_end_internal`: Core byte reading logic
- `VecWithInitialized`: Efficient vector wrapper for initialized memory tracking
- `finish_string_read`: UTF-8 validation and string finalization utility
- `pin_project_lite`: Safe field projection for pinned futures

**Architecture Pattern:** 
Follows Tokio's standard async I/O pattern with temporary buffer swapping to avoid UTF-8 validation overhead during reading phase. The string's allocation is moved into a byte vector, read into, then converted back with validation at completion.

**Key Invariants:**
- Both `buf` and `output` are empty at UTF-8 conversion point (L62-63)
- `read` counter accounts for any pre-existing string content
- Memory allocation is preserved throughout the operation via buffer swapping
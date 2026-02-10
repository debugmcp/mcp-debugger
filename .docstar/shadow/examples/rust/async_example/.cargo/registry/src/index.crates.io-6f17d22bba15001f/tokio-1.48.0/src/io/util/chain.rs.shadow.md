# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/util/chain.rs
@source-hash: a7c8596ded43537f
@generated: 2026-02-09T18:02:45Z

## Chain Reader Combinator

**Purpose**: Implements sequential chaining of two async readers, where data is read from the first reader until exhausted, then automatically switches to the second reader.

### Core Structure

- **Chain<T, U> (L13-20)**: Pin-projected struct combining two AsyncRead implementations
  - `first: T` - Primary reader (pinned)
  - `second: U` - Secondary reader (pinned) 
  - `done_first: bool` - State flag tracking first reader exhaustion

### Key Functions

- **chain() (L22-32)**: Constructor function creating Chain instance with `done_first: false`
- **get_ref() (L40-42)**: Returns immutable references to both underlying readers
- **get_mut() (L49-51)**: Returns mutable references with corruption warning
- **get_pin_mut() (L58-61)**: Returns pinned mutable references using projection
- **into_inner() (L64-66)**: Consumes Chain, returning owned readers

### Async Trait Implementations

**AsyncRead (L82-105)**:
- **poll_read() (L87-104)**: Core reading logic
  - Reads from first reader while `!done_first`
  - Switches to second reader when first yields no progress (L97-98)
  - Uses `ready!` macro for async polling

**AsyncBufRead (L107-134)**:
- **poll_fill_buf() (L112-124)**: Buffered reading with automatic transition
  - Switches when first reader returns empty buffer (L117)
- **consume() (L126-133)**: Routes consumption to appropriate reader based on state

### Dependencies

- `pin_project_lite` for safe pinned field projection
- Standard async I/O traits: `AsyncRead`, `AsyncBufRead`, `ReadBuf`
- `std::task::{ready, Context, Poll}` for async coordination

### Architecture Notes

- Uses pin projection for safe async reader handling
- State machine with single boolean flag for reader transition
- Zero-copy design - no intermediate buffering
- Maintains async reader semantics throughout chain
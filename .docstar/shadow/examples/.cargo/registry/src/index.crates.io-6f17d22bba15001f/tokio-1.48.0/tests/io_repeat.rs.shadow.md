# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/io_repeat.rs
@source-hash: ba531deaf9b3ef3c
@generated: 2026-02-09T18:12:16Z

**Purpose**: Test file verifying that `tokio::io::repeat()` is cooperative and yields control to the async runtime appropriately.

**Key Test Function**:
- `repeat_poll_read_is_cooperative()` (L7-18): Async test that validates tokio's `repeat()` I/O primitive doesn't monopolize the executor thread

**Test Logic**:
- Uses `tokio::select!` with `biased` ordering (L8-9) to ensure deterministic branch selection
- First branch (L10-15): Infinite loop continuously reading 4096 bytes from `tokio::io::repeat(0b101)` 
- Second branch (L16): Single `yield_now()` call that should be reached if the first branch yields control
- Test passes if the second branch executes, proving cooperative scheduling

**Dependencies**:
- `tokio::io::AsyncReadExt` (L4): Provides `read_exact()` method
- `tokio::io::repeat()` (L13): Creates infinite stream of specified byte value (0b101 = 5)
- `tokio::select!` macro: Runtime multiplexing primitive
- `tokio::task::yield_now()`: Explicit yield point

**Architecture Notes**:
- Conditional compilation: Only runs with "full" feature and excludes Miri (L2)
- Uses `#[tokio::test]` attribute for async test execution (L6)
- Tests fundamental cooperative multitasking behavior of tokio I/O primitives

**Critical Invariant**: The `repeat()` implementation must yield control periodically during continuous reading operations to prevent blocking the async runtime.
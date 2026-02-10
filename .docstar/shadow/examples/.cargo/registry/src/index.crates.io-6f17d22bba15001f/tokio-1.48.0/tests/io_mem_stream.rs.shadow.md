# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/io_mem_stream.rs
@source-hash: 7b20d86c02c8a868
@generated: 2026-02-09T18:12:16Z

## Purpose
Test suite for Tokio's in-memory duplex stream functionality, validating bidirectional communication, cross-task operations, disconnection handling, and cooperative scheduling behavior.

## Key Components

### Test Functions
- **ping_pong (L7-19)**: Basic bidirectional communication test between duplex stream endpoints within single task
- **across_tasks (L22-41)**: Validates duplex streams work correctly across separate spawned tasks with concurrent read/write operations
- **disconnect (L44-63)**: Tests graceful handling when one endpoint is dropped, ensuring EOF detection
- **disconnect_reader (L66-82)**: Verifies writer receives error when reader endpoint is dropped mid-operation
- **max_write_size (L85-102)**: Tests partial write behavior when buffer capacity is exceeded
- **duplex_is_cooperative (L105-121)**: Ensures duplex operations yield control to scheduler using `tokio::select!` with `biased` and `yield_now()`

## Dependencies
- `tokio::io::{duplex, AsyncReadExt, AsyncWriteExt}` (L4): Core duplex stream and async I/O traits
- Uses `#[tokio::test]` macro for async test execution
- Requires "full" feature flag (L2)

## Test Patterns
- Buffer capacity testing with various sizes (2, 32, 8192 bytes)
- Cross-task communication using `tokio::spawn`
- Error handling validation with `unwrap_err()`
- EOF detection through zero-byte reads
- Cooperative scheduling verification using `tokio::select!` with bias

## Critical Behaviors Tested
- Bidirectional data flow integrity
- Proper backpressure when buffer full
- Clean disconnection semantics
- Task-safe concurrent operations
- Scheduler cooperation to prevent starvation
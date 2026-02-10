# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/tcp_shutdown.rs
@source-hash: 23a29aab5f1b8a0a
@generated: 2026-02-09T18:12:34Z

## Purpose
Test suite for TCP connection shutdown behavior in Tokio, verifying graceful shutdown, reset handling, and idempotency across different network conditions.

## Key Test Functions

### `shutdown` (L12-33)
- **Purpose**: Tests basic TCP graceful shutdown sequence
- **Pattern**: Client-server with spawned client task, server echoes data using `io::copy`
- **Key assertions**: Client shutdown triggers server-side EOF (0 bytes read), bidirectional shutdown completes successfully
- **Dependencies**: Uses `TcpListener::bind("127.0.0.1:0")` for dynamic port allocation

### `shutdown_after_tcp_reset` (L36-60)
- **Purpose**: Verifies shutdown behavior after TCP reset condition
- **Pattern**: Uses oneshot channels for synchronization between client/server
- **Critical technique**: Forces TCP reset via `set_linger(Some(Duration::new(0, 0)))` (L53)
- **Coordination**: `connected_tx/rx` and `dropped_tx/rx` channels ensure proper timing
- **Assertion**: Shutdown should succeed even after connection reset

### `shutdown_multiple_calls` (L63-82)
- **Purpose**: Tests idempotency of multiple shutdown calls
- **Pattern**: Client calls `AsyncWriteExt::shutdown()` three times consecutively (L72-74)
- **Assertion**: Multiple shutdown calls should not error or cause issues

## Architecture & Dependencies

**Core imports**:
- `tokio::net::{TcpListener, TcpStream}` - TCP networking primitives
- `tokio::io::{AsyncReadExt, AsyncWriteExt}` - Async I/O traits with shutdown capability
- `tokio::sync::oneshot::channel` - Single-use synchronization channels
- `tokio_test::assert_ok` - Test assertion macro for Result unwrapping

**Platform constraints**: Disabled on WASI (no socket support) and Miri (incomplete socket implementation) via cfg attribute (L2)

## Test Patterns

**Common structure**: 
1. Bind server to localhost with dynamic port (`"127.0.0.1:0"`)
2. Spawn client task with server address
3. Server accepts connection
4. Execute shutdown scenario
5. Await spawned task completion

**Synchronization**: Uses oneshot channels where timing coordination is critical, particularly in reset scenario to ensure proper sequence of events.
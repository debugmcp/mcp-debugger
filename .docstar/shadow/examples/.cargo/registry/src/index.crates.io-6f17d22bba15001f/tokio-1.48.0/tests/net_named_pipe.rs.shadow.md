# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/net_named_pipe.rs
@source-hash: f7998290a77e4e9b
@generated: 2026-02-09T18:12:26Z

## Purpose
Test suite for Windows named pipes in Tokio, validating client-server communication patterns, connection handling, pipe modes, and access controls.

## Test Functions

**test_named_pipe_client_drop (L12-29)**: Tests proper error handling when client disconnects unexpectedly. Creates server/client pair, drops client, verifies server gets ERROR_NO_DATA when attempting write operations.

**test_named_pipe_single_client (L32-68)**: Basic ping-pong communication test between single server and client using buffered I/O. Both tasks run concurrently and exchange "ping"/"pong" messages via `tokio::try_join!`.

**test_named_pipe_multi_client (L71-145)**: Stress test with 10 concurrent clients connecting to sequential server instances. Server spawns new instance before handling each client to prevent connection gaps. Clients implement retry logic for ERROR_PIPE_BUSY/NotFound conditions.

**test_named_pipe_multi_client_ready (L148-324)**: Low-level readiness-based I/O test with 10 clients. Uses `readable()`/`writable()` with `try_read()`/`try_write()` instead of async read/write methods. Demonstrates manual buffer management and readiness polling.

**test_named_pipe_mode_message (L327-334)**: Wrapper test validating message vs byte pipe modes by calling helper function with both modes.

**_named_pipe_mode_message (L336-372)**: Helper function testing pipe mode behavior. Message mode preserves write boundaries while byte mode may merge buffers. Uses multiple write/read iterations to detect mode differences.

**test_named_pipe_access (L375-399)**: Tests server access control settings (inbound/outbound) with corresponding client read/write permissions. Uses `tokio_test::task::spawn` for polling server connect state.

## Key Dependencies
- `tokio::net::windows::named_pipe::{ClientOptions, ServerOptions, PipeMode}` for named pipe APIs
- `tokio::io::{AsyncReadExt, AsyncWriteExt, AsyncBufReadExt, BufReader}` for async I/O
- `windows_sys::Win32::Foundation` for Windows error codes
- `tokio::time` for retry delays

## Patterns
- **Server lifecycle**: Create → Connect → Handle → Create next instance
- **Client retry logic**: Handle ERROR_PIPE_BUSY/NotFound with exponential backoff
- **Concurrent testing**: Heavy use of `tokio::spawn` and `try_join!` for parallel execution
- **Error validation**: Specific Windows error code checking via `raw_os_error()`

## Constants
- Unique pipe names per test to avoid conflicts (using test function names)
- N=10 for multi-client stress tests
- 10ms sleep intervals for client retry loops
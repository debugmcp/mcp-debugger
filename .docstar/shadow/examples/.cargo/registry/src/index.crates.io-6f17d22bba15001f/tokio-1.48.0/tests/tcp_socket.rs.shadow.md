# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/tcp_socket.rs
@source-hash: ac49b1c03a8f590c
@generated: 2026-02-09T18:12:31Z

**Purpose**: Test suite for Tokio's `TcpSocket` API, validating basic socket operations including binding, listening, connecting, and socket option management.

**Key Test Functions**:
- `basic_usage_v4` (L10-25): Tests IPv4 TCP socket lifecycle - creates server socket, binds to localhost, listens with backlog of 128, creates client socket, establishes connection, and accepts incoming connection
- `basic_usage_v6` (L28-43): Identical to v4 test but uses IPv6 addresses (`[::1]:0`) and `TcpSocket::new_v6()`
- `bind_before_connect` (L46-62): Tests client-side binding before connection - demonstrates that client sockets can bind to local addresses before connecting to remote servers
- `basic_linger` (L65-75): Tests SO_LINGER socket option management - verifies default linger state (None) and ability to set/get linger duration

**Dependencies**:
- `tokio::net::TcpSocket`: Core socket type being tested
- `tokio_test::assert_ok`: Macro for unwrapping Results in tests
- `std::time::Duration`: For linger timeout values

**Test Patterns**:
- All tests use ephemeral ports (`:0`) for automatic port allocation
- Consistent pattern: create server socket → bind → listen → create client → connect → accept
- IPv4 uses `127.0.0.1`, IPv6 uses `[::1]` loopback addresses
- Tests validate both successful operations and socket option management

**Platform Constraints**:
- Disabled on WASI (no bind support) and Miri (no socket support) via cfg attributes (L2-3)
- Requires "full" feature flag for complete Tokio networking functionality
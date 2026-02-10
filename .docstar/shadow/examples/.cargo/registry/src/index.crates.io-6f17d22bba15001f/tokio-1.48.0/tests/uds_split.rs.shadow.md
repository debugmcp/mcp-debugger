# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/uds_split.rs
@source-hash: c0a9e5631f121368
@generated: 2026-02-09T18:12:34Z

**Purpose:** Test file for `tokio::net::UnixStream` split functionality, specifically validating that Unix domain sockets can be split into separate read/write halves and that shutdown behavior works correctly.

**Key Components:**

- **`split` test function (L15-31):** Main async test that creates a Unix socket pair, splits both streams into read/write halves, and performs bidirectional communication to verify proper isolation and shutdown handling
- **`send_recv_all` helper (L33-44):** Utility function that writes data to a stream, shuts it down, then reads all remaining data from the paired stream

**Architecture & Patterns:**

- Uses `UnixStream::pair()` to create connected socket pair for testing
- Leverages `UnixStream::split()` to separate streams into read-only and write-only halves
- Employs `futures::future::try_join` for concurrent bidirectional communication testing
- Tests shutdown semantics by writing data, calling `shutdown()`, then reading to EOF

**Key Dependencies:**
- `tokio::net::UnixStream` for Unix domain socket functionality
- `tokio::io` traits (`AsyncRead`, `AsyncWrite`, `AsyncReadExt`, `AsyncWriteExt`) for async I/O operations
- `futures::future::try_join` for concurrent execution

**Test Flow:**
1. Creates socket pair (a, b)
2. Splits each socket into read/write halves
3. Concurrently sends "A" from a→b and "B" from b→a
4. Verifies cross-communication: a receives "B", b receives "A"

**Platform Constraints:**
- Unix-only (`#![cfg(unix)]`)
- Requires "full" feature
- Disabled under Miri (no socket support)

**Critical Behavior:** Validates that `poll_shutdown` implementation properly closes the write side while allowing the read side to consume remaining buffered data.
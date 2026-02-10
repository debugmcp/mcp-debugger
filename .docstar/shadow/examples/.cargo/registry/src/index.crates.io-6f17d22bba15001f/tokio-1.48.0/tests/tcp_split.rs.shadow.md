# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/tcp_split.rs
@source-hash: 7d09483e2a422825
@generated: 2026-02-09T18:12:32Z

**Purpose**: Integration test validating Tokio's TCP stream splitting functionality, ensuring read and write halves operate independently while maintaining data integrity.

**Key Test Function**:
- `split()` (L13-43): Async test demonstrating bidirectional TCP communication using split stream halves
  - Creates std TCP listener on localhost with random port (L16-17)
  - Spawns blocking thread for server-side echo logic (L19-26)
  - Connects Tokio TcpStream and splits into read/write halves (L28-29)
  - Tests `peek()` functionality for non-destructive data inspection (L32-38)
  - Validates full duplex communication by reading server data and writing response (L36-41)

**Dependencies**:
- `tokio::net::TcpStream` for async TCP operations
- `tokio::io::{AsyncReadExt, AsyncWriteExt}` for async I/O traits
- Standard library `net`, `thread` for synchronous server implementation
- Test message constant `MSG = b"split"` (L14)

**Test Pattern**:
- Hybrid async/sync design: async client with blocking server thread
- Validates stream splitting doesn't break bidirectional communication
- Tests peek operation idempotency (multiple peeks return same data)
- Ensures read operations consume peeked data correctly

**Platform Constraints**:
- Excluded on WASI (no bind support) and Miri (no socket support) via cfg attribute (L2-3)
- Requires "full" feature flag for complete Tokio functionality

**Critical Assertions**:
- Peek length consistency across multiple calls (L34)
- Read length matches peek length (L37)
- Data integrity preservation through split operations (L25, L38)
- Write operation returns correct byte count (L40)
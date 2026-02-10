# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/net/tcp/stream.rs
@source-hash: 4bf53135eb094919
@generated: 2026-02-09T18:03:07Z

**Core Purpose**: Tokio's `TcpStream` implementation - an async TCP socket wrapper providing non-blocking network I/O operations on top of mio's TcpStream.

**Primary Structure**: 
- `TcpStream` (L70-72): Main struct wrapping `PollEvented<mio::net::TcpStream>` for async TCP operations

**Key Connection Methods**:
- `connect<A: ToSocketAddrs>()` (L115-133): Async connection establishment with multi-address fallback
- `connect_addr()` (L136-139): Single address connection helper
- `connect_mio()` (L141-157): Internal connection finalizer handling write-readiness polling
- `from_std()` (L207-213): Converts std::net::TcpStream to async variant with blocking validation
- `into_std()` (L254-281): Platform-specific conversion back to std::net::TcpStream using raw fd/socket

**I/O Operations**:
- `try_read()` (L621-627): Non-blocking read attempt using registration's try_io
- `try_read_vectored()` (L699-705): Scatter read variant 
- `try_read_buf()` (L765-783): BufMut-based read for zero-copy scenarios
- `try_write()` (L918-924): Non-blocking write attempt
- `try_write_vectored()` (L980-986): Gather write variant
- `peek()` (L1103-1108): MSG_PEEK equivalent for data inspection
- `poll_peek()` (L366-390): Poll-based peek with readiness management

**Readiness Management**:
- `ready()` (L465-468): Waits for specified Interest (readable/writable)
- `readable()`/`writable()` (L520-523, L832-835): Convenience methods for common interests
- `poll_read_ready()`/`poll_write_ready()` (L554-556, L866-868): Poll variants for manual readiness checking

**Advanced I/O**:
- `try_io()` (L1020-1028): User-provided syscall execution with readiness management
- `async_io()` (L1055-1064): Async version with retry loop for WouldBlock handling

**Socket Configuration**:
- `nodelay()`/`set_nodelay()` (L1145-1171): TCP_NODELAY (Nagle algorithm control)
- `quickack()`/`set_quickack()` (L1204-1246): Linux TCP_QUICKACK for eager ACK sending
- `linger()`/`set_linger()` (L1268-1295): SO_LINGER for connection termination behavior
- `ttl()`/`set_ttl()` (L1316-1339): IP_TTL packet time-to-live

**Stream Splitting**:
- `split()` (L1351-1353): Borrowed read/write halves for concurrent operations
- `into_split()` (L1366-1368): Owned halves with heap allocation

**Internal Helpers**:
- `new()` (L160-163): Internal constructor from connected mio stream
- `shutdown_std()` (L1120-1125): Internal shutdown with NotConnected error handling
- Poll variants (L1376-1399): Private polling methods for internal use

**Trait Implementations**:
- `AsyncRead`/`AsyncWrite` (L1416-1457): Core async I/O traits
- Platform-specific raw fd/socket traits for interop (L1472-1522)

**Architecture Notes**:
- Uses PollEvented wrapper for mio integration
- Maintains separate read/write waker registration
- Handles platform differences (Unix fd vs Windows socket vs WASI)
- Connection establishment uses write-readiness as connection completion signal
- Error handling abstracts OS-specific behaviors (e.g., NotConnected normalization)
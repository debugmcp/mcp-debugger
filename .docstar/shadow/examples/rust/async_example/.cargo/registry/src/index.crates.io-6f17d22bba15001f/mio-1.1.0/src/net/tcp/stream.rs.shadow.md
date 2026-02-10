# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/net/tcp/stream.rs
@source-hash: 6673a5fe862c4d80
@generated: 2026-02-09T18:02:38Z

**Purpose**: Non-blocking TCP stream implementation for the Mio async I/O library, providing cross-platform asynchronous networking capabilities.

**Core Structure**:
- `TcpStream` (L52-54): Main struct wrapping `IoSource<net::TcpStream>` to provide non-blocking TCP operations

**Key Methods**:
- `connect()` (L91-99): Creates new TCP stream with non-blocking connect to specified address. Only available on non-WASI targets. Returns immediately without waiting for connection completion
- `from_std()` (L113-117): Converts standard library `TcpStream` to Mio `TcpStream`, assuming non-blocking mode is already set
- `peer_addr()` (L120-122) / `local_addr()` (L125-127): Socket address accessors
- `shutdown()` (L134-136): Connection shutdown control
- `set_nodelay()` / `nodelay()` (L151-168): TCP_NODELAY option management 
- `set_ttl()` / `ttl()` (L180-197): IP_TTL option management
- `take_error()` (L204-206): Retrieves and clears SO_ERROR from socket
- `peek()` (L214-218): Non-destructive data inspection using MSG_PEEK
- `try_io()` (L271-276): Generic I/O operation wrapper ensuring proper event re-registration on WouldBlock

**Trait Implementations**:
- `Read` (L279-297): Both owned and borrowed implementations using `inner.do_io()` wrapper
- `Write` (L299-325): Both owned and borrowed implementations with vectored I/O support
- `event::Source` (L327-349): Mio event registration/deregistration for polling integration
- Platform-specific raw FD/socket traits (L357-463): Unix/Windows/WASI compatibility layers

**Critical Connection Logic** (L67-84):
The `connect()` method returns immediately but requires a complex 6-step handshake:
1. Call connect 2. Register for write events 3. Wait for writable event 4. Check take_error() 5. Verify peer_addr() 6. Stream ready for use

**Platform Abstractions**:
- Unix/Hermit/WASI: File descriptor based (L4-9, L357-410)
- Windows: Socket handle based (L10-13, L411-463)
- WASI: Limited functionality (no connect method)

**Dependencies**:
- `IoSource`: Core wrapper providing do_io() method for proper event management
- `crate::sys::tcp`: Platform-specific connect/socket creation (L17)
- Standard library networking and I/O traits

**Architecture Notes**:
- All I/O operations go through `inner.do_io()` to ensure proper WouldBlock handling and event re-registration
- Cross-platform compatibility achieved through conditional compilation
- Safety ensured through proper raw FD/socket lifecycle management
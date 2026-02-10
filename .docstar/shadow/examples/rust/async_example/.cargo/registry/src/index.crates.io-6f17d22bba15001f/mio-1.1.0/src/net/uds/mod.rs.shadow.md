# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/net/uds/mod.rs
@source-hash: 39d8e36750564c22
@generated: 2026-02-09T18:02:23Z

**Purpose**: Module organization file for Unix Domain Socket (UDS) networking primitives in the mio async I/O library. Serves as the public interface aggregator for UDS functionality.

**Architecture**: Simple re-export pattern organizing UDS types into separate submodules:
- `datagram` (L1) → `UnixDatagram` (L2): UDP-like datagram sockets over Unix domain sockets
- `listener` (L4) → `UnixListener` (L5): TCP-like server/listener sockets for accepting connections  
- `stream` (L7) → `UnixStream` (L8): TCP-like bidirectional stream connections

**Key Exports**:
- `UnixDatagram` (L2): Async datagram socket for connectionless communication
- `UnixListener` (L5): Async listener for accepting incoming Unix socket connections
- `UnixStream` (L8): Async bidirectional stream socket for connected communication

**Dependencies**: Internal submodules only - no external crates imported at this level.

**Pattern**: Standard Rust module organization pattern with private submodules and selective public re-exports to create a clean API surface. Each UDS socket type is isolated in its own module but exposed at the parent level for ergonomic imports.
# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/net/tcp/mod.rs
@source-hash: f2c50c1d338a69d7
@generated: 2026-02-09T18:02:24Z

**Purpose**: TCP networking module organization for Mio async I/O library. Serves as the public interface aggregator for TCP functionality by re-exporting core TCP types from submodules.

**Architecture**: Simple module facade pattern that consolidates TCP networking primitives:
- `listener` submodule (L1) - Contains TCP server socket implementation
- `stream` submodule (L4) - Contains TCP client socket implementation

**Key Exports**:
- `TcpListener` (L2) - Re-exported from `self::listener`, provides async TCP server socket capabilities
- `TcpStream` (L5) - Re-exported from `self::stream`, provides async TCP client socket capabilities

**Dependencies**: 
- Internal submodules: `listener` and `stream`
- Part of broader `mio::net` networking abstraction layer

**Design Pattern**: Module aggregator pattern - centralizes public API while keeping implementation details in separate files. Follows Rust's convention of using `mod.rs` files to organize module hierarchies and control public visibility of nested components.

**Usage Context**: This module is the entry point for TCP networking in Mio applications, providing the fundamental building blocks for async TCP servers and clients in event-driven architectures.
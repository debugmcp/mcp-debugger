# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/net/tcp/mod.rs
@source-hash: 347182e4f0381896
@generated: 2026-02-09T18:02:52Z

## TCP Network Module

**Primary Purpose**: Module aggregator for TCP networking functionality in Tokio, organizing TCP-related utilities and abstractions into a cohesive interface.

**Architecture**: Clean module organization pattern with conditional compilation support for different target platforms.

### Key Modules and Exports

**Internal Modules**:
- `listener` (L3): TCP listener functionality (internal use)
- `socket` (L6): Socket operations - conditionally compiled, excluded on WASI targets via `cfg_not_wasi!` macro
- `stream` (L15): Core TCP stream implementation (internal use, re-exported as `TcpStream`)

**Public Split Types** (L9-13):
- `split` module: Provides `ReadHalf`, `WriteHalf` - borrowed split halves for TCP streams
- `split_owned` module: Provides `OwnedReadHalf`, `OwnedWriteHalf`, `ReuniteError` - owned split halves with reunification support

### Architectural Decisions

**Conditional Compilation** (L5-7): Uses `cfg_not_wasi!` to exclude socket module on WASI targets, indicating platform-specific networking limitations.

**Visibility Strategy**: Mixed visibility approach - internal modules use `pub(crate)` for controlled access within the crate, while split types are fully public for end-user consumption.

**Split Pattern Implementation**: Dual split approach offering both borrowed (`ReadHalf`/`WriteHalf`) and owned (`OwnedReadHalf`/`OwnedWriteHalf`) variants for different ownership patterns.

### Dependencies and Relationships

This module serves as the entry point for TCP functionality, likely consumed by higher-level Tokio networking APIs. The split functionality suggests integration with async I/O patterns where separate read/write handles are needed.
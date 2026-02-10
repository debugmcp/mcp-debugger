# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/net/addr.rs
@source-hash: 7aac2266980d74a9
@generated: 2026-02-09T18:06:42Z

**Purpose**: Tokio async networking address resolution trait and implementations providing non-blocking conversion to socket addresses.

**Core Architecture**:
- **ToSocketAddrs trait (L19)**: Public sealed trait for async socket address conversion
- **ToSocketAddrsPriv trait (L262-267)**: Internal implementation trait with Future-based async interface
- **Sealed module pattern**: Uses `sealed::Internal` token (L270) to prevent external implementations

**Key Components**:

**Address Type Implementations**:
- **SocketAddr (L50-60)**: Direct conversion using `std::option::IntoIter`, returns ready future
- **SocketAddrV4/V6 (L64-86)**: Convert to generic SocketAddr then delegate
- **IP tuples (L90-128)**: `(IpAddr, u16)`, `(Ipv4Addr, u16)`, `(Ipv6Addr, u16)` - construct appropriate socket addresses
- **Address slices (L132-157)**: `&[SocketAddr]` converts to owned Vec for static lifetime compliance

**String/DNS Resolution** (conditional on `cfg_net!`):
- **str (L162-186)**: Attempts parse first, falls back to DNS lookup via `spawn_blocking`
- **(&str, u16) (L190-223)**: Optimized path - tries IPv4/IPv6 parse before DNS
- **String types (L227-249)**: Delegate to str implementations

**Internal Types** (sealed module L252-333):
- **MaybeReady (L282)**: Future handling both immediate results and blocking DNS operations
- **State enum (L285-288)**: `Ready(Option<SocketAddr>)` vs `Blocking(JoinHandle<...>)`
- **OneOrMore enum (L292-295)**: Iterator wrapper for single address vs multiple results

**Key Functions**:
- **to_socket_addrs() (L24-29)**: Public entry point calling internal implementation
- **Future::poll for MaybeReady (L300-313)**: Handles state machine between ready/blocking states

**Design Patterns**:
- **Sealed trait pattern**: Prevents external trait implementations while maintaining public API
- **Future-based async**: All conversions return futures for non-blocking operation  
- **Optimization strategy**: Parse before DNS lookup to avoid unnecessary blocking operations
- **Static lifetime compliance**: Allocates owned data structures for returned iterators

**Dependencies**:
- `std::net` types for socket addresses
- `crate::blocking::spawn_blocking` for DNS resolution
- Conditional compilation with `cfg_net!` macro
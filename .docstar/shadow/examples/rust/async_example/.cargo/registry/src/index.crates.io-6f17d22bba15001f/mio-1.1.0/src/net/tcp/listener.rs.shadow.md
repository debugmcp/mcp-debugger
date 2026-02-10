# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/net/tcp/listener.rs
@source-hash: 880f845baae93d91
@generated: 2026-02-09T18:02:41Z

## Purpose
Cross-platform TCP listener implementation for the Mio async I/O library. Wraps `std::net::TcpListener` with non-blocking event-driven capabilities through the `IoSource` abstraction.

## Core Structure
- **TcpListener (L51-53)**: Main struct wrapping `IoSource<net::TcpListener>` for async TCP server operations
- **IoSource wrapper**: Provides platform-agnostic event registration and non-blocking I/O operations

## Key Methods
- **bind() (L66-86)**: Creates new listener bound to address with platform-specific socket setup:
  - Creates raw socket via `new_for_addr()`
  - Sets `SO_REUSEADDR` on Unix/Hermit (not Windows due to security concerns)
  - Binds and starts listening with `LISTEN_BACKLOG_SIZE`
  - Available on all platforms except WASI
- **from_std() (L94-98)**: Wraps existing `std::TcpListener` in Mio's `IoSource`
- **accept() (L108-112)**: Non-blocking accept returning `(TcpStream, SocketAddr)` or `WouldBlock` error
- **local_addr() (L115-117)**: Returns bound socket address
- **set_ttl()/ttl() (L123-134)**: IP TTL option management
- **take_error() (L141-143)**: Retrieves and clears socket error state

## Event System Integration
- **event::Source impl (L146-168)**: Enables registration with Mio's event loop
  - `register()`, `reregister()`, `deregister()` delegate to `inner.IoSource`
- **Token/Interest**: Standard Mio event identification and interest specification

## Platform Abstractions
### Unix/Hermit/WASI (L176-228)
- File descriptor traits: `IntoRawFd`, `AsRawFd`, `FromRawFd`, `AsFd`
- `OwnedFd` conversions for modern Rust I/O safety

### Windows (L230-282)  
- Socket handle traits: `IntoRawSocket`, `AsRawSocket`, `FromRawSocket`, `AsSocket`
- `OwnedSocket` conversions

### Conversion to std (L284-300)
- **From<TcpListener> for net::TcpListener (L284-300)**: Extracts raw fd/socket for interop

## Dependencies
- **Internal**: `IoSource`, `TcpStream`, `sys::tcp` functions, `Registry`, `Token`, `Interest`
- **External**: Standard library networking and platform-specific I/O traits

## Architecture Notes
- Platform-specific socket reuse behavior (SO_REUSEADDR enabled on Unix, disabled on Windows)
- WASI target has limited functionality (no `bind()` method)
- Hermit OS uses separate fd trait imports due to Rust issue #126198
- All raw fd/socket conversions marked unsafe with caller responsibility for non-blocking mode
# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/net/mod.rs
@source-hash: 8df34238d2e9462f
@generated: 2026-02-09T18:06:38Z

## Primary Purpose

Module entry point for Tokio's networking functionality, providing TCP/UDP/Unix socket abstractions for async I/O operations. Acts as a facade module organizing platform-specific and protocol-specific networking components.

## Key Components

**Address Resolution (L31-36)**
- `addr` module: Internal address resolution utilities
- `ToSocketAddrs` trait: Public interface for converting various types to socket addresses
- `to_socket_addrs()`: Internal utility function (WASI-excluded, net feature-gated)

**Host Lookup (L39-40)**
- `lookup_host()` function: Async DNS resolution functionality (net feature-gated)

**TCP Components (L42-47)**
- `tcp` module: TCP protocol implementations
- `TcpListener`: Server-side TCP socket listener
- `TcpStream`: Client/server TCP connection stream
- `TcpSocket`: Raw TCP socket (WASI-excluded)

**UDP Components (L48-51)**
- `udp` module: UDP protocol implementation
- `UdpSocket`: Connectionless UDP socket (WASI-excluded)

**Unix Domain Sockets (L54-60)**
- `unix` module: Unix-specific socket types (Unix platforms only)
- `UnixDatagram`: Unix domain datagram socket
- `UnixListener`: Unix domain stream listener
- `UnixStream`: Unix domain stream socket
- `UnixSocket`: Raw Unix domain socket

**Windows Networking (L62-64)**
- `windows` module: Windows-specific networking (Windows platforms only)

## Architecture Patterns

**Conditional Compilation Strategy**
- Uses `cfg_net!`, `cfg_net_unix!`, `cfg_net_windows!`, `cfg_not_wasi!` macros for platform/feature selection
- Excludes WASI platform from certain networking features
- Feature-gates networking functionality behind "net" feature flag

**Module Organization**
- Protocol-based separation (TCP, UDP, Unix)
- Platform-specific modules (unix, windows)
- Common utilities (addr, lookup_host) shared across protocols

## Dependencies

- Standard library socket types (abstracted through tokio's async interfaces)
- Platform-specific networking APIs (Unix sockets, Windows named pipes)
- Internal tokio I/O primitives and async runtime

## Critical Constraints

- WASI platform limitations exclude UDP sockets and raw TCP sockets
- Unix domain sockets only available on Unix-like platforms
- Windows-specific functionality isolated to Windows builds
- All networking requires "net" feature flag activation
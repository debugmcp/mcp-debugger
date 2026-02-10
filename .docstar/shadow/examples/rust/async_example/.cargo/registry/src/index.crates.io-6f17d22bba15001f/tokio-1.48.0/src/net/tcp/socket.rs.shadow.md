# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/net/tcp/socket.rs
@source-hash: e6babf0f44901a00
@generated: 2026-02-09T18:03:02Z

## Purpose
Provides `TcpSocket` - a low-level TCP socket abstraction that allows fine-grained configuration before establishing connections or listening. This is Tokio's wrapper around `socket2::Socket` for advanced use cases where default `TcpStream::connect()` and `TcpListener::bind()` behavior is insufficient.

## Core Structure
- **`TcpSocket` (L88-90)**: Main struct wrapping `socket2::Socket` with async capabilities
- **Private field `inner`**: The underlying `socket2::Socket` providing OS socket functionality

## Key Construction Methods
- **`new_v4()` (L123-125)**: Creates IPv4 socket via `socket(2)` with `AF_INET`
- **`new_v6()` (L156-158)**: Creates IPv6 socket via `socket(2)` with `AF_INET6`
- **`new()` (L160-186)**: Internal constructor handling platform-specific non-blocking setup
- **`from_std_stream()` (L780-796)**: Converts `std::net::TcpStream` to `TcpSocket`

## Socket Configuration Methods
- **Buffer sizing**: `set_send_buffer_size()` (L346), `set_recv_buffer_size()` (L380)
- **Socket options**: `set_keepalive()` (L189), `set_reuseaddr()` (L224), `set_nodelay()` (L452)
- **Platform-specific**: `set_reuseport()` (L294) Unix-only, `set_tos()` (L533) IP TOS field
- **Linux-specific**: `bind_device()` (L561) for `SO_BINDTODEVICE`
- **Linger control**: `set_linger()` (L419) for graceful close behavior

## Connection Operations
- **`bind()` (L624-626)**: Binds socket to local address via `bind(2)`
- **`connect()` (L660-688)**: Async connect operation consuming socket, returns `TcpStream`
- **`listen()` (L725-744)**: Converts to `TcpListener` with specified backlog

## Platform Abstraction
- **Unix traits (L819-848)**: `AsRawFd`, `FromRawFd`, `IntoRawFd`, `AsFd` implementations
- **Windows traits (L852-881)**: `AsRawSocket`, `FromRawSocket`, `IntoRawSocket`, `AsSocket` implementations
- **Cross-platform conversion**: `convert_address()` (L799-807) handles `socket2::SockAddr` to `SocketAddr`

## Architecture Notes
- Socket is automatically set to non-blocking mode during construction
- Platform-specific conditional compilation via `cfg!` macros for Unix/Windows
- Consumes self in `connect()` and `listen()` operations - one-time use pattern
- Delegates to underlying `socket2::Socket` for most socket option operations
- Error handling preserves OS-specific error codes (EINPROGRESS on Unix, WouldBlock on Windows)
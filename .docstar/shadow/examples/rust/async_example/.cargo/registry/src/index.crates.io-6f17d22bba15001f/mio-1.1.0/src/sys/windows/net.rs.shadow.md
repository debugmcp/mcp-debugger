# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/windows/net.rs
@source-hash: 67093e8c2c672bc7
@generated: 2026-02-09T18:02:31Z

## Purpose
Windows-specific networking utilities for the MIO async I/O library. Provides socket creation, address conversion, and Windows WinSock API integration with proper initialization handling.

## Key Components

### Network Initialization
- `init()` (L13-21): One-time Windows network stack initialization using `std::Once`. Leverages standard library's `WSAStartup` call via dummy UDP socket creation to avoid double initialization issues.

### Socket Creation Functions
- `new_ip_socket()` (L24-31): Creates non-blocking IP sockets, automatically determining domain (IPv4/IPv6) from `SocketAddr`
- `new_socket()` (L33-48): Lower-level socket creation with manual domain specification. Handles WinSock initialization, socket creation via `socket()` syscall, and sets non-blocking mode with `ioctlsocket(FIONBIO)`. Includes cleanup on error.

### Address Conversion System
- `SocketAddrCRepr` union (L54-64): Memory-layout-compatible union for Windows `SOCKADDR` types, supporting both IPv4 (`SOCKADDR_IN`) and IPv6 (`SOCKADDR_IN6`). Provides `as_ptr()` for safe casting to `*const SOCKADDR`.
- `socket_addr()` (L66-111): Converts Rust `SocketAddr` to Windows socket address format. Handles endianness conversion for IPv4 addresses using native byte order, and manages IPv6 scope ID and flow info fields.

## Dependencies
- `windows_sys::Win32::Networking::WinSock`: Core Windows socket APIs
- Uses `syscall!` macro for error handling (imported from parent modules)

## Architecture Patterns
- **Lazy initialization**: Network stack initialized only when first socket created
- **Type safety**: Union-based address representation maintains memory layout compatibility while providing type safety
- **Error handling**: Comprehensive cleanup on socket creation failure
- **Endianness awareness**: Proper handling of network byte order for different address types

## Critical Invariants
- Network initialization must complete before any socket operations
- Non-blocking mode set on all created sockets
- Memory layout of `SocketAddrCRepr` must match Windows `SOCKADDR` expectations
- Socket cleanup required on any post-creation configuration failure
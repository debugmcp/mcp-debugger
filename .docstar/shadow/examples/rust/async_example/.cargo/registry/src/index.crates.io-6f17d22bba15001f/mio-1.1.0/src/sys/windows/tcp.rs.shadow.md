# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/windows/tcp.rs
@source-hash: 4ece198438b7686c
@generated: 2026-02-09T18:02:31Z

## Purpose and Responsibility

Windows-specific TCP socket operations module providing low-level wrappers around WinSock APIs for the mio async I/O library. Abstracts platform-specific TCP socket creation, binding, connecting, listening, and accepting operations.

## Key Functions

- **`new_for_addr`** (L9-11): Creates a new TCP socket for a given address by delegating to `new_ip_socket` with `SOCK_STREAM` type
- **`bind`** (L13-27): Binds a `TcpListener` to a socket address using WinSock's `bind()`, with error handling via `syscall!` macro
- **`connect`** (L29-47): Initiates TCP connection, handling `WouldBlock` errors as non-fatal (non-blocking I/O pattern)
- **`listen`** (L49-58): Sets socket to listening state with specified backlog using WinSock's `listen()`
- **`accept`** (L60-64): Accepts incoming connections by delegating to standard library's `TcpListener::accept()`

## Dependencies and Architecture

- **WinSock Integration**: Uses `windows_sys::Win32::Networking::WinSock` for low-level socket operations
- **Platform Abstraction**: Part of `crate::sys::windows::net` module hierarchy for Windows-specific networking
- **Error Handling**: Leverages `syscall!` macro for consistent WinSock error translation to `io::Result`
- **Standard Library Bridge**: Works with `std::net` types while providing async-compatible behavior

## Key Patterns

- **Raw Socket Casting**: Consistent pattern of `socket.as_raw_socket() as _` for type conversion to WinSock SOCKET type
- **Address Conversion**: Uses `socket_addr()` helper to convert `SocketAddr` to raw WinSock address structures
- **Non-blocking Semantics**: `connect()` treats `WouldBlock` as success for async operation compatibility
- **Inherited Socket State**: `accept()` relies on WinSock behavior where accepted sockets inherit listener's non-blocking state

## Critical Invariants

- All functions expect valid socket handles from std::net types
- Socket addresses must be compatible with the address family of the socket
- Non-blocking behavior is preserved across accept operations per WinSock documentation
# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/windows/udp.rs
@source-hash: 45cbba2941287d89
@generated: 2026-02-09T18:02:29Z

**Primary Purpose**: Windows-specific UDP socket operations for the Mio async I/O library. Provides platform-specific implementations for UDP socket creation and IPv6-only socket detection.

**Key Functions**:
- `bind(addr: SocketAddr)` (L12-24): Creates and binds a UDP socket to the specified address. Uses Windows raw socket APIs to create socket via `new_ip_socket()`, wraps it in stdlib `UdpSocket`, then binds using WinSock `win_bind()` syscall.
- `only_v6(socket: &net::UdpSocket)` (L26-46): Checks if a UDP socket is IPv6-only by querying the `IPV6_V6ONLY` socket option via `getsockopt()`. Returns boolean indicating IPv6-only status.

**Dependencies**:
- Standard library: `io`, `mem`, `net`, Windows-specific socket types
- Internal: `crate::sys::windows::net` for socket utilities (`new_ip_socket`, `socket_addr`)
- External: `windows_sys` crate for raw WinSock API bindings

**Architectural Patterns**:
- Uses `syscall!` macro for error handling around Windows socket operations
- Bridges between Windows raw socket handles (`usize`) and stdlib socket types (`u32/u64`)
- Employs unsafe code for raw socket conversion and uninitialized memory handling
- Uses `MaybeUninit` pattern for safe uninitialized memory management in `getsockopt` calls

**Critical Implementation Details**:
- Socket type casting between Windows-sys (`usize`) and stdlib (`u32/u64`) socket representations (L5, L14, L32)
- Memory safety ensured through proper `MaybeUninit` usage and `assume_init()` after syscall validation (L27, L44)
- Debug assertion validates expected option length consistency (L42)
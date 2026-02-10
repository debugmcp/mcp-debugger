# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/shell/mod.rs
@source-hash: 384480e21104e54d
@generated: 2026-02-09T18:03:20Z

**Primary Purpose**: Shell/stub implementation for the mio async I/O library's system layer that provides non-functional placeholders when the library is compiled without OS-specific polling support.

**Key Components**:

- **`os_required!` macro (L1-5)**: Core panic macro that triggers when any OS-dependent functionality is attempted without proper OS polling compilation flags
- **Module exports (L7-20)**: Re-exports selector components and conditionally includes waker and networking modules based on target OS
- **`IoSourceState` struct (L36-104)**: Empty state container for I/O source management with platform-specific method implementations

**Architecture Pattern**: 
This is a "shell" or stub implementation that serves as a compile-time safety mechanism. When mio is built without `os-poll` feature, this module provides the required API surface but panics on actual usage, ensuring developers are notified of missing OS-specific functionality rather than experiencing silent failures.

**Platform Conditionals**:
- WASI targets exclude waker functionality (L10-13)
- Unix/Hermit targets use `RawFd` for file descriptor operations (L53-78)  
- Windows targets use `RawSocket` for socket operations (L80-104)
- Networking modules (tcp/udp/uds) are gated behind `cfg_net!` macro (L15-20)

**Critical Behavior**: All I/O registration methods (`register`, `reregister`, `deregister`) immediately panic via `os_required!()` macro, making this implementation unsuitable for actual I/O operations.

**Dependencies**: 
- Standard library I/O types and platform-specific raw handles
- Internal mio types: `Registry`, `Token`, `Interest` (L34)
- Custom configuration macros: `cfg_net!`, `cfg_io_source!`
# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/net/
@generated: 2026-02-09T18:16:10Z

## Overall Purpose

The `net` module provides Mio's complete networking abstraction layer, offering cross-platform, non-blocking socket primitives for asynchronous I/O operations. This module serves as the primary networking API surface for Mio applications, delivering TCP, UDP, and Unix Domain Socket capabilities with consistent behavior across different operating systems.

## Key Components and Architecture

### Core Networking Types
- **TCP Sockets** (`tcp/`): Connection-oriented streaming sockets via `TcpListener` and `TcpStream`
- **UDP Sockets** (`udp.rs`): Connectionless datagram communication via `UdpSocket`
- **Unix Domain Sockets** (`uds/`): Local inter-process communication primitives (`UnixDatagram`, `UnixListener`, `UnixStream`)

### Module Organization
The module follows a facade pattern where `mod.rs` acts as the public API entry point, conditionally re-exporting types from specialized submodules based on platform capabilities. This provides a clean, unified interface while maintaining platform-specific optimizations underneath.

## Public API Surface

### Universal Types (All Platforms)
- `TcpListener` - TCP server socket for accepting connections
- `TcpStream` - TCP client/connected socket for bidirectional streaming

### Platform-Conditional Types
- `UdpSocket` - UDP datagram socket (excluded on WASI targets)
- `UnixDatagram`, `UnixListener`, `UnixStream` - Unix Domain Sockets (Unix-only)

## Internal Organization and Data Flow

### Common Patterns Across Socket Types
All networking types follow consistent architectural patterns:

1. **IoSource Wrapper**: Socket types wrap `IoSource<std::net::Socket>` for event system integration
2. **Event Loop Integration**: Implement `event::Source` trait for Mio's `Poll` registration
3. **Non-blocking Operations**: All I/O operations return `WouldBlock` when not ready
4. **Platform Abstraction**: Conditional compilation provides unified behavior across Unix/Windows

### Data Flow
1. Applications create sockets via `bind()`, `connect()`, or `from_std()` constructors
2. Sockets register with Mio's event loop via `Poll::registry()`
3. I/O operations delegate to `IoSource::do_io()` for proper event handling
4. Platform-specific implementations handle OS differences transparently

## Critical Design Patterns

### Conditional Compilation Strategy
The module extensively uses `#[cfg()]` attributes for platform-specific feature gating:
- `#[cfg(not(target_os = "wasi"))]` - Excludes UDP on WASI
- `#[cfg(unix)]` - Unix Domain Sockets only on Unix-like systems

### Cross-Platform Compatibility
- **Buffer Handling**: Platform-specific datagram truncation behavior (Unix fills buffer vs Windows returns error)
- **Raw Socket Access**: Provides both Unix file descriptor and Windows socket handle traits
- **Error Semantics**: Consistent error handling patterns across platforms

## Important Constraints and Behaviors

### Portability Requirements
- Applications must follow Mio portability guidelines for consistent cross-platform behavior
- Buffer sizing critical for datagram sockets to prevent data loss
- Platform-specific error handling required for robust datagram operations

### Event-Driven Model
- All sockets require registration with Mio's `Poll` for event notifications
- Operations are edge-triggered and non-blocking by design
- Callers responsible for handling `WouldBlock` conditions appropriately

## Dependencies
- Internal: Platform-specific `sys::*` modules for low-level socket operations
- External: Standard library networking types for conversion and wrapping
- Mio Core: `IoSource`, event system types (`Poll`, `Registry`, `Token`, `Interest`)

This module represents Mio's primary networking interface, providing the foundation for building high-performance, async networking applications with consistent cross-platform behavior.
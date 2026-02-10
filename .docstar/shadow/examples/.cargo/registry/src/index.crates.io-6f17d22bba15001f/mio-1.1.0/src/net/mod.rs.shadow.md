# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/net/mod.rs
@source-hash: 4b971b3502a16383
@generated: 2026-02-09T18:06:23Z

## Primary Purpose
Module entry point for Mio's networking primitives, providing cross-platform non-blocking socket abstractions. Acts as a public API facade that conditionally exports platform-specific networking types based on target OS capabilities.

## Key Components

### TCP Types (L28-29)
- Re-exports `TcpListener` and `TcpStream` from internal tcp module
- Always available across all supported platforms

### UDP Types (L31-34)  
- Conditionally exports `UdpSocket` from udp module
- Excluded on WASI targets due to platform limitations
- Uses `#[cfg(not(target_os = "wasi"))]` conditional compilation

### Unix Domain Socket Types (L36-39)
- Exports `UnixDatagram`, `UnixListener`, `UnixStream` from uds module  
- Only available on Unix-like platforms via `#[cfg(unix)]`
- Provides local inter-process communication primitives

## Architectural Patterns
- **Conditional Compilation**: Heavy use of cfg attributes for platform-specific feature gating
- **Re-export Facade**: Module acts as clean public API while implementation is in submodules
- **Platform Abstraction**: Unified interface across different OS networking capabilities

## Critical Behavior Notes
- **Datagram Truncation Behavior**: Platform-specific handling of undersized receive buffers
  - Unix systems: Fill buffer, return bytes written (potential truncation)
  - Windows: Returns `WSAEMSGSIZE` error
- **Portability Contract**: Types designed for identical behavior across platforms when guidelines followed
- **Non-blocking Default**: All networking types are non-blocking by design

## Dependencies
- Internal submodules: `tcp`, `udp` (conditional), `uds` (conditional)
- References Poll struct portability guidelines (external documentation link)

## Usage Constraints
- Buffer sizing critical for datagram sockets to avoid data loss
- Platform-specific error handling required for robust datagram reception
- Must follow Mio portability guidelines for consistent cross-platform behavior
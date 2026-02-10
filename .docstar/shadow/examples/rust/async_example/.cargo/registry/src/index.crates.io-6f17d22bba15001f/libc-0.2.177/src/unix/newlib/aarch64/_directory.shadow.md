# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/newlib/aarch64/
@generated: 2026-02-09T18:16:06Z

## Purpose
Platform-specific libc bindings for newlib on AArch64 (64-bit ARM) architecture. This module provides C ABI-compatible types, socket structures, and system constants that mirror the newlib C library interface, enabling Rust programs to interact with the underlying C library on embedded and bare-metal AArch64 systems.

## Key Components
The module is organized around core system programming primitives:

- **Basic Types**: Architecture-appropriate type definitions (`clock_t`, `wchar_t`) sized for AArch64
- **Socket Infrastructure**: Complete socket programming API with IPv4/IPv6 address structures
- **Network Constants**: Protocol families, I/O control flags, and socket options
- **Re-exported Utilities**: Common newlib types from the generic module

## Public API Surface
Main entry points for system programming:

- **Socket Structures**: `sockaddr`, `sockaddr_in`, `sockaddr_in6` for network programming
- **Network Constants**: `AF_INET6`, `SOL_SOCKET`, `FIONBIO` for socket configuration
- **Poll Interface**: `POLLIN`, `POLLOUT`, `POLLERR` flags for event monitoring
- **Generic Types**: Re-exported `dirent`, `sigset_t`, `stat` from parent newlib module

## Internal Organization
The module follows libc's layered approach:
1. **Type Definitions** - Platform-specific primitive types aligned with AArch64 ABI
2. **C Struct Bindings** - Socket addresses defined using `s!` macro for exact C layout compatibility
3. **Constants** - Network and I/O control values matching newlib's definitions
4. **Re-exports** - Common newlib types pulled from generic implementation

## Architecture Characteristics
- **Embedded Focus**: Newlib is primarily used in embedded/bare-metal environments
- **Limited Features**: Many socket message flags set to 0, indicating reduced functionality compared to full Unix systems
- **BSD-style Sockets**: Socket structures include explicit length fields characteristic of BSD socket API
- **AArch64 Optimization**: Types and alignments specifically tailored for 64-bit ARM architecture

This module serves as the foundational layer for low-level system calls and network programming on AArch64 newlib systems, providing the necessary FFI bindings while respecting the constraints of embedded environments.
# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/unix/mod.rs
@source-hash: 99da5dc878b4872d
@generated: 2026-02-09T18:03:21Z

## Primary Purpose
Platform abstraction layer for Unix-like systems in the mio async I/O library. Provides conditional compilation logic to select appropriate I/O event notification mechanisms and system interfaces based on target operating system capabilities.

## Key Components

### System Call Wrapper Macro
- `syscall!` macro (L5-15): Safe wrapper around libc system calls that automatically handles error conversion from errno to `io::Error`
- Returns `io::Result<T>` with proper error handling for negative return values

### Conditional Module Selection Architecture
Uses complex conditional compilation with custom `cfg_os_poll!` macro to select platform-specific implementations:

**Event Notification Selector** (L17-55):
- `selector/epoll.rs`: Linux, Android, Illumos, Redox systems
- `selector/kqueue.rs`: BSD-like systems (FreeBSD, macOS, iOS, etc.)  
- `selector/poll.rs`: Fallback for unsupported systems or when forced via `mio_unsupported_force_poll_poll`

**Waker Implementation** (L57-109):
- `waker/eventfd.rs`: Linux-based systems using eventfd
- `waker/kqueue.rs`: BSD systems using kqueue (incompatible with poll selector)
- `waker/pipe.rs`: Universal pipe-based fallback

### Feature-Gated Modules
- `sourcefd` (L111-114, L163-166): Raw file descriptor integration, available under `os-ext` feature
- Network modules (L116-123): TCP, UDP, Unix domain sockets conditionally compiled under `cfg_net!`
- `pipe` module (L125-159): Pipe operations with complex OS compatibility matrix

## Dependencies
- `libc` crate for system call access
- Custom conditional compilation macros (`cfg_os_poll!`, `cfg_not_os_poll!`, `cfg_net!`, `cfg_os_ext!`)

## Architectural Patterns
- **Platform Abstraction**: Single interface with multiple OS-specific backends
- **Conditional Compilation**: Extensive use of `cfg` attributes for platform selection
- **Fallback Strategy**: Multiple implementation tiers (optimized → compatible → universal)
- **Feature Flags**: Optional functionality gated behind cargo features

## Critical Design Constraints
- Kqueue-based waker incompatible with poll-based selector (L70, L84, L132)
- Hermit OS limitations (no pipes support, L156-157)
- Platform-specific optimization preferences with universal fallbacks
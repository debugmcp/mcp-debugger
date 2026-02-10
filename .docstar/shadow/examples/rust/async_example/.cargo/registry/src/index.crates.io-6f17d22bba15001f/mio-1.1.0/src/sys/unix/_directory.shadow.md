# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/unix/
@generated: 2026-02-09T18:16:46Z

## Overall Purpose and Responsibility

This directory implements the complete Unix platform abstraction layer for the Mio asynchronous I/O library. It provides a unified interface over diverse Unix-like systems (Linux, macOS, BSD variants, Android, etc.) while maximizing platform-specific performance optimizations. The module serves as the core backend enabling cross-platform async I/O by abstracting system call differences, event notification mechanisms, and networking primitives behind consistent APIs.

## Key Components and Integration

### Core Infrastructure
- **mod.rs**: Central platform detection and module selection logic using extensive conditional compilation
- **syscall! macro**: Safe wrapper around libc system calls with automatic errno-to-io::Error conversion
- **Platform selection architecture**: Compile-time selection of optimal implementations based on target OS capabilities

### I/O Event Notification (selector/)
Three-tier selector implementation providing unified event polling interface:
- **epoll.rs**: Linux-optimized using epoll(7) system calls for high-performance edge-triggered events
- **kqueue.rs**: BSD-family selector using kqueue(2) with platform-specific type handling
- **poll.rs**: Portable POSIX poll(2) fallback with thread-safe multi-producer design
- **stateless_io_source.rs**: Zero-overhead wrapper for epoll/kqueue systems

### Cross-Thread Signaling (waker/)
Platform-optimized waker mechanisms for event loop coordination:
- **eventfd.rs**: Linux eventfd-based 64-bit atomic counter implementation
- **kqueue.rs**: BSD kqueue user events for native signaling
- **pipe.rs**: Universal pipe-based fallback for maximum compatibility

### Network Protocol Support
- **net.rs**: Low-level socket creation utilities with platform-specific non-blocking setup
- **tcp.rs**: TCP-specific operations (bind, listen, connect, accept) with dual accept() strategies
- **udp.rs**: UDP socket creation and IPv6-only configuration
- **uds/**: Complete Unix domain socket implementation (stream, datagram, listener variants)

### System Integration
- **pipe.rs**: Cross-platform pipe creation and management with event system integration
- **sourcefd.rs**: Raw file descriptor adapter for integrating arbitrary FDs into Mio's event system

## Public API Surface

### Primary Entry Points
- **Selector types**: Platform-appropriate event polling interfaces (epoll/kqueue/poll)
- **Socket factories**: `new_ip_socket()`, `bind()`, `connect()`, `accept()` functions
- **Pipe operations**: `new()` returning `(Sender, Receiver)` pairs with event integration
- **Waker interface**: `Waker::new()` and `wake()` for cross-thread signaling
- **SourceFd**: Raw FD integration via `event::Source` trait implementation

### Integration Patterns
All components implement consistent patterns:
- **event::Source trait**: Unified event registration/deregistration interface
- **Interest-based registration**: READABLE/WRITABLE/ERROR event filtering
- **Token-based dispatch**: User-defined tokens for event correlation
- **RAII resource management**: Automatic cleanup and deregistration

## Internal Organization and Data Flow

### Conditional Compilation Strategy
The module uses sophisticated `cfg` attribute combinations to select optimal implementations:
- Feature detection macros (`cfg_os_poll!`, `cfg_net!`) enable compile-time platform optimization
- Fallback hierarchies ensure universal compatibility while preferring performance
- Platform-specific workarounds handle edge cases (Android seccomp, macOS EPIPE, illumos emulation)

### Event Processing Pipeline
1. **Registration Phase**: I/O sources register with platform-appropriate selector using unified API
2. **Polling Phase**: Selector blocks on optimized system calls (epoll_wait/kevent/poll)
3. **Event Conversion**: Raw system events normalized to Mio event format with token extraction
4. **User Dispatch**: Events delivered through consistent iterator interface

### Resource Management
- **CLOEXEC by default**: All file descriptors created with close-on-exec semantics
- **Non-blocking mode**: Atomic flag setting on modern platforms, fcntl() fallback on legacy systems
- **OwnedFd integration**: Modern Rust file descriptor lifetime management
- **Safe unsafe abstractions**: Careful sockaddr handling and pointer management with documented invariants

## Critical Design Patterns

### Performance Optimization
- **Zero-copy operations**: Direct system call forwarding where possible
- **Batch processing**: Efficient event buffer management
- **Edge-triggered preference**: Minimized system call overhead on Linux/BSD
- **Platform-specific fast paths**: accept4(), pipe2(), eventfd optimizations

### Compatibility Strategy
- **Multi-tier fallbacks**: Optimal → compatible → universal implementation chains
- **Runtime adaptation**: Graceful handling of missing system features
- **Consistent error semantics**: Unified error handling across platform variations
- **Thread safety**: Lock-free operations where possible, careful synchronization elsewhere

This directory forms the foundational layer enabling Mio's "zero-cost async I/O" promise by providing maximum platform optimization while maintaining consistent cross-platform semantics and API compatibility.
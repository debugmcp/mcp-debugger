# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/
@generated: 2026-02-09T18:16:18Z

## Purpose and Responsibility

The `sys` directory serves as the platform abstraction layer for the MIO (Metal I/O) async I/O library, providing a unified interface that delegates to platform-specific implementations across Unix, Windows, and WASI systems. This module is critical for enabling cross-platform asynchronous I/O operations while maintaining consistent APIs regardless of the underlying operating system.

## Key Components and Relationships

**Platform Dispatcher (`mod.rs`)**: Acts as the central orchestrator that selects appropriate system implementations based on compile-time target detection:
- Unix/Hermit systems → `unix` module
- Windows → `windows` module  
- WASI → `wasi` module
- Non-OS poll fallback → `shell` module

**Platform-Specific Modules**:
- **unix/**: Complete Unix I/O abstraction with selector (epoll/kqueue), Unix domain sockets, and waker mechanisms
- **windows/**: Windows-specific I/O implementations
- **wasi/**: WebAssembly System Interface adaptations
- **shell/**: Fallback implementations for limited environments

**Cross-Platform Utilities**:
- `debug_detail` macro for consistent Debug formatting of system events
- Platform-specific TCP listen backlog constants optimized per OS kernel

## Public API Surface

All platform modules must expose identical public interfaces to maintain API consistency:

- **Event/Events**: Cross-platform event representation and collections
- **Selector**: Core event polling and notification system
- **IoSourceState**: I/O source state management
- **Waker**: Thread-safe cross-thread signaling
- **TCP/UDP modules**: Network socket abstractions

The abstraction ensures that higher-level MIO code can use the same APIs regardless of the target platform.

## Internal Organization and Data Flow

**Compilation-Time Selection**: Uses Rust's `cfg` attributes extensively to select appropriate implementations at build time, ensuring zero-cost abstractions with no runtime overhead.

**Uniform Interface Pattern**: Each platform module implements the same set of traits and provides identical public APIs, allowing the dispatcher to seamlessly delegate operations.

**Resource Management**: Platform-specific optimizations like listen backlog sizes are carefully tuned for each OS (e.g., Windows uses 128, Linux uses -1 for OS maximum).

## Important Patterns and Conventions

- **Conditional Compilation**: Extensive use of `cfg_os_poll!` and `cfg_not_os_poll!` macros for feature gating
- **Zero-Cost Abstractions**: Platform selection happens at compile time with no runtime dispatch overhead  
- **Consistent Debug Output**: The `debug_detail` macro ensures uniform event formatting across platforms
- **OS-Specific Optimization**: Each platform implementation is tuned for optimal performance on its target system

This directory represents the foundational system integration layer that enables MIO's cross-platform capabilities while maintaining high performance and platform-specific optimizations.
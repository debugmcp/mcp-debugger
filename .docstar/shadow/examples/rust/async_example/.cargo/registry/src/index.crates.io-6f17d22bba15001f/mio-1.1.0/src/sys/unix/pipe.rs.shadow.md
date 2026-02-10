# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/unix/pipe.rs
@source-hash: 37c4ee16550238de
@generated: 2026-02-09T18:02:34Z

## Purpose
Unix pipe implementation for the `mio` asynchronous I/O library, providing non-blocking, cross-platform pipe creation and management for inter-process/thread communication.

## Core Architecture
The file implements platform-specific pipe creation strategies based on OS capabilities:
- **Modern Unix systems** (L11-30): Use `pipe2()` with `O_CLOEXEC|O_NONBLOCK` flags for atomic creation
- **Legacy Unix systems** (L32-61): Fall back to `pipe()` + manual `fcntl()` flag setting with cleanup on failure
- **Public API** (L66-619): High-level wrapper types and event-driven I/O integration

## Key Components

### Raw Pipe Creation
- `new_raw()` (L8-64): Platform-agnostic pipe creation returning `[RawFd; 2]` array
  - Handles 15+ Unix variants with conditional compilation
  - Ensures non-blocking mode and close-on-exec semantics
  - Implements proper cleanup on configuration failure

### High-Level Types
- `new()` (L209-215): Public constructor returning `(Sender, Receiver)` tuple
- `Sender` struct (L220-223): Write end wrapper around `IoSource<File>`
- `Receiver` struct (L405-408): Read end wrapper around `IoSource<File>`

### I/O Integration
Both `Sender` and `Receiver` implement:
- `event::Source` trait (L300-322, L485-507): Mio event registration/deregistration
- Standard I/O traits: `Write`/`Read` with vectored operations
- `try_io()` methods (L292-297, L477-482): Direct syscall execution with proper event handling
- `set_nonblocking()` methods (L226-229, L411-414): Runtime blocking mode control

### Platform Abstraction
- `set_nonblocking()` implementations:
  - IOCTL-based (L590-597): Most Unix systems using `FIONBIO`
  - fcntl-based (L599-619): AIX/Solaris systems using `F_GETFL`/`F_SETFL`

### Type Conversions
Extensive trait implementations for both `Sender` and `Receiver`:
- Raw FD traits: `FromRawFd`, `AsRawFd`, `IntoRawFd`, `AsFd`
- `OwnedFd` conversions for modern Rust file descriptor management
- Child process stdio conversions (`ChildStdin`/`ChildStdout`/`ChildStderr`)

## Dependencies
- `libc`: Low-level Unix syscall bindings
- `IoSource`: Mio's event-aware I/O wrapper
- `event`, `Interest`, `Registry`, `Token`: Mio's event system types

## Design Patterns
- **Conditional compilation**: Extensive use of `cfg` attributes for cross-platform support
- **RAII**: Automatic cleanup and deregistration on drop
- **Zero-cost abstractions**: Thin wrappers over system file descriptors
- **Event-driven I/O**: Integration with epoll/kqueue-based event loops

## Critical Invariants
- Pipes are created in non-blocking mode with close-on-exec semantics
- File descriptors are properly cleaned up on creation failure (L55-58)
- Event registration state is maintained through `IoSource` wrapper
- Both ends must be registered with appropriate interests (`READABLE`/`WRITABLE`)
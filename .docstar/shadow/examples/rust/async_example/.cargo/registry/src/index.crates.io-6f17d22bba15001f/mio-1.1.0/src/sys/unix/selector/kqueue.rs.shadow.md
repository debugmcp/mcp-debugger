# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/unix/selector/kqueue.rs
@source-hash: b5b1825f45925e69
@generated: 2026-02-09T17:58:26Z

## Primary Purpose
Unix kqueue-based I/O event selector implementation for the Mio crate. Provides cross-platform abstraction over BSD kqueue system for event-driven I/O multiplexing.

## Key Components

### Core Types
- **Selector (L71-75)**: Main kqueue wrapper containing `OwnedFd` and optional debug ID
- **Event (L334-352)**: Transparent wrapper around `libc::kevent` with deref operations  
- **Events (L354-374)**: Vector container for Event objects with custom Send/Sync impls

### Platform Abstraction Types (L18-56)
- **Count (L19-22)**: Platform-specific type for kevent counts (int vs size_t)
- **Filter (L25-36)**: Platform-specific filter field types (short, i16, u32)
- **Flags (L39-50)**: Platform-specific flags field types (ushort, u16, u32)
- **UData (L53-56)**: Platform-specific user data types (void* vs intptr_t)

### Core Methods

#### Selector Implementation (L77-273)
- **new() (L78-87)**: Creates kqueue fd with CLOEXEC, assigns unique debug ID
- **try_clone() (L89-96)**: Clones kqueue fd while preserving same debug ID
- **select() (L98-126)**: Main event polling loop with timeout handling
- **register() (L129-166)**: Registers fd with read/write interest filters, handles macOS EPIPE quirk
- **reregister() (L169-200)**: Modifies existing registration, ignores ENOENT errors
- **deregister() (L202-215)**: Removes all filters for fd, ignores ENOENT errors

#### Waker Support (L227-272)
- **setup_waker() (L227-244)**: Configures EVFILT_USER for cross-thread waking (FreeBSD/macOS only)
- **wake() (L255-272)**: Triggers user event with NOTE_TRIGGER flag

### Utility Functions
- **kevent_register() (L276-301)**: Low-level kevent registration with error handling
- **check_errors() (L304-316)**: Validates kevent results, filters ignored errors
- **kevent! macro (L58-68)**: Constructs kevent structures with type casting

### Event Module (L384-896)
Provides event introspection functions:
- **token() (L392-394)**: Extracts Token from udata field
- **is_readable/is_writable() (L396-428)**: Tests for read/write events
- **is_error/is_*_closed() (L430-443)**: Tests for error and EOF conditions
- **is_aio/is_lio() (L451-488)**: Tests for async I/O events (platform-specific)
- **debug_details() (L490-895)**: Comprehensive debug formatting for all kqueue flags/filters

## Architecture Decisions

### Platform Compatibility
- Extensive conditional compilation for BSD variants (FreeBSD, NetBSD, OpenBSD, macOS, etc.)
- Type aliases abstract platform-specific libc differences
- Special handling for macOS EPIPE errors during registration

### Error Handling Strategy
- **EPIPE tolerance**: Ignores EPIPE on registration for closed pipe scenarios
- **ENOENT tolerance**: Ignores missing filters during reregister/deregister
- **EINTR handling**: Treats EINTR as success in kevent_register()

### Memory Safety
- Uses MaybeUninit for uninitialized kevent arrays
- Unsafe Send/Sync impls for Events with detailed safety justification (L376-382)
- Raw pointer handling in kevent construction and slice operations

## Critical Invariants
- kqueue fd must remain valid for selector lifetime
- Event vector length must match actual kevent results after select()
- Token values stored in udata field must fit in usize
- Platform-specific type casting must preserve bit patterns

## Dependencies
- **libc**: Core system call interface
- **std::os::fd**: File descriptor management
- **crate::{Interest, Token}**: Mio's public API types
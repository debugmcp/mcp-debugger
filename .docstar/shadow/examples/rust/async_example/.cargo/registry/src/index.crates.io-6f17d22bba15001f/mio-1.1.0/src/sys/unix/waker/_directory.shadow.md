# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/unix/waker/
@generated: 2026-02-09T18:16:08Z

## Purpose
This directory implements platform-specific waker mechanisms for Unix systems in the Mio asynchronous I/O library. Wakers provide thread-safe cross-thread signaling to wake up event loops, with different implementations optimized for specific Unix variants and their available system primitives.

## Core Components

### Waker Implementations
Three platform-optimized waker variants, each providing the same conceptual interface:

- **eventfd.rs**: Linux-optimized implementation using `eventfd` system call as a 64-bit counter
- **kqueue.rs**: BSD/macOS implementation leveraging kqueue's EVFILT_USER mechanism  
- **pipe.rs**: Portable Unix fallback using traditional pipe-based signaling

### Common Architecture Pattern
All implementations follow a consistent structure:
- Constructor methods: `new()` (registered with selector) and `new_unregistered()` (standalone)
- Core signaling: `wake()` method for cross-thread event triggering
- Reset/acknowledgment: Buffer management methods for event loop integration
- Platform abstraction: File descriptor exposure via `AsRawFd` trait

## Public API Surface

### Primary Entry Points
- `Waker::new(selector: &Selector, token: Token) -> io::Result<Waker>` - Creates registered waker
- `Waker::new_unregistered() -> io::Result<Waker>` - Creates standalone waker
- `Waker::wake() -> io::Result<()>` - Thread-safe wake signal

### Integration Methods
- `ack_and_reset()` - Clears pending signals (poll implementation)
- `AsRawFd` implementation - Exposes underlying file descriptor for selector registration

## Internal Organization

### Platform Selection
The directory uses conditional compilation to select optimal waker implementation based on target platform capabilities:
- eventfd preferred on Linux for efficiency (64-bit atomic counter)
- kqueue used on BSD systems (native user events)
- pipe as universal Unix fallback (POSIX compliance)

### Data Flow
1. **Creation**: Waker initialized with optional selector registration and unique token
2. **Signaling**: Cross-thread `wake()` calls write to underlying primitive (counter/event/pipe)
3. **Detection**: Selector monitors waker file descriptor for readability
4. **Reset**: Event loop clears signal state via buffer draining/counter reset

## Important Patterns

### Error Handling
- Robust retry logic for interrupted system calls and full buffers
- Platform-specific edge case handling (illumos epoll emulation, ESP-IDF flags)
- Graceful degradation for resource exhaustion scenarios

### Platform Adaptations
- Compile-time feature detection for optimal primitive selection
- Runtime workarounds for platform-specific quirks (illumos edge-triggering, Hermit OS fd traits)
- Conditional flag usage (EFD_NONBLOCK on ESP-IDF, EFD_CLOEXEC handling)

### Thread Safety
- All implementations provide thread-safe wake operations
- File descriptor cloning enables independent cross-thread usage
- Atomic counter semantics (eventfd) or synchronized pipe operations ensure consistency

This waker subsystem forms a critical foundation for Mio's cross-platform async I/O capabilities, abstracting Unix signal delivery complexity behind a uniform interface while maximizing platform-specific performance.
# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/poll.rs
@source-hash: 29a365b1f85d9a2d
@generated: 2026-02-09T18:11:39Z

## Primary Purpose
Core polling abstraction for Mio's event-driven I/O system. Provides cross-platform interface for monitoring multiple I/O sources for readiness events using OS-specific selectors (epoll, kqueue, IOCP).

## Key Structures

### Poll (L268-270)
Main event polling handle containing a Registry. Provides blocking `poll()` method to wait for readiness events.
- `new()` (L322-330): Creates new Poll instance with platform-specific selector
- `registry()` (L335-337): Returns reference to Registry for registering event sources
- `poll()` (L436-438): Core blocking method that waits for readiness events with optional timeout

### Registry (L273-278)
I/O resource registration interface wrapping system selector.
- `selector` (L274): Platform-specific sys::Selector implementation
- `has_waker` (L277): Debug-only atomic bool to enforce single waker per Poll
- `register()` (L569-579): Register event source with token and interest flags
- `reregister()` (L637-647): Modify existing registration's token/interests
- `deregister()` (L700-706): Remove event source from monitoring
- `try_clone()` (L712-718): Create independent Registry sharing same selector

## Platform Support
Conditional compilation for Unix systems (L1-17, L441-461), excluding unsupported targets. AsRawFd trait implementation for accessing underlying file descriptor on supported Unix platforms.

## Key Dependencies
- `sys::Selector`: Platform-specific selector implementation (epoll/kqueue/IOCP)
- `Events`: Container for collected readiness events
- `Token`: User-provided identifier for event sources
- `Interest`: Bitflags specifying which operations to monitor (readable/writable)

## Critical Design Patterns
- Event sources must implement `event::Source` trait
- Token-based event identification for multiplexing
- Interest-based filtering of readiness events
- Registry pattern separating registration from polling
- Debug assertions for single waker enforcement (L723-728)

## Architecture Notes
Documentation extensively covers cross-platform considerations:
- Spurious wakeup handling requirements
- Readiness draining obligations
- Platform-specific selector mapping (L235-247)
- Windows IOCP completion model adaptation
- File descriptor access caveats (L185-207)
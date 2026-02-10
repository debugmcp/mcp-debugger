# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/io/driver.rs
@source-hash: 84c31deb12aa7a17
@generated: 2026-02-09T18:03:13Z

## Purpose
Core I/O driver for Tokio async runtime, providing the reactor pattern implementation backed by Mio for cross-platform event polling. Manages I/O resource registration, event dispatching, and optional io_uring support on Linux.

## Key Components

### Driver Struct (L25-34)
Primary event loop driver containing:
- `signal_ready`: Flag for signal token events
- `events`: Reusable Mio events buffer for polling
- `poll`: System event queue (Mio Poll instance)

Key methods:
- `new()` (L117-157): Creates driver/handle pair with specified event capacity
- `park()` (L159-162): Blocks indefinitely waiting for events
- `park_timeout()` (L164-167): Blocks with timeout
- `turn()` (L179-239): Core event processing loop - polls, dispatches events to ScheduledIo instances
- `shutdown()` (L169-177): Gracefully shuts down all registrations

### Handle Struct (L37-71) 
Thread-safe reference to I/O driver containing:
- `registry`: Mio registry for resource registration
- `registrations`: RegistrationSet tracking all I/O resources  
- `synced`: Mutex-protected synchronized state
- `waker`: Cross-thread wakeup mechanism (not on WASI)
- `metrics`: I/O driver metrics
- `uring_context`/`uring_state`: Linux io_uring support (feature-gated)

Key methods:
- `add_source()` (L266-290): Registers I/O resources with interest mask
- `deregister_source()` (L293-311): Cleanly removes I/O resources
- `unpark()` (L258-261): Wakes blocked driver from other threads

### Supporting Types
- `ReadyEvent` (L74-78): Encapsulates readiness state with tick and shutdown info
- `Direction` (L93-96): Read/Write enum with ready mask conversion (L327-332)
- `Tick` (L98-101): Set/Clear operations for readiness state

## Key Dependencies
- `mio`: Cross-platform event notification (Poll, Registry, Events)
- `ScheduledIo`: Per-resource state management
- `RegistrationSet`: Collection managing all registered I/O resources
- `UringContext`: Linux io_uring integration (feature-gated)

## Architecture Patterns
- **Reactor Pattern**: Central event loop dispatching to registered handlers
- **Token-based Registration**: Uses Mio tokens for O(1) event-to-resource mapping
- **Unsafe Pointer Casting**: Tokens are memory addresses cast to/from `ScheduledIo` refs (L210-216)
- **Conditional Compilation**: Extensive feature gates for platform-specific code (WASI, Linux io_uring)
- **Thread Safety**: Handle is Send+Sync (L106-110), Driver is single-threaded

## Critical Invariants
- Tokens must remain valid until deregistration AND driver stops polling (L212-216)
- Driver holds Arc<ScheduledIo> preventing premature deallocation
- Registration/deregistration must be synchronized through RegistrationSet
- Signal handling uses reserved TOKEN_SIGNAL (L104) and TOKEN_WAKEUP (L103) tokens
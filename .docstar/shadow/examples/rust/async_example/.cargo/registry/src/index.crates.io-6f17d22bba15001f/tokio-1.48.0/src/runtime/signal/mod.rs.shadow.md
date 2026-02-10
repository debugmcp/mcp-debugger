# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/signal/mod.rs
@source-hash: 7cae37626477a94d
@generated: 2026-02-09T18:03:06Z

## Purpose
Signal driver implementation for Tokio's async runtime, responsible for receiving OS signals via Unix pipes and dispatching notifications to signal listeners. This driver integrates with the IO driver to handle signal readiness events asynchronously.

## Key Components

### Driver Struct (L19-30)
Main signal driver that manages signal reception and processing:
- `io: io::Driver` (L21) - Delegates parking/unparking to IO driver
- `receiver: UnixStream` (L24) - Unix pipe for receiving wake events from signal handlers
- `inner: Arc<()>` (L29) - Shared state reference for driver lifetime tracking

### Handle Struct (L32-37) 
Lightweight handle for checking driver availability:
- `inner: Weak<()>` (L36) - Weak reference to driver's shared state

## Core Functionality

### Driver::new() (L43-81)
Creates new signal driver instance with dedicated Unix stream receiver:
- Clones global signal receiver file descriptor to avoid registration conflicts
- Registers receiver with IO handle for readiness notifications
- Returns initialized driver with IO delegation and signal reception capabilities

### Signal Processing (L91-99, L105-127)
- `park()` and `park_timeout()` delegate to IO driver then call `process()`
- `process()` (L105-127) drains signal pipe when ready and broadcasts received signals:
  - Checks for signal readiness via `io.consume_signal_ready()`
  - Drains pipe buffer completely to reset readiness state
  - Calls `globals().broadcast()` to notify signal listeners

### Handle Operations (L85-89, L133-142)
- `handle()` creates weak reference handle for cross-thread access
- `check_inner()` verifies driver is still active via strong count check

## Dependencies
- `crate::runtime::{driver, io}` - Runtime driver integration
- `crate::signal::registry::globals` - Global signal state management  
- `mio::net::UnixStream` - Non-blocking Unix socket for signal pipe
- Unix-specific file descriptor operations

## Architecture Notes
- Driver relies on enabled IO driver for pipe readiness notifications
- Uses file descriptor duplication to avoid reactor registration conflicts
- Implements self-pipe trick pattern for async signal handling
- Strong/weak reference pattern ensures graceful driver shutdown detection
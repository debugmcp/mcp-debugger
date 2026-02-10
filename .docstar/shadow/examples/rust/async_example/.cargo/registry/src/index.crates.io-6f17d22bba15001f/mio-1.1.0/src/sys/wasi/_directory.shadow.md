# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/wasi/
@generated: 2026-02-09T18:16:09Z

## Purpose
This directory implements mio's I/O selector for WASI (WebAssembly System Interface), providing event-driven I/O capabilities in WebAssembly environments. It serves as the WASI-specific backend for mio's cross-platform async I/O abstraction, enabling networking and file I/O operations within WebAssembly runtimes.

## Key Components and Architecture

### Core Event Loop Infrastructure
The module centers around a `Selector` that uses WASI's `poll_oneoff` system call for event-driven I/O:
- **Subscription Management**: Thread-safe event subscription list using `Arc<Mutex<Vec<wasi::Subscription>>>`
- **Event Polling**: Main `select()` method that blocks on WASI events and handles timeouts
- **Event Processing**: Utilities for interpreting WASI events (read/write readiness, connection state)

### I/O Registration System
- **Registration API**: `register()`, `reregister()`, and `deregister()` methods for managing file descriptor subscriptions
- **Interest Translation**: Converts mio's `Interest` flags to WASI read/write subscription types
- **Token Association**: Links user-provided tokens with file descriptors for event identification

### Timeout and Event Handling
- **Timeout Support**: Clock-based timeout subscriptions with special token identification
- **Event Introspection**: Methods for extracting event metadata (tokens, readiness flags, connection state)
- **Error Handling**: WASI errno to Rust `io::Error` conversion

## Public API Surface

### Primary Entry Points
- `Selector::new()` - Creates new event selector instance
- `Selector::select()` - Main event polling loop with timeout support
- `Selector::register()/reregister()/deregister()` - FD subscription management
- `Selector::try_clone()` - Creates shared selector instance

### Event Processing
- Event introspection functions (`token()`, `is_readable()`, `is_writable()`, connection state detection)
- `Events` and `Event` type aliases wrapping WASI event structures

### TCP Support (conditional)
- Basic `accept()` function for TCP server sockets when `net` feature is enabled

## Internal Organization and Data Flow

1. **Registration Phase**: Applications register file descriptors with interest masks
2. **Subscription Creation**: Interests are converted to WASI read/write subscriptions
3. **Event Polling**: `poll_oneoff` blocks until events or timeout occur
4. **Event Processing**: WASI events are interpreted and returned to application
5. **State Management**: Subscriptions are maintained in shared, mutex-protected collection

## Important Patterns and Conventions

### Thread Safety Model
- Uses `Arc<Mutex<>>` for subscription sharing between selector clones
- **Critical Limitation**: Single-threaded use only due to mutex contention during concurrent operations

### WASI Integration
- Direct use of `wasi::poll_oneoff` for event polling
- WASI-specific event types and error codes
- WebAssembly runtime environment assumptions

### Error Handling
- Consistent conversion of WASI errno values to Rust `io::Error`
- Event validation for error conditions before processing

## System Limitations
- **No Waker Support**: Cannot interrupt `poll_oneoff` from other threads
- **Shared State Issues**: Selector cloning shares subscription state rather than creating independent instances
- **Platform Constraints**: WASI-specific implementation with limited syscall availability
- **Concurrency Restrictions**: Designed for single-threaded event loops only

This module enables mio applications to run in WebAssembly environments while maintaining the familiar event-driven programming model, albeit with significant concurrency limitations imposed by the WASI runtime model.
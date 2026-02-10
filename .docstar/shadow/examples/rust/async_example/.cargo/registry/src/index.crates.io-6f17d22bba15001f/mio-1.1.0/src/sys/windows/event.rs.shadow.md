# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/windows/event.rs
@source-hash: 2a40784b42d2cef9
@generated: 2026-02-09T18:02:35Z

## Purpose
Windows-specific event handling for mio, bridging between Windows I/O Completion Ports (IOCP) and AFD (Auxiliary Function Driver) polling mechanisms. Provides event representation and state management for asynchronous I/O operations.

## Key Components

### Event Structure (L7-11)
Core event data structure containing:
- `flags`: u32 bitmask representing I/O readiness states using AFD poll flags
- `data`: u64 token identifier for associating events with registered sources

### Event Construction & Conversion (L18-51)
- `new()` (L18-23): Creates event from token with zero flags
- `from_completion_status()` (L34-39): Converts IOCP completion to event
- `to_completion_status()` (L41-43): Converts event to IOCP completion status
- `to_completion_status_with_overlapped()` (L46-51): Feature-gated conversion with overlapped I/O pointer

### Flag Management (L25-32)
- `set_readable()` (L25-27): Sets AFD POLL_RECEIVE flag
- `set_writable()` (L30-32): Sets AFD POLL_SEND flag (feature-gated)

### Flag Constants (L54-63)
Predefined flag combinations for different I/O states:
- `READABLE_FLAGS`: Receive, disconnect, accept, abort, connect_fail
- `WRITABLE_FLAGS`: Send, abort, connect_fail  
- `ERROR_FLAGS`: Connect_fail only
- `READ_CLOSED_FLAGS`: Disconnect, abort, connect_fail
- `WRITE_CLOSED_FLAGS`: Abort, connect_fail

### Event State Queries (L65-97)
Boolean functions for checking event states:
- `is_readable()`, `is_writable()`, `is_error()` (L65-75): Standard I/O readiness
- `is_read_closed()`, `is_write_closed()` (L77-83): Connection closure detection
- `is_priority()` (L85-87): Expedited data handling
- `is_aio()`, `is_lio()` (L89-97): Unsupported operations (always false)

### Debug Support (L99-122)
`debug_details()` function providing formatted debug output with AFD flag breakdown using internal `debug_detail!` macro.

### Events Collection (L124-168)
Container for batch event processing:
- `statuses`: Boxed array of CompletionStatus for raw IOCP results
- `events`: Vector of processed Event objects for upward propagation
- Standard collection methods: `with_capacity()`, `len()`, `get()`, `clear()`

## Dependencies
- `super::afd`: AFD polling constants and functionality
- `super::iocp::CompletionStatus`: IOCP completion status handling
- `crate::Token`: Event source identification

## Architecture Notes
- Dual-layer design: raw IOCP completions processed into higher-level events
- Windows-specific AFD integration for efficient socket polling
- Feature gates for optional functionality (`os-ext`)
- Zero-cost abstractions with direct flag manipulation
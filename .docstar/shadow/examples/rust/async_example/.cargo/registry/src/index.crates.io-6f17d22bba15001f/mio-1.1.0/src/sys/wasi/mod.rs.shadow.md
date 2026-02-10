# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/wasi/mod.rs
@source-hash: 1c269f5fd8aa19c4
@generated: 2026-02-09T18:03:21Z

## Purpose
WASI (WebAssembly System Interface) implementation of mio's I/O selector, providing event-driven networking capabilities with significant limitations for single-threaded use only.

## Key Components

### Selector (L43-206)
Core event polling mechanism with shared subscription state:
- `subscriptions: Arc<Mutex<Vec<wasi::Subscription>>>` (L47) - Thread-safe event subscription list
- `new()` (L51-57) - Creates selector with unique ID and empty subscriptions
- `select()` (L64-117) - Main event polling loop using `wasi::poll_oneoff`, handles timeout subscriptions
- `register()` (L128-167) - Adds FD read/write subscriptions based on interests
- `reregister()` (L169-177) - Deregisters then re-registers FD with new interests
- `deregister()` (L179-204) - Removes all subscriptions matching given FD
- `try_clone()` (L119-125) - Clones selector sharing same subscription state

### TCP Support (L27-37)
Minimal TCP functionality when `net` feature enabled:
- `accept()` (L31-35) - Accepts TCP connections and sets non-blocking mode

### Event Handling (L259-348)
Event introspection utilities:
- `token()` (L265-267) - Extracts token from event userdata
- `is_readable()/is_writable()` (L269-275) - Event type detection
- `is_read_closed()/is_write_closed()` (L284-294) - Connection state detection using hangup flags
- `debug_details()` (L311-347) - Formatted debug output for events

### Timeout Management
- `timeout_subscription()` (L212-233) - Creates clock-based timeout subscription
- `is_timeout_event()` (L235-237) - Identifies timeout events using special token
- `TIMEOUT_TOKEN` (L209) - Special userdata value for timeout identification

### Utility Functions
- `check_errors()` (L240-247) - Validates events for WASI errors
- `io_err()` (L250-253) - Converts WASI errno to Rust io::Error
- `IoSourceState` (L352-367) - No-op state management for I/O sources

## Dependencies
- `std::sync::{Arc, Mutex}` for thread-safe subscription sharing
- `wasi` crate for WebAssembly system interface bindings
- Conditional `crate::{Interest, Token}` for networking features

## Critical Limitations
- **Single-threaded only**: Concurrent polling and registration don't work due to shared mutex
- **No Waker support**: Cannot wake threads from `poll_oneoff`
- **Limited cloning**: `try_clone()` shares state rather than true independence
- **WASI-specific**: Tied to WebAssembly runtime environment

## Type Aliases
- `Events = Vec<Event>` (L255) - Event collection type
- `Event = wasi::Event` (L257) - Individual event type
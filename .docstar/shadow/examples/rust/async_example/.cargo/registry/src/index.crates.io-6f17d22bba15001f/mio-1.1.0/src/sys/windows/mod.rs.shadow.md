# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/windows/mod.rs
@source-hash: efd3be8b902128fc
@generated: 2026-02-09T18:03:20Z

**Primary Purpose:** Windows-specific module organization for the mio crate's async I/O functionality. Serves as the main entry point for Windows system integration, providing platform-specific implementations of event handling, selectors, and I/O source state management.

**Module Organization:**
- `event` (L3): Public module exposing `Event` and `Events` types for Windows event handling
- `selector` (L15): Public module providing `Selector` for Windows I/O multiplexing  
- `afd`, `handle`, `io_status_block`, `iocp`, `overlapped` (L1,6,9-12): Private Windows implementation details
- Conditionally compiled modules via feature flags:
  - Network modules (`tcp`, `udp`, `net`) under `cfg_net!` (L19-40)
  - Named pipe support under `cfg_os_ext!` (L42-44)
- `waker` (L46): Internal waker implementation for event loop notifications

**Key Components:**

**syscall! macro (L23-32):** Utility macro for executing Windows system calls with automatic error handling. Takes a function call, error test condition, and error value, returning `io::Result`.

**InternalState struct (L57-62):** Core state container for registered I/O sources:
- `selector`: Reference to selector implementation
- `token`: Unique identifier for the I/O source
- `interests`: Event interests (read/write flags)
- `sock_state`: Thread-safe socket state management

**InternalState::drop (L64-69):** Cleanup implementation that marks socket state for deletion when state is dropped.

**IoSourceState struct (L71-77):** Public API wrapper for managing I/O source registration lifecycle. Contains optional boxed `InternalState` (None when unregistered).

**IoSourceState methods:**
- `new()` (L80-82): Creates unregistered state
- `do_io()` (L84-99): Executes I/O operations with automatic re-registration on `WouldBlock` errors
- `register()` (L101-118): Initial registration with registry, prevents double registration
- `reregister()` (L120-138): Updates existing registration with new token/interests
- `deregister()` (L140-153): Removes registration and marks for cleanup

**Architectural Patterns:**
- Feature-gated conditional compilation for platform-specific functionality
- RAII pattern with Drop trait for automatic cleanup
- State machine pattern for I/O source lifecycle (None -> Some -> None)
- Error propagation using `io::Result` throughout
- Thread-safe shared state using `Arc<Mutex<T>>`

**Dependencies:**
- Windows-specific types (`RawSocket` from `std::os::windows::io`)
- mio core types (`Interest`, `Registry`, `Token`)
- Standard library concurrency primitives (`Arc`, `Mutex`, `Pin`)

**Critical Constraints:**
- I/O sources must be registered before performing operations
- Double registration is prevented (returns `AlreadyExists` error)
- Operations on unregistered sources return `NotFound` error
- Socket state cleanup is automatic via Drop trait
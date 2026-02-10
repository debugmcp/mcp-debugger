# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/park.rs
@source-hash: 9c7fba240d99a20d
@generated: 2026-02-09T18:06:46Z

**Primary Purpose:**
Thread parking/unparking implementation for Tokio runtime - provides blocking primitives for thread synchronization using condition variables and atomic state machines.

**Core Architecture:**
- Three-state atomic state machine: EMPTY (0), PARKED (1), NOTIFIED (2) (L28-30)
- Thread-local storage for parker instances via `CURRENT_PARKER` (L32-34)
- Shared `Inner` state protected by mutex/condvar for coordination (L21-26)

**Key Classes/Structs:**

**ParkThread (L10-13):**
- Main parking handle wrapping shared `Inner` state
- `new()` - creates new parker instance (L45-53)
- `park()` - blocks current thread indefinitely (L60-64)
- `park_timeout()` - blocks with timeout (L66-70)
- `unpark()` - creates `UnparkThread` handle (L55-58)
- `shutdown()` - notifies all waiting threads (L72-74)

**UnparkThread (L16-19):**
- Clonable handle for waking parked threads
- `unpark()` - triggers thread wake-up (L221-223)
- `into_waker()` - converts to standard `Waker` (L294-297)

**CachedParkThread (L233-236):**
- Thread-local parker that accesses `CURRENT_PARKER`
- `park()` / `park_timeout()` - delegates to thread-local instance (L257-265)
- `block_on()` - runs futures to completion with parking (L275-291)
- `waker()` - creates `Waker` for async integration (L249-251)

**Inner Implementation (L79-210):**

**park() (L80-125):**
- Fast path: consume existing notification (L83-89)
- Slow path: acquire mutex, set PARKED state, wait on condvar
- Handles spurious wakeups and memory ordering requirements

**park_timeout() (L127-176):**
- Similar to park() but with duration limit
- Special handling for WASM without atomics (L164-169)
- Unconditionally resets state after timeout

**unpark() (L178-205):**
- Uses atomic swap to set NOTIFIED state
- Acquires/releases mutex to synchronize with parker thread
- Handles race conditions between state changes and condvar waits

**Memory Ordering:**
- Uses SeqCst (sequential consistency) throughout for strong ordering guarantees
- Critical for cross-thread synchronization and preventing races

**Platform Adaptations:**
- Loom testing support with park count tracking (L37-40, L310-313)
- WASM fallback to thread::sleep when atomics unavailable (L164-169)
- Conditional compilation for different target families

**Wake Integration:**
- `Inner` implements `Wake` trait for async ecosystem compatibility (L300-308)
- Enables conversion to standard library `Waker` types
# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/parking_lot_core-0.9.12/src/thread_parker/windows/
@generated: 2026-02-09T18:16:15Z

## Purpose and Responsibility

This directory implements Windows-specific thread parking infrastructure for `parking_lot_core`, providing efficient thread blocking and unblocking primitives. It serves as the platform abstraction layer that adapts parking_lot's generic ThreadParker API to Windows synchronization mechanisms, with automatic backend selection and fallback for maximum compatibility across Windows versions.

## Key Components and Architecture

### Backend Selection Strategy (mod.rs)
The module implements a dual-backend architecture with automatic selection:
- **WaitAddress Backend**: Preferred implementation using WaitOnAddress/WakeByAddressSingle APIs (Windows 8+) for userspace-optimized synchronization
- **KeyedEvent Backend**: Fallback using NT Keyed Events (Windows XP+) for broad compatibility
- **Global Singleton**: Thread-safe lazy initialization with atomic backend selection and race-free fallback logic

### Low-Level Implementations
- **waitaddress.rs**: Modern userspace-first approach using WaitOnAddress APIs with dynamic loading and timeout handling
- **keyed_event.rs**: Kernel-based approach using NT Keyed Events with complex timeout conversion and state management
- **bindings.rs**: Manual Win32/NT API bindings that eliminate external dependencies for this foundational crate

### Synchronization Protocol
All backends follow a consistent two-phase unpark pattern:
1. **prepare_park()**: Atomically set parking state
2. **park()/park_until()**: Block thread until unparked or timeout
3. **unpark_lock()**: Mark thread as unparked and return handle
4. **UnparkHandle::unpark()**: Perform actual wake operation after locks released

## Public API Surface

**Primary Entry Points:**
- `ThreadParker`: Main parking primitive implementing `ThreadParkerT` trait
  - `new()`: Creates parker with appropriate backend
  - `prepare_park()`: Sets up parking state (unsafe)
  - `park()`: Infinite blocking wait
  - `park_until()`: Timeout-aware blocking with `ParkResult`
  - `unpark_lock()`: Thread-safe unpark initialization

**Supporting Types:**
- `UnparkHandle`: Deferred unpark mechanism for lock-free wakeup
- `thread_yield()`: Windows-specific CPU yield utility

## Internal Organization and Data Flow

### Initialization Flow
1. First `ThreadParker::new()` call triggers backend selection
2. `Backend::create()` attempts WaitAddress API loading
3. Falls back to KeyedEvent creation if APIs unavailable
4. Atomic singleton storage prevents duplicate initialization races

### Parking Flow
1. Thread calls `prepare_park()` to set atomic state
2. `park()` or `park_until()` delegates to backend implementation
3. Backend uses appropriate Windows API (WaitOnAddress vs NtWaitForKeyedEvent)
4. Returns `ParkResult::Unparked` or `ParkResult::TimedOut`

### Unparking Flow
1. `unpark_lock()` atomically changes state and returns handle
2. Caller releases queue locks before calling `UnparkHandle::unpark()`
3. Handle delegates to backend-specific wake implementation
4. Target thread resumes from parking call

## Important Patterns and Conventions

### Dependency Minimization
- Manual API bindings avoid transitive dependencies critical for foundational crates
- Dynamic loading using `GetModuleHandle`/`GetProcAddress` for optional APIs
- Unsafe transmute for function pointer conversion with careful type safety

### Cross-Version Compatibility
- Runtime feature detection for Windows 8+ WaitOnAddress APIs
- Graceful fallback to NT Keyed Events for older Windows versions
- Consistent abstraction layer hiding implementation differences

### Memory Safety and Synchronization
- Atomic state machines with carefully chosen memory orderings
- RAII handles for resource cleanup and delayed operations
- Two-phase unpark protocol prevents race conditions and minimizes lock contention
- All parking operations marked unsafe due to memory ordering requirements

### Timeout Handling
- Complex timeout conversion between Rust `Instant` and Windows native formats
- Overflow protection for large timeout values
- Platform-specific error code handling and validation

This directory represents a critical foundation for Rust's parking_lot ecosystem, providing battle-tested Windows synchronization primitives with optimal performance characteristics and broad compatibility.
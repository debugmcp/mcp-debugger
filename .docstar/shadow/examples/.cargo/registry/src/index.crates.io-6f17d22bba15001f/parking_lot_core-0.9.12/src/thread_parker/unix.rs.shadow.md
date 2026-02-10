# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/parking_lot_core-0.9.12/src/thread_parker/unix.rs
@source-hash: 4cd468fcee83f29e
@generated: 2026-02-09T18:06:30Z

Unix-specific implementation of thread parking/unparking primitives using pthreads for the parking_lot library. Provides synchronization mechanisms where threads can efficiently block and be woken by other threads.

## Core Components

### ThreadParker (L28-33)
Primary synchronization primitive implementing `ThreadParkerT` trait. Contains:
- `should_park: Cell<bool>` - atomic flag indicating if thread should block
- `mutex: UnsafeCell<pthread_mutex_t>` - pthread mutex for synchronization
- `condvar: UnsafeCell<pthread_cond_t>` - pthread condition variable for blocking/waking
- `initialized: Cell<bool>` - tracks lazy initialization state

Key methods:
- `new()` (L41-48) - creates with static pthread initializers
- `prepare_park()` (L51-57) - sets park flag and lazy-initializes if needed
- `park()` (L73-82) - unconditionally blocks until unparked
- `park_until()` (L85-115) - blocks with timeout, returns true if unparked before timeout
- `timed_out()` (L60-70) - thread-safe check of park state
- `unpark_lock()` (L118-125) - creates locked UnparkHandle for thread-safe unparking

### UnparkHandle (L166-168)
Handle for waking a parked thread, contains raw pointer to ThreadParker. The `unpark()` method (L172-182) atomically clears park flag and signals condition variable while holding mutex to prevent races.

## Platform-Specific Behavior

### Clock Selection
- **Apple/Android/ESP-IDF**: Uses default CLOCK_REALTIME via no-op `init()` (L132)
- **Other Unix**: Configures CLOCK_MONOTONIC via `init()` (L137-147) to avoid issues with system clock changes

### Time Handling
- **x32 Linux**: Uses `i64` for `tv_nsec_t` (L22) due to non-standard timespec
- **Standard**: Uses `libc::c_long` for `tv_nsec_t` (L25)

### Time Functions
- `timespec_now()` (L188-214) - platform-specific current time retrieval
- `timeout_to_timespec()` (L219-237) - converts relative Duration to absolute timespec with overflow protection

## Architecture Notes

- **Lazy Initialization**: pthreads primitives initialized on first use to handle platform quirks
- **Memory Safety**: Extensive use of `UnsafeCell` for interior mutability with raw pthread APIs
- **Race Prevention**: UnparkHandle maintains mutex lock during unpark to prevent use-after-free
- **Overflow Handling**: Robust timeout arithmetic with fallback to indefinite wait
- **Debug Assertions**: Comprehensive error checking in debug builds for pthread API calls

## Key Invariants

- Mutex must be held when accessing/modifying `should_park` flag
- Condition variable operations require corresponding mutex to be locked
- UnparkHandle created with mutex locked, unlocked during `unpark()`
- Timeout calculations handle overflow by falling back to indefinite wait

## Dependencies

- `libc` - pthread and time APIs
- `std::time` - Duration and Instant for timeout handling
- `core::cell` - Cell and UnsafeCell for interior mutability
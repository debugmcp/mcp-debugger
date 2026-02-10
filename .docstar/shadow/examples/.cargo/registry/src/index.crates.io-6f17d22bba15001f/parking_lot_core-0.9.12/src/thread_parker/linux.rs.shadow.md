# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/parking_lot_core-0.9.12/src/thread_parker/linux.rs
@source-hash: 70bfe6c168fc4319
@generated: 2026-02-09T18:06:28Z

## Linux-specific Thread Parker Implementation

**Primary Purpose**: Platform-specific thread parking implementation for Linux using futex system calls. Provides efficient thread blocking/unblocking primitives that integrate with parking_lot's synchronization mechanisms.

## Key Types

### ThreadParker (L37-102)
Core thread parking structure implementing `ThreadParkerT` trait:
- **Field**: `futex: AtomicI32` (L38) - Atomic state variable for futex operations
- **State Management**: Uses 0=unparked, 1=parked states with Release/Acquire ordering
- **Construction**: `IS_CHEAP_TO_CONSTRUCT = true` (L44) - no heap allocation or syscalls needed

### UnparkHandle (L131-151)  
Handle for waking parked threads:
- **Field**: `futex: *const AtomicI32` (L132) - Raw pointer to target thread's futex
- **Safety**: Handle may outlive target thread data; EFAULT errors are expected/handled

## Core Operations

### Parking Methods
- `prepare_park()` (L54-56): Sets futex to 1 with Relaxed ordering
- `park()` (L64-68): Busy-waits with futex_wait syscalls using Acquire ordering
- `park_until()` (L71-90): Timed parking with overflow protection and timespec conversion
- `timed_out()` (L59-61): Checks if still parked after timeout

### Unparking
- `unpark_lock()` (L96-101): Clears futex state and returns UnparkHandle
- `UnparkHandle::unpark()` (L137-150): Issues FUTEX_WAKE syscall

### Low-level Futex Interface
- `futex_wait()` (L106-128): Wrapper for FUTEX_WAIT syscall with timeout support
- Error handling for EINTR, EAGAIN, ETIMEDOUT conditions

## Platform Adaptations

### Architecture-specific Types
- `tv_nsec_t` (L18-23): Handles x32 Linux's non-standard timespec.tv_nsec type
- Uses `i64` for x32, `c_long` for other platforms

### OS-specific Error Handling  
- `errno()` (L25-34): Platform-specific errno access via `__errno_location()` (Linux) or `__errno()` (Android)

## Dependencies
- **libc**: Futex syscalls and platform constants
- **std::time::Instant**: Timeout calculations  
- **core::sync::atomic**: Memory ordering guarantees

## Architecture Notes
- Uses FUTEX_PRIVATE_FLAG for better performance (no cross-process synchronization)
- Implements busy-wait loops with syscall parking to handle spurious wakeups
- Timeout overflow protection prevents incorrect behavior with large durations
- Raw pointer usage in UnparkHandle allows cross-thread operations with lifetime safety handled at higher levels
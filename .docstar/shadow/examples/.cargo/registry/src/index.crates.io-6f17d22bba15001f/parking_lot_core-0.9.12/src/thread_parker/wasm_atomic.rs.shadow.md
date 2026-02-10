# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/parking_lot_core-0.9.12/src/thread_parker/wasm_atomic.rs
@source-hash: 6fbc09accc9df9d4
@generated: 2026-02-09T18:06:27Z

## Purpose
WASM-specific thread parking implementation using atomic operations for parking_lot_core. Provides thread synchronization primitives that work on WebAssembly platforms by leveraging WASM32's atomic wait/notify instructions.

## Core Components

**ThreadParker (L16-18)**: Main parking primitive containing a single `AtomicI32` state field. Implements the `ThreadParkerT` trait to provide thread parking/unparking functionality specific to WASM environments.

**State Constants (L20-21)**:
- `UNPARKED (0)`: Thread is active and not waiting
- `PARKED (1)`: Thread is parked and waiting for notification

## Key Methods

**new() (L29-33)**: Creates ThreadParker with initial UNPARKED state. Marked as cheap to construct via `IS_CHEAP_TO_CONSTRUCT = true` (L26).

**prepare_park() (L36-38)**: Sets atomic state to PARKED using relaxed ordering, preparing thread for parking.

**park() (L46-53)**: Blocks indefinitely using `wasm32::memory_atomic_wait32()` with -1 timeout. Loops until state changes from PARKED, handling spurious wakeups. Uses acquire ordering for state checks.

**park_until() (L56-67)**: Timed parking with deadline. Calculates remaining nanoseconds and uses them as timeout for atomic wait. Returns false if deadline already passed, true if successfully unparked.

**unpark_lock() (L70-75)**: Sets state to UNPARKED with release ordering and returns UnparkHandle for notification.

**UnparkHandle (L84)**: Wrapper around raw pointer for safe unparking operations.

**unpark() (L88-91)**: Notifies exactly one waiting thread using `wasm32::memory_atomic_notify()`.

## Architecture Patterns

- **Lock-free design**: Uses atomic operations without traditional locks
- **Memory ordering**: Acquire/release semantics for proper synchronization
- **WASM integration**: Direct use of WASM32 atomic wait/notify instructions
- **Unsafe interface**: All parking operations marked unsafe, requiring caller to ensure thread safety
- **Handle-based unparking**: Separates unpark capability from parker instance

## Dependencies
- `core::arch::wasm32`: For atomic wait/notify operations
- `core::sync::atomic`: For AtomicI32 and memory ordering
- `std::time`: For timeout handling in timed parking

## Critical Constraints
- WASM32 platform specific - relies on SharedArrayBuffer support
- Atomic operations require proper memory alignment
- Debug assertions verify expected return codes from WASM atomic operations
- Pointer casting assumes AtomicI32 and i32 have same memory layout
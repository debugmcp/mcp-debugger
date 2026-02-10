# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/parking_lot-0.12.5/src/condvar.rs
@source-hash: 182e5a2f6c06cf66
@generated: 2026-02-09T18:11:44Z

## Primary Purpose
Implements a high-performance condition variable (Condvar) for parking_lot synchronization primitives. Provides wait/notify semantics for blocking threads until conditions are met, with optimizations over standard library condvars including no spurious wakeups and efficient requeuing to mutexes.

## Key Components

### WaitTimeoutResult (L20-31)
- Simple wrapper struct indicating whether a timed wait operation timed out
- `timed_out()` method returns boolean timeout status

### Condvar (L90-510)
Core condition variable implementation with single atomic pointer state tracking associated mutex.

**Constructor:**
- `new()` (L98-102): Creates condvar with null state pointer

**Notification Methods:**
- `notify_one()` (L128-136): Fast path check for waiting threads, delegates to slow path
- `notify_one_slow()` (L139-175): Uses parking_lot_core unpark_requeue for atomic wake/requeue operations
- `notify_all()` (L187-195): Similar fast path pattern
- `notify_all_slow()` (L198-239): Wakes/requeues all waiting threads

**Waiting Methods:**
- `wait()` (L255-257): Basic blocking wait on condition
- `wait_until()` (L283-292): Wait with absolute timeout deadline
- `wait_for()` (L381-388): Wait with relative timeout duration
- `wait_until_internal()` (L296-360): Core waiting logic handling mutex validation, parking, and reacquisition
- `wait_while_until_internal()` (L391-409): Helper for predicate-based waiting

**Predicate-Based Methods:**
- `wait_while()` (L427-433): Wait while condition remains true
- `wait_while_until()` (L463-474): Predicate wait with absolute timeout
- `wait_while_for()` (L498-509): Predicate wait with relative timeout

## Key Architectural Decisions

**Single Mutex Association**: Enforces one-condvar-per-mutex constraint via atomic state pointer tracking (L307-314). Panics on violation (L348-350).

**No Spurious Wakeups**: Unlike standard library, guarantees waits only return due to explicit notifications or timeouts.

**Efficient Requeuing**: Uses parking_lot_core's unpark_requeue to atomically transfer waiting threads from condvar to mutex queue, avoiding thundering herd on notify_all.

**Token Handoff Optimization**: Supports direct mutex ownership transfer on wakeup (L353-357) for improved performance.

## Dependencies
- `parking_lot_core`: Core parking/unparking primitives
- `crate::mutex::MutexGuard`: Integration with parking_lot mutexes
- `crate::raw_mutex::RawMutex`: Low-level mutex operations

## Critical Invariants
- State pointer must be null or point to currently associated mutex
- Mutex reacquisition guaranteed after wait operations
- State cleared when no threads waiting (L167-169, L214, L329-331)
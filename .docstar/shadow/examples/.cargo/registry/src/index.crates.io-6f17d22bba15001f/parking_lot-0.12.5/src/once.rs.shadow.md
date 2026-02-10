# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/parking_lot-0.12.5/src/once.rs
@source-hash: 58c78dba952e217c
@generated: 2026-02-09T18:11:43Z

## Primary Purpose
Implements `Once`, a compact one-time initialization primitive that executes closures exactly once, with poison handling for panics. More efficient than std library version: 1 byte vs 1 word, relaxed memory barriers, adaptive spinning.

## Key Data Structures

### OnceState Enum (L20-34)
State tracking for Once instances:
- `New`: Uninitialized
- `Poisoned`: Previous initialization panicked  
- `InProgress`: Thread currently executing
- `Done`: Successfully completed

Methods:
- `poisoned()` (L42-44): Checks if poisoned
- `done()` (L49-51): Checks if completed

### Once Struct (L77)
Core synchronization primitive using single `AtomicU8` with bit flags:
- `DONE_BIT` (L15): Initialization completed
- `POISON_BIT` (L16): Previous panic occurred
- `LOCKED_BIT` (L17): Thread holds execution lock
- `PARKED_BIT` (L18): Threads waiting in parking lot

## Core Methods

### Public Interface
- `new()` (L82-84): Creates zeroed instance
- `state()` (L88-99): Returns current OnceState from atomic bits
- `call_once()` (L151-161): Standard one-time execution with fast path check
- `call_once_force()` (L173-185): Ignores poison state, allows retry after panic

### Internal Implementation
- `call_once_slow()` (L199-309): Cold path handling contention, parking, and execution
  - Spin-wait optimization before parking
  - Compare-exchange lock acquisition
  - Parking lot integration for thread blocking
  - Poison handling with `PanicGuard` (L275-288)

## Critical Patterns

### Memory Ordering Strategy
- Acquire ordering on state loads for synchronization
- Release ordering on final state updates
- Relaxed ordering for spin-wait loops
- Explicit acquire fence after relaxed loads (L207, L214)

### Panic Safety
- `PanicGuard` RAII wrapper (L275-288) ensures poison bit set on panic
- `mem::forget(guard)` (L299) prevents poisoning on successful execution
- Unparks all waiting threads on both success and failure

### Contention Management
- Fast path: single atomic load check (L155, L177)
- Adaptive spinning via `SpinWait` before parking
- Parking lot integration for efficient thread blocking
- Address-based parking using `Once` instance pointer

## Dependencies
- `parking_lot_core`: Thread parking/unparking primitives
- `UncheckedOptionExt`: Unsafe Option unwrapping utility
- Core atomic primitives and memory fences

## Architecture Decisions
- Non-generic `call_once_slow()` reduces monomorphization cost
- `#[cold]` attribute guides compiler optimization
- FnMut instead of FnOnce for virtual dispatch without allocation
- Single byte storage vs word-sized standard library implementation
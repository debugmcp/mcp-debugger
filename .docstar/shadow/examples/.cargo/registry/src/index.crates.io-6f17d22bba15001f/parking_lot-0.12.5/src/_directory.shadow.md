# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/parking_lot-0.12.5/src/
@generated: 2026-02-09T18:16:17Z

## Overall Purpose
This directory contains the core implementation of the `parking_lot` crate, a high-performance synchronization primitives library that provides drop-in replacements for standard library types with significant performance improvements. The library is built on a layered architecture using atomic operations, parking lot primitives for thread blocking/unblocking, and the `lock_api` crate for generic synchronization abstractions.

## Architecture & Component Organization

### Layered Implementation Strategy
The crate follows a three-tier architecture:

1. **Raw Lock Layer** (`raw_mutex.rs`, `raw_rwlock.rs`, `raw_fair_mutex.rs`): Low-level lock implementations using atomic operations and parking_lot_core primitives
2. **Type-Safe Wrapper Layer** (`mutex.rs`, `rwlock.rs`, `fair_mutex.rs`, `remutex.rs`): High-level APIs built on `lock_api` generics, providing RAII guards and safe interfaces
3. **Utility & Support Layer** (`util.rs`, `elision.rs`, `deadlock.rs`): Performance optimizations, hardware features, and debugging tools

### Core Synchronization Primitives
- **Mutex** (`mutex.rs` + `raw_mutex.rs`): Standard mutual exclusion with eventual fairness
- **FairMutex** (`fair_mutex.rs` + `raw_fair_mutex.rs`): Always-fair FIFO ordering mutex
- **RwLock** (`rwlock.rs` + `raw_rwlock.rs`): Reader-writer locks with upgradable read support
- **ReentrantMutex** (`remutex.rs`): Recursive locks allowing same-thread re-entry
- **Condvar** (`condvar.rs`): Condition variables with no spurious wakeups
- **Once** (`once.rs`): One-time initialization primitive with panic handling

## Public API Surface

### Main Entry Points (via `lib.rs`)
- **`Mutex<T>`**, **`MutexGuard`**, **`MappedMutexGuard`**: Standard mutex types
- **`FairMutex<T>`**, **`FairMutexGuard`**, **`MappedFairMutexGuard`**: Fair mutex variants
- **`RwLock<T>`** with read/write/upgradable guards: Reader-writer synchronization
- **`ReentrantMutex<T>`**, **`ReentrantMutexGuard`**: Recursive locking
- **`Condvar`**, **`WaitTimeoutResult`**: Condition variable types
- **`Once`**, **`OnceState`**: One-time initialization
- **Raw types**: `RawMutex`, `RawFairMutex`, `RawRwLock` for custom implementations

### Const Constructors
All types provide const constructors (`const_mutex`, `const_rwlock`, etc.) enabling static initialization on stable Rust.

## Key Architectural Patterns

### Performance Optimizations
- **Fast-path/slow-path design**: Atomic compare-exchange for uncontended cases, parking lot fallback for contention
- **Hardware lock elision** (`elision.rs`): Intel TSX support for x86/x86_64 to potentially eliminate lock overhead
- **Adaptive spinning**: Micro-contention handling before expensive thread parking
- **Memory efficiency**: 1-byte overhead vs standard library's boxed implementations

### Fairness & Scheduling
- **Eventual fairness**: Automatic fair unlocks every 0.5ms or for critical sections >1ms
- **Dual wait queues**: RwLock uses separate queues for different lock types to prevent starvation
- **Token-based handoff**: Direct lock transfer between threads without intermediate unlock
- **FIFO ordering**: Fair mutex guarantees first-come-first-served access

### Safety & Correctness
- **No poisoning model**: Locks remain usable after panics (unlike std library)
- **RAII guard system**: Automatic lock release via drop, with mapping support for subfields  
- **Deadlock detection** (`deadlock.rs`): Optional runtime cycle detection in lock dependency graph
- **Thread identification**: Portable thread ID system using thread-local addresses

## Internal Data Flow

### Lock Acquisition Pattern
1. **Fast path**: Atomic compare-exchange attempt
2. **Spin wait**: Brief spinning for micro-contention
3. **Park**: Thread blocked using parking_lot_core primitives
4. **Wake**: Unparked by releasing thread, often with direct handoff

### State Management
- **Atomic state encoding**: Bit flags for lock status, parking indicators, reader counts
- **State transitions**: Careful atomic operations to maintain consistency during contention
- **Address-based parking**: Uses lock memory address for thread parking queues

## Dependencies & Integration
- **`parking_lot_core`**: Foundation for thread parking/unparking
- **`lock_api`**: Generic lock traits and RAII guard implementations
- **`deadlock` module**: Optional cycle detection in lock graphs
- **Hardware features**: TSX support, architecture-specific optimizations

## Critical Design Trade-offs
- **Performance vs fairness**: Regular mutex prioritizes speed, fair mutex ensures no starvation
- **Memory vs features**: Minimal footprint (1 byte locks) vs std library's feature-rich boxes
- **Safety vs speed**: Unsafe optimizations in hot paths with careful invariant maintenance
- **Complexity vs capability**: Rich feature set (timeouts, upgrades, downgrades) with sophisticated implementations
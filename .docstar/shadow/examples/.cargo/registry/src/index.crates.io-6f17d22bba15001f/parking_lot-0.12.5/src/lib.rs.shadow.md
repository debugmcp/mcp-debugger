# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/parking_lot-0.12.5/src/lib.rs
@source-hash: 0ad0d7a416c12f99
@generated: 2026-02-09T18:11:40Z

## Purpose
Root module for the parking_lot crate, providing high-performance synchronization primitives as alternatives to standard library types. Acts as the main API surface by re-exporting all public types from internal modules.

## Architecture
Modular design with separate modules for each synchronization primitive:
- `condvar` (L15) - Condition variables
- `mutex`/`fair_mutex` (L18,L17) - Standard and fair mutexes  
- `rwlock` (L24) - Reader-writer locks
- `remutex` (L23) - Reentrant mutexes
- `once` (L19) - One-time initialization
- `raw_*` modules (L20-22) - Low-level raw lock implementations
- `deadlock` (L28-30) - Optional deadlock detection
- `util` (L25) - Utilities
- `elision` (L16) - Lock elision optimizations

## Feature Configuration
**Mutually Exclusive Features (L34-35):**
- `send_guard` and `deadlock_detection` cannot be enabled together (compile error)

**Feature-dependent Types:**
- `GuardMarker` (L37-39): Conditionally aliases `lock_api::GuardSend` or `lock_api::GuardNoSend`
- `deadlock` module (L27-30): Public if deadlock detection enabled, private otherwise
- Arc-based guards (L58-62): Available only with `arc_lock` feature

## Public API Surface
**Core Synchronization Types:**
- `Mutex`, `MutexGuard`, `MappedMutexGuard` (L43)
- `FairMutex`, `FairMutexGuard`, `MappedFairMutexGuard` (L42) 
- `RwLock` with read/write/upgradable guards (L52-55)
- `ReentrantMutex` and associated guards (L48-51)
- `Condvar`, `WaitTimeoutResult` (L41)
- `Once`, `OnceState` (L44)

**Raw Lock Types (L45-47):**
- `RawMutex`, `RawFairMutex`, `RawRwLock` - Building blocks for higher-level locks

**External Dependencies:**
- Re-exports `lock_api` crate (L56) - Provides generic lock traits and implementations
- Conditionally exports Arc-based guard types from `lock_api` (L59-61)

## Key Patterns
- Consistent constructor naming: `const_mutex`, `const_fair_mutex`, etc.
- Mapped guard types for lock splitting/projection
- Feature-gated compilation for different threading models
- Raw lock implementations separated from high-level wrappers
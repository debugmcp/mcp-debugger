# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/rwlock/write_guard.rs
@source-hash: adce3b45dc7b2a98
@generated: 2026-02-09T18:03:21Z

## Purpose
RAII guard for Tokio RwLock exclusive write access. Automatically releases write lock when dropped and provides transformation methods for mapping and downgrading.

## Core Structure
- **RwLockWriteGuard<'a, T>** (L17-26): Main RAII guard struct containing semaphore reference, data pointer, permits count, phantom data, and optional tracing span
- **Inner<'a, T>** (L29-35): Helper struct for transferring ownership without triggering Drop, mirrors guard fields except PhantomData

## Key Methods

### Transformation Methods
- **skip_drop()** (L38-49): Transfers ownership to Inner struct without triggering Drop via ManuallyDrop
- **map()** (L88-103): Maps to RwLockMappedWriteGuard targeting subset of data, consumes original guard
- **try_map()** (L222-243): Fallible version of map(), returns Result with original guard on failure
- **into_mapped()** (L335-337): Converts to mapped guard without changing target data

### Downgrade Methods  
- **downgrade()** (L376-409): Converts write guard to read guard, releases all permits except one
- **downgrade_map()** (L143-180): Maps data and downgrades to read guard in single operation
- **try_downgrade_map()** (L287-327): Fallible version of downgrade_map()

### Standard Traits
- **Deref/DerefMut** (L412-424): Provides transparent access to protected data via unsafe pointer dereference
- **Debug/Display** (L426-442): Delegates formatting to underlying data
- **Drop** (L444-456): Releases all acquired permits and emits tracing events

## Key Dependencies
- **Semaphore** (L1): Core synchronization primitive for permit management
- **RwLockReadGuard/RwLockMappedWriteGuard** (L2-3): Related guard types for transformations
- **PhantomData** (L4): Ensures proper lifetime and mutability semantics

## Critical Invariants
- Write guard holds multiple permits (permits_acquired field) representing exclusive access
- Data pointer must remain valid for guard lifetime
- skip_drop() must be used when transferring ownership to prevent double-release
- Downgrade operations release (permits_acquired - 1) permits, keeping one for read access

## Architectural Patterns
- RAII pattern for automatic resource cleanup
- Builder-like transformation methods that consume self
- Unsafe pointer manipulation wrapped in safe abstractions
- Conditional compilation for optional tracing instrumentation
- Association functions avoid method name conflicts with user data
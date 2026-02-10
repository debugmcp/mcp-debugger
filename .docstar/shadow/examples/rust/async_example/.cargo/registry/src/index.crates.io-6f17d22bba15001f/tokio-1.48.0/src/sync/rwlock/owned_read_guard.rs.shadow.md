# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/rwlock/owned_read_guard.rs
@source-hash: f6678f20bef3c1e4
@generated: 2026-02-09T18:03:19Z

## Purpose
RAII guard for owned read access to Tokio's `RwLock`, automatically releasing the lock when dropped. Provides mapping operations and safe access to the protected data while maintaining ownership through Arc reference counting.

## Key Types

**OwnedRwLockReadGuard<T, U>** (L15-23)
- Main guard struct with two type parameters: T (original lock type), U (viewed data type)
- Fields:
  - `lock`: Arc<RwLock<T>> - Owned reference to the lock
  - `data`: *const U - Raw pointer to the protected data
  - `_p`: PhantomData<T> - Zero-cost type marker
  - `resource_span`: tracing::Span (conditional) - For observability

**Inner<T, U>** (L26-31)
- Helper struct for transferring ownership during skip_drop operations
- Mirrors OwnedRwLockReadGuard fields without Drop implementation

## Core Operations

**skip_drop()** (L34-46)
- Prevents Drop execution by wrapping in ManuallyDrop
- Transfers field ownership to Inner struct using unsafe ptr::read
- Critical for map operations to avoid double-dropping

**map()** (L76-90)
- Transforms guard to view different data component
- Uses skip_drop to avoid releasing lock prematurely
- Returns new guard with updated data pointer

**try_map()** (L123-140)
- Conditional mapping that can fail
- Returns Result with original guard on closure failure
- Same ownership transfer pattern as map()

**rwlock()** (L164-166)
- Accessor for the underlying Arc<RwLock<T>> reference

## Trait Implementations

**Deref** (L169-175)
- Provides transparent access to protected data via unsafe dereference

**Debug/Display** (L177-193)
- Forward formatting to the protected data

**Drop** (L195-207)
- Releases read lock by calling `self.lock.s.release(1)`
- Includes optional tracing for observability

## Key Invariants
- Data pointer must remain valid while guard exists
- Lock must be held in read mode throughout guard lifetime
- Arc reference prevents lock deallocation
- skip_drop prevents double-release during transformations

## Dependencies
- `crate::sync::rwlock::RwLock` - The lock implementation
- `std::sync::Arc` - Reference counting for ownership
- `tracing` (conditional) - Runtime observability
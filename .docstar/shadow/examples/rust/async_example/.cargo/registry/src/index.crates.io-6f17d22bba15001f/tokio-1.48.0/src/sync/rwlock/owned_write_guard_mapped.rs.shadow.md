# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/rwlock/owned_write_guard_mapped.rs
@source-hash: d48e8d258c8560fd
@generated: 2026-02-09T18:03:19Z

## Purpose
RAII guard for owning exclusive write access to a mapped portion of RwLock data. This guard is created by mapping an `OwnedRwLockWriteGuard` to focus on a subset of the locked data. Cannot be downgraded to prevent undefined behavior.

## Key Types and Fields

### OwnedRwLockMappedWriteGuard<T, U> (L16-25)
Primary struct providing exclusive access to mapped portion of RwLock data:
- `permits_acquired: u32` (L21) - Number of write permits held
- `lock: Arc<RwLock<T>>` (L22) - Reference to original lock
- `data: *mut U` (L23) - Raw pointer to mapped data subset
- `_p: PhantomData<T>` (L24) - Phantom data for type safety
- `resource_span: tracing::Span` (L20) - Conditional tracing span

### Inner<T, U> (L28-34)
Helper struct for transferring ownership during mapping operations, mirroring guard fields but with `*const U` data pointer.

## Core Methods

### skip_drop() (L37-50)
Internal method that transfers ownership without triggering Drop, using `ManuallyDrop` and unsafe pointer reads to create `Inner` struct.

### map<F, V>() (L85-100) 
Maps guard to different data subset using closure `F: FnOnce(&mut U) -> &mut V`. Creates new guard pointing to mapped data while preserving lock ownership.

### try_map<F, V>() (L136-157)
Fallible version of map that returns `Result<Guard, Self>`. Returns original guard if mapping closure returns `None`.

### rwlock() (L180-182)
Returns reference to underlying `Arc<RwLock<T>>` for lock identification.

## Trait Implementations

### Deref/DerefMut (L185-197)
Provides transparent access to guarded data through unsafe pointer dereferencing.

### Debug/Display (L199-215) 
Delegates formatting to underlying data type.

### Drop (L217-229)
Releases write permits via `self.lock.s.release()` and optionally logs tracing events.

## Safety and Design Constraints
- Raw pointer `data` requires careful lifetime management
- `skip_drop()` prevents double-drop through `ManuallyDrop`
- Mapping operations preserve lock ownership while changing data focus
- Cannot be downgraded due to potential undefined behavior with mapped guards
- Uses `#[clippy::has_significant_drop]` annotation for static analysis

## Dependencies
- `std::sync::Arc` for shared ownership
- `crate::sync::rwlock::RwLock` for underlying lock mechanism  
- Optional `tracing` integration for runtime resource monitoring
# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/loom/std/atomic_usize.rs
@source-hash: dba5a8481b51953a
@generated: 2026-02-09T18:02:52Z

## AtomicUsize (L7-59)

Tokio's loom testing framework wrapper for `std::sync::atomic::AtomicUsize` that provides additional unsafe operations for performance-critical scenarios.

**Primary Purpose**: Extends standard atomic usize operations with an unsafe unsynchronized load operation (`unsync_load`) while maintaining thread safety guarantees through careful API design.

### Key Components

- **Inner Storage (L8)**: `UnsafeCell<std::sync::atomic::AtomicUsize>` - wraps the standard atomic in an unsafe cell to enable additional access patterns
- **Constructor (L17-20)**: `new(val: usize)` - const constructor that initializes the wrapped atomic
- **Unsafe Load (L28-30)**: `unsync_load()` - bypasses atomic synchronization for performance, requires caller to guarantee no concurrent mutations
- **Mutable Access (L32-35)**: `with_mut()` - provides safe mutable access to the underlying value when exclusive reference is held

### Safety Traits (L11-14)
Implements `Send`, `Sync`, `RefUnwindSafe`, and `UnwindSafe` to maintain thread safety contracts despite the `UnsafeCell` wrapper.

### Deref Implementation (L38-53)
- **Deref (L38-46)**: Provides transparent access to standard `AtomicUsize` methods through immutable dereferencing
- **DerefMut (L48-53)**: Enables mutable access to standard atomic operations when exclusive reference is held

### Critical Invariants
- `unsync_load` requires all mutations to complete before the call and no concurrent mutations during execution
- Deref operations maintain atomicity guarantees by never performing unsafe mutations on shared references
- `with_mut` is safe because it requires exclusive mutable access

**Architecture Pattern**: This is a common loom pattern for extending standard library atomics with testing-friendly unsafe operations while preserving the standard API through deref coercion.
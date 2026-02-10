# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/mutex.rs
@source-hash: f5ca224054d774db
@generated: 2026-02-09T18:06:52Z

## Tokio Async Mutex Implementation

**Primary Purpose**: Implements an async-friendly Mutex that can be held across `.await` points, providing FIFO-ordered exclusive access to protected data.

**Core Architecture**: Built on top of a semaphore (`batch_semaphore`) with capacity 1, using `UnsafeCell<T>` for interior mutability and optional tracing support.

### Key Types

**Main Mutex (L133-138)**:
- `Mutex<T>`: Core async mutex with semaphore, unsafe cell, and optional tracing span
- FIFO ordering guaranteed for lock acquisition
- Safe to send/share across threads when `T: Send`

**Guard Types**:
- `MutexGuard<'a, T>` (L151-157): Borrowed guard, automatically releases on drop
- `OwnedMutexGuard<T>` (L175-181): Arc-based guard with 'static lifetime
- `MappedMutexGuard<'a, T>` (L190-199): Guard for mapped subfields, holds raw pointer
- `OwnedMappedMutexGuard<T, U>` (L209-216): Arc-based mapped guard

**Helper Types**:
- `TryLockError` (L293): Error for failed non-blocking lock attempts
- Various `*Inner` structs (L221-253): Used in `skip_drop` implementations

### Core Methods

**Mutex Construction**:
- `new(t: T)` (L338-375): Creates instrumented mutex with tracing
- `const_new(t: T)` (L395-405): Creates non-instrumented const mutex

**Lock Acquisition**:
- `lock()` (L434-466): Async lock with FIFO ordering, cancellation-safe
- `lock_owned(Arc<Self>)` (L618-653): Returns owned guard
- `blocking_lock()` (L520-522): Synchronous lock using `block_on`
- `try_lock()` (L682-703): Non-blocking attempt

**Data Access**:
- `get_mut(&mut self)` (L722-724): Direct mutable access when exclusively borrowed
- `into_inner(self)` (L787-792): Consumes mutex, returns data

### Guard Operations

**Mapping Operations**:
- `MutexGuard::map()` (L869-883): Creates mapped guard for subfield
- `MutexGuard::try_map()` (L918-935): Fallible mapping
- Similar operations for `OwnedMutexGuard` and mapped variants

**Resource Management**:
- All guards implement `Drop` to release semaphore permit
- `skip_drop()` methods prevent double-release during transformations
- Guards implement `Deref`/`DerefMut` for transparent data access

### Safety Considerations

**Concurrency Safety**:
- No lock poisoning on panic (unlike std::sync::Mutex)
- Guards are `Send + Sync` when appropriate
- Raw pointers in mapped guards require careful lifetime management

**Memory Safety**:
- Uses `ManuallyDrop` and `ptr::read` in `skip_drop` implementations
- `UnsafeCell` access protected by semaphore invariants
- PhantomData ensures proper variance for mapped guards

### Tracing Integration

Conditional tracing support (L4-5, L342-374):
- Resource span tracking for tokio-console integration
- State updates logged on lock/unlock operations
- Async operation tracing for lock acquisition

### Usage Patterns

Designed for protecting I/O resources rather than plain data. Prefers std::sync::Mutex for CPU-bound operations. Supports wrapping in Arc for shared ownership across tasks.
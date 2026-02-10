# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/rwlock.rs
@source-hash: 41258ad275ad40e0
@generated: 2026-02-09T18:06:54Z

## Primary Purpose
Implements Tokio's asynchronous reader-writer lock (`RwLock<T>`) that allows multiple concurrent readers or exclusive writer access with fair priority policy to prevent writer starvation.

## Core Architecture
The RwLock uses a semaphore-based design where:
- **Semaphore coordination**: Uses `batch_semaphore::Semaphore` (L96) to manage access permits
- **Reader permits**: Each reader acquires 1 permit from the semaphore
- **Writer exclusivity**: Writers acquire ALL available permits (`self.mr`) to ensure exclusivity
- **Fair queuing**: FIFO queue prevents reader starvation of writers

## Key Structure
**RwLock<T>** (L88-100):
- `mr: u32` - Maximum concurrent readers (L93)
- `s: Semaphore` - Core synchronization primitive (L96) 
- `c: UnsafeCell<T>` - Protected data storage (L99)
- `resource_span: tracing::Span` - Optional tracing instrumentation (L90)

## Constructor Methods
- **`new(value: T)`** (L204-254): Standard constructor with tracing support
- **`with_max_readers(value: T, max_reads: u32)`** (L271-327): Custom reader limit constructor
- **`const_new(value: T)`** (L347-358): Compile-time constructor without tracing
- **`const_with_max_readers(value: T, max_reads: u32)`** (L371-384): Compile-time constructor with custom limit

## Lock Acquisition Methods

### Read Access
- **`read()`** (L431-470): Async shared read lock, returns `RwLockReadGuard`
- **`read_owned()`** (L579-621): Async shared read lock for `Arc<Self>`, returns `OwnedRwLockReadGuard`
- **`try_read()`** (L655-680): Non-blocking read attempt
- **`try_read_owned()`** (L720-745): Non-blocking read attempt for `Arc<Self>`
- **`blocking_read()`** (L524-526): Synchronous blocking read

### Write Access  
- **`write()`** (L775-815): Async exclusive write lock, returns `RwLockWriteGuard`
- **`write_owned()`** (L910-953): Async exclusive write lock for `Arc<Self>`, returns `OwnedRwLockWriteGuard`
- **`try_write()`** (L978-1004): Non-blocking write attempt
- **`try_write_owned()`** (L1036-1062): Non-blocking write attempt for `Arc<Self>`
- **`blocking_write()`** (L871-873): Synchronous blocking write

### Utility Methods
- **`get_mut()`** (L1081-1083): Direct mutable access via exclusive borrow
- **`into_inner()`** (L1086-1091): Consumes lock, returns inner value

## Guard Types (Imported)
All guard types are defined in separate modules (L10-21):
- `RwLockReadGuard` / `OwnedRwLockReadGuard` - Shared access guards
- `RwLockWriteGuard` / `OwnedRwLockWriteGuard` - Exclusive access guards  
- `RwLockMappedWriteGuard` / `OwnedRwLockMappedWriteGuard` - Mapped write guards

## Thread Safety Implementation
Comprehensive `unsafe impl` blocks (L149-191) establish Send/Sync bounds:
- RwLock requires `T: Send + Sync` for thread sharing
- Guards have specific Send/Sync requirements based on access type and ownership model
- Write guards require `T: Send` since they provide mutable access across threads

## Key Constants
- **MAX_READS** (L24/L27): Platform-dependent reader limit (u32::MAX >> 3 normal, 10 for loom testing)

## Tracing Integration
Optional tracing support via `tokio_unstable` feature provides resource monitoring and state updates throughout lock lifecycle.

## Critical Invariants
- Write lock acquires all permits (mr) to ensure exclusivity
- Reader count limited by MAX_READS to prevent overflow
- Fair scheduling prevents writer starvation via FIFO queue
- UnsafeCell provides interior mutability with external synchronization guarantees
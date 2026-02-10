# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/semaphore.rs
@source-hash: 890da65eb3135613
@generated: 2026-02-09T18:06:53Z

**Purpose:** Implements Tokio's asynchronous counting semaphore for controlling access to shared resources through permit-based synchronization.

**Architecture:** Built as a wrapper around low-level batch semaphore implementation (`ll::Semaphore`) with optional tracing instrumentation for tokio-console visibility.

## Core Types

**Semaphore (L398-403)** - Main counting semaphore struct
- `ll_sem: ll::Semaphore` - Underlying batch semaphore implementation  
- `resource_span: tracing::Span` - Optional tracing span (tokio_unstable + tracing feature)
- Fair permit distribution using FIFO queue semantics
- Maximum permits: `usize::MAX >> 3` (L447-450)

**SemaphorePermit<'a> (L413-416)** - Borrowed permit with lifetime tied to semaphore
- `sem: &'a Semaphore` - Reference to originating semaphore
- `permits: u32` - Number of permits held
- Auto-releases permits on drop (L1196-1200)

**OwnedSemaphorePermit (L426-429)** - Owned permit for cross-task usage
- `sem: Arc<Semaphore>` - Owned reference to semaphore  
- `permits: u32` - Number of permits held
- Auto-releases permits on drop (L1202-1206)

## Key Operations

**Construction:**
- `new(permits)` (L456-484) - Creates instrumented semaphore
- `const_new(permits)` (L504-510) - Creates non-instrumented const semaphore
- `new_closed()/const_new_closed()` (L513-529) - Creates closed semaphores

**Permit Acquisition (async):**
- `acquire()` (L585-602) - Acquires single permit, returns `SemaphorePermit<'_>`
- `acquire_many(n)` (L632-650) - Acquires n permits
- `acquire_owned()` (L767-784) - Returns `OwnedSemaphorePermit` for Arc<Semaphore>
- `acquire_many_owned(n)` (L828-848) - Owned version of acquire_many

**Permit Acquisition (sync):**
- `try_acquire()` (L680-688) - Non-blocking single permit acquisition
- `try_acquire_many(n)` (L715-723) - Non-blocking n permits
- `try_acquire_owned()` (L882-890) - Owned try_acquire
- `try_acquire_many_owned(n)` (L921-932) - Owned try_acquire_many

**Management:**
- `add_permits(n)` (L539-541) - Adds permits to semaphore
- `forget_permits(n)` (L547-549) - Removes permits, returns actual removed count
- `available_permits()` (L532-534) - Returns current available permits
- `close()` (L963-965) - Closes semaphore, notifies waiting tasks
- `is_closed()` (L967-970) - Checks if semaphore is closed

## Permit Operations

**SemaphorePermit methods:**
- `forget()` (L995-997) - Consumes permit without releasing back to semaphore
- `merge(other)` (L1032-1039) - Combines permits from same semaphore, panics if different semaphores
- `split(n)` (L1059-1072) - Splits permit into two, returns new permit with n permits
- `num_permits()` (L1075-1077) - Returns number of permits held

**OwnedSemaphorePermit methods:**
- `forget()` (L1102-1104) - Owned version of forget
- `merge(other)` (L1139-1146) - Owned version of merge using `Arc::ptr_eq`
- `split(n)` (L1170-1183) - Owned version of split, clones Arc
- `semaphore()` (L1185-1188) - Returns reference to Arc<Semaphore>
- `num_permits()` (L1191-1193) - Returns permit count

## Critical Properties

**Fairness:** FIFO permit distribution - requests served in acquisition order, even with `acquire_many` blocking smaller requests.

**Cancel Safety:** All acquire methods lose queue position on cancellation, documented in each async method.

**Error Handling:** 
- Returns `AcquireError` when semaphore is closed
- Returns `TryAcquireError::{NoPermits, Closed}` for try_* methods

**Tracing Integration:** Conditional compilation provides tokio-console visibility when `tokio_unstable` + `tracing` features enabled.

**Resource Management:** Automatic permit release on drop for both permit types, with explicit `forget()` to prevent release.
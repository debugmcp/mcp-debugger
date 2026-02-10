# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/sync_rwlock.rs
@source-hash: 3f2509c6d30ac4d2
@generated: 2026-02-09T18:12:36Z

## Purpose

Test suite for Tokio's async RwLock synchronization primitive, validating concurrent read/write access patterns, blocking behavior, and guard functionality through comprehensive unit and integration tests.

## Key Test Categories

### Basic Operations (L20-24)
- `into_inner()`: Validates basic RwLock construction and value extraction

### Concurrent Access Patterns (L27-122)
- `read_shared()` (L28-35): Tests multiple concurrent readers can acquire lock
- `write_shared_pending()` (L39-46): Verifies writers block when readers exist
- `read_exclusive_pending()` (L50-57): Confirms readers block when writer exists  
- `write_exclusive_pending()` (L83-90): Tests writers block other writers
- `exhaust_reading()` (L62-79): Tests max reader limit with `with_max_readers(100, 1024)`

### Lock Ordering & Priority (L94-141)
- `write_shared_drop()` (L94-104): Tests writer unblocks when readers drop
- `write_read_shared_pending()` (L109-122): Validates writer priority blocks new readers
- `write_read_shared_drop_pending()` (L127-141): Tests reader recovery after pending writer drops

### Async Operations (L144-172)
- `read_uncontested()` (L145-150): Basic async read access
- `write_uncontested()` (L154-159): Basic async write with mutation
- `write_order()` (L163-172): Validates FIFO ordering of write futures

### Multithreaded Stress Test (L175-249)
- `multithreaded()`: Uses 4 spawned tasks with barrier synchronization, each performing 1000 write operations with different increments (2, 3, 5, 7), expects final value of 17,000

### Try Methods (L252-282)
- `try_write()` (L252-258): Tests non-blocking write attempts
- `try_read_try_write()` (L261-282): Comprehensive try_read/try_write interaction patterns

### Guard Downgrading (L285-332)
- `downgrade_map()` (L285-304): Tests write-to-read guard downgrading with mapping function
- `try_downgrade_map()` (L307-332): Tests conditional downgrading that can fail

## Key Dependencies

- `tokio::sync::{RwLock, RwLockWriteGuard}` - Core async RwLock types
- `tokio_test::{spawn, assert_pending, assert_ready}` - Async test utilities for polling futures
- `futures::future::FutureExt` - Future combinators for mapping
- Platform-specific test macros for WASM vs native environments

## Testing Patterns

Uses `spawn()` to create testable futures that can be manually polled, enabling precise control over async execution timing. Tests rely heavily on `assert_pending!()` and `assert_ready!()` macros to validate expected blocking/non-blocking behavior.

## Architecture Notes

- RwLock uses semaphore-based implementation allowing configurable max readers
- Write operations gather all available permits to ensure exclusivity
- Guard downgrading maintains memory safety through mapping functions
- Priority system prevents reader starvation when writers are pending
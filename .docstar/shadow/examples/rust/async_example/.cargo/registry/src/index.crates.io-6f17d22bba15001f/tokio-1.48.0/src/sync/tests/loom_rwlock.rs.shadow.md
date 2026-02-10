# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/tests/loom_rwlock.rs
@source-hash: 80ec00bdcac83880
@generated: 2026-02-09T18:03:22Z

**Purpose**: Loom-based concurrency testing for Tokio's async RwLock implementation. Uses deterministic execution modeling to verify thread-safety properties under various concurrent access patterns.

**Dependencies**:
- `crate::sync::rwlock::*` - Tokio's async RwLock implementation under test
- `loom` - Deterministic concurrency testing framework for model checking
- `std::sync::Arc` - Reference counting for shared ownership

**Test Functions**:

**`concurrent_write` (L7-36)**: 
- Tests two threads performing concurrent write operations
- Thread 1 uses `write().await` (L17-18), Thread 2 uses `write_owned().await` (L25-26)
- Both increment shared u32 value by 5
- Verifies final value equals 10, ensuring both writes complete atomically
- Uses `loom::model::Builder` for systematic execution exploration

**`concurrent_read_write` (L38-84)**:
- Complex scenario with 2 writers + 2 readers running concurrently
- Writers: same pattern as concurrent_write test (L46-58)
- Readers: one spawned thread (L61-68) and one main thread operation (L70-74)
- Reader assertions allow intermediate values (0, 5, or 10) due to race conditions
- Final assertion ensures writers completed (value = 10)

**`downgrade` (L85-105)**:
- Tests write guard downgrade to read guard functionality
- Main thread acquires write guard, spawns competing writer thread (L93-96)
- Downgrades write guard to read guard (L98), verifies original value preserved
- Dropping downgraded guard allows competing writer to proceed
- Verifies final state after all operations complete

**Key Patterns**:
- All tests use `Arc<RwLock<u32>>` for shared state
- Consistent use of `block_on()` for async operation execution in loom context
- Thread spawning with `.clone()` for shared ownership transfer
- Systematic exploration of concurrent interleavings via loom model checking
- Tests both borrowed (`write()`, `read()`) and owned (`write_owned()`, `read_owned()`) guard variants
# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/tracing_sync.rs
@source-hash: 76c5fc3f1e0cdbc4
@generated: 2026-02-09T18:12:35Z

**Primary Purpose:** Test suite for Tokio synchronization primitive instrumentation tracing, verifying that sync objects emit correct spans and events when tracing is enabled.

**Key Test Functions:**
- `test_barrier_creates_span` (L11-44): Validates that `sync::Barrier::new(1)` creates proper runtime resource span with size and arrived events
- `test_mutex_creates_span` (L46-88): Tests `sync::Mutex::new()` instrumentation including mutex span and associated batch_semaphore span with permits tracking
- `test_oneshot_creates_span` (L90-187): Most complex test for `sync::oneshot::channel()` covering tx/rx dropped states, value sent/received events, and async operation spans with polling instrumentation
- `test_rwlock_creates_span` (L189-243): Verifies `sync::RwLock::new()` creates spans with max_readers, write_locked, current_readers events plus batch_semaphore instrumentation
- `test_semaphore_creates_span` (L245-282): Tests `sync::Semaphore::new()` span creation with nested batch_semaphore span and permits tracking

**Dependencies:**
- `tokio::sync` - The synchronization primitives being tested
- `tracing_mock::{expect, subscriber}` - Mock tracing infrastructure for test assertions

**Architectural Pattern:**
Each test follows identical structure:
1. Define expected spans with specific targets (e.g., "tokio::sync::barrier", "tokio::sync::mutex")
2. Define expected events with "runtime::resource::state_update" target and specific field values
3. Build mock subscriber with expected sequence of span/event operations
4. Execute sync primitive construction within tracing guard scope
5. Assert all expected tracing activity occurred

**Key Tracing Targets:**
- Resource spans: "tokio::sync::{primitive_name}"
- State events: "runtime::resource::state_update" 
- Async operations: "runtime.resource.async_op" and "runtime.resource.async_op.poll"

**Critical Constraints:**
- Only runs with `tokio_unstable`, `tracing` feature, and 64-bit atomics (L6)
- Tests verify exact tracing instrumentation behavior for runtime resource monitoring
- Mock subscriber must match precise sequence of span enter/exit/drop operations
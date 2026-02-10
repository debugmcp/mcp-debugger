# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/tests/semaphore_batch.rs
@source-hash: 0353ff4fedf668c2
@generated: 2026-02-09T18:03:33Z

## Test Suite for Batch Semaphore Implementation

Comprehensive test suite for `batch_semaphore::Semaphore` focusing on multi-permit acquisition patterns and edge cases.

### Primary Purpose
Tests the batch semaphore variant that supports acquiring multiple permits in a single operation, validating both synchronous and asynchronous acquisition patterns, permit release mechanics, and semaphore lifecycle management.

### Key Test Categories

**Basic Acquisition Tests (L9-54)**
- `poll_acquire_one_available` (L10-17): Tests immediate permit acquisition when permits available
- `poll_acquire_many_available` (L20-30): Tests batch permit acquisition (5 permits at once)
- `try_acquire_one_available` (L33-42): Tests synchronous single permit acquisition
- `try_acquire_many_available` (L45-54): Tests synchronous batch permit acquisition

**Contention and Blocking Tests (L57-115)**
- `poll_acquire_one_unavailable` (L57-78): Tests task parking/waking when permits exhausted
- `poll_acquire_many_unavailable` (L81-115): Complex test validating batch acquisition queuing and fairness - demonstrates that larger requests (5 permits) get satisfied before smaller ones (3 permits) when sufficient permits become available

**Synchronous Failure Tests (L117-156)**
- `try_acquire_one_unavailable` (L118-134): Validates immediate failure when permits unavailable
- `try_acquire_many_unavailable` (L137-156): Tests batch try_acquire failure modes

**Zero-Permit Edge Case (L158-171)**
- `poll_acquire_one_zero_permits` (L159-171): Tests semaphore initialized with 0 permits

**Validation and Limits (L173-183)**
- `max_permits_doesnt_panic` (L174-176): Validates MAX_PERMITS constant works
- `validates_max_permits` (L179-183): Tests panic on exceeding MAX_PERMITS (non-WASM only)

**Semaphore Closure Tests (L185-244)**
- `close_semaphore_prevents_acquire` (L186-197): Tests that closed semaphores reject new acquisitions
- `close_semaphore_notifies_permit1` (L200-210): Tests pending tasks get notified on close
- `close_semaphore_notifies_permit2` (L213-244): Tests multiple pending tasks notification on close

**Advanced Scenarios (L246-310)**
- `cancel_acquire_releases_permits` (L247-260): Tests that dropped acquisition futures release reserved permits
- `release_permits_at_drop` (L263-289): Complex test using custom ArcWake to test permit cleanup on drop
- `forget_permits_basic` (L292-298): Tests `forget_permits` functionality for permanently reducing semaphore capacity
- `update_permits_many_times` (L301-310): Tests dynamic permit manipulation during pending acquisitions

### Key Dependencies
- `crate::sync::batch_semaphore::Semaphore`: The batch-capable semaphore implementation being tested
- `tokio_test::*`: Provides async test utilities (`task::spawn`, `assert_ready_ok!`, `assert_pending!`)
- WASM compatibility layer (L6-7): Conditional compilation for WASM environments

### Critical Testing Patterns
- **Task parking verification**: Uses `acquire.is_woken()` to verify proper task notification
- **Permit counting validation**: Extensive use of `available_permits()` to verify internal state
- **Batch operation focus**: Unlike standard semaphore tests, emphasizes multi-permit operations
- **Fairness testing**: Validates that larger batch requests don't starve when permits become available

### Architectural Notes
- Tests both the async (`acquire()`) and sync (`try_acquire()`) APIs
- Validates proper cleanup behavior when acquisition futures are dropped
- Tests permit release mechanics work correctly with batch operations
- Uses `MAX_PERMITS` constant from parent semaphore implementation for boundary testing
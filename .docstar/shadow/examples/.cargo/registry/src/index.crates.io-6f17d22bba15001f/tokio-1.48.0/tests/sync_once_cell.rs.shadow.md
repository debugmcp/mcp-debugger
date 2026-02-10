# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/sync_once_cell.rs
@source-hash: 435865e2d53a528c
@generated: 2026-02-09T18:12:35Z

**Primary Purpose**: Comprehensive test suite for Tokio's `OnceCell` synchronization primitive, verifying thread-safe lazy initialization, drop behavior, error handling, and concurrent access patterns.

**Key Dependencies**:
- `tokio::sync::OnceCell`: Thread-safe once-only initialization cell
- `tokio::runtime`: Async runtime for testing concurrent scenarios
- `tokio::time`: Time manipulation utilities for deterministic testing
- `std::sync::atomic::AtomicU32`: Thread-safe counter for drop tracking

**Test Helper Types**:
- `Foo` struct (L13-27): Drop-counting wrapper with `AtomicU32` to track destructor calls
  - Implements `Drop` to increment counter on destruction (L17-21)
  - `From<Arc<AtomicU32>>` conversion for easy construction (L23-27)

**Core Test Categories**:

1. **Drop Behavior Tests** (L29-76):
   - `drop_cell` (L29-38): Verifies stored value is dropped when `OnceCell` is dropped
   - `drop_cell_new_with` (L40-48): Tests drop behavior with pre-initialized cell
   - `drop_into_inner` (L50-62): Confirms `into_inner()` transfers ownership without dropping
   - `drop_into_inner_new_with` (L64-76): Same test but with pre-initialized cell

2. **Basic Functionality Tests**:
   - `from` (L78-82): Tests `From` trait implementation for direct initialization
   - `get_uninit` (L185-190): Verifies `get()` returns `None` for uninitialized cell
   - `set_twice` (L192-200): Ensures second `set()` call fails with `AlreadyInitError`

3. **Async Helper Functions** (L84-117):
   - `func1`/`func2`: Simple async initializers returning different values
   - `func_err`/`func_ok`: Result-returning functions for testing `get_or_try_init`
   - `func_panic`: Panicking initializer for error handling tests
   - `sleep_and_set`/`advance_time_and_set`: Time-based functions for concurrency testing

4. **Concurrent Access Tests**:
   - `get_or_init` (L119-142): Multiple tasks racing to initialize, first wins
   - `get_or_init_panic` (L144-167): Panic in one initializer doesn't prevent others
   - `set_and_get` (L169-183): Basic set/get operations in async context
   - `set_while_initializing` (L202-225): `set()` fails with `InitializingError` during initialization
   - `get_or_try_init` (L227-249): Fallible initialization with error recovery

**Testing Patterns**:
- Uses single-threaded runtime with time control for deterministic testing
- Static `OnceCell` instances ensure proper cleanup between tests
- Time manipulation (`pause`, `advance`, `resume`) for controlled concurrency
- Drop counting pattern ensures proper resource cleanup
- Error type verification using `is_already_init_err()` and `is_initializing_err()`

**Critical Invariants**:
- Only one initialization succeeds across all concurrent attempts
- Stored values are properly dropped when cell is dropped
- Failed initializations don't prevent subsequent successful ones
- `into_inner()` transfers ownership without triggering destructors
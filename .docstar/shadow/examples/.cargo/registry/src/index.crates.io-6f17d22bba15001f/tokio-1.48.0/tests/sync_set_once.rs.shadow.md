# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/sync_set_once.rs
@source-hash: 4ba4b76529c3bc13
@generated: 2026-02-09T18:12:34Z

## Purpose
Test suite for `tokio::sync::SetOnce` primitive, validating thread-safe single-initialization semantics, drop behavior, and async coordination capabilities.

## Key Components

### DropCounter (L10-31)
Test utility struct that tracks drop events using atomic counters for verifying resource cleanup.
- `new()` (L16-20): Creates instance with zero drop counter
- `assert_num_drops()` (L22-24): Validates expected number of drops occurred
- `Drop` impl (L27-31): Increments atomic counter on drop

## Test Categories

### Drop Behavior Tests (L33-80)
- `drop_cell` (L33-45): Verifies SetOnce drops contained value when cell goes out of scope
- `drop_cell_new_with` (L47-57): Tests drop behavior when SetOnce initialized with `new_with()`
- `drop_into_inner` (L59-69): Validates `into_inner()` transfers ownership without dropping
- `drop_into_inner_new_with` (L71-80): Same as above but with `new_with()` initialization

### Basic API Tests (L82-95)
- `from` (L82-86): Tests `From<T>` trait implementation
- `set_and_get` (L88-95): Basic synchronous set/get operations using static SetOnce

### Async Coordination Tests (L97-134)
- `set_and_wait` (L97-105): Tests async waiting with `wait()` method
- `set_and_wait_multiple_threads` (L107-120): Validates thread-safe concurrent set attempts
- `set_and_wait_threads` (L122-134): Cross-thread async/sync coordination

### Edge Cases (L136-179)
- `get_uninit` (L136-141): Behavior when accessing uninitialized SetOnce
- `set_twice` (L143-151): Error handling for duplicate initialization attempts  
- `is_none_initializing` (L153-162): State transitions during initialization
- `is_some_initializing` (L164-171): Async state observation
- `into_inner_int_empty_setonce` (L173-179): Extracting value from empty SetOnce

## Key Dependencies
- `tokio::sync::SetOnce`: Primary test target
- `std::sync::{atomic::AtomicU32, Arc}`: For thread-safe drop counting
- Standard threading and async runtime facilities

## Notable Patterns
- Uses static SetOnce instances for testing global initialization semantics
- Employs atomic reference counting to verify precise drop behavior
- Tests both sync and async API surfaces comprehensively
- WASM compatibility considerations with conditional test ignoring
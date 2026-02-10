# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/task_blocking.rs
@source-hash: 8609cace4ff03c8a
@generated: 2026-02-09T18:12:36Z

**Primary Purpose:**
Comprehensive test suite for Tokio's blocking task functionality, testing `spawn_blocking` and `block_in_place` across different runtime configurations and edge cases.

**Key Test Categories:**

1. **Basic Blocking Operations (L14-33)**
   - `basic_blocking()`: Tests basic `spawn_blocking` with thread sleep, validates async-to-sync bridge works correctly with 100 iterations

2. **Nested Blocking Scenarios (L35-76)**
   - `block_in_blocking()` (L35-56): Tests `block_in_place` within `spawn_blocking` on multi-thread runtime
   - `block_in_block()` (L58-76): Tests nested `block_in_place` calls

3. **Runtime Constraint Tests (L78-99)**
   - `no_block_in_current_thread_scheduler()` (L78-82): Ensures `block_in_place` panics on current-thread scheduler
   - `yes_block_in_threaded_block_on()` (L84-90): Validates `block_in_place` works in multi-thread `block_on`
   - `no_block_in_current_thread_block_on()` (L92-99): Ensures panic with current-thread runtime

4. **Nested Runtime Tests (L101-163)**
   - `can_enter_current_thread_rt_from_within_block_in_place()` (L101-114): Tests creating inner runtime within `block_in_place`
   - `useful_panic_message_when_dropping_rt_in_rt()` (L116-139): Validates proper error message when dropping runtime in runtime
   - Runtime shutdown tests (L141-163): Tests `shutdown_timeout` and `shutdown_background` behavior

5. **Cooperative Scheduling Tests (L165-228)**
   - `coop_disabled_in_block_in_place()` (L165-194): Verifies cooperative scheduling is disabled in `block_in_place`
   - `coop_disabled_in_block_in_place_in_block_on()` (L196-228): Similar test with explicit thread spawning for timeout handling

6. **Paused Runtime Tests (L230-310, feature-gated)**
   - `blocking_when_paused()` (L231-253): Tests that blocking tasks don't auto-advance paused time
   - `blocking_task_wakes_paused_runtime()` (L256-270): Tests blocking tasks wake paused scheduler
   - `unawaited_blocking_task_wakes_paused_runtime()` (L273-289): Tests unawaited blocking tasks still wake scheduler
   - `panicking_blocking_task_wakes_paused_runtime()` (L293-310): Tests panicking blocking tasks wake scheduler

**Key Dependencies:**
- `tokio`: Core async runtime and task APIs
- `tokio_test::assert_ok`: Test assertion helper
- `support::mpsc_stream` (L10-12): Internal test utility for stream testing
- `std::thread`, `std::time`: Standard blocking primitives
- `futures::executor` and `tokio_stream` for cooperative scheduling tests

**Architecture Patterns:**
- Extensive use of `#[should_panic]` for negative testing
- Feature gates (`#[cfg]`) for platform/feature-specific tests
- Repetitive testing (100 iterations) for race condition detection
- Timeout-based testing with manual thread spawning for reliability
- Real-time measurement in paused runtime tests

**Critical Constraints:**
- WASI and Miri excluded due to threading limitations (L2)
- Multi-thread flavor required for `block_in_place` functionality
- Current-thread scheduler prohibits `block_in_place` operations
- Paused runtime behavior must not interfere with system time
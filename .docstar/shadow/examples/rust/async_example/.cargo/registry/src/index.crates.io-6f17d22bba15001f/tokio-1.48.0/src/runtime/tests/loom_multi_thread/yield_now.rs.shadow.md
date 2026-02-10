# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/tests/loom_multi_thread/yield_now.rs
@source-hash: fac610e464660c19
@generated: 2026-02-09T17:58:19Z

## Tokio Runtime Yield Behavior Test

This is a loom-based concurrency test that verifies the correct behavior of `tokio::task::yield_now()` in multi-threaded runtime scenarios.

**Primary Purpose**: Tests that `yield_now()` properly calls park before allowing a task to be scheduled again, ensuring correct yielding semantics in concurrent environments.

**Key Components**:
- **yield_calls_park_before_scheduling_again()** (L5-30): Main test function using loom model checking to verify yield behavior
  - Creates 2-thread runtime via `mk_runtime(2)` (L11)
  - Spawns async task that captures thread ID and park count before yielding (L14-26)
  - Uses oneshot channel for synchronization between spawned task and test thread (L12, L25, L28)
  - Verifies park count increments by exactly 1 when task yields and remains on same thread (L20-23)

- **mk_runtime()** (L32-37): Helper function creating multi-threaded Tokio runtime with specified worker thread count

**Dependencies**:
- `crate::runtime::park` - for accessing park count metrics
- `crate::runtime::tests::loom_oneshot` - for test synchronization
- `crate::runtime::Runtime` - for runtime creation
- `loom::model::Builder` - for concurrency model checking
- `crate::task::yield_now()` - the function under test

**Test Strategy**: 
- Uses loom's model checker with limited permutations (max 1) for efficient testing (L8-9)
- Captures thread ID before and after yield to detect thread migration
- Only validates park count increment when task stays on same thread (avoiding cross-thread park count comparison issues)

**Critical Invariant**: When `yield_now()` is called and the task remains on the same thread, the park count must increment by exactly 1, indicating proper yielding behavior.
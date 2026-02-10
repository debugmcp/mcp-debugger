# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/time_panic.rs
@source-hash: 6df845dbe6b96479
@generated: 2026-02-09T18:12:35Z

## Purpose
Test suite for Tokio time API panic handling and caller location tracking. Verifies that time-related functions panic with correct file location information when called inappropriately.

## Configuration & Dependencies
- Requires `full` feature flag and excludes WASI targets (L2)
- Uses `panic = "unwind"` configuration (L3)
- Dependencies: futures, tokio runtime/time modules (L5-9)
- Imports panic testing utilities from `support::panic` module (L11-14)

## Test Functions

### `pause_panic_caller()` (L16-31)
Tests that calling `time::pause()` twice in sequence panics with correct caller location. Uses current thread runtime and verifies panic originates from this test file.

### `resume_panic_caller()` (L33-47)  
Tests that calling `time::resume()` without prior pause panics with correct caller location. Validates panic location tracking for resume operations.

### `interval_panic_caller()` (L49-59)
Tests that creating an interval with zero duration (`Duration::from_millis(0)`) panics appropriately. Verifies panic location is correctly attributed to caller.

### `interval_at_panic_caller()` (L61-71)
Tests that creating an interval starting at a specific instant with zero duration panics. Similar validation pattern to other interval tests.

### `timeout_panic_caller()` (L73-87)
Tests timeout functionality panic behavior when no timer is enabled in the runtime. Creates runtime without `enable_time()` to trigger the panic condition.

## Helper Functions

### `current_thread()` (L89-94)
Factory function creating a current-thread runtime with all features enabled. Used by multiple tests to provide consistent runtime environment.

## Test Pattern
All tests follow identical pattern:
1. Use `test_panic()` wrapper to capture panic location
2. Execute time API operation expected to panic
3. Assert panic location matches current file using `file!()` macro
4. Return `Ok(())` on successful validation

## Key Architecture Notes
- Tests validate Tokio's panic location tracking mechanism
- Focuses on time-related APIs that have specific panic conditions
- Uses consistent error handling pattern with `Box<dyn Error>`
- Relies on external panic testing infrastructure from support module
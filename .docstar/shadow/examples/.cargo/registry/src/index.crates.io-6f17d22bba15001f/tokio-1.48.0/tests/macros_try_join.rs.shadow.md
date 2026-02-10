# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/macros_try_join.rs
@source-hash: 6d7f642f776a9c9b
@generated: 2026-02-09T18:12:22Z

**Test Suite for Tokio's `try_join!` Macro**

Comprehensive test file for the `tokio::try_join!` macro functionality, validating both eager and biased execution modes. The macro combines multiple fallible async operations, returning early on first error.

## Key Test Categories

**Basic Syntax and Behavior Tests (L15-49):**
- `sync_one_lit_expr_comma/no_comma` - Tests single future with/without trailing comma
- `sync_two_lit_expr_comma/no_comma` - Tests multiple futures with/without trailing comma
- All tests validate both normal and biased execution modes

**Async Coordination Tests (L52-91):**
- `two_await` (L52-69) - Tests concurrent execution with oneshot channels, verifies waking behavior and result ordering
- `err_abort_early` (L72-91) - Tests early termination on first error, validates that remaining futures are cancelled

**Memory Footprint Validation (L93-111, L225-243):**
- `try_join_size` - Validates future memory size on 64-bit platforms (32 bytes for 1 future, 48 for 2)
- `try_join_size_biased` - Similar validation for biased mode (24 bytes for 1, 40 for 2)

**Cooperative Scheduling Tests (L144-158, L161-223):**
- `try_join_does_not_allow_tasks_to_starve` - Uses semaphore-based tasks to verify fair scheduling
- `a_different_future_is_polled_first_every_time_poll_fn_is_polled` - Tests round-robin polling order
- `futures_are_polled_in_order_in_biased_mode` - Validates sequential polling in biased mode

**Edge Cases (L246-269):**
- `empty_try_join` - Tests zero-future macro invocation
- `caller_names_const_count` - Regression test for macro hygiene (issue #7637)

## Helper Functions

- `ok<T>` (L113-115) - Simple Result::Ok wrapper
- `non_cooperative_task` (L117-130) - Budget-exhausting task for scheduling tests
- `poor_little_task` (L132-142) - Lightweight task for fairness validation

## Dependencies and Architecture

- Uses conditional compilation for WASM vs native testing via `maybe_tokio_test` alias
- Leverages `tokio_test` for polling state assertions (`assert_pending`, `assert_ready`)
- Tests both default (round-robin) and biased execution strategies
- Validates macro hygiene to prevent variable shadowing in caller scope
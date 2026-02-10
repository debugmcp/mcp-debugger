# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/macros_select.rs
@source-hash: 5eb72ecdbb1fc20a
@generated: 2026-02-09T18:12:29Z

## Primary Purpose

Comprehensive test suite for Tokio's `select!` macro, verifying its behavior across different scenarios including basic operations, advanced patterns, biased selection, and edge cases. Tests are conditionally compiled for WASM environments and feature gates.

## Key Test Categories

### Basic Select Operations (L16-127)
- **sync_one_lit_expr_comma** (L17-23): Tests single branch with trailing comma
- **no_branch_else_only** (L26-32): Tests else-only select without futures
- **sync_one_await** (L74-80): Tests selecting on function call futures
- **sync_two** (L94-112): Tests race condition between two futures
- **drop_in_fut** (L115-127): Tests variable dropping within selected futures

### Channel Operations (L131-213)  
- **one_ready** (L131-145): Tests oneshot channels with immediate readiness
- **select_streams** (L149-187): Tests unbounded MPSC channels with spawn
- **move_uncompleted_futures** (L190-213): Tests moving futures after selection

### Advanced Patterns (L216-310)
- **nested** (L216-226): Tests nested select expressions
- **mutable_borrowing_future_with_same_borrow_in_block** (L281-292): Tests mutable references across branches
- **future_panics_after_poll** (L312-339): Tests panic handling in futures
- **disable_with_if** (L342-361): Tests conditional branch disabling

### Conditional Selection (L364-396)
- **join_with_select** (L364-396): Tests implementing join semantics with conditional selection

### Biased Selection (L537-594)
- **biased_one_not_ready** (L537-558): Tests deterministic branch ordering
- **biased_eventually_ready** (L562-594): Tests biased selection with yield points

### Memory Layout Tests (L228-278)
Platform-specific (64-bit) tests verifying select struct sizes:
- **struct_size_1/2/3** (L235-277): Validates memory layout optimizations

### Edge Cases and Regressions
- **many_branches** (L428-497): Tests macro with 64 branches
- **mut_on_left_hand_side** (L521-534): Tests mutable pattern matching
- **mut_ref_patterns** (L608-630): Tests ref/mut ref patterns
- **select_into_future** (L714-728): Tests IntoFuture trait integration
- **select_is_budget_aware** (L739-760): Tests cooperative scheduling budget

### Deterministic Selection Tests (L632-711)
Unstable feature tests for seeded RNG:
- **deterministic_select_current_thread** (L637-652): Single-threaded determinism
- **deterministic_select_multi_thread** (L656-695): Multi-threaded determinism

## Helper Functions (L508-517)
- **one()** (L508-510): Returns async 1
- **require_mutable()** (L512): Takes mutable reference
- **async_noop()** (L513): No-op async function  
- **async_never()** (L515-517): Never-resolving future

## Dependencies
- **tokio::sync::oneshot**: Channel operations
- **tokio::sync::mpsc**: Stream testing  
- **tokio_test**: Assertion utilities (assert_pending, assert_ready)
- **futures**: External future utilities
- **std::future**: Core future traits

## Platform Conditionals
- WASM compatibility layer (L4-8) using wasm_bindgen_test
- 64-bit pointer width tests for memory layout validation
- Feature gates for "full" and "macros" functionality
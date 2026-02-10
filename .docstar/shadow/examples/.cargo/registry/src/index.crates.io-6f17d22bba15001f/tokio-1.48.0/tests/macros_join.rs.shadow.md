# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/macros_join.rs
@source-hash: 20e20ad10dcef059
@generated: 2026-02-09T18:12:25Z

## Purpose
Test suite for Tokio's `join!` macro, validating macro syntax, execution semantics, memory efficiency, and cooperative scheduling behavior.

## Test Structure
File uses conditional compilation for WASM vs native environments (L5-12), with `maybe_tokio_test` attribute routing to appropriate test framework.

## Key Test Categories

### Syntax and Basic Functionality (L17-51)
- `sync_one_lit_expr_comma` (L18-24): Tests single future with trailing comma
- `sync_one_lit_expr_no_comma` (L27-33): Tests single future without trailing comma  
- `sync_two_lit_expr_comma` (L36-42): Tests two futures with trailing comma
- `sync_two_lit_expr_no_comma` (L45-51): Tests two futures without trailing comma
All variants test both normal and `biased` execution modes.

### Asynchronous Coordination (L54-73)
- `two_await` (L54-73): Tests concurrent execution using oneshot channels, validates that join waits for all futures and maintains proper wake-up behavior using `tokio_test` polling utilities.

### Memory Layout Validation (L76-93, L197-214)
- `join_size` (L77-93): Validates future size for normal join mode (32 bytes single, 48 bytes double on 64-bit)
- `join_size_biased` (L198-214): Validates future size for biased mode (24 bytes single, 40 bytes double on 64-bit)

### Cooperative Scheduling Tests (L95-194)
Helper functions:
- `non_cooperative_task` (L95-108): Consumes full task budget by acquiring 128 permits across 5 iterations
- `poor_little_task` (L110-119): Simple task that acquires 5 permits sequentially

Critical scheduling validation:
- `join_does_not_allow_tasks_to_starve` (L122-133): Ensures fair scheduling despite budget exhaustion
- `a_different_future_is_polled_first_every_time_poll_fn_is_polled` (L136-163): Validates round-robin polling order in normal mode
- `futures_are_polled_in_order_in_biased_mode` (L166-194): Validates sequential polling in biased mode

### Edge Cases
- `empty_join` (L218-221): Tests zero-argument join macro
- `join_into_future` (L224-236): Tests IntoFuture trait integration with custom `NotAFuture` struct
- `caller_names_const_count` (L243-256): Regression test ensuring macro's internal `COUNT` constant doesn't shadow user variables

## Dependencies
- `tokio::sync::{oneshot, Semaphore}` (L14): For coordination and rate limiting
- `tokio_test` (L15): For manual polling and assertion utilities  
- `futures::future` (L78, 199): For ready futures in size tests

## Architecture Notes
Tests validate both execution correctness and implementation details like memory layout. The biased vs normal mode distinction is consistently tested across syntax variations. Cooperative scheduling tests use semaphores to create realistic contention scenarios.
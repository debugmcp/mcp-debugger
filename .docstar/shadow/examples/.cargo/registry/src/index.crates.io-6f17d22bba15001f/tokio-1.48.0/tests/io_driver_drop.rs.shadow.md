# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/io_driver_drop.rs
@source-hash: f4522b82247909d8
@generated: 2026-02-09T18:12:14Z

## Purpose
Test file for Tokio's I/O driver behavior during runtime shutdown scenarios. Validates that TCP operations properly handle runtime drops and that pending tasks are correctly woken when the runtime is dropped.

## Test Functions
- `tcp_doesnt_block()` (L8-29): Tests that TCP operations fail immediately when runtime is dropped before awaiting
- `drop_wakes()` (L31-55): Tests that pending TCP operations are properly woken when runtime is dropped
- `rt()` (L57-62): Helper function creating a current-thread runtime with all features enabled

## Architecture & Pattern
Uses the test pattern of:
1. Create runtime and enter its context
2. Create non-blocking TCP listener within runtime context  
3. Drop runtime at specific timing
4. Spawn async task that attempts TCP operation
5. Assert expected behavior (immediate failure vs. proper wakeup)

## Dependencies
- `tokio::net::TcpListener`: Async TCP listener wrapper
- `tokio::runtime`: Runtime builder and management
- `tokio_test`: Test utilities for async task polling and assertions

## Key Behaviors Tested
- Runtime drop before task execution causes immediate error (L22-28)
- Runtime drop during task suspension properly wakes pending tasks (L49-54)
- TCP listeners created in runtime context maintain proper lifecycle semantics

## Platform Constraints
- Disabled on WASI (no socket support)
- Ignored under Miri (no socket support)
- Uses localhost binding on ephemeral ports for isolation
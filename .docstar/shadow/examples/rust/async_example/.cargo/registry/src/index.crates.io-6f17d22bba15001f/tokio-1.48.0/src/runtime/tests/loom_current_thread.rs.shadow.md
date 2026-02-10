# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/tests/loom_current_thread.rs
@source-hash: e75612f6d3e1ed36
@generated: 2026-02-09T18:03:15Z

## Loom-based Concurrency Tests for Current Thread Runtime

This file contains Loom concurrency model tests specifically for Tokio's current thread runtime scheduler. Loom is a model checker for Rust programs that systematically explores different interleavings to detect data races and other concurrency bugs.

### Primary Purpose
Tests the current thread runtime's behavior under concurrent access scenarios, focusing on polling efficiency, waker management, and task scheduling invariants.

### Key Test Functions

**`assert_at_most_num_polls()` (L14-34)**
- Helper function that verifies a future isn't polled more than expected times
- Spawns a task that yields 12 times before completion
- Uses `BlockedFuture` to track poll counts through atomic counter
- Critical for validating runtime efficiency

**`block_on_num_polls()` (L36-68)** 
- Main test verifying poll count limits when multiple threads compete for runtime access
- Expects at most 4 polls due to specific scheduling points (detailed in comments L39-53)
- Creates 3 threads sharing same runtime instance to test concurrent `block_on` calls
- Models race conditions around parker stealing and task scheduling

**`assert_no_unnecessary_polls()` (L71-107)**
- Tests that futures aren't over-polled after waking
- Uses `ResetFuture` to track pending counts
- Validates woken state resets correctly after outer future polls
- Expects at most 1 pending poll per future

**`drop_jh_during_schedule()` (L109-161)**
- Tests join handle dropping during task scheduling
- Custom waker implementation with reference counting (L111-123)
- Validates waker cleanup when join handle dropped concurrently with scheduling
- Uses abort handle to maintain task reference count during test

### Key Structures

**`BlockedFuture` (L163-179)**
- Wrapper around oneshot receiver that counts polls via atomic counter
- Increments `num_polls` on each poll before delegating to inner receiver

**`ResetFuture` (L181-198)**  
- Similar to `BlockedFuture` but only counts pending polls
- Used to test waker reset behavior after polling

### Dependencies
- Uses Loom's thread and sync primitives for model checking
- Relies on Tokio's current thread runtime builder and task spawning
- Integrates with oneshot channels for coordination

### Critical Invariants
- Current thread runtime should not over-poll futures under concurrent access
- Waker reference counts must be properly managed during concurrent operations  
- Parker stealing scenarios should be bounded in poll attempts
- Futures should not be unnecessarily re-polled after waking
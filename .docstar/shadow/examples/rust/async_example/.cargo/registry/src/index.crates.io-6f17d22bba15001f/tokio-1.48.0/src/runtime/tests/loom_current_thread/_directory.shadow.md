# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/tests/loom_current_thread/
@generated: 2026-02-09T18:16:06Z

## Overall Purpose

This directory contains Loom-based concurrency tests specifically for Tokio's current-thread runtime scheduler. It uses deterministic model checking to verify the correctness of async scheduling primitives under various execution interleavings, focusing on single-threaded runtime behavior.

## Key Components

**Test Files:**
- `yield_now.rs` - Tests the `yield_now()` function's parking and rescheduling behavior

**Core Testing Pattern:**
- Utilizes Loom's model checker for deterministic concurrency testing
- Tests run with limited permutations to manage state space explosion
- Focuses on current-thread runtime scheduler (single-threaded execution model)
- Verifies internal runtime metrics like park count tracking

## Public API Surface

**Main Entry Points:**
- `yield_calls_park_before_scheduling_again()` - Primary test verifying yield behavior
- `mk_runtime()` - Helper for creating test runtime instances

**Testing Infrastructure:**
- Loom model checking framework integration
- Current-thread runtime builder configuration
- Park count verification mechanisms

## Internal Organization and Data Flow

**Test Execution Flow:**
1. Create current-thread runtime using `mk_runtime()`
2. Spawn async tasks within Loom's model checking environment
3. Execute yield operations and capture runtime state
4. Verify invariants about scheduler behavior (park counts, thread affinity)

**State Verification:**
- Thread ID tracking to handle potential thread migration
- Park count increments to verify actual yielding occurred
- Runtime scheduler state consistency checks

## Important Patterns and Conventions

**Loom Integration:**
- Uses `loom::model` for deterministic execution exploration
- Limited permutation counts to balance coverage and performance
- Thread-local state tracking for verification

**Runtime Testing:**
- Current-thread scheduler focus (single-threaded model)
- Internal metric verification (park counts)
- Async task spawning and yield point testing

**Architectural Significance:**
This test suite ensures that Tokio's current-thread runtime correctly implements cooperative multitasking primitives, particularly that `yield_now()` properly parks the thread before allowing other tasks to execute. The Loom-based approach provides confidence that the scheduler behaves correctly under all possible execution interleavings in single-threaded scenarios.
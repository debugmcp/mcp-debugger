# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/tests/queue.rs
@source-hash: 943db81039db14b4
@generated: 2026-02-09T18:03:20Z

## Purpose
Test module for Tokio's multi-threaded runtime scheduler queue implementation, focusing on work stealing, overflow behavior, and concurrent access patterns.

## Key Testing Components

### Test Utility Macros & Functions
- **`assert_metrics` macro (L8-24)**: Validates scheduler metrics on platforms with 64-bit atomic support. Checks specific metric fields against expected values using relaxed ordering.
- **`new_stats` function (L26-29)**: Factory function creating fresh `Stats` instances with new worker metrics for test isolation.
- **`normal_or_miri` function (L147-153)**: Conditional constant selection for different test environments - reduces test parameters under Miri (Rust's experimental MIR interpreter).

### Core Queue Capacity Tests
- **`fits_256_one_at_a_time` (L31-49)**: Validates local queue can hold exactly 256 tasks when pushed individually. Ensures no overflow to injection queue.
- **`fits_256_all_at_once` (L51-66)**: Tests bulk insertion of 256 tasks via `push_back(drain)` operation. Verifies complete retrieval.
- **`fits_256_all_in_chunks` (L68-87)**: Tests chunked insertion pattern (10+100+46+100 tasks) totaling 256. Validates queue handles variable chunk sizes.

### Overflow Behavior Tests  
- **`overflow` (L89-113)**: Tests queue overflow at 257 tasks. Validates one task overflows to injection queue and metrics track overflow count correctly.

### Work Stealing Tests
- **`steal_batch` (L115-145)**: Tests basic work stealing between two local queues. Validates steal operation transfers correct number of tasks and updates steal metrics.

### Stress Testing
- **`stress1` (L155-216)**: Multi-threaded stress test with concurrent pushing, popping, and stealing across multiple iterations. Uses configurable constants for different test environments.
- **`stress2` (L218-273)**: High-volume stress test (up to 1M tasks) with periodic stealing and overflow handling. Tests sustained concurrent operations.

## Dependencies & Architecture
- Imports from `crate::runtime::scheduler::multi_thread::{queue, Stats}` for core queue functionality
- Uses `super::unowned(async {})` to create test tasks
- Leverages `RefCell<Vec<_>>` to simulate injection queue behavior
- Conditional compilation via `cfg_unstable_metrics!` for metric assertions
- Thread-based concurrency testing with `thread::spawn` and synchronization

## Critical Patterns
- Local queue capacity is exactly 256 tasks before overflow
- Work stealing transfers tasks in batches, not individually  
- Overflow tasks go to injection queue for global access
- Metrics tracking requires 64-bit atomic support
- Test parameters scale down significantly under Miri for performance

## Key Invariants
- Total task count is preserved across all operations (push, pop, steal, overflow)
- Queue operations are lock-free and thread-safe
- Stealing operations maintain work distribution balance
- Overflow behavior is deterministic and measurable
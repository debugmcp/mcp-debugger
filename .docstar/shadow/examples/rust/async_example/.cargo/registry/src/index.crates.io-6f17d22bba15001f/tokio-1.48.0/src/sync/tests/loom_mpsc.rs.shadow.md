# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/tests/loom_mpsc.rs
@source-hash: 3716995799176d80
@generated: 2026-02-09T18:03:24Z

## Purpose
Loom-based concurrency testing module for Tokio's MPSC (Multi-Producer Single-Consumer) channel implementation. Uses Loom's deterministic model checker to verify channel behavior under various concurrent scenarios and race conditions.

## Key Dependencies
- `crate::sync::mpsc` - Tokio's MPSC channel implementation being tested
- `loom` - Deterministic concurrency testing framework for detecting race conditions
- `tokio_test::assert_ok` - Test assertion utilities

## Test Functions

### Channel Closing Tests
- `closing_tx()` (L9-25): Tests bounded channel behavior when transmitter is dropped - verifies receiver gets pending message then returns None
- `closing_unbounded_tx()` (L27-43): Same test but for unbounded channels
- `closing_bounded_rx()` (L45-57): Tests that transmitters detect receiver closure via `closed()` method
- `closing_unbounded_rx()` (L86-98): Same receiver closure test for unbounded channels

### Concurrent Closing and Sending
- `closing_and_sending()` (L59-84): Complex 3-thread scenario testing race between sending, closing detection, and receiving with Arc-wrapped transmitter

### Transmitter Dropping Tests  
- `dropping_tx()` (L100-116): Tests that receiver returns None when all transmitter clones are dropped (bounded)
- `dropping_unbounded_tx()` (L118-134): Same dropping test for unbounded channels

### Advanced Concurrency Tests
- `try_recv()` (L136-190): Complex test using semaphore to coordinate concurrent try_recv/try_send operations
  - Uses nested `Context` struct (L146-150) with semaphore, transmitter, and mutex-wrapped receiver
  - `run()` function (L152-160) implements the coordinated send/receive cycle
  - Tests PERMITS=2, TASKS=2, CYCLES=1 configuration

### Channel State Tests
- `len_nonzero_after_send()` (L192-207): Verifies channel length reporting after concurrent sends
- `nonempty_after_send()` (L209-224): Verifies `is_empty()` method accuracy after concurrent sends

## Testing Patterns
- All tests wrapped in `loom::model()` for deterministic execution exploration
- Heavy use of `thread::spawn()` for concurrent scenarios  
- `block_on()` for async operation execution in test context
- Consistent pattern of send → receive → assert for state verification
- Arc/clone patterns for sharing transmitters across threads

## Critical Invariants Tested
- Channel closure semantics (transmitter vs receiver initiated)
- Message delivery guarantees during concurrent operations
- State reporting accuracy (`len()`, `is_empty()`) under concurrency
- Proper None return when all transmitters dropped
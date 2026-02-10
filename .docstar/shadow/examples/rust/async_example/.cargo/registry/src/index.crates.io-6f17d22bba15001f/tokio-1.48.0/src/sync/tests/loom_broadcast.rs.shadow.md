# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/tests/loom_broadcast.rs
@source-hash: b2c6f138707fc389
@generated: 2026-02-09T18:03:22Z

## Purpose
Loom-based concurrency tests for Tokio's broadcast channel implementation. Uses Loom's model checker to systematically explore thread interleavings and detect race conditions, memory leaks, and other concurrency bugs in broadcast channel operations.

## Key Components

### Test Functions
- `broadcast_send` (L9-47): Tests concurrent sending from multiple threads with message counting and lag handling
- `broadcast_two` (L50-93): Validates dual receiver scenario with Arc values for memory leak detection  
- `broadcast_wrap` (L95-142): Tests channel buffer wraparound behavior with lag detection
- `drop_rx` (L144-180): Verifies receiver drop behavior doesn't affect other receivers
- `drop_multiple_rx_with_overflow` (L182-207): Stress tests receiver drops during channel overflow

### Dependencies
- `crate::sync::broadcast`: Core broadcast channel implementation being tested
- `loom`: Model checker providing deterministic concurrency testing
- `tokio_test`: Assertion macros for async testing
- `loom::sync::Arc`: Atomic reference counting for shared ownership across threads

## Architecture Patterns

### Loom Model Testing
All tests wrapped in `loom::model()` to enable systematic exploration of execution paths. Uses `loom::thread::spawn()` and `block_on()` for controlled async execution.

### Error Handling Strategy
Tests explicitly handle `RecvError` variants:
- `Closed`: Expected when sender is dropped
- `Lagged(n)`: Channel overflow, adds lagged count to message totals

### Memory Safety Validation
`broadcast_two` uses `Arc<&'static str>` values (L53) to detect memory leaks through Loom's tracking.

### Concurrency Patterns
- Multiple senders sharing transmitter via `Arc::clone()` (L13-14)
- Receivers created via `tx.subscribe()` (L54, L99)
- Coordinated thread joins to ensure completion (L44-45, L90-91, etc.)

## Critical Invariants
- Message count accuracy despite race conditions and channel overflow
- Proper channel closure semantics when all senders dropped
- No memory leaks in multi-receiver scenarios
- Receiver independence (one drop doesn't affect others)
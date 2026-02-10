# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/tests/loom_oneshot.rs
@source-hash: 0a7df0b6d54aea72
@generated: 2026-02-09T18:03:24Z

## Purpose
Loom-based concurrency tests for Tokio's oneshot channel implementation. Uses the Loom model checker to verify thread-safe behavior under various concurrent scenarios and detect potential race conditions.

## Key Test Functions

### `smoke` (L8-20)
Basic smoke test verifying oneshot channel functionality. Creates channel, sends value from spawned thread, receives on main thread.

### `changing_rx_task` (L22-56)
Tests receiver task switching scenarios. Polls receiver once to potentially park the task, then continues with a new task if needed. Verifies proper waker management when receiver tasks change.

### `try_recv_close` (L58-70)
Regression test for GitHub issue #4225. Tests calling `try_recv()` after `close()` to ensure no panic or undefined behavior occurs.

### `recv_closed` (L72-85)
Another regression test for issue #4225. Tests awaiting a closed receiver to verify proper handling of closed state.

### `checking_tx_send_ok_not_drop` (L142-187)
Complex test ensuring proper drop behavior when send fails. Uses thread-local state to verify that messages are properly forgotten (not dropped) in sender thread when send returns error.

## Helper Structures

### `OnClose` (L93-112)
Custom future wrapper that polls `oneshot::Sender::closed()` and returns boolean indicating if poll completed. Used in `changing_tx_task` test.

### `Msg` (L151-163)
Test struct with custom Drop implementation that asserts it's only dropped in receiver thread context, used to verify proper error handling semantics.

## Dependencies
- `crate::sync::oneshot` - The oneshot channel implementation being tested
- `loom::*` - Loom model checker for concurrent testing
- Standard library futures and task primitives

## Test Patterns
- All tests use `loom::model()` wrapper for deterministic concurrency testing
- Tests spawn threads to simulate concurrent sender/receiver scenarios
- Uses `block_on` for synchronous future execution in test context
- Regression tests specifically target known GitHub issues

## Notable Architectural Decisions
- Tests are isolated to loom environment for reproducible concurrency verification
- Custom preemption bounds used in complex scenarios (L166)
- Thread-local storage used to track execution context for drop verification
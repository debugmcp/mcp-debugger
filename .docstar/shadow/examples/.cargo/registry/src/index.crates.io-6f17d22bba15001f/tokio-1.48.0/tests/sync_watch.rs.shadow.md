# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/sync_watch.rs
@source-hash: 8952bf4ffd4e8a17
@generated: 2026-02-09T18:12:41Z

**Purpose**: Comprehensive test suite for Tokio's watch channel implementation, validating single-producer multiple-consumer broadcast behavior, lifecycle management, and cooperative scheduling.

## Core Test Categories

### Basic Receiver Operations (L14-47)
- `single_rx_recv`: Tests fundamental receiver lifecycle - initial pending state, change notifications, and error handling when sender drops
- Validates `changed()` method returns pending until value updates, then resolves to Ok/Err appropriately

### Receiver State Management (L49-138)
- `rx_version_underflow` (L49-56): Guards against version counter underflow when `mark_changed()` called multiple times
- `rx_mark_changed` (L58-105): Tests manual change marking - allows receivers to force notification state independent of actual value changes
- `rx_mark_unchanged` (L107-138): Tests change state reset functionality - receivers can dismiss pending notifications

### Multi-Receiver Scenarios (L140-205)
- `multi_rx` (L140-205): Validates multiple receivers can independently track change state and all get notified simultaneously when sender broadcasts new values
- Tests receiver cloning behavior and independent polling states

### Channel Closure Semantics (L207-290)
- `rx_observes_final_value` (L207-250): Ensures receivers can observe final sent value even after sender drops
- `poll_close` (L252-267): Tests sender's `closed()` future resolves when all receivers drop
- `borrow_and_update` (L269-291): Tests atomic read-and-mark-seen operation

### Sender Management (L293-306)
- `reopened_after_subscribe` (L293-306): Tests channel reopening when new receivers subscribe to closed sender
- Validates `is_closed()` state tracking

### Error Handling (L308-336)
- `send_modify_panic` (L311-336): Tests panic safety in modify operations - ensures partial state changes are preserved even when modifier function panics

### Concurrent Senders (L338-370)
- `multiple_sender` (L338-355): Tests multiple sender handles can independently send values
- `receiver_is_notified_when_last_sender_is_dropped` (L357-370): Validates notification only occurs when all senders drop

### Cooperative Scheduling (L372-452)
- Tests that watch operations yield control in tight loops to prevent blocking the async runtime
- Covers `changed()`, `wait_for()`, and `closed()` methods using `tokio::select!` with `yield_now()`

### Channel State Edge Cases (L454-505)
- Tests behavior when channels close with unseen vs seen values
- `has_changed()` error semantics on closed channels
- `wait_for()` predicate evaluation on closed channels

## Key Dependencies
- `tokio::sync::watch`: Core watch channel implementation
- `tokio_test`: Testing utilities for async task spawning and polling assertions
- `wasm_bindgen_test`: WASM compatibility testing

## Architecture Notes
- Uses `spawn()` wrapper for controlled task polling in non-async tests  
- Extensive use of assertion macros (`assert_pending!`, `assert_ready_ok!`, etc.) for precise async state validation
- Tests validate both immediate synchronous state and eventual async resolution
- Panic tests conditionally compiled for unwinding platforms only
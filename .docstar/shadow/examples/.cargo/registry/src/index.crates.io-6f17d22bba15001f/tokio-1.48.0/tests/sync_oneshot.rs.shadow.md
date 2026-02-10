# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/sync_oneshot.rs
@source-hash: f60df13e3cf887d3
@generated: 2026-02-09T18:12:41Z

## Test Suite for Tokio Oneshot Channel

Comprehensive test suite for `tokio::sync::oneshot` channel functionality, covering synchronous and asynchronous operations, error handling, task management, and state tracking.

### Primary Responsibilities

Tests the complete lifecycle and edge cases of oneshot channels including:
- Basic send/receive operations
- Channel closure scenarios  
- Task waking and polling behaviors
- State introspection methods

### Key Test Categories

#### Basic Operations (L39-60)
- `send_recv()` (L39-52): Synchronous send/receive with task spawning and polling
- `async_send_recv()` (L54-60): Asynchronous send/receive using await syntax

#### Channel Closure Tests (L62-154)
- `close_tx()` (L62-73): Tests receiver behavior when sender is dropped
- `close_rx()` (L75-97): Tests sender behavior when receiver is dropped, includes `poll_closed()` usage
- `explicit_close_poll()` (L111-154): Tests explicit receiver closure with various timing scenarios
- `explicit_close_try_recv()` (L156-181): Tests explicit closure with synchronous receive attempts

#### Error Handling (L183-228)
- `close_try_recv_poll()` (L183-195): Panic test for invalid state transitions
- `close_after_recv()` (L197-205): Tests closure after successful receive
- `try_recv_after_completion()` (L207-216): Tests repeated receive attempts after completion
- `try_recv_after_completion_await()` (L218-228): Similar test using polling interface

#### Task Management (L230-294)
- `drops_tasks()` (L230-244): Validates proper task cleanup and waker reference counting
- `receiver_changes_task()` (L246-269): Tests task switching behavior on receiver side
- `sender_changes_task()` (L271-294): Tests task switching behavior on sender side

#### State Introspection (L296-440)
Tests for `is_terminated()` method:
- `receiver_is_terminated_send()` (L296-318): Termination state during send operations
- `receiver_is_terminated_try_recv()` (L320-341): Termination state during try_recv operations  
- `receiver_is_terminated_drop()` (L343-365): Termination state when sender dropped
- `receiver_is_terminated_rx_close()` (L367-388): Termination state on explicit close

Tests for `is_empty()` method:
- `receiver_is_empty_send()` (L390-403): Empty state during send operations
- `receiver_is_empty_try_recv()` (L405-417): Empty state during try_recv operations
- `receiver_is_empty_drop()` (L419-432): Empty state when sender dropped
- `receiver_is_empty_rx_close()` (L434-440): Empty state on explicit close

### Test Infrastructure

#### Platform Abstraction (L4-11)
Conditional compilation for WASM vs native platforms, aliasing test macros appropriately.

#### Helper Traits (L20-37)
- `AssertSend` (L21-23): Compile-time Send trait verification for channel types
- `SenderExt` (L26-37): Extension trait providing `poll_closed()` method for testing

#### Dependencies
- `tokio_test`: Provides task spawning and assertion macros
- `tokio::sync::oneshot`: Core oneshot channel implementation under test
- Standard futures/async machinery for polling operations

### Testing Patterns

Uses extensive macro-based assertions (`assert_pending!`, `assert_ready!`, etc.) and task spawning for controlled async execution testing. Tests cover both the polling-based Future interface and the synchronous try_recv interface.

Critical focus on task waking behavior, proper cleanup, and state consistency across different usage patterns.
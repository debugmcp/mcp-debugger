# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/sync_mpsc.rs
@source-hash: 67b54be3247a88aa
@generated: 2026-02-09T18:12:43Z

# Tokio MPSC Channel Test Suite

**Primary Purpose**: Comprehensive test suite for tokio's multi-producer, single-consumer (MPSC) channel implementation, covering both bounded and unbounded channels with all channel operations.

## Module Structure

**Platform Compatibility Setup (L1-24)**:
- WASM-specific test attribute handling with conditional compilation
- Support module for stream tests (non-WASM only)

**Panic Safety Assertions (L25-48)**:
- `AssertRefUnwindSafe` trait (L26) and `AssertUnwindSafe` trait (L38) implementations for all MPSC types
- Ensures channel types are panic-safe across async boundaries

## Key Test Categories

### Bounded Channel Core Operations
- **`send_recv_with_buffer()` (L49-71)**: Basic send/receive with permits and try_send
- **`reserve_disarm()` (L73-109)**: Permit reservation, slot management, and wakeup behavior  
- **`async_send_recv_with_buffer()` (L129-142)**: Async send patterns with spawned tasks
- **`start_send_past_cap()` (L172-203)**: Backpressure handling when channel is full

### Unbounded Channel Operations
- **`send_recv_unbounded()` (L212-226)**: Basic unbounded channel operations
- **`async_send_recv_unbounded()` (L361-374)**: Async patterns for unbounded channels

### Batch Operations (`recv_many`)
- **`async_send_recv_many_with_buffer()` (L144-170)**: Bounded channel batch receive
- **`send_recv_many_bounded_capacity()` (L277-317)**: Buffer capacity management during batch ops
- **`send_recv_many_unbounded()` (L228-275)**: Unbounded batch operations with capacity reuse

### Permit System & Reservation
- **`reserve_many_above_cap()` (L546-554)**: Error handling for oversized reservations
- **`reserve_many_zero()` (L576-591)**: Edge case handling for zero-sized reservations
- **`try_reserve_many_full()` (L682-722)**: Complex permit allocation/deallocation patterns

### Channel State Management
- **`recv_close_gets_none_idle()` (L458-467)**: Close behavior on idle channels
- **`dropping_rx_closes_channel()` (L767-778)**: Resource cleanup when receiver is dropped
- **Channel state queries**: `is_closed()`, `is_empty()`, `len()` tests (L1024-1455)

### Error Handling & Edge Cases
- **`try_send_fail()` (L504-523)**: `TrySendError::Full` handling
- **`buffer_gteq_one()` (L205-210)**: Panic test for zero-capacity channels
- **`try_recv_*` tests (L907-985)**: `TryRecvError` scenarios

### Stream Integration
- **`send_recv_stream_*` tests (L111-127, L376-393)**: Integration with tokio-stream

### Synchronous Operations
- **`blocking_recv()` (L817-832)**: Cross-thread blocking operations
- **`recv_timeout()` (L987-1010)**: Timeout-based send operations

### Panic & Resource Management
- **`drop_all_elements_during_panic()` (L457-501)**: Ensures proper cleanup during panics
- **Various drop tests**: Permit cleanup and resource management validation

## Key Implementation Details

**Capacity Management**: Tests verify that `capacity()` decreases with reservations while `max_capacity()` remains constant.

**Wakeup Semantics**: Extensive testing of task wakeup behavior when permits become available or channels close.

**Resource Cleanup**: Validates proper Arc reference counting and element dropping during channel closure.

**Cross-platform**: Conditional compilation handles WASM limitations (no threads, no unwinding).

## Dependencies
- `tokio::sync::mpsc` - Core MPSC implementation
- `tokio_test` - Testing utilities for async task management  
- `tokio_stream` - Stream trait integration (non-WASM)
- `std::sync::Arc` - Reference counting for resource tests
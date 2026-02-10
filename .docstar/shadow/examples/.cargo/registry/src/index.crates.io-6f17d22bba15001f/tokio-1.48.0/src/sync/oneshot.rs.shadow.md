# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/oneshot.rs
@source-hash: cf87378ebc4751b0
@generated: 2026-02-09T18:06:55Z

## Purpose
Tokio's one-shot channel implementation for sending a single message between asynchronous tasks. Provides lock-free, atomic state management for single-use communication channels with proper task waking semantics.

## Core Types

### Sender<T> (L222-226)
Producer handle that sends exactly one value to its paired receiver. Contains:
- `inner`: Optional Arc to shared Inner state
- Conditional tracing spans for instrumentation

Key methods:
- `send(T) -> Result<(), T>` (L595-631): Consumes self, stores value atomically, wakes receiver task
- `closed() -> impl Future` (L700-717): Async method to wait for receiver closure
- `is_closed() -> bool` (L746-751): Synchronous check for receiver status
- `poll_closed(&mut Context) -> Poll<()>` (L793-841): Core polling implementation with task registration

### Receiver<T> (L322-330)
Consumer handle that receives the single value. Implements Future trait directly. Contains:
- `inner`: Optional Arc to shared Inner state  
- Conditional tracing spans for async operation tracking

Key methods:
- `close()` (L920-932): Prevents sender from sending, enables graceful shutdown
- `is_terminated() -> bool` (L988-990): Check if Future has completed
- `is_empty() -> bool` (L1055-1075): Check if channel contains no value
- `try_recv() -> Result<T, TryRecvError>` (L1144-1180): Non-blocking receive attempt
- `blocking_recv() -> Result<T, RecvError>` (L1213-1215): Blocking receive for sync contexts

### Inner<T> (L379-402)
Shared state between sender and receiver using atomic operations:
- `state`: AtomicUsize with bit flags for channel state
- `value`: UnsafeCell<Option<T>> for the transmitted value
- `tx_task`/`rx_task`: Task wakers for sender/receiver notification

Core methods:
- `complete() -> bool` (L1271-1286): Mark value as sent, wake receiver
- `poll_recv(&Context) -> Poll<Result<T, RecvError>>` (L1288-1355): Future polling implementation
- `close() -> State` (L1358-1368): Mark channel as closed, wake sender
- `consume_value() -> Option<T>` (L1379-1381): Unsafe value extraction
- `has_value() -> bool` (L1392-1394): Check value presence

## State Management

### State (L437-556)
Atomic bit field managing channel lifecycle with constants:
- `RX_TASK_SET` (L1446): Receiver task waker is initialized
- `VALUE_SENT` (L1455): Value stored, controls UnsafeCell access safety
- `CLOSED` (L1456): Channel closed by receiver
- `TX_TASK_SET` (L1463): Sender task waker is initialized

State methods provide atomic operations for safe concurrent access patterns.

## Key Functions

### channel<T>() -> (Sender<T>, Receiver<T>) (L470-552)
Creates channel pair with shared Inner state. Includes extensive tracing instrumentation when tokio_unstable feature is enabled.

## Error Types (L332-375)

### RecvError (L340-341)
Returned when sender drops without sending value.

### TryRecvError (L344-351) 
Enum for non-blocking receive failures:
- `Empty`: No value sent yet
- `Closed`: Sender dropped or value already consumed

## Safety & Concurrency

Uses UnsafeCell with atomic state bits to coordinate access between sender/receiver threads. The VALUE_SENT bit ensures only one side accesses the UnsafeCell at a time. Extensive unsafe blocks with safety documentation throughout.

Task waker management ensures proper async runtime integration with cooperative task scheduling and budget tracking via `crate::task::coop::poll_proceed()`.

## Dependencies
- `crate::loom`: Concurrency testing abstractions
- `crate::util::trace`: Tokio tracing integration (conditional)
- Standard library futures/task/atomic primitives
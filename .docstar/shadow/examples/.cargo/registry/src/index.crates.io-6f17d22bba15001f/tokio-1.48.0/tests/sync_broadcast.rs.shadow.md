# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/sync_broadcast.rs
@source-hash: 6503579f5a5be152
@generated: 2026-02-09T18:12:42Z

## Purpose and Scope
Comprehensive test suite for Tokio's broadcast channel synchronization primitive (`tokio::sync::broadcast`). Tests multi-producer, multi-consumer message broadcasting functionality, including channel capacity management, receiver lagging behavior, task coordination, and graceful shutdown scenarios.

## Test Macros (L16-53)
- `assert_recv!` (L16-23): Wrapper for `try_recv()` that panics on error
- `assert_empty!` (L25-33): Verifies receiver queue is empty 
- `assert_lagged!` (L35-44): Asserts receiver lagged by specific message count
- `assert_closed!` (L46-53): Verifies channel is closed

## Trait Implementations (L55-59) 
- `AssertSend`: Compile-time verification that broadcast types implement `Send + Sync`
- Applied to `Sender<i32>`, `Receiver<i32>`, `WeakSender<i32>`

## Core Functionality Tests

### Basic Operations (L61-110)
- `send_try_recv_bounded` (L61-74): Single sender/receiver message flow
- `send_two_recv` (L76-95): Multi-receiver broadcast verification 
- `send_recv_bounded` (L97-110): Async receive with task polling

### Multi-Receiver Coordination (L112-216)
- `send_two_recv_bounded` (L112-149): Two receivers with task waking behavior
- `change_tasks` (L151-166): Task switching on same receiver future
- `send_slow_rx` (L168-216): Complex multi-receiver timing scenarios

### Channel Lifecycle (L217-352)
- `drop_rx_while_values_remain` (L218-231): Resource cleanup verification
- `dropping_tx_notifies_rx` (L324-352): Shutdown notification propagation
- `unconsumed_messages_are_dropped` (L354-367): Memory management validation

### Capacity and Lagging (L233-479)
- `lagging_rx` (L233-263): Receiver lag detection and recovery
- `single_capacity_recvs` (L369-377): Edge case for capacity=1
- `receiver_len_with_lagged` (L461-478): Length reporting with lag

### Error Conditions (L279-291)
- `zero_capacity` (L279-284): Panics on invalid capacity=0
- `capacity_too_big` (L286-291): Panics on excessive capacity
- `panic_in_clone` (L293-322): Clone panic handling during receive

### Resubscription (L484-529)
- `resubscribe_points_to_tail` (L484-505): New receiver positioning
- `resubscribe_lagged` (L507-520): Resubscription with existing lag
- `resubscribe_to_closed_channel` (L522-529): Resubscription after close

### Sender State Management (L531-587)
- `sender_len` (L531-563): Length tracking across multiple receivers
- `sender_len_random` (L565-587): Randomized length verification

### Advanced Scenarios (L589-708)
- `send_in_waker_drop` (L589-641): Deadlock prevention during waker replacement
- `receiver_recv_is_cooperative` (L643-657): Cooperative task yielding
- `broadcast_sender_closed` (L659-674): Sender close detection
- `broadcast_sender_new_must_be_closed` (L710-722): New sender initial state

## Key Dependencies
- `tokio::sync::broadcast`: Core broadcast channel implementation
- `tokio_test::task`: Task spawning and polling utilities
- `tokio_test` assertion macros: Testing-specific assertions
- `futures::task`: Future and waking primitives for advanced tests
- `std::sync::Arc`: Reference counting for memory management tests

## Testing Patterns
- Extensive use of `task::spawn()` for async polling control
- Manual task waking verification with `is_woken()`
- Capacity-based lag testing with varying buffer sizes
- Resource cleanup validation using `Arc::strong_count()`
- Cross-platform compatibility guards for WASM environments

## Helper Function
- `is_closed` (L480-482): Pattern matching utility for `RecvError::Closed`